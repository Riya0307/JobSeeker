import { alertCriteria, formatDate } from "./format";
import type { JobAlert } from "./types";

interface JobAlertCardProps {
  alert: JobAlert;
  busy: boolean;
  onEdit: (alert: JobAlert) => void;
  onToggle: (alert: JobAlert) => void;
  onDelete: (alert: JobAlert) => void;
}

export default function JobAlertCard({ alert, busy, onEdit, onToggle, onDelete }: JobAlertCardProps) {
  const criteria = alertCriteria(alert);
  return (
    <article className={`rounded-2xl border p-5 sm:p-6 ${alert.is_active ? "border-cyan-400/20 bg-slate-900/70" : "border-white/10 bg-slate-900/35 opacity-80"}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold text-white">{alert.name}</h2><p className="mt-1 text-xs text-slate-500">Updated {formatDate(alert.updated_at)}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${alert.is_active ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-400"}`}>{alert.is_active ? "Active" : "Inactive"}</span></header>
      <div className="mt-5 flex flex-wrap gap-2">{criteria.map((criterion) => <span key={criterion} className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-slate-300">{criterion}</span>)}</div>
      <section className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Skills</h3><div className="mt-2 flex flex-wrap gap-2">{alert.skills.length ? alert.skills.map((skill) => <span key={skill} className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">{skill}</span>) : <span className="text-sm text-slate-500">Any skills</span>}</div></section>
      <p className="mt-5 text-xs text-slate-500">Created {formatDate(alert.created_at)}{alert.last_checked_at ? ` · Last checked ${formatDate(alert.last_checked_at)}` : ""}</p>
      <footer className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row"><button type="button" disabled={busy} onClick={() => onToggle(alert)} className="rounded-lg border border-cyan-400/25 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50">{busy ? "Updating…" : alert.is_active ? "Deactivate" : "Activate"}</button><button type="button" disabled={busy} onClick={() => onEdit(alert)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500 disabled:opacity-50">Edit</button><button type="button" disabled={busy} onClick={() => onDelete(alert)} className="rounded-lg border border-red-400/25 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-50">Delete</button></footer>
    </article>
  );
}
