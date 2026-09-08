import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiError, inputClass } from "../auth/formUtils";
import { formatDate, titleCase } from "../jobs/format";
import * as interviewsApi from "./api";
import { formatInterviewDate, formatInterviewDateTime, formatInterviewTime, interviewModeLabel, interviewStatusClass, interviewStatusLabel } from "./format";
import type { Interview, InterviewStatusAction } from "./types";

export default function InterviewDetailPage() {
  const { id } = useParams();
  const interviewId = Number(id);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [action, setAction] = useState<InterviewStatusAction | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleError, setRescheduleError] = useState("");
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    if (!Number.isInteger(interviewId) || interviewId <= 0) { setError("This interview could not be found."); setLoading(false); return; }
    setLoading(true); setError("");
    try { setInterview(await interviewsApi.getInterview(interviewId)); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, [interviewId, retry]);
  useEffect(() => { void load(); }, [load]);

  async function changeStatus(nextStatus: "completed" | "cancelled") {
    if (!interview || !window.confirm(`${nextStatus === "completed" ? "Mark" : "Cancel"} this interview${nextStatus === "completed" ? " as completed" : ""}?`)) return;
    setAction(nextStatus); setError(""); setSuccess("");
    try {
      await interviewsApi.updateInterviewStatus(interview.id, nextStatus);
      setInterview(await interviewsApi.getInterview(interview.id));
      setSuccess(nextStatus === "completed" ? "Interview marked as completed." : "Interview cancelled successfully.");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setAction(null); }
  }

  async function reschedule(event: FormEvent) {
    event.preventDefault();
    if (!interview || !rescheduleAt) { setRescheduleError("Choose a new date and time."); return; }
    const parsed = new Date(rescheduleAt);
    if (Number.isNaN(parsed.getTime())) { setRescheduleError("Choose a valid date and time."); return; }
    if (parsed.getTime() === new Date(interview.scheduled_at).getTime()) { setRescheduleError("Choose a different date or time."); return; }
    setAction("rescheduled"); setRescheduleError(""); setError(""); setSuccess("");
    try {
      await interviewsApi.updateInterviewStatus(interview.id, "rescheduled", parsed.toISOString());
      setInterview(await interviewsApi.getInterview(interview.id));
      setRescheduleOpen(false); setSuccess("Interview rescheduled successfully.");
    } catch (reason) { setRescheduleError(getApiError(reason)); }
    finally { setAction(null); }
  }

  if (loading) return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div className="h-[32rem] animate-pulse rounded-2xl bg-slate-900/70" aria-label="Loading interview details" /></main>;
  if (!interview) return <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6"><div role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-red-200"><h1 className="text-xl font-semibold">Unable to load interview</h1><p className="mt-2 text-sm">{error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-4 rounded-lg border border-red-300/30 px-4 py-2 text-sm font-semibold">Try again</button></div><Link to="/interviews" className="mt-6 inline-block text-sm font-semibold text-cyan-300">← Back to interviews</Link></main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link to="/interviews" className="text-sm font-medium text-slate-400 hover:text-cyan-300">← Back to interviews</Link>
      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <article className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <header className="border-b border-white/10 p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-cyan-300">{interview.application.job.company_name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{interview.round_name}</h1><p className="mt-2 text-lg text-slate-200">{interview.application.job.title}</p><p className="mt-3 text-sm text-slate-400">{interview.application.job.location} · {titleCase(interview.application.job.work_mode)} · {titleCase(interview.application.job.employment_type)}</p></div><span className={`w-fit rounded-full border px-3 py-1 text-sm font-semibold ${interviewStatusClass(interview.status)}`}>{interviewStatusLabel(interview.status)}</span></div>
          {interview.status === "scheduled" && <div className="mt-7 flex flex-col gap-3 sm:flex-row"><button disabled={action !== null} onClick={() => void changeStatus("completed")} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{action === "completed" ? "Updating..." : "Mark completed"}</button><button disabled={action !== null} onClick={() => { setRescheduleOpen(true); setRescheduleError(""); }} className="rounded-xl border border-amber-400/30 px-5 py-3 text-sm font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-50">Reschedule</button><button disabled={action !== null} onClick={() => void changeStatus("cancelled")} className="rounded-xl border border-red-400/30 px-5 py-3 text-sm font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-50">{action === "cancelled" ? "Cancelling..." : "Cancel interview"}</button></div>}
        </header>
        <div className="space-y-8 p-6 sm:p-8"><section><h2 className="text-lg font-semibold">Schedule</h2><dl className="mt-4 grid gap-5 sm:grid-cols-3"><div><dt className="text-xs uppercase tracking-wider text-slate-500">Date</dt><dd className="mt-1 text-sm text-slate-200">{formatInterviewDate(interview.scheduled_at)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-slate-500">Time</dt><dd className="mt-1 text-sm text-slate-200">{formatInterviewTime(interview.scheduled_at)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-slate-500">Duration</dt><dd className="mt-1 text-sm text-slate-200">{interview.duration_minutes} minutes</dd></div></dl></section>
          <section className="border-t border-white/10 pt-7"><h2 className="text-lg font-semibold">Interview details</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wider text-slate-500">Mode</dt><dd className="mt-1 text-sm text-slate-200">{interviewModeLabel(interview.mode)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-slate-500">Location</dt><dd className="mt-1 text-sm text-slate-200">{interview.location || "Not provided"}</dd></div><div className="sm:col-span-2"><dt className="text-xs uppercase tracking-wider text-slate-500">Meeting link</dt><dd className="mt-1 text-sm">{interview.meeting_link ? <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-cyan-300 hover:text-cyan-200">Open meeting link ↗</a> : <span className="text-slate-500">Not provided</span>}</dd></div></dl></section>
          <section className="border-t border-white/10 pt-7"><h2 className="text-lg font-semibold">Notes</h2>{interview.notes ? <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{interview.notes}</p> : <p className="mt-3 text-sm text-slate-500">No notes provided.</p>}</section>
          <section className="border-t border-white/10 pt-7"><h2 className="text-lg font-semibold">Application</h2><p className="mt-2 text-sm text-slate-400">Application reference #{interview.application.id}</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><Link to={`/applications/${interview.application.id}`} className="rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-semibold text-slate-200 hover:border-slate-500">View application</Link><Link to={`/jobs/${interview.application.job.id}`} className="rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-semibold text-slate-200 hover:border-slate-500">View job</Link></div></section>
          <p className="border-t border-white/10 pt-5 text-xs text-slate-500">Created {formatDate(interview.created_at)} · Updated {formatInterviewDateTime(interview.updated_at)}</p>
        </div>
      </article>
      {rescheduleOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="reschedule-title" onMouseDown={(event) => { if (event.target === event.currentTarget && action === null) setRescheduleOpen(false); }}><div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6"><h2 id="reschedule-title" className="text-xl font-semibold">Reschedule interview</h2><p className="mt-2 text-sm text-slate-400">Choose a new date and time in your local timezone.</p>{rescheduleError && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{rescheduleError}</p>}<form onSubmit={(event) => void reschedule(event)} className="mt-5"><label className="text-sm text-slate-300">New date and time<input autoFocus required type="datetime-local" className={inputClass} value={rescheduleAt} onChange={(event) => setRescheduleAt(event.target.value)} /></label><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={action !== null} onClick={() => setRescheduleOpen(false)} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">Cancel</button><button disabled={action !== null} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{action === "rescheduled" ? "Rescheduling..." : "Confirm reschedule"}</button></div></form></div></div>}
    </main>
  );
}
