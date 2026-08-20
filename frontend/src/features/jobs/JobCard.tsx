import { Link } from "react-router-dom";
import { formatExperience, formatSalary, titleCase } from "./format";
import type { Job } from "./types";

interface JobCardProps {
  job: Job;
  busy?: boolean;
  onToggleSave: (job: Job) => void;
}

export default function JobCard({ job, busy = false, onToggleSave }: JobCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 transition hover:border-cyan-400/25 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0"><h2 className="text-xl font-semibold tracking-tight text-white">{job.title}</h2><p className="mt-1 text-sm font-medium text-cyan-300">{job.company_name}</p></div>
        {job.is_saved && <span className="shrink-0 rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-medium text-cyan-300">Saved</span>}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
        <span>{job.location} · {titleCase(job.work_mode)}</span>
        <span>{formatExperience(job.experience_min, job.experience_max)}</span>
        <span>{formatSalary(job.salary_min, job.salary_max)}</span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {job.skills.slice(0, 6).map((skill) => <span key={skill} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{skill}</span>)}
        {job.skills.length > 6 && <span className="px-2 py-1 text-xs text-slate-500">+{job.skills.length - 6} more</span>}
      </div>
      <div className="mt-6 flex flex-col gap-2 border-t border-white/10 pt-5 sm:flex-row">
        <Link to={`/jobs/${job.id}`} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">View job</Link>
        <button disabled={busy} onClick={() => onToggleSave(job)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-300 disabled:opacity-50">{busy ? "Updating..." : job.is_saved ? "Unsave" : "Save"}</button>
      </div>
    </article>
  );
}
