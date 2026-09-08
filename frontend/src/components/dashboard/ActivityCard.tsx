import { Link } from "react-router-dom";

interface ActivityCardProps {
  label: string;
  value: number | null;
  path: string;
  error?: boolean;
  onRetry?: () => void;
}

export default function ActivityCard({ label, value, path, error = false, onRetry }: ActivityCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <p className="text-sm font-medium text-slate-400">{label}</p>
      {error ? <div className="mt-3"><p className="text-sm text-red-200">Unavailable</p>{onRetry && <button onClick={onRetry} className="mt-2 text-xs font-semibold text-cyan-300">Retry</button>}</div> : value === null ? <div className="mt-3 h-9 w-16 animate-pulse rounded bg-white/5" aria-label={`Loading ${label}`} /> : <p className="mt-2 text-3xl font-semibold text-white">{value}</p>}
      <Link to={path} className="mt-4 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200">View {label.toLowerCase()} →</Link>
    </article>
  );
}
