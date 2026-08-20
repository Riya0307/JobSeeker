import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

const links = [
  ["Dashboard", "/dashboard"],
  ["Profile", "/profile"],
  ["Resumes", "/resumes"],
  ["Jobs", "/jobs"],
  ["Saved Jobs", "/saved-jobs"],
] as const;

export default function AuthenticatedLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <NavLink to="/dashboard" className="text-lg font-semibold tracking-tight">
            JobSeeker<span className="text-cyan-300">.</span>
          </NavLink>
          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto" aria-label="Candidate navigation">
            {links.map(([label, path]) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400 hover:bg-white/5 hover:text-white"}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <button onClick={handleLogout} className="order-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white sm:order-3">
            Logout
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
