"""Evaluation module — confusion matrix, emergency recall, asymmetric scoring.

Under-triage is penalized ~20x more than over-triage (per spec).
"""
from typing import Any
from safety_rules import evaluate_safety_rules
from scoring import score_patient


UNDER_TRIAGE_PENALTY = 20.0
OVER_TRIAGE_PENALTY = 1.0
MISSED_EMERGENCY_PENALTY = 20.0


def predict_triage(payload: dict[str, Any]) -> dict[str, Any]:
    """Combined pipeline used by both API endpoints and evaluation."""
    safety = evaluate_safety_rules(payload)
    model = score_patient(payload)

    predicted_level = min(model["level"], safety["forced_min_level"])
    abstain = safety.get("abstain", False)

    if abstain:
        final_level = 2  # abstention still routed urgently, never last in queue
        action = "Cannot assess safely — send to nurse for immediate review."
    elif safety["forced_min_level"] < model["level"]:
        action = "Safety rule overrode scoring engine. Immediate review required."
    elif predicted_level == 1:
        action = "Immediate resuscitation — transfer to Emergency Department now."
    elif predicted_level == 2:
        action = "Very urgent — assess within 15 minutes."
    elif predicted_level == 3:
        action = "Urgent — assess within 30 minutes."
    elif predicted_level == 4:
        action = "Less urgent — assess within 60 minutes."
    else:
        action = "Routine clinician assessment."

    # Emergency flag: triggered when any safety rule forces level 1 or 2
    is_emergency_pred = predicted_level <= 2 or len(safety["triggered_rules"]) > 0

    return {
        "predicted_level": predicted_level,
        "department": "Emergency Department" if predicted_level == 1 else model["department"],
        "is_emergency_pred": is_emergency_pred,
        "safety": safety,
        "model": model,
        "abstain": abstain,
        "abstain_reason": safety.get("abstain_reason"),
        "recommended_action": action,
    }


def evaluate_dataset(dataset: list[dict]) -> dict[str, Any]:
    """Compute all evaluation metrics against labeled synthetic data."""
    # 5x5 confusion matrix (rows=true, cols=pred), 1-indexed
    matrix = [[0] * 5 for _ in range(5)]
    per_class = {i: {"tp": 0, "fp": 0, "fn": 0} for i in range(1, 6)}

    true_emergency_total = 0
    true_emergency_caught = 0
    false_emergency_escalations = 0
    abstentions = 0
    asymmetric_penalty = 0.0

    missed_emergencies: list[dict] = []

    for row in dataset:
        pred = predict_triage(row)
        pl = pred["predicted_level"]
        tl = row["true_level"]

        matrix[tl - 1][pl - 1] += 1

        for i in range(1, 6):
            if tl == i and pl == i:
                per_class[i]["tp"] += 1
            elif tl != i and pl == i:
                per_class[i]["fp"] += 1
            elif tl == i and pl != i:
                per_class[i]["fn"] += 1

        if row.get("true_emergency"):
            true_emergency_total += 1
            if pred["is_emergency_pred"] or pl <= 2:
                true_emergency_caught += 1
            else:
                missed_emergencies.append({
                    "id": row.get("id"),
                    "chief_complaint": row.get("chief_complaint"),
                    "true_level": tl,
                    "predicted_level": pl,
                    "triggered_rules": [r["rule"] for r in pred["safety"]["triggered_rules"]],
                })
        else:
            if pred["is_emergency_pred"] and pl <= 2:
                false_emergency_escalations += 1

        if pred["abstain"]:
            abstentions += 1

        # Asymmetric penalty
        if pl > tl:
            # Under-triage (predicted less urgent than truth)
            asymmetric_penalty += UNDER_TRIAGE_PENALTY * (pl - tl)
        elif pl < tl:
            asymmetric_penalty += OVER_TRIAGE_PENALTY * (tl - pl)

        if row.get("true_emergency") and not (pred["is_emergency_pred"] or pl <= 2):
            asymmetric_penalty += MISSED_EMERGENCY_PENALTY

    total = len(dataset)
    correct = sum(matrix[i][i] for i in range(5))
    accuracy = correct / total if total else 0.0

    emergency_recall = (true_emergency_caught / true_emergency_total) if true_emergency_total else None

    per_class_metrics = {}
    for i in range(1, 6):
        tp = per_class[i]["tp"]
        fp = per_class[i]["fp"]
        fn = per_class[i]["fn"]
        prec = tp / (tp + fp) if (tp + fp) else 0.0
        rec = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        per_class_metrics[str(i)] = {
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1": round(f1, 3),
            "support": tp + fn,
        }

    return {
        "total_samples": total,
        "accuracy": round(accuracy, 3),
        "confusion_matrix": matrix,
        "per_class_metrics": per_class_metrics,
        "emergency": {
            "true_total": true_emergency_total,
            "caught": true_emergency_caught,
            "missed": true_emergency_total - true_emergency_caught,
            "recall": round(emergency_recall, 3) if emergency_recall is not None else None,
            "recall_display": (
                f"{true_emergency_caught}/{true_emergency_total} "
                f"({round(emergency_recall * 100, 1)}%)"
                if emergency_recall is not None else "No positive emergency labels"
            ),
        },
        "false_emergency_escalations": false_emergency_escalations,
        "abstention_rate": round(abstentions / total, 3) if total else 0,
        "asymmetric_penalty_total": round(asymmetric_penalty, 2),
        "asymmetric_score": round(1 / (1 + asymmetric_penalty / total), 3) if total else 0,
        "missed_emergencies_sample": missed_emergencies[:10],
        "penalty_config": {
            "under_triage": UNDER_TRIAGE_PENALTY,
            "over_triage": OVER_TRIAGE_PENALTY,
            "missed_emergency": MISSED_EMERGENCY_PENALTY,
        },
    }


