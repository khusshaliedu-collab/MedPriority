"""Synthetic demo data for MediPriority AI."""
from datetime import datetime, timedelta, timezone
import random
import uuid

random.seed(42)

DEPARTMENTS = ["Emergency Department", "General Medicine", "Cardiology",
               "Pediatrics", "General Surgery", "Orthopedics", "Neurology",
               "Respiratory Medicine"]


def _iso(dt):
    return dt.isoformat()


def demo_users_plain():
    return [
        {"username": "nurse", "password": "nurse123", "role": "nurse",
         "name": "Priya Sharma", "shift": "Morning"},
        {"username": "doctor", "password": "doctor123", "role": "doctor",
         "name": "Dr. Arjun Rao", "shift": "On Call"},
        {"username": "admin", "password": "admin123", "role": "admin",
         "name": "Admin Mehta", "shift": "Day"},
    ]


SAMPLE_CASES = [
    {
        "age": 58, "sex": "male",
        "vitals": {"sbp": 85, "dbp": 55, "heart_rate": 118, "temp_c": 37.1,
                   "spo2": 92, "resp_rate": 24},
        "chief_complaint": "Crushing chest pain radiating to left arm since 30 minutes",
        "conditions": "diabetes, hypertension", "medications": "metformin, amlodipine",
        "true_level": 1, "true_emergency": True, "true_dept": "Cardiology",
    },
    {
        "age": 4, "sex": "female",
        "vitals": {"sbp": 95, "dbp": 60, "heart_rate": 150, "temp_c": 40.1,
                   "spo2": 95, "resp_rate": 44},
        "chief_complaint": "My child is breathing very fast and has high fever",
        "conditions": "", "medications": "",
        "true_level": 2, "true_emergency": True, "true_dept": "Pediatrics",
    },
    {
        "age": 32, "sex": "female",
        "vitals": {"sbp": 118, "dbp": 76, "heart_rate": 88, "temp_c": 37.5,
                   "spo2": 98, "resp_rate": 18},
        "chief_complaint": "Mild stomach pain for two days",
        "conditions": "", "medications": "",
        "true_level": 4, "true_emergency": False, "true_dept": "General Medicine",
    },
    {
        "age": 67, "sex": "male",
        "vitals": {"sbp": 160, "dbp": 95, "heart_rate": 92, "temp_c": 36.9,
                   "spo2": 97, "resp_rate": 18},
        "chief_complaint": "Sudden weakness one side of body and slurred speech",
        "conditions": "hypertension", "medications": "amlodipine",
        "true_level": 1, "true_emergency": True, "true_dept": "Neurology",
    },
    {
        "age": 22, "sex": "male",
        "vitals": {"sbp": 125, "dbp": 80, "heart_rate": 78, "temp_c": 36.8,
                   "spo2": 99, "resp_rate": 16},
        "chief_complaint": "Twisted my ankle playing cricket, swollen",
        "conditions": "", "medications": "",
        "true_level": 5, "true_emergency": False, "true_dept": "Orthopedics",
    },
    {
        "age": 45, "sex": "female",
        "vitals": {"sbp": 110, "dbp": 70, "heart_rate": 105, "temp_c": 38.9,
                   "spo2": 94, "resp_rate": 22},
        "chief_complaint": "High fever and feel very weak since yesterday",
        "conditions": "", "medications": "",
        "true_level": 3, "true_emergency": False, "true_dept": "General Medicine",
    },
    {
        "age": 71, "sex": "male",
        "vitals": {"sbp": 95, "dbp": 60, "heart_rate": 112, "temp_c": 36.5,
                   "spo2": 88, "resp_rate": 28},
        "chief_complaint": "Cannot breathe properly, gasping",
        "conditions": "COPD", "medications": "salbutamol",
        "true_level": 1, "true_emergency": True, "true_dept": "Respiratory Medicine",
    },
    {
        "age": 29, "sex": "female",
        "vitals": {"sbp": 115, "dbp": 72, "heart_rate": 72, "temp_c": 36.7,
                   "spo2": 99, "resp_rate": 15},
        "chief_complaint": "Mild headache for a few hours",
        "conditions": "", "medications": "",
        "true_level": 5, "true_emergency": False, "true_dept": "General Medicine",
    },
]


def generate_queue_patients(count=18):
    """Generate synthetic patients currently in the queue."""
    now = datetime.now(timezone.utc)
    patients = []
    for i in range(count):
        tpl = random.choice(SAMPLE_CASES)
        arrival = now - timedelta(minutes=random.randint(1, 180))
        status = random.choice(["awaiting", "awaiting", "assessed", "in_review"])
        patients.append({
            "id": str(uuid.uuid4()),
            "encounter_id": f"ENC-{1000 + i}",
            "age": tpl["age"] + random.randint(-3, 3),
            "sex": tpl["sex"],
            "arrival_time": _iso(arrival),
            "chief_complaint": tpl["chief_complaint"],
            "conditions": tpl["conditions"],
            "medications": tpl["medications"],
            "vitals": tpl["vitals"],
            "triage_level": tpl["true_level"] if status != "awaiting" else None,
            "department": tpl["true_dept"] if status != "awaiting" else None,
            "status": status,
            "true_emergency": tpl["true_emergency"],
            "true_level": tpl["true_level"],
            "true_dept": tpl["true_dept"],
            "assessment_time_sec": random.randint(35, 85) if status != "awaiting" else None,
            "created_at": _iso(arrival),
        })
    return patients


def generate_eval_dataset(count=400):
    """Generate labeled synthetic data for the evaluation dashboard."""
    rows = []
    for i in range(count):
        tpl = random.choice(SAMPLE_CASES)
        # Add noise
        vitals = {k: v + random.randint(-5, 5) if isinstance(v, (int, float)) else v
                  for k, v in tpl["vitals"].items()}
        rows.append({
            "id": f"EVAL-{i}",
            "age": max(0, tpl["age"] + random.randint(-5, 5)),
            "sex": tpl["sex"],
            "vitals": vitals,
            "chief_complaint": tpl["chief_complaint"],
            "conditions": tpl["conditions"],
            "medications": tpl["medications"],
            "true_level": tpl["true_level"],
            "true_emergency": tpl["true_emergency"],
            "true_dept": tpl["true_dept"],
        })
    return rows


def generate_arrival_log(count=120):
    """Synthetic arrival log for waiting-time simulation."""
    now = datetime.now(timezone.utc).replace(hour=8, minute=0, second=0, microsecond=0)
    arrivals = []
    t = 0
    for i in range(count):
        t += max(1, int(random.expovariate(1 / 4)))  # avg ~4 min between arrivals
        tpl = random.choice(SAMPLE_CASES)
        arrivals.append({
            "patient_id": f"P-{i}",
            "arrival_minute": t,
            "arrival_time": _iso(now + timedelta(minutes=t)),
            "true_level": tpl["true_level"],
            "true_emergency": tpl["true_emergency"],
            # Service time depends on severity
            "service_minutes": max(5, int(random.gauss(15 - tpl["true_level"] * 1.5, 3))),
        })
    return arrivals
