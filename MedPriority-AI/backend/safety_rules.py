"""Hard-coded safety rules — MUST run independently of the scoring engine.

NOTE: Thresholds in this module are PLACEHOLDER values for a demo. Clinician
approval is REQUIRED before any real deployment.
"""
from typing import Any


# Keywords for configured emergency complaints (demo set, replaceable)
EMERGENCY_KEYWORDS = {
    "stroke": ["face droop", "slurred speech", "one side weak", "sudden weakness",
               "cannot speak", "can't speak", "arm weak", "paralysis", "stroke"],
    "cardiac": ["chest pain", "chest tight", "chest tightness", "crushing chest",
                "chest pressure", "heart attack", "radiating arm pain", "jaw pain with sweating"],
    "respiratory": ["cannot breathe", "can't breathe", "breathless", "severe shortness of breath",
                    "gasping", "struggling to breathe", "blue lips", "cyanosis",
                    "breathing very fast", "fast breathing", "respiratory distress"],
    "bleeding": ["heavy bleeding", "bleeding profusely", "losing blood", "massive bleeding",
                 "vomiting blood", "coughing blood", "blood in stool"],
    "consciousness": ["unresponsive", "not responding", "unconscious", "fainted",
                      "passed out", "confused", "altered mental", "cannot wake", "seizure",
                      "convulsion", "fitting"],
    "trauma": ["head injury", "severe trauma", "major accident", "crushing injury",
               "deep wound", "stab", "gunshot"],
    "pediatric_distress": ["child not responding", "baby not feeding", "limp child",
                           "child seizure", "child breathing fast"],
    "anaphylaxis": ["swelling throat", "throat closing", "allergic reaction severe",
                    "anaphylaxis", "tongue swelling"],
}


