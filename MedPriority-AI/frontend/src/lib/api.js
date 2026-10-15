import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("mp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("mp_token");
      localStorage.removeItem("mp_user");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;

export const TRIAGE_LEVELS = {
  1: { name: "Resuscitation", short: "L1", badge: "bg-red-600 text-white", card: "bg-red-50 border-red-500", icon: "AlertOctagon", target: "0 min — immediate" },
  2: { name: "Emergency", short: "L2", badge: "bg-orange-600 text-white", card: "bg-orange-50 border-orange-500", icon: "AlertTriangle", target: "< 15 min" },
  3: { name: "Urgent", short: "L3", badge: "bg-amber-500 text-slate-950", card: "bg-amber-50 border-amber-400", icon: "Clock", target: "< 30 min" },
  4: { name: "Less Urgent", short: "L4", badge: "bg-teal-600 text-white", card: "bg-teal-50 border-teal-400", icon: "Info", target: "< 60 min" },
  5: { name: "Non-Urgent", short: "L5", badge: "bg-emerald-600 text-white", card: "bg-emerald-50 border-emerald-400", icon: "CheckCircle2", target: "< 120 min" },
};
