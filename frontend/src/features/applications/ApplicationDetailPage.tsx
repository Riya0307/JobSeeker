import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import { formatDate, titleCase } from "../jobs/format";
import * as applicationsApi from "./api";
import { applicationStatusClass, applicationStatusLabel, formatFileSize } from "./format";
import type { Application } from "./types";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const applicationId = Number(id);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(location.state?.created ? "Application submitted successfully." : "");
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isInteger(applicationId) || applicationId <= 0) { setError("This application could not be found."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setApplication(await applicationsApi.getApplication(applicationId)); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, [applicationId, retry]);
  useEffect(() => { void load(); }, [load]);

  async function withdraw() {
    if (!application || !window.confirm(`Withdraw your application for ${application.job.title}? This cannot be reversed.`)) return;
    setWithdrawing(true); setError(""); setSuccess("");
    try { setApplication(await applicationsApi.withdrawApplication(application.id)); setSuccess("Application withdrawn successfully."); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setWithdrawing(false); }
  }

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div className="h-96 animate-pulse rounded-2xl bg-slate-900/70" aria-label="Loading application details" /></main>;
  if (!application) return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-red-200"><h1 className="text-xl font-semibold">Unable to load application</h1><p className="mt-2 text-sm">{error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-lg border border-red-300/30 px-4 py-2 text-sm font-semibold">Try again</button></div><Link to="/applications" className="mt-6 inline-block text-sm font-semibold text-cyan-300">← Back to applications</Link></main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/applications" className="text-sm font-medium text-slate-400 hover:text-cyan-300">← Back to applications</Link>
      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <article className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <header className="border-b border-white/10 p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-cyan-300">{application.job.company_name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{application.job.title}</h1><p className="mt-3 text-sm text-slate-400">{application.job.location} · {titleCase(application.job.work_mode)} · {titleCase(application.job.employment_type)}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-sm font-semibold ${applicationStatusClass(application.status)}`}>{applicationStatusLabel(application.status)}</span></div><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link to={`/jobs/${application.job.id}`} className="rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-semibold text-slate-200 hover:border-slate-500">View job</Link>{application.status === "applied" && <button disabled={withdrawing} onClick={() => void withdraw()} className="rounded-xl border border-red-400/25 px-5 py-3 text-sm font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-50">{withdrawing ? "Withdrawing..." : "Withdraw application"}</button>}</div></header>
        <div className="space-y-8 p-6 sm:p-8"><dl className="grid gap-5 sm:grid-cols-3"><div><dt className="text-xs uppercase tracking-wider text-slate-500">Applied</dt><dd className="mt-1 text-sm text-slate-200">{formatDate(application.applied_at)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-slate-500">Last updated</dt><dd className="mt-1 text-sm text-slate-200">{formatDate(application.updated_at)}</dd></div>{application.withdrawn_at && <div><dt className="text-xs uppercase tracking-wider text-slate-500">Withdrawn</dt><dd className="mt-1 text-sm text-slate-200">{formatDate(application.withdrawn_at)}</dd></div>}</dl>
          <section className="border-t border-white/10 pt-7"><h2 className="text-lg font-semibold">Selected resume</h2><div className="mt-4 rounded-xl bg-white/5 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{application.resume.title}</p><p className="mt-1 text-sm text-slate-400">{application.resume.file_name} · {formatFileSize(application.resume.file_size)}</p></div>{application.resume.is_primary && <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">Primary</span>}</div></div></section>
          <section className="border-t border-white/10 pt-7"><h2 className="text-lg font-semibold">Cover letter</h2>{application.cover_letter ? <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{application.cover_letter}</p> : <p className="mt-3 text-sm text-slate-500">No cover letter was included.</p>}</section>
        </div>
      </article>
    </main>
  );
}
