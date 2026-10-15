import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Zap, Heart, Thermometer, Wind, Activity } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_PROFILES = [
  { name: "Chest pain (STEMI-like)", data: { age: 58, sex: "male", chief_complaint: "Crushing chest pain radiating to left arm since 30 minutes", conditions: "diabetes, hypertension", medications: "metformin, amlodipine", sbp: 85, dbp: 55, heart_rate: 118, temp_c: 37.1, spo2: 92, resp_rate: 24 }},
  { name: "Pediatric high fever", data: { age: 4, sex: "female", chief_complaint: "My child is breathing very fast and has high fever", conditions: "", medications: "", sbp: 95, dbp: 60, heart_rate: 150, temp_c: 40.1, spo2: 95, resp_rate: 44 }},
  { name: "Stroke symptoms", data: { age: 67, sex: "male", chief_complaint: "Sudden weakness one side of body and slurred speech", conditions: "hypertension", medications: "amlodipine", sbp: 160, dbp: 95, heart_rate: 92, temp_c: 36.9, spo2: 97, resp_rate: 18 }},
  { name: "Minor sprain", data: { age: 22, sex: "male", chief_complaint: "Twisted my ankle playing cricket, swollen", conditions: "", medications: "", sbp: 125, dbp: 80, heart_rate: 78, temp_c: 36.8, spo2: 99, resp_rate: 16 }},
];

const initial = {
  age: "", sex: "male", chief_complaint: "", conditions: "", medications: "", notes: "",
  sbp: "", dbp: "", heart_rate: "", temp_c: "", spo2: "", resp_rate: "",
  sbp_unknown: false, dbp_unknown: false, hr_unknown: false, temp_unknown: false, spo2_unknown: false, rr_unknown: false,
};

const VITAL_FIELDS = [
  { key: "sbp", label: "Systolic BP (mmHg)", unk: "sbp_unknown", icon: Activity, hint: "90-140" },
  { key: "dbp", label: "Diastolic BP (mmHg)", unk: "dbp_unknown", icon: Activity, hint: "60-90" },
  { key: "heart_rate", label: "Heart Rate (bpm)", unk: "hr_unknown", icon: Heart, hint: "60-100" },
  { key: "temp_c", label: "Temperature (°C)", unk: "temp_unknown", icon: Thermometer, hint: "36.0-37.5" },
  { key: "spo2", label: "SpO2 (%)", unk: "spo2_unknown", icon: Wind, hint: "95-100" },
  { key: "resp_rate", label: "Resp Rate (/min)", unk: "rr_unknown", icon: Wind, hint: "12-20" },
];

