import { TRIAGE_LEVELS } from "@/lib/api";
import { AlertOctagon, AlertTriangle, Clock, Info, CheckCircle2 } from "lucide-react";

const ICONS = { AlertOctagon, AlertTriangle, Clock, Info, CheckCircle2 };

export default function TriageBadge({ level, size = "md", testid }) {
  if (!level) return <span data-testid={testid} className="inline-flex px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-500">—</span>;
  const lv = TRIAGE_LEVELS[level];
  if (!lv) return null;
  const Icon = ICONS[lv.icon] || Info;
  const padding = size === "lg" ? "px-4 py-2 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span
      data-testid={testid || `triage-level-badge-${level}`}
      className={`inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide rounded ${lv.badge} ${padding}`}
    >
      <Icon className={size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      <span className="font-mono">{lv.short}</span>
      <span>{lv.name}</span>
    </span>
  );
}
