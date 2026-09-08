import { Link } from "react-router-dom";
import { formatDate, titleCase } from "../jobs/format";
import { applicationStatusClass, applicationStatusLabel } from "./format";
import type { Application } from "./types";

interface ApplicationCardProps {
  application: Application;
  withdrawing: boolean;
  onWithdraw: (application: Application) => void;
}

export default function ApplicationCard({ application, withdrawing, onWithdraw }: ApplicationCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h2 className="text-xl font-semibold tracking-tight">{application.job.title}</h2><p className="mt-1 text-sm font-medium text-cyan-300">{application.job.company_name}</p><p className="mt-3 text-sm text-slate-400">{application.job.location} · {titleCase(application.job.work_mode)}</p></div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${applicationStatusClass(application.status)}`}>{applicationStatusLabel(application.status)}</span>
      </div>
      <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-3">
        <div><dt className="text-xs uppercase tracking-wider text-slate-500">Applied</dt><dd className="mt-1 text-slate-200">{formatDate(application.applied_at)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-slate-500">Resume</dt><dd className="mt-1 truncate text-slate-200" title={application.resume.file_name}>{application.resume.title}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-slate-500">Last updated</dt><dd className="mt-1 text-slate-200">{formatDate(application.updated_at)}</dd></div>
      </dl>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row"><Link to={`/applications/${application.id}`} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-300">View details</Link>{application.status === "applied" && <button disabled={withdrawing} onClick={() => onWithdraw(application)} className="rounded-lg border border-red-400/25 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-50">{withdrawing ? "Withdrawing..." : "Withdraw"}</button>}<Link to={`/jobs/${application.job.id}`} className="rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold text-slate-300 hover:border-slate-500">View job</Link></div>
    </article>
  );
}
