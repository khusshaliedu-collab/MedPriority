import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import TriageBadge from "@/components/TriageBadge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Activity, AlertOctagon, Clock, UserPlus, Users, Hourglass, Stethoscope, Target,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const KPIS = [
  { key: "total_today", label: "Patients today", icon: Users, accent: "text-slate-900" },
  { key: "awaiting", label: "Awaiting review", icon: Hourglass, accent: "text-amber-700" },
  { key: "critical", label: "Critical cases (L1-L2)", icon: AlertOctagon, accent: "text-red-700" },
  { key: "needs_review", label: "Human review needed", icon: Stethoscope, accent: "text-indigo-700" },
  { key: "avg_assessment_sec", label: "Avg assessment time", icon: Clock, accent: "text-teal-700", suffix: "s" },
  { key: "emergency_recall", label: "Emergency recall", icon: Target, accent: "text-emerald-700", isText: true },
];

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [queue, setQueue] = useState([]);
  const [filter, setFilter] = useState({ level: "all", dept: "all", status: "all" });
  const nav = useNavigate();

  const refresh = async () => {
    const [s, q] = await Promise.all([
      api.get("/dashboard/summary"),
      api.get("/dashboard/queue"),
    ]);
    setSummary(s.data); setQueue(q.data);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = queue.filter(p => {
    if (filter.level !== "all" && String(p.triage_level) !== filter.level) return false;
    if (filter.dept !== "all" && p.department !== filter.dept) return false;
    if (filter.status !== "all" && p.status !== filter.status) return false;
    return true;
  });

  const departments = [...new Set(queue.map(p => p.department).filter(Boolean))];
  const criticalPatients = queue.filter(p => p.triage_level <= 2);

  return (
    <AppShell>
      <div className="space-y-6" data-testid="dashboard-page">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">Command Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Live OPD triage activity · {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <Button
            data-testid="dashboard-new-intake-button"
            onClick={() => nav("/intake")}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold h-10 px-5"
          >
            <UserPlus className="w-4 h-4 mr-2"/> New rapid intake
          </Button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {KPIS.map(kpi => {
            const raw = summary?.[kpi.key];
            const val = kpi.isText ? (raw || "—") : (raw ?? "—");
            return (
              <Card key={kpi.key} className="p-5 border-slate-200" data-testid={`kpi-${kpi.key}`}>
                <kpi.icon className="w-4 h-4 text-slate-400 mb-3"/>
                <div className={`font-mono text-2xl font-extrabold ${kpi.accent}`}>
                  {val}{!kpi.isText && kpi.suffix ? kpi.suffix : ""}
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-tight">{kpi.label}</div>
              </Card>
            );
          })}
        </div>

        {/* Critical alert banner */}
        {criticalPatients.length > 0 && (
          <Card className="p-5 bg-red-50 border-2 border-red-500" data-testid="critical-alert-banner">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center emergency-pulse flex-shrink-0">
                <AlertOctagon className="w-5 h-5 text-white"/>
              </div>
              <div className="flex-1">
                <div className="font-display font-bold text-red-950 text-base">
                  {criticalPatients.length} critical patient{criticalPatients.length > 1 ? "s" : ""} require immediate attention
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {criticalPatients.slice(0, 6).map(p => (
                    <button
                      key={p.encounter_id}
                      onClick={() => nav(`/history/${p.encounter_id}`)}
                      data-testid={`critical-patient-${p.encounter_id}`}
                      className="bg-white border border-red-300 rounded-md px-3 py-1.5 text-xs font-mono text-red-900 hover:bg-red-100"
                    >
                      {p.encounter_id} · L{p.triage_level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Queue */}
        <Card className="border-slate-200">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">Live triage queue</h2>
              <p className="text-xs text-slate-500 mt-0.5">{filtered.length} of {queue.length} patients</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filter.level} onValueChange={(v) => setFilter(f => ({...f, level: v}))}>
                <SelectTrigger className="w-[150px] h-9 text-xs" data-testid="filter-level"><SelectValue placeholder="All levels"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  {[1,2,3,4,5].map(l => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filter.dept} onValueChange={(v) => setFilter(f => ({...f, dept: v}))}>
                <SelectTrigger className="w-[180px] h-9 text-xs" data-testid="filter-department"><SelectValue placeholder="All depts"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filter.status} onValueChange={(v) => setFilter(f => ({...f, status: v}))}>
                <SelectTrigger className="w-[140px] h-9 text-xs" data-testid="filter-status"><SelectValue placeholder="All status"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="assessed">Assessed</SelectItem>
                  <SelectItem value="awaiting_review">Awaiting review</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  {["Encounter","Age/Sex","Arrival","Triage","Department","Status","Chief Complaint",""].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No patients match filters.</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.encounter_id} className="border-b border-slate-100 hover:bg-slate-50"
                      data-testid={`patient-queue-row-${p.encounter_id}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{p.encounter_id}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{p.age ?? "—"}y · {p.sex?.[0]?.toUpperCase() || "?"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.arrival_time ? formatDistanceToNow(new Date(p.arrival_time), { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-4 py-3"><TriageBadge level={p.triage_level} testid={`queue-triage-${p.encounter_id}`} /></td>
                    <td className="px-4 py-3 text-xs text-slate-700">{p.department || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[10px] font-semibold uppercase">{p.status?.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">{p.chief_complaint}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => nav(`/history/${p.encounter_id}`)}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                        data-testid={`view-encounter-${p.encounter_id}`}
                      >View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