def simulate_waiting_time(arrivals: list[dict], num_doctors: int = 2) -> dict[str, Any]:
    """FCFS vs Priority queue simulation. Returns comparative stats."""
    def run(mode: str):
        remaining = sorted(arrivals, key=lambda x: x["arrival_minute"])
        docs = [0] * num_doctors  # when each doctor is free (sim minutes)
        waits = []
        emergency_waits = []

        if mode == "priority":
            # Within arrival window, pick highest priority first
            queue: list[dict] = []
            i = 0
            now = 0
            served = []
            while i < len(remaining) or queue or any(d > now for d in docs):
                # Admit any arrivals up to current time
                while i < len(remaining) and remaining[i]["arrival_minute"] <= now:
                    queue.append(remaining[i])
                    i += 1
                # Any free doctor
                free_idx = next((idx for idx, t in enumerate(docs) if t <= now), None)
                if free_idx is not None and queue:
                    queue.sort(key=lambda p: (p["true_level"], p["arrival_minute"]))
                    p = queue.pop(0)
                    wait = now - p["arrival_minute"]
                    waits.append(wait)
                    if p.get("true_emergency"):
                        emergency_waits.append(wait)
                    docs[free_idx] = now + p["service_minutes"]
                    served.append(p)
                else:
                    # Advance time to next event
                    next_arrival = remaining[i]["arrival_minute"] if i < len(remaining) else float("inf")
                    next_free = min(d for d in docs if d > now) if any(d > now for d in docs) else float("inf")
                    now = min(next_arrival, next_free)
                    if now == float("inf"):
                        break
        else:  # FCFS
            for p in remaining:
                free_idx = min(range(num_doctors), key=lambda idx: docs[idx])
                start = max(docs[free_idx], p["arrival_minute"])
                wait = start - p["arrival_minute"]
                waits.append(wait)
                if p.get("true_emergency"):
                    emergency_waits.append(wait)
                docs[free_idx] = start + p["service_minutes"]

        waits_sorted = sorted(waits)
        n = len(waits)
        avg = sum(waits) / n if n else 0
        median = waits_sorted[n // 2] if n else 0
        p90 = waits_sorted[int(n * 0.9)] if n else 0
        em_avg = sum(emergency_waits) / len(emergency_waits) if emergency_waits else 0
        return {
            "average": round(avg, 1), "median": round(median, 1), "p90": p90,
            "emergency_average": round(em_avg, 1), "count": n,
        }

    fcfs = run("fcfs")
    priority = run("priority")
    reduction = (fcfs["emergency_average"] - priority["emergency_average"]) / fcfs["emergency_average"] * 100 \
        if fcfs["emergency_average"] else 0

    reorder_count = sum(1 for a in arrivals if a.get("true_level", 5) <= 2)

    return {
        "fcfs": fcfs,
        "priority": priority,
        "emergency_wait_reduction_pct": round(reduction, 1),
        "reordered_patients": reorder_count,
        "assumptions": {
            "num_doctors": num_doctors,
            "service_time": "Varies by severity (approx 5-20 minutes)",
            "arrival_pattern": "Synthetic Poisson-like arrivals",
            "note": "Illustrative simulation on synthetic demo data.",
        },
    }