export default function Intake() {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const loadSample = (profile) => {
    setForm({ ...initial, ...profile.data });
    toast.info(`Loaded profile: ${profile.name}`);
  };

  const validate = () => {
    const errs = [];
    if (!form.chief_complaint.trim()) errs.push("Chief complaint is required");
    if (!form.age && form.age !== 0) errs.push("Age is required");
    const num = (v) => v === "" ? null : Number(v);
    if (num(form.sbp) !== null && (num(form.sbp) <= 0 || num(form.sbp) > 300)) errs.push("SBP out of plausible range");
    if (num(form.spo2) !== null && (num(form.spo2) < 50 || num(form.spo2) > 100)) errs.push("SpO2 out of plausible range");
    if (num(form.temp_c) !== null && (num(form.temp_c) < 25 || num(form.temp_c) > 45)) errs.push("Temperature out of plausible range (did you mean °C?)");
    return errs;
  };

  const submit = async () => {
    const errs = validate();
    if (errs.length) { errs.forEach(e => toast.error(e)); return; }
    setSubmitting(true);
    try {
      const vitals = {};
      VITAL_FIELDS.forEach(({ key, unk }) => {
        if (!form[unk] && form[key] !== "") vitals[key] = Number(form[key]);
      });
      const payload = {
        age: Number(form.age), sex: form.sex,
        chief_complaint: form.chief_complaint,
        conditions: form.conditions, medications: form.medications, notes: form.notes,
        vitals,
      };
      const { data } = await api.post("/triage/assess", payload);
      toast.success(`Assessment complete: Level ${data.result.predicted_level}`);
      nav(`/results/${data.encounter_id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Assessment failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6" data-testid="intake-page">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">60-Second Rapid Intake</h1>
          <p className="text-sm text-slate-500 mt-1">Quick assessment · All fields assessed by safety rules independently of the scoring engine</p>
        </div>

        {/* Sample profiles */}
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              <Zap className="w-4 h-4"/> Quick-load demo:
            </div>
            {SAMPLE_PROFILES.map(p => (
              <Button key={p.name} variant="outline" size="sm" onClick={() => loadSample(p)}
                data-testid={`sample-profile-${p.name.replace(/\s+/g,'-').toLowerCase()}`}
                className="h-8 text-xs">
                {p.name}
              </Button>
            ))}
          </div>
        </Card>

        {/* Patient info */}
        <Card className="p-6 border-slate-200">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Patient information</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Age *</Label>
              <Input type="number" value={form.age} onChange={e => setField("age", e.target.value)}
                data-testid="intake-age-input" className="mt-1.5" placeholder="e.g. 45"/>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Sex</Label>
              <Select value={form.sex} onValueChange={v => setField("sex", v)}>
                <SelectTrigger className="mt-1.5" data-testid="intake-sex-select"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="decline">Decline to state</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Vitals */}
        <Card className="p-6 border-slate-200">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Vital signs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VITAL_FIELDS.map(({ key, label, unk, icon: Icon, hint }) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5"/>{label}
                  </Label>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Checkbox checked={form[unk]} onCheckedChange={v => setField(unk, !!v)}
                      data-testid={`intake-${key}-unknown`}/>
                    Unknown
                  </label>
                </div>
                <Input
                  type="number" value={form[key]} disabled={form[unk]}
                  onChange={e => setField(key, e.target.value)}
                  data-testid={`intake-${key}-input`}
                  placeholder={`Normal: ${hint}`}
                  step="0.1"
                />
              </div>
            ))}
          </div>
          <Alert className="mt-4 bg-amber-50 border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-700"/>
            <AlertDescription className="text-xs text-amber-900">
              Never silently substitute missing vitals with normal values. Suspicious or missing values will trigger a safety review.
            </AlertDescription>
          </Alert>
        </Card>

        {/* Clinical info */}
        <Card className="p-6 border-slate-200">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">Clinical information</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Chief complaint *</Label>
              <Textarea
                value={form.chief_complaint}
                onChange={e => setField("chief_complaint", e.target.value)}
                data-testid="intake-complaint-input"
                className="mt-1.5 min-h-[80px]"
                placeholder="Describe in the patient's own words — e.g. 'My chest feels tight and I cannot breathe properly'"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Known conditions</Label>
                <Input value={form.conditions} onChange={e => setField("conditions", e.target.value)}
                  data-testid="intake-conditions-input" className="mt-1.5"
                  placeholder="diabetes, hypertension, asthma…"/>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Current medications</Label>
                <Input value={form.medications} onChange={e => setField("medications", e.target.value)}
                  data-testid="intake-medications-input" className="mt-1.5"
                  placeholder="metformin, aspirin…"/>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Additional notes</Label>
              <Textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
                data-testid="intake-notes-input" className="mt-1.5" placeholder="Optional context"/>
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 sticky bottom-0 bg-slate-50/95 backdrop-blur-sm py-4 border-t border-slate-200">
          <Button variant="outline" onClick={() => setForm(initial)} data-testid="intake-reset-button">
            Reset form
          </Button>
          <Button onClick={submit} disabled={submitting}
            data-testid="rapid-intake-submit-button"
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold h-12 px-8 text-base">
            {submitting ? "Assessing…" : "Assess Patient →"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
