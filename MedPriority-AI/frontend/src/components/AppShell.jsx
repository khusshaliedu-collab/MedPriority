import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard, UserPlus, FileSearch, BarChart3, Clock, LogOut,
  ShieldCheck, Activity, Bell,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Command Dashboard", id: "dashboard" },
  { to: "/intake", icon: UserPlus, label: "Rapid Intake", id: "intake" },
  { to: "/history", icon: FileSearch, label: "Patient Records", id: "history" },
  { to: "/evaluation", icon: BarChart3, label: "Model Evaluation", id: "evaluation" },
  { to: "/simulation", icon: Clock, label: "Waiting-Time Sim", id: "simulation" },
];

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col border-r border-slate-800" data-testid="app-sidebar">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-teal-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-extrabold text-base leading-tight tracking-tight">MediPriority</div>
              <div className="text-[10px] uppercase tracking-widest text-teal-300">AI · Triage</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.to === "/"}
              data-testid={`nav-item-${item.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-teal-500/15 text-teal-200 border-l-2 border-teal-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-teal-600 text-white text-xs font-bold">
                {user.name?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">{user.role}</div>
            </div>
            <button
              onClick={() => { logout(); nav("/login"); }}
              data-testid="logout-button"
              className="text-slate-400 hover:text-white p-1.5"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge className="bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100 font-semibold text-[10px] uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3 mr-1" /> Demo Mode · Synthetic Data
            </Badge>
            <span className="text-xs text-slate-500 hidden md:inline">Clinical decision support only — not a certified medical device</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative text-slate-500 hover:text-slate-900" data-testid="header-notifications">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-900">{user.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{user.shift || "Shift"}</div>
            </div>
          </div>
        </header>
        <div className="flex-1 p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
