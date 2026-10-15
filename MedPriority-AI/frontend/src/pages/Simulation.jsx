import { useEffect, useState } from "react";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingDown, Users, Play } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";

export default function Simulation() {
  const [docs, setDocs] = useState(2);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try { const r = await api.post("/simulation/waiting-time", { num_doctors: Number(docs) }); setData(r.data); toast.success("Simulation complete"); }
    catch { toast.error("Simulation failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []);

  const chartData = data ? [
    { metric: "Average", FCFS: data.fcfs.average, Priority: data.priority.average },
    { metric: "Median", FCFS: data.fcfs.median, Priority: data.priority.median },
    { metric: "P90", FCFS: data.fcfs.p90, Priority: data.priority.p90 },
    { metric: "Emergency avg", FCFS: data.fcfs.emergency_average, Priority: data.priority.emergency_average },
  ] : [];

  return (
    <AppShell>
      <div className="space-y-6" data-testid="simulation-page">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Waiting-Time Simulation</h1>
            <p className="text-sm text-slate-500 mt-1">FCFS vs AI-Priority queue · <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 ml-1">Illustrative only — synthetic arrival log</Badge></p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Doctors available</Label>
              <Input type="number" value={docs} onChange={e=>setDocs(e.target.value)} min={1} max={10}
                className="mt-1.5 w-24" data-testid="sim-doctors-input"/>
            </div>
            <Button onClick={run} disabled={loading} className="bg-teal-600 hover:bg-teal-700 text-white h-10" data-testid="run-simulation-button">
              <Play className="w-4 h-4 mr-2"/>{loading ? "Running…" : "Run simulation"}
            </Button>
          </div>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-5 border-slate-200" data-testid="sim-kpi-fcfs">
                <Clock className="w-5 h-5 text-slate-400 mb-2"/>
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-600">FCFS — emergency wait</div>
                <div className="font-mono text-3xl font-black text-slate-900 mt-1">{data.fcfs.emergency_average}<span className="text-base text-slate-500 ml-1">min</span></div>
              </Card>
              <Card className="p-5 border-2 border-teal-500 bg-teal-50" data-testid="sim-kpi-priority">
                <Clock className="w-5 h-5 text-teal-700 mb-2"/>
                <div className="text-xs uppercase tracking-wider font-semibold text-teal-900">Priority — emergency wait</div>
                <div className="font-mono text-3xl font-black text-teal-900 mt-1">{data.priority.emergency_average}<span className="text-base text-teal-700 ml-1">min</span></div>
              </Card>
              <Card className="p-5 border-slate-200" data-testid="sim-kpi-reduction">
                <TrendingDown className="w-5 h-5 text-emerald-600 mb-2"/>
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-600">Emergency wait reduction</div>
                <div className="font-mono text-3xl font-black text-emerald-700 mt-1">{data.emergency_wait_reduction_pct}%</div>
              </Card>
              <Card className="p-5 border-slate-200" data-testid="sim-kpi-reordered">
                <Users className="w-5 h-5 text-indigo-600 mb-2"/>
                <div className="text-xs uppercase tracking-wider font-semibold text-slate-600">Patients reprioritized</div>
                <div className="font-mono text-3xl font-black text-indigo-700 mt-1">{data.reordered_patients}</div>
              </Card>
            </div>

            <Card className="p-5 border-slate-200" data-testid="sim-chart-card">
              <h3 className="font-display font-bold text-slate-900 mb-4">Wait-time comparison (minutes)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0"/>
                    <XAxis dataKey="metric" tick={{ fontSize: 12 }}/>
                    <YAxis tick={{ fontSize: 12 }}/>
                    <Tooltip/>
                    <Legend/>
                    <Bar dataKey="FCFS" fill="#94A3B8" radius={[6,6,0,0]}/>
                    <Bar dataKey="Priority" fill="#0D9488" radius={[6,6,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 border-slate-200">
              <h3 className="font-display font-bold text-slate-900 mb-3">Assumptions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><span className="text-xs uppercase tracking-wider text-slate-500">Doctors</span><div className="font-mono font-bold">{data.assumptions.num_doctors}</div></div>
                <div><span className="text-xs uppercase tracking-wider text-slate-500">Service time</span><div className="text-sm">{data.assumptions.service_time}</div></div>
                <div><span className="text-xs uppercase tracking-wider text-slate-500">Arrival pattern</span><div className="text-sm">{data.assumptions.arrival_pattern}</div></div>
              </div>
              <div className="mt-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-3">{data.assumptions.note}</div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
