import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, ShieldCheck, Stethoscope, UserCog, UserRound } from "lucide-react";
import { toast } from "sonner";

const DEMO = [
  { label: "Nurse", user: "nurse", pass: "nurse123", icon: UserRound, color: "bg-teal-600" },
  { label: "Doctor", user: "doctor", pass: "doctor123", icon: Stethoscope, color: "bg-indigo-600" },
  { label: "Admin", user: "admin", pass: "admin123", icon: UserCog, color: "bg-slate-800" },
];

export default function Login() {
  const { user, login, loading } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e?.preventDefault();
    setErr("");
    const res = await login(username, password);
    if (res.ok) { toast.success("Welcome back"); nav("/"); }
    else { setErr(res.error); toast.error(res.error); }
  };

  const quickLogin = async (u, p) => {
    setUsername(u); setPassword(p); setErr("");
    const res = await login(u, p);
    if (res.ok) { toast.success(`Signed in as ${u}`); nav("/"); }
    else setErr(res.error);
  };

  return (
    <div className="min-h-screen flex" data-testid="login-page">
      {/* Left side - brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 text-slate-100 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-teal-500 flex items-center justify-center">
              <Activity className="w-6 h-6 text-slate-900" strokeWidth={2.5}/>
            </div>
            <div>
              <div className="font-display font-extrabold text-xl">MediPriority</div>
              <div className="text-xs uppercase tracking-widest text-teal-300">AI · OPD Triage Assistant</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-tight">
            Rapid triage.<br/>
            <span className="text-teal-300">Patient safety first.</span>
          </h1>
          <p className="text-slate-300 text-base max-w-md">
            Decision-support for overloaded OPDs — identify emergencies in under 60 seconds, with
            mandatory safety rules that override every lower-priority prediction.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { k: "60s", v: "Target assessment" },
              { k: "5", v: "Triage levels" },
              { k: "20×", v: "Under-triage penalty" },
            ].map(x => (
              <div key={x.k} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                <div className="font-mono text-xl font-bold text-teal-300">{x.k}</div>
                <div className="text-[11px] text-slate-400 mt-1">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-xs text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Clinical prototype · Synthetic data · Not for autonomous diagnosis
        </div>
      </div>

      {/* Right side - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-2 justify-center">
            <div className="w-9 h-9 rounded-md bg-teal-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div className="font-display font-extrabold text-lg">MediPriority AI</div>
          </div>

          <Card className="p-7 border-slate-200">
            <div className="mb-5">
              <h2 className="font-display text-2xl font-bold text-slate-900">Staff sign in</h2>
              <p className="text-sm text-slate-500 mt-1">Access your clinical dashboard</p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Username</Label>
                <Input
                  id="username" data-testid="login-username-input"
                  value={username} onChange={(e)=>setUsername(e.target.value)}
                  placeholder="nurse / doctor / admin"
                  autoComplete="username" required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-slate-600">Password</Label>
                <Input
                  id="password" data-testid="login-password-input"
                  type="password" value={password} onChange={(e)=>setPassword(e.target.value)}
                  autoComplete="current-password" required
                />
              </div>
              {err && (
                <Alert variant="destructive" data-testid="login-error">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" data-testid="login-submit-button" disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold h-11">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Card>

          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Quick demo login</div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map(d => (
                <button
                  key={d.user} type="button"
                  onClick={() => quickLogin(d.user, d.pass)}
                  data-testid={`quick-login-${d.user}`}
                  className="group border border-slate-200 bg-white rounded-lg p-3 text-left hover:border-teal-400 hover:shadow-sm transition"
                >
                  <div className={`w-8 h-8 rounded ${d.color} flex items-center justify-center mb-2`}>
                    <d.icon className="w-4 h-4 text-white"/>
                  </div>
                  <div className="font-semibold text-sm text-slate-900">{d.label}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{d.user} / {d.pass}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              Demo credentials are shown here for the prototype only. Not production-grade security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
