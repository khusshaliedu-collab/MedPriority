from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta

from safety_rules import evaluate_safety_rules
from scoring import score_patient
from evaluation import predict_triage, evaluate_dataset, simulate_waiting_time
from seed_data import (
    demo_users_plain, generate_queue_patients,
    generate_eval_dataset, generate_arrival_log, DEPARTMENTS,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "medipriority-demo-secret-change-me")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 12

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="MediPriority AI")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("medipriority")


# ========================= AUTH =========================
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user: dict) -> str:
    payload = {
        "sub": user["username"],
        "role": user["role"],
        "name": user["name"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def current_user(creds: HTTPAuthorizationCredentials = Depends(security)):
    if not creds:
        raise HTTPException(status_code=401, detail="Missing authentication token")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload


def require_role(*roles):
    async def _check(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return user
    return _check


class LoginIn(BaseModel):
    username: str
    password: str


@api.post("/auth/login")
async def login(body: LoginIn):
    doc = await db.users.find_one({"username": body.username}, {"_id": 0})
    if not doc or not verify_pw(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = make_token(doc)
    return {
        "token": token,
        "user": {"username": doc["username"], "role": doc["role"],
                 "name": doc["name"], "shift": doc.get("shift", "")},
    }


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


# ========================= PATIENTS / TRIAGE =========================
class Vitals(BaseModel):
    model_config = ConfigDict(extra="ignore")
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    heart_rate: Optional[float] = None
    temp_c: Optional[float] = None
    spo2: Optional[float] = None
    resp_rate: Optional[float] = None


class TriageRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    age: Optional[float] = None
    sex: Optional[str] = None
    chief_complaint: str = ""
    conditions: Optional[str] = ""
    medications: Optional[str] = ""
    notes: Optional[str] = ""
    vitals: Vitals = Field(default_factory=Vitals)
    arrival_time: Optional[str] = None


@api.post("/triage/assess")
async def triage_assess(body: TriageRequest, user=Depends(current_user)):
    payload = body.model_dump()
    payload["vitals"] = {k: v for k, v in payload["vitals"].items()}
    result = predict_triage(payload)

    encounter_id = f"ENC-{uuid.uuid4().hex[:8].upper()}"
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "encounter_id": encounter_id,
        "age": payload.get("age"),
        "sex": payload.get("sex"),
        "chief_complaint": payload.get("chief_complaint"),
        "conditions": payload.get("conditions"),
        "medications": payload.get("medications"),
        "notes": payload.get("notes"),
        "vitals": payload.get("vitals"),
        "triage_level": result["predicted_level"],
        "department": result["department"],
        "is_emergency_pred": result["is_emergency_pred"],
        "triggered_rules": result["safety"]["triggered_rules"],
        "red_flags": result["safety"]["red_flags"],
        "data_quality_warnings": result["safety"]["data_quality_warnings"],
        "contributions": result["model"]["contributions"],
        "confidence_demo": result["model"]["confidence_demo"],
        "abstain": result["abstain"],
        "abstain_reason": result["abstain_reason"],
        "recommended_action": result["recommended_action"],
        "status": "awaiting_review" if result["abstain"] else "assessed",
        "assessed_by": user["sub"],
        "assessed_at": now,
        "arrival_time": payload.get("arrival_time") or now,
        "doctor_review": None,
    }
    await db.assessments.insert_one(record)
    record.pop("_id", None)
    return {"encounter_id": encounter_id, "result": result, "record": record}


@api.get("/patients")
async def list_patients(status_filter: Optional[str] = None,
                       level: Optional[int] = None,
                       department: Optional[str] = None,
                       user=Depends(current_user)):
    q: dict = {}
    if status_filter: q["status"] = status_filter
    if level: q["triage_level"] = level
    if department: q["department"] = department
    docs = await db.assessments.find(q, {"_id": 0}).sort("assessed_at", -1).to_list(500)
    return docs


@api.get("/patients/{encounter_id}")
async def get_patient(encounter_id: str, user=Depends(current_user)):
    doc = await db.assessments.find_one({"encounter_id": encounter_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return doc


class DoctorReview(BaseModel):
    final_level: int
    final_department: str
    notes: str = ""


@api.post("/patients/{encounter_id}/review")
async def doctor_review(encounter_id: str, body: DoctorReview,
                       user=Depends(require_role("doctor", "admin"))):
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "doctor_review": {
            "final_level": body.final_level,
            "final_department": body.final_department,
            "notes": body.notes,
            "reviewed_by": user["sub"],
            "reviewed_at": now,
        },
        "status": "reviewed",
    }
    res = await db.assessments.update_one({"encounter_id": encounter_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return {"ok": True}


# ========================= DASHBOARD =========================
@api.get("/dashboard/summary")
async def dashboard_summary(user=Depends(current_user)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    total = await db.assessments.count_documents({"assessed_at": {"$gte": today_start}})
    awaiting = await db.assessments.count_documents({"status": "awaiting_review"})
    critical = await db.assessments.count_documents({"triage_level": {"$lte": 2}})
    needs_review = await db.assessments.count_documents({"abstain": True, "status": "awaiting_review"})

    # Avg assessment time (demo: fixed window)
    all_recent = await db.assessments.find({}, {"_id": 0, "assessed_at": 1, "arrival_time": 1}).to_list(500)
    times = []
    for d in all_recent:
        try:
            a = datetime.fromisoformat(d["arrival_time"])
            b = datetime.fromisoformat(d["assessed_at"])
            times.append((b - a).total_seconds())
        except Exception:
            pass
    avg_sec = int(sum(times) / len(times)) if times else 55

    # Simulate emergency recall from last eval (seeded)
    eval_doc = await db.evaluation_cache.find_one({"_id": "latest"}, {"_id": 0})
    recall_display = eval_doc.get("emergency", {}).get("recall_display") if eval_doc else None

    return {
        "total_today": total,
        "awaiting": awaiting,
        "critical": critical,
        "needs_review": needs_review,
        "avg_assessment_sec": max(45, min(avg_sec, 90)),
        "emergency_recall": recall_display,
        "is_demo": True,
    }


@api.get("/dashboard/queue")
async def dashboard_queue(user=Depends(current_user)):
    docs = await db.assessments.find({}, {"_id": 0}).sort("assessed_at", -1).limit(30).to_list(30)
    return docs


# ========================= EVALUATION =========================
@api.get("/evaluation/metrics")
async def evaluation_metrics(user=Depends(current_user)):
    cached = await db.evaluation_cache.find_one({"_id": "latest"}, {"_id": 0})
    if cached:
        return cached
    raise HTTPException(status_code=404, detail="No evaluation data")


@api.post("/evaluation/run")
async def evaluation_run(user=Depends(require_role("admin", "doctor"))):
    dataset = generate_eval_dataset(400)
    metrics = evaluate_dataset(dataset)
    metrics["_id"] = "latest"
    metrics["generated_at"] = datetime.now(timezone.utc).isoformat()
    metrics["is_demo"] = True
    await db.evaluation_cache.replace_one({"_id": "latest"}, metrics, upsert=True)
    metrics.pop("_id", None)
    return metrics


# ========================= WAITING-TIME SIMULATION =========================
class SimRequest(BaseModel):
    num_doctors: int = 2


@api.post("/simulation/waiting-time")
async def simulation_waiting_time(body: SimRequest, user=Depends(current_user)):
    arrivals = generate_arrival_log(120)
    return simulate_waiting_time(arrivals, num_doctors=body.num_doctors)


# ========================= META =========================
@api.get("/meta/departments")
async def meta_departments():
    return {"departments": DEPARTMENTS}


@api.get("/")
async def root():
    return {"service": "MediPriority AI", "status": "ok", "demo_mode": True}


# ========================= STARTUP: SEED =========================
@app.on_event("startup")
async def startup():
    # Seed users (idempotent)
    for u in demo_users_plain():
        existing = await db.users.find_one({"username": u["username"]})
        if not existing:
            await db.users.insert_one({
                "username": u["username"],
                "password_hash": hash_pw(u["password"]),
                "role": u["role"],
                "name": u["name"],
                "shift": u["shift"],
            })

    # Seed queue if empty
    count = await db.assessments.count_documents({})
    if count == 0:
        seeds = generate_queue_patients(18)
        for p in seeds:
            vitals = p["vitals"]
            payload = {
                "age": p["age"], "sex": p["sex"], "chief_complaint": p["chief_complaint"],
                "conditions": p["conditions"], "medications": p["medications"],
                "vitals": vitals,
            }
            result = predict_triage(payload)
            await db.assessments.insert_one({
                "id": p["id"],
                "encounter_id": p["encounter_id"],
                "age": p["age"], "sex": p["sex"],
                "chief_complaint": p["chief_complaint"],
                "conditions": p["conditions"], "medications": p["medications"],
                "notes": "", "vitals": vitals,
                "triage_level": result["predicted_level"],
                "department": result["department"],
                "is_emergency_pred": result["is_emergency_pred"],
                "triggered_rules": result["safety"]["triggered_rules"],
                "red_flags": result["safety"]["red_flags"],
                "data_quality_warnings": result["safety"]["data_quality_warnings"],
                "contributions": result["model"]["contributions"],
                "confidence_demo": result["model"]["confidence_demo"],
                "abstain": result["abstain"],
                "abstain_reason": result["abstain_reason"],
                "recommended_action": result["recommended_action"],
                "status": p["status"] if p["status"] != "awaiting" else "assessed",
                "assessed_by": "seed",
                "assessed_at": p["created_at"],
                "arrival_time": p["arrival_time"],
                "doctor_review": None,
            })

    # Cache initial evaluation
    cached = await db.evaluation_cache.find_one({"_id": "latest"})
    if not cached:
        dataset = generate_eval_dataset(400)
        metrics = evaluate_dataset(dataset)
        metrics["_id"] = "latest"
        metrics["generated_at"] = datetime.now(timezone.utc).isoformat()
        metrics["is_demo"] = True
        await db.evaluation_cache.insert_one(metrics)

    log.info("MediPriority AI started with demo seed data")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
