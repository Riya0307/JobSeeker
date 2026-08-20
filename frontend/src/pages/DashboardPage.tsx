import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";

const cards = [
  { title: "Profile", description: "Manage your professional information", path: "/profile", accent: "cyan" },
  { title: "Resumes", description: "Upload and manage your resumes", path: "/resumes", accent: "indigo" },
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Candidate workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {user?.first_name}.</h1>
      <p className="mt-3 max-w-2xl text-slate-400">Keep your candidate profile current and your application-ready resumes organized.</p>
      <section className="mt-10 grid gap-6 sm:grid-cols-2">
        {cards.map((card) => <Link key={card.path} to={card.path} className={`group rounded-2xl border p-7 transition hover:-translate-y-0.5 ${card.accent === "cyan" ? "border-cyan-400/20 bg-cyan-400/5 hover:border-cyan-400/40" : "border-indigo-400/20 bg-indigo-400/5 hover:border-indigo-400/40"}`}>
          <h2 className="text-xl font-semibold">{card.title}</h2><p className="mt-3 text-sm text-slate-400">{card.description}</p><span className="mt-8 inline-block text-sm font-medium text-cyan-300 group-hover:text-cyan-200">Open {card.title.toLowerCase()} →</span>
        </Link>)}
      </section>
    </main>
  );
}
