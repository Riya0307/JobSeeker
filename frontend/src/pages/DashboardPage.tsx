import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">JobSeeker<span className="text-cyan-300">.</span></span>
          <button onClick={handleLogout} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white">Log out</button>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Candidate workspace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Good to see you, {user?.first_name}.</h1>
        <p className="mt-3 max-w-2xl text-slate-400">Your focused home for building a credible candidate presence and managing the search ahead.</p>
        <section className="mt-10 grid gap-6 md:grid-cols-[1.4fr_0.6fr]">
          <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-7 shadow-2xl shadow-black/10">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Candidate profile</p><h2 className="mt-1 text-xl font-semibold">{user?.profile.headline || "Add your professional headline"}</h2></div><span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300">Active</span></div>
            <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:grid-cols-2">
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Email</p><p className="mt-2 text-sm text-slate-200">{user?.email}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Location</p><p className="mt-2 text-sm text-slate-200">{user?.profile.location || "Not added yet"}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Current role</p><p className="mt-2 text-sm text-slate-200">{user?.profile.current_job_title || "Not added yet"}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-slate-500">Experience</p><p className="mt-2 text-sm text-slate-200">{user?.profile.years_of_experience ?? 0} years</p></div>
            </div>
          </article>
          <aside className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-7"><p className="text-sm font-medium text-indigo-200">Foundation complete</p><p className="mt-3 text-3xl font-semibold">Profile ready</p><p className="mt-3 text-sm leading-6 text-indigo-100/60">Your account and private candidate profile are securely connected.</p></aside>
        </section>
      </div>
    </main>
  );
}
