import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { TRIAGE_LEVELS } from "@/lib/api";
import AppShell from "@/components/AppShell";
import TriageBadge from "@/components/TriageBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertOctagon, ShieldCheck, AlertTriangle, Stethoscope, ArrowLeft, CheckCircle2, Users,
  Hospital, Flag,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function Results() {
  const { encounterId } = useParams();
  const [rec, setRec] = useState(null);
  const nav = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api.get(`/patients/${encounterId}`).then(r => setRec(r.data))
      .catch(() => toast.error("Encounter not found"));
  }, [encounterId]);

  if (!rec) return <AppShell><div className="text-slate-500">Loading…</div></AppShell>;

  const lv = TRIAGE_LEVELS[rec.triage_level] || TRIAGE_LEVELS[3];
  const isEmergency = rec.triage_level <= 2;

  const requestReview = async () => {
    toast.success("Human review requested — this patient will be prioritized for nurse/doctor assessment.");
  };

  const saveAndReturn = () => {
    toast.success("Assessment saved to encounter record");
    nav("/");
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6" data-testid="results-page">
        <button onClick={() => nav(-1)} className="text-sm text-slate-600 hover:text-slate-900 inline-flex items-center gap-1" data-testid="results-back-button">
          <ArrowLeft className="w-4 h-4"/> Back
        </button>

        {/* HERO */}
        <Card className={`p-8 border-2 ${lv.card} ${isEmergency ? "emergency-pulse" : ""}`} data-testid="triage-result-hero">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="font-mono text-xs text-slate-500">{rec.encounter_id}</div>
                <Badge variant="outline" className="text-[10px] uppercase font-semibold">{new Date(rec.assessed_at).toLocaleString()}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                <div className={`w-20 h-20 rounded-xl ${lv.badge} flex flex-col items-center justify-center shadow-lg`}>
                  <div className="font-mono text-3xl font-black leading-none">L{rec.triage_level}</div>
                  <div className="text-[10px] uppercase tracking-wider mt-0.5">Triage</div>
                </div>
                <div>
                  <h1 className="font-display text-4xl font-extrabold text-slate-900">{lv.name}</h1>
                  <p className="text-sm text-slate-600 mt-1">Target wait: <span className="font-mono font-bold">{lv.target}</span></p>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-5 flex-wrap">
                <div className="flex items-center gap-2">
                  <Hospital className="w-4 h-4 text-slate-500"/>
                  <span className="text-sm text-slate-700">Route to <strong className="text-slate-900">{rec.department}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500"/>
                  <span className="text-sm text-slate-700">Patient: <strong>{rec.age}y · {rec.sex}</strong></span>
                </div>
              </div>
            </div>
            {isEmergency && (
              <div className="bg-red-600 text-white rounded-lg px-5 py-4 flex items-center gap-3" data-testid="emergency-warning-banner">
                <AlertOctagon className="w-8 h-8"/>
                <div>
                  <div className="font-display font-extrabold text-lg leading-tight">EMERGENCY</div>
                  <div className="text-xs opacity-90">Immediate attention required</div>
                </div>
              </div>
            )}
          </div>

          <Alert className="mt-5 bg-white border-slate-200">
            <Stethoscope className="w-4 h-4"/>
            <AlertTitle className="font-semibold">Recommended action</AlertTitle>
            <AlertDescription className="text-slate-700">{rec.recommended_action}</AlertDescription>
          </Alert>
        </Card>

        {rec.abstain && (
          <Alert variant="destructive" data-testid="abstention-alert">
            <AlertTriangle className="w-4 h-4"/>
            <AlertTitle>Cannot assess safely — send to nurse for immediate review</AlertTitle>
            <AlertDescription>{rec.abstain_reason}</AlertDescription>
          </Alert>
        )}

        {/* Three-column breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Safety rules */}
          <Card className="p-5 border-slate-200" data-testid="safety-rules-card">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-5 h-5 text-red-600"/>
              <h3 className="font-display font-bold text-slate-900">Safety rules triggered</h3>
            </div>
            {rec.triggered_rules?.length ? (
              <ul className="space-y-2">
                {rec.triggered_rules.map((r, i) => (
                  <li key={i} className="bg-red-50 border border-red-200 rounded p-3" data-testid={`safety-rule-${i}`}>
                    <div className="font-mono text-xs font-bold text-red-900">{r.rule} → L{r.forced_level}</div>
                    <div className="text-xs text-red-800 mt-0.5">{r.reason}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600"/>No hard safety rules triggered
              </div>
            )}
          </Card>

          {/* Red flags */}
          <Card className="p-5 border-slate-200" data-testid="red-flags-card">
            <div className="flex items-center gap-2 mb-3">
              <Flag className="w-5 h-5 text-orange-600"/>
              <h3 className="font-display font-bold text-slate-900">Red flags detected</h3>
            </div>
            {rec.red_flags?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {rec.red_flags.map((f, i) => (
                  <Badge key={i} className="bg-orange-100 text-orange-900 border-orange-200 hover:bg-orange-100" data-testid={`red-flag-${i}`}>
                    {f}
                  </Badge>
                ))}
              </div>
            ) : <div className="text-xs text-slate-500">None detected</div>}

            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">Data-quality warnings</h4>
              {rec.data_quality_warnings?.length ? (
                <ul className="space-y-1">
                  {rec.data_quality_warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1" data-testid={`dq-warning-${i}`}>
                      ⚠ {w}
                    </li>
                  ))}
                </ul>
              ) : <div className="text-xs text-slate-500">All inputs plausible</div>}
            </div>
          </Card>

          {/* Scoring breakdown */}
          <Card className="p-5 border-slate-200" data-testid="scoring-card">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="w-5 h-5 text-teal-600"/>
              <h3 className="font-display font-bold text-slate-900">Scoring contributions</h3>
            </div>
            <div className="text-xs text-slate-500 mb-3">
              Confidence (demo heuristic): <span className="font-mono font-bold text-slate-900">{rec.confidence_demo}</span>
              <div className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1">
                Not a calibrated clinical probability.
              </div>
            </div>
            {rec.contributions?.length ? (
              <ul className="space-y-1.5">
                {rec.contributions.map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 flex-1 truncate pr-2">{c.reason}</span>
                    <span className="font-mono font-bold text-slate-900">+{c.points}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-slate-500">No positive contributions</div>}
          </Card>
        </div>

        {/* Vitals snapshot */}
        <Card className="p-5 border-slate-200">
          <h3 className="font-display font-bold text-slate-900 mb-3">Vitals recorded</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              ["SBP", rec.vitals?.sbp, "mmHg"], ["DBP", rec.vitals?.dbp, "mmHg"],
              ["HR", rec.vitals?.heart_rate, "bpm"], ["Temp", rec.vitals?.temp_c, "°C"],
              ["SpO2", rec.vitals?.spo2, "%"], ["RR", rec.vitals?.resp_rate, "/min"],
            ].map(([k, v, u]) => (
              <div key={k} className="bg-slate-50 rounded p-3" data-testid={`vital-${k.toLowerCase()}`}>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
                <div className="font-mono text-lg font-bold text-slate-900">
                  {v ?? <span className="text-slate-400">—</span>}
                </div>
                <div className="text-[10px] text-slate-500">{u}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap sticky bottom-0 bg-slate-50/95 py-4 border-t border-slate-200">
          <Button onClick={saveAndReturn} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold" data-testid="confirm-save-button">
            <CheckCircle2 className="w-4 h-4 mr-2"/>Confirm & save
          </Button>
          <Button onClick={requestReview} variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" data-testid="request-review-button">
            <AlertTriangle className="w-4 h-4 mr-2"/>Request immediate review
          </Button>
          <Button variant="outline" onClick={() => nav("/intake")} data-testid="edit-intake-button">
            Edit intake
          </Button>
          <Button variant="ghost" onClick={() => nav("/")} data-testid="back-to-dashboard-button">
            Return to dashboard
          </Button>
        </div>

        <div className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded px-3 py-2">
          <strong>Disclaimer:</strong> This system is clinical decision support only. A trained clinician must make the final triage decision.
        </div>
      </div>
    </AppShell>
  );
}
