import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import TriageBadge from "@/components/TriageBadge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, FileSearch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function History() {
  const { encounterId } = useParams();
  const nav = useNavigate();
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/patients").then(r => setPatients(r.data));
  }, []);

  useEffect(() => {
    if (encounterId) nav(`/results/${encounterId}`, { replace: true });
  }, [encounterId, nav]);

  const filtered = patients.filter(p => {
    if (!q) return true;
    const s = q.toLowerCase();
    return p.encounter_id?.toLowerCase().includes(s)
      || p.chief_complaint?.toLowerCase().includes(s)
      || p.department?.toLowerCase().includes(s);
  });

  return (
    <AppShell>
      <div className="space-y-6" data-testid="history-page">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-slate-900">Patient records</h1>
            <p className="text-sm text-slate-500 mt-1">{patients.length} assessment records · Audit trail</p>
          </div>
          <div className="relative w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <Input
              placeholder="Search encounter, complaint, dept…"
              value={q} onChange={e => setQ(e.target.value)}
              className="pl-9"
              data-testid="patient-search-input"
            />
          </div>
        </div>

        <Card className="border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left">
                  {["Encounter","Date","Age/Sex","Triage","Dept","Status","Rules","Complaint",""].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 text-sm">
                    <FileSearch className="w-8 h-8 mx-auto mb-2 text-slate-300"/>
                    No matching records.
                  </td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.encounter_id} className="border-b border-slate-100 hover:bg-slate-50" data-testid={`history-row-${p.encounter_id}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{p.encounter_id}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {p.assessed_at ? formatDistanceToNow(new Date(p.assessed_at), { addSuffix: true }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.age}y · {p.sex?.[0]?.toUpperCase()}</td>
                    <td className="px-4 py-3"><TriageBadge level={p.triage_level}/></td>
                    <td className="px-4 py-3 text-xs">{p.department}</td>
                    <td className="px-4 py-3 text-xs">{p.status?.replace("_"," ")}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">
                      {p.triggered_rules?.length ? `${p.triggered_rules.length} rule${p.triggered_rules.length>1?"s":""}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-sm truncate">{p.chief_complaint}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => nav(`/results/${p.encounter_id}`)}
                        data-testid={`history-view-${p.encounter_id}`}>View</Button>
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
