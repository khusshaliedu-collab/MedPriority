import { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, AlertOctagon, TrendingDown, Shield, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const COLORS = ["bg-red-600 text-white", "bg-orange-600 text-white", "bg-amber-500 text-slate-950", "bg-teal-600 text-white", "bg-emerald-600 text-white"];

export default function Evaluation() {
  const [m, setM] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const load = async () => {
    try { const { data } = await api.get("/evaluation/metrics"); setM(data); }
    catch { setM(null); }
  };

  const rerun = async () => {
    setLoading(true);
    try { const { data } = await api.post("/evaluation/run"); setM(data); toast.success("Evaluation refreshed"); }
    catch (e) { toast.error(e.response?.data?.detail || "Need admin/doctor role to re-run"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (!m) return <AppShell><div className="text-slate-500">Loading evaluation…</div></AppShell>;

  const cm = m.confusion_matrix;
  const maxCell = Math.max(...cm.flat());

  return (
    <AppShell>
      <div className="space-y-6" data-testid="evaluation-page">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Model Evaluation Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">
              Evaluated on {m.total_samples} synthetic labeled samples · <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 ml-1">DEMO SYNTHETIC METRICS</Badge>
            </p>
          </div>
          <Button onClick={rerun} disabled={loading} variant="outline" data-testid="rerun-eval-button">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}/>Re-run evaluation
          </Button>
        </div>

        {/* Headline cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5 border-2 border-emerald-500 bg-emerald-50" data-testid="kpi-emergency-recall">
            <Target className="w-5 h-5 text-emerald-700 mb-2"/>
            <div className="text-xs uppercase tracking-wider font-semibold text-emerald-900">Emergency recall</div>
            <div className="font-mono text-3xl font-black text-emerald-900 mt-1">
              {m.emergency.recall !== null ? `${(m.emergency.recall*100).toFixed(1)}%` : "—"}
            </div>
            <div className="text-xs text-emerald-800 mt-1">{m.emergency.recall_display}</div>
          </Card>
          <Card className="p-5 border-slate-200" data-testid="kpi-overall-accuracy">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-600">Overall accuracy</div>
            <div className="font-mono text-3xl font-black text-slate-900 mt-1">{(m.accuracy*100).toFixed(1)}%</div>
            <div className="text-xs text-slate-500 mt-1">{m.total_samples} samples</div>
          </Card>
          <Card className="p-5 border-slate-200" data-testid="kpi-missed-emergencies">
            <AlertOctagon className="w-5 h-5 text-red-600 mb-2"/>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-600">Missed emergencies</div>
            <div className="font-mono text-3xl font-black text-red-700 mt-1">{m.emergency.missed}</div>
            <div className="text-xs text-slate-500 mt-1">of {m.emergency.true_total} true emergencies</div>
          </Card>
          <Card className="p-5 border-slate-200" data-testid="kpi-asymmetric-score">
            <Shield className="w-5 h-5 text-indigo-600 mb-2"/>
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-600">Asymmetric safety score</div>
            <div className="font-mono text-3xl font-black text-slate-900 mt-1">{m.asymmetric_score}</div>
            <div className="text-xs text-slate-500 mt-1">Penalty: {m.asymmetric_penalty_total}</div>
          </Card>
        </div>

        {/* Confusion matrix + per-class */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-5 border-slate-200" data-testid="confusion-matrix-card">
            <h3 className="font-display font-bold text-slate-900 mb-1">5×5 Confusion matrix</h3>
            <p className="text-xs text-slate-500 mb-4">Rows: true level · Columns: predicted level</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="p-2"></th>
                    {[1,2,3,4,5].map(i => <th key={i} className="p-2 text-xs font-semibold text-slate-600">P-L{i}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {cm.map((row, r) => (
                    <tr key={r}>
                      <td className="p-2 text-xs font-semibold text-slate-600">T-L{r+1}</td>
                      {row.map((v, c) => {
                        const isDiag = r === c;
                        const intensity = maxCell ? Math.round((v / maxCell) * 100) : 0;
                        return (
                          <td key={c} className="p-1">
                            <div
                              data-testid={`confusion-matrix-cell-${r+1}-${c+1}`}
                              className={`w-full aspect-square flex items-center justify-center rounded font-mono text-sm font-bold ${
                                isDiag ? "bg-teal-600 text-white" : v > 0 ? "bg-red-100 text-red-900 border border-red-200" : "bg-slate-50 text-slate-400"
                              }`}
                              style={{ opacity: v > 0 ? Math.max(0.4, intensity / 100) : 1 }}
                            >
                              {v}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-5 border-slate-200" data-testid="per-class-metrics">
            <h3 className="font-display font-bold text-slate-900 mb-4">Per-class metrics</h3>
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr><th className="p-2 text-left text-xs font-semibold uppercase text-slate-500">Level</th>
                    <th className="p-2 text-xs">Precision</th><th className="p-2 text-xs">Recall</th>
                    <th className="p-2 text-xs">F1</th><th className="p-2 text-xs">Support</th></tr>
              </thead>
              <tbody>
                {Object.entries(m.per_class_metrics).map(([lv, v]) => (
                  <tr key={lv} className="border-b border-slate-100">
                    <td className="p-2"><span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${COLORS[+lv-1]}`}>L{lv}</span></td>
                    <td className="p-2 font-mono text-center">{v.precision}</td>
                    <td className="p-2 font-mono text-center">{v.recall}</td>
                    <td className="p-2 font-mono text-center">{v.f1}</td>
                    <td className="p-2 font-mono text-center text-slate-500">{v.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 pt-4 border-t border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-600">False emergency escalations</span><span className="font-mono font-bold">{m.false_emergency_escalations}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Abstention rate</span><span className="font-mono font-bold">{(m.abstention_rate*100).toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Under-triage penalty weight</span><span className="font-mono font-bold">{m.penalty_config.under_triage}×</span></div>
              <div className="flex justify-between"><span className="text-slate-600">Over-triage penalty weight</span><span className="font-mono font-bold">{m.penalty_config.over_triage}×</span></div>
            </div>
          </Card>
        </div>

        {/* Missed emergencies table */}
        <Card className="p-5 border-slate-200" data-testid="missed-emergencies-card">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-600"/>
            <h3 className="font-display font-bold text-slate-900">Missed emergencies — error analysis</h3>
          </div>
          {m.missed_emergencies_sample.length === 0 ? (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">
              No missed emergencies in this evaluation batch.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {["Sample","True","Predicted","Complaint","Rules triggered"].map(h => (
                    <th key={h} className="p-2 text-left text-xs font-semibold uppercase text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.missed_emergencies_sample.map((e, i) => (
                  <tr key={i} className="border-b border-slate-100" data-testid={`missed-row-${i}`}>
                    <td className="p-2 font-mono text-xs">{e.id}</td>
                    <td className="p-2 font-mono text-xs"><span className={`px-1.5 py-0.5 rounded ${COLORS[e.true_level-1]}`}>L{e.true_level}</span></td>
                    <td className="p-2 font-mono text-xs"><span className={`px-1.5 py-0.5 rounded ${COLORS[e.predicted_level-1]}`}>L{e.predicted_level}</span></td>
                    <td className="p-2 text-xs max-w-sm truncate">{e.chief_complaint}</td>
                    <td className="p-2 text-xs font-mono text-slate-600">{e.triggered_rules.join(", ") || "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded p-3">
          <strong>Note:</strong> All metrics shown are computed on synthetic demo data. They do NOT represent real-world clinical performance.
          Replace with the official hackathon evaluate.py and labeled dataset for valid clinical evaluation.
        </div>
      </div>
    </AppShell>
  );
}
