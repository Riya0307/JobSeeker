import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import * as jobsApi from "./api";
import { formatDate, formatExperience, formatSalary, titleCase } from "./format";
import type { Job } from "./types";

export default function JobDetailPage() {
  const { id } = useParams();
  const jobId = Number(id);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!Number.isInteger(jobId) || jobId <= 0) { setError("This job could not be found."); setLoading(false); return; }
    jobsApi.getJob(jobId).then(setJob).catch((reason) => setError(getApiError(reason))).finally(() => setLoading(false));
  }, [jobId]);
  async function toggleSave() {
    if (!job) return; setSaving(true); setError("");
    try { if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id); setJob({ ...job, is_saved: !job.is_saved }); }
    catch (reason) { setError(getApiError(reason)); } finally { setSaving(false); }
  }
  if (loading) return <main className="mx-auto max-w-4xl px-4 py-12 text-sm text-slate-400 sm:px-6">Loading job details...</main>;
  if (!job) return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-red-200"><h1 className="text-xl font-semibold">Unable to load job</h1><p className="mt-2 text-sm">{error}</p></div><Link to="/jobs" className="mt-6 inline-block text-sm font-semibold text-cyan-300">← Back to jobs</Link></main>;
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/jobs" className="text-sm font-medium text-slate-400 hover:text-cyan-300">← Back to jobs</Link>
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <article className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <header className="border-b border-white/10 p-6 sm:p-8"><p className="text-sm font-semibold text-cyan-300">{job.company_name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{job.title}</h1><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300"><span>{job.location}</span><span>{titleCase(job.work_mode)}</span><span>{titleCase(job.employment_type)}</span><span>{formatExperience(job.experience_min, job.experience_max)}</span><span>{formatSalary(job.salary_min, job.salary_max)}</span></div><p className="mt-4 text-xs text-slate-500">Posted {formatDate(job.posted_at)}</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><a href={job.application_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-cyan-400 px-6 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-300">Apply externally ↗</a><button disabled={saving} onClick={() => void toggleSave()} className="rounded-xl border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-400/50 hover:text-cyan-300 disabled:opacity-50">{saving ? "Updating..." : job.is_saved ? "Unsave job" : "Save job"}</button></div></header>
        <div className="p-6 sm:p-8"><section><h2 className="text-lg font-semibold">Skills</h2><div className="mt-4 flex flex-wrap gap-2">{job.skills.length ? job.skills.map((skill) => <span key={skill} className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200">{skill}</span>) : <span className="text-sm text-slate-500">No skills specified.</span>}</div></section><section className="mt-8 border-t border-white/10 pt-8"><h2 className="text-lg font-semibold">About the role</h2><div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{job.description}</div></section></div>
      </article>
    </main>
  );
}