def _val(v):
    """Return float or None, treating 'unknown' sentinels as None."""
    if v is None or v == "" or v == "unknown":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def evaluate_safety_rules(payload: dict[str, Any]) -> dict[str, Any]:
    """Run all hard-coded safety rules. Returns dict with triggered rules,
    forced minimum triage level, red flags, and data-quality warnings.

    Lower triage level = more urgent (1 = resuscitation).
    """
    triggered: list[dict[str, str]] = []
    red_flags: list[str] = []
    dq_warnings: list[str] = []
    forced_min_level = 5  # start non-urgent, only decreases (more urgent)

    vitals = payload.get("vitals", {}) or {}
    complaint = (payload.get("chief_complaint") or "").lower()
    age = _val(payload.get("age"))

    spo2 = _val(vitals.get("spo2"))
    hr = _val(vitals.get("heart_rate"))
    sbp = _val(vitals.get("sbp"))
    dbp = _val(vitals.get("dbp"))
    temp = _val(vitals.get("temp_c"))
    rr = _val(vitals.get("resp_rate"))

    def trigger(name: str, reason: str, min_level: int, flag: str | None = None):
        nonlocal forced_min_level
        triggered.append({"rule": name, "reason": reason, "forced_level": str(min_level)})
        if flag:
            red_flags.append(flag)
        if min_level < forced_min_level:
            forced_min_level = min_level

    # Plausibility / data-quality checks (do NOT silently correct)
    if sbp is not None and (sbp <= 0 or sbp > 300):
        dq_warnings.append(f"Systolic BP implausible: {sbp}")
    if dbp is not None and (dbp <= 0 or dbp > 200):
        dq_warnings.append(f"Diastolic BP implausible: {dbp}")
    if spo2 is not None and (spo2 < 50 or spo2 > 100):
        dq_warnings.append(f"SpO2 out of plausible range: {spo2}")
    if hr is not None and (hr <= 0 or hr > 300):
        dq_warnings.append(f"Heart rate implausible: {hr}")
    if temp is not None and (temp < 25 or temp > 45):
        dq_warnings.append(f"Temperature implausible: {temp}°C (possible unit error)")
    if rr is not None and (rr <= 0 or rr > 80):
        dq_warnings.append(f"Respiratory rate implausible: {rr}")

    # --- Vital-sign rules (demo thresholds) ---
    if spo2 is not None and 50 <= spo2 < 90:
        trigger("CRITICAL_HYPOXIA", f"SpO2 {spo2}% below 90%", 1, f"Severe hypoxia (SpO2 {spo2}%)")
    elif spo2 is not None and 90 <= spo2 < 94:
        trigger("MODERATE_HYPOXIA", f"SpO2 {spo2}% between 90-93%", 2, f"Low SpO2 ({spo2}%)")

    if sbp is not None and 0 < sbp < 90:
        trigger("HYPOTENSION", f"Systolic BP {sbp} mmHg below 90", 1, f"Hypotension (SBP {sbp})")
    elif sbp is not None and sbp > 220:
        trigger("HYPERTENSIVE_CRISIS", f"Systolic BP {sbp} mmHg above 220", 2, f"Hypertensive crisis (SBP {sbp})")

    if hr is not None and 0 < hr < 40:
        trigger("SEVERE_BRADYCARDIA", f"Heart rate {hr} bpm below 40", 1, f"Severe bradycardia (HR {hr})")
    elif hr is not None and hr > 140:
        trigger("SEVERE_TACHYCARDIA", f"Heart rate {hr} bpm above 140", 2, f"Severe tachycardia (HR {hr})")

    if temp is not None and 25 <= temp < 35:
        trigger("HYPOTHERMIA", f"Temperature {temp}°C below 35", 2, f"Hypothermia ({temp}°C)")
    elif temp is not None and temp >= 40:
        trigger("HYPERPYREXIA", f"Temperature {temp}°C ≥ 40", 2, f"Hyperpyrexia ({temp}°C)")

    if rr is not None and (rr < 8 or rr > 30):
        trigger("RESPIRATORY_DISTRESS_VITAL", f"Respiratory rate {rr}/min outside 8-30", 2,
                f"Abnormal respiratory rate ({rr}/min)")

    # Pediatric adjustments (demo)
    if age is not None and age < 5:
        if temp is not None and temp >= 39:
            trigger("PEDIATRIC_HIGH_FEVER", f"Child age {int(age)} with temp {temp}°C", 2,
                    f"Pediatric high fever ({temp}°C)")
        if rr is not None and rr > 40:
            trigger("PEDIATRIC_TACHYPNEA", f"Child age {int(age)} with RR {rr}", 2,
                    f"Pediatric tachypnea (RR {rr})")

    # --- Symptom-based rules ---
    for category, keywords in EMERGENCY_KEYWORDS.items():
        for kw in keywords:
            if kw in complaint:
                if category == "stroke":
                    trigger("SUSPECTED_STROKE", f"Stroke keyword detected: '{kw}'", 1,
                            "Suspected stroke symptoms")
                elif category == "cardiac":
                    trigger("CARDIAC_RED_FLAG", f"Cardiac keyword detected: '{kw}'", 2,
                            "Chest pain with cardiac features")
                elif category == "respiratory":
                    trigger("SEVERE_RESP_DISTRESS", f"Respiratory keyword detected: '{kw}'", 2,
                            "Severe respiratory distress reported")
                elif category == "bleeding":
                    trigger("SEVERE_BLEEDING", f"Bleeding keyword detected: '{kw}'", 1,
                            "Severe bleeding reported")
                elif category == "consciousness":
                    trigger("ALTERED_CONSCIOUSNESS", f"Consciousness keyword: '{kw}'", 1,
                            "Altered consciousness / seizure")
                elif category == "trauma":
                    trigger("MAJOR_TRAUMA", f"Trauma keyword: '{kw}'", 2, "Major trauma reported")
                elif category == "pediatric_distress":
                    trigger("PEDIATRIC_DISTRESS", f"Pediatric distress: '{kw}'", 1,
                            "Pediatric emergency features")
                elif category == "anaphylaxis":
                    trigger("ANAPHYLAXIS", f"Anaphylaxis keyword: '{kw}'", 1,
                            "Suspected anaphylaxis")
                break  # one trigger per category is enough

    # Multiple critical findings
    critical_rules = [r for r in triggered if int(r["forced_level"]) <= 2]
    if len(critical_rules) >= 2:
        trigger("MULTIPLE_CRITICAL_FINDINGS",
                f"{len(critical_rules)} critical findings together", 1,
                "Multiple critical findings")

    # Abstention trigger: dangerous combo of implausible vitals + concerning symptoms
    abstain = False
    abstain_reason = None
    concerning_symptom = any(
        kw in complaint for kws in EMERGENCY_KEYWORDS.values() for kw in kws
    )
    missing_critical_vitals = sum(1 for v in [spo2, hr, sbp] if v is None)
    if dq_warnings and concerning_symptom:
        abstain = True
        abstain_reason = "Implausible vitals combined with concerning symptoms"
    elif missing_critical_vitals >= 2 and concerning_symptom:
        abstain = True
        abstain_reason = "Multiple critical vitals missing with concerning symptoms"

    return {
        "triggered_rules": triggered,
        "red_flags": red_flags,
        "data_quality_warnings": dq_warnings,
        "forced_min_level": forced_min_level,
        "abstain": abstain,
        "abstain_reason": abstain_reason,
    }
