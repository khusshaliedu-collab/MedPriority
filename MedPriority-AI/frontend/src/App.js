import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Intake from "@/pages/Intake";
import Results from "@/pages/Results";
import History from "@/pages/History";
import Evaluation from "@/pages/Evaluation";
import Simulation from "@/pages/Simulation";

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace/>;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login/>}/>
            <Route path="/" element={<Protected><Dashboard/></Protected>}/>
            <Route path="/intake" element={<Protected><Intake/></Protected>}/>
            <Route path="/results/:encounterId" element={<Protected><Results/></Protected>}/>
            <Route path="/history" element={<Protected><History/></Protected>}/>
            <Route path="/history/:encounterId" element={<Protected><History/></Protected>}/>
            <Route path="/evaluation" element={<Protected><Evaluation/></Protected>}/>
            <Route path="/simulation" element={<Protected><Simulation/></Protected>}/>
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton/>
      </AuthProvider>
    </div>
  );
}

export default App;
