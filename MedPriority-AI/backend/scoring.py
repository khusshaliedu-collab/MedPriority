"""Deterministic rule-based scoring engine (DEMO — not a trained ML model).

Produces a preliminary triage level (1-5) and department recommendation.
Lower level = more urgent.
"""
from typing import Any


DEPARTMENT_KEYWORDS = {
    "Cardiology": ["chest pain", "chest tight", "heart", "palpitation", "cardiac"],
    "Respiratory Medicine": ["cough", "breath", "wheez", "asthma", "pneumonia", "lung"],
    "Neurology": ["headache", "stroke", "numb", "weak", "seizure", "dizzy", "faint", "slurred"],
    "Pediatrics": [],  # applied by age
    "General Surgery": ["appendicitis", "abdomen", "stomach", "bleeding", "wound", "cut", "stab"],
    "Orthopedics": ["fracture", "broken", "bone", "joint", "knee", "sprain", "ankle"],
    "Emergency Department": ["unconscious", "unresponsive", "trauma", "accident"],
    "General Medicine": ["fever", "weak", "fatigue", "nausea", "vomit"],
}


def _val(v):
    if v is None or v == "" or v == "unknown":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def score_patient(payload: dict[str, Any]) -> dict[str, Any]:
    """Return preliminary level, department, confidence note, contributions."""
    vitals = payload.get("vitals", {}) or {}
    complaint = (payload.get("chief_complaint") or "").lower()
    age = _val(payload.get("age"))
    conditions = (payload.get("conditions") or "").lower()

    contributions: list[dict[str, Any]] = []
    score = 0.0  # higher score = more urgent

    spo2 = _val(vitals.get("spo2"))
    hr = _val(vitals.get("heart_rate"))
    sbp = _val(vitals.get("sbp"))
    temp = _val(vitals.get("temp_c"))
    rr = _val(vitals.get("resp_rate"))

    def add(points: float, reason: str):
        nonlocal score
        score += points
        contributions.append({"points": points, "reason": reason})

    # Vitals contributions
    if spo2 is not None:
        if spo2 < 90: add(40, f"SpO2 {spo2}% (severe hypoxia)")
        elif spo2 < 94: add(20, f"SpO2 {spo2}% (mild hypoxia)")
    if sbp is not None:
        if sbp < 90: add(35, f"SBP {sbp} mmHg (hypotension)")
        elif sbp > 180: add(15, f"SBP {sbp} mmHg (hypertension)")
    if hr is not None:
        if hr < 50: add(25, f"HR {hr} bpm (bradycardia)")
        elif hr > 120: add(15, f"HR {hr} bpm (tachycardia)")
    if temp is not None:
        if temp >= 39: add(10, f"Fever {temp}°C")
        if temp >= 40: add(10, f"Hyperpyrexia {temp}°C")
    if rr is not None:
        if rr > 25: add(15, f"RR {rr}/min (tachypnea)")
        if rr < 10: add(20, f"RR {rr}/min (hypoventilation)")

    # Age risk
    if age is not None:
        if age >= 70: add(8, f"Age {int(age)} (elderly)")
        if age < 2: add(10, f"Age {int(age)} (infant)")

    # Comorbidity risk
    for c in ["diabetes", "cardiac", "heart", "copd", "cancer", "renal", "stroke"]:
        if c in conditions:
            add(5, f"Known comorbidity: {c}")

    # Complaint severity words (demo)
    severity_words = {
        "severe": 15, "worst": 15, "crushing": 20, "sudden": 10, "unbearable": 15,
        "very bad": 10, "cannot": 10, "can't": 10, "high fever": 10, "weakness": 5,
    }
    for word, pts in severity_words.items():
        if word in complaint:
            add(pts, f"Complaint keyword: '{word}'")

    # Map total score to level (lower = more urgent)
    if score >= 50:
        level = 2
    elif score >= 30:
        level = 3
    elif score >= 15:
        level = 4
    else:
        level = 5

    # Department recommendation
    dept = "General Medicine"
    if age is not None and age < 14:
        dept = "Pediatrics"
    else:
        for d, keywords in DEPARTMENT_KEYWORDS.items():
            for kw in keywords:
                if kw in complaint:
                    dept = d
                    break
            if dept != "General Medicine":
                break

    # Deterministic "confidence" — a demo heuristic only
    # Reflects how close score is to a decision boundary. NOT a calibrated probability.
    boundaries = [15, 30, 50]
    distances = [abs(score - b) for b in boundaries]
    conf_raw = min(distances) if distances else 0
    confidence_demo = min(0.95, 0.5 + conf_raw / 50)

    return {
        "level": level,
        "department": dept,
        "score": round(score, 2),
        "contributions": contributions,
        "confidence_demo": round(confidence_demo, 2),
        "confidence_note": "DEMO rule-based engine — not a calibrated clinical model.",
    }
