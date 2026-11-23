import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import { RowsSkeleton, SectionError } from "../../components/dashboard/DashboardStates";
import { formatDate, titleCase } from "../jobs/format";
import * as interviewsApi from "./api";
import InterviewPreparationPanel from "./InterviewPreparationPanel";
import { formatInterviewDate, formatInterviewDateTime, formatInterviewTime, interviewModeLabel, interviewStatusTone, interviewStatusLabel } from "./format";
import type { Interview, InterviewStatusAction } from "./types";

export default function InterviewDetailPage() {
  const { id } = useParams();
  return <InterviewDetails key={id} interviewId={Number(id)} />;
}

function InterviewDetails({ interviewId }: { interviewId: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
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
  useEffect(() => {
    if (!rescheduleOpen) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [rescheduleOpen]);

  async function changeStatus(nextStatus: "completed" | "cancelled") {
    if (!interview || !window.confirm(`${nextStatus === "completed" ? "Mark" : "Cancel"} this interview${nextStatus === "completed" ? " as completed" : ""}?`)) return;
    setAction(nextStatus); setError(""); setSuccess("");
    try {
      setInterview(await interviewsApi.updateInterviewStatus(interview.id, nextStatus));
      setSuccess(nextStatus === "completed" ? "Interview marked as completed." : "Interview cancelled successfully.");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setAction(null); }
  }

  async function reschedule(event: FormEvent) {
    event.preventDefault();
    if (!interview || !rescheduleAt) { setRescheduleError("Choose a new date and time."); return; }
    const parsed = new Date(rescheduleAt);
    if (Number.isNaN(parsed.getTime())) { setRescheduleError("Choose a valid date and time."); return; }
    if (parsed.getTime() <= Date.now()) { setRescheduleError("Choose a future date and time."); return; }
    if (parsed.getTime() === new Date(interview.scheduled_at).getTime()) { setRescheduleError("Choose a different date or time."); return; }
    setAction("rescheduled"); setRescheduleError(""); setError(""); setSuccess("");
    try {
      setInterview(await interviewsApi.updateInterviewStatus(interview.id, "rescheduled", parsed.toISOString()));
      setRescheduleOpen(false); setSuccess("Interview rescheduled successfully.");
    } catch (reason) { setRescheduleError(getApiError(reason)); }
    finally { setAction(null); }
  }

  return (
    <main className="ws-page">
      <Link to="/interviews" className="ws-link mb-4 inline-flex min-h-10 items-center text-sm">← Back to interviews</Link>
      {success && <p role="status" className="ws-notice mb-4">{success}</p>}
      {loading ? <div className="ws-card px-4"><RowsSkeleton label="Loading interview details" /></div> :
        !interview ? <SectionError message={error || "Unable to load interview."} onRetry={() => setRetry((value) => value + 1)} /> : (
          <div className="grid gap-4">
            {error && <p role="alert" className="ws-alert">{error}</p>}
            <article className="grid gap-4">
              <header className="ws-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-[1_1_16rem]">
                    <p className="ws-muted mb-1 wrap-anywhere text-sm font-semibold">{interview.application.job.company_name}</p>
                    <h1 className="ws-title wrap-anywhere">{interview.round_name}</h1>
                    <p className="mt-2 wrap-anywhere font-semibold">{interview.application.job.title}</p>
                    <p className="ws-muted mt-1 wrap-anywhere text-sm">{interview.application.job.location} · {titleCase(interview.application.job.work_mode)} · {titleCase(interview.application.job.employment_type)}</p>
                  </div>
                  <span className="ws-badge" data-tone={interviewStatusTone(interview.status)}>{interviewStatusLabel(interview.status)}</span>
                </div>
                {interview.status === "scheduled" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className="ws-button ws-button-primary" disabled={action !== null}
                      onClick={() => { setRescheduleOpen(true); setRescheduleError(""); }}>Reschedule</button>
                    <button type="button" className="ws-button" disabled={action !== null} onClick={() => void changeStatus("completed")}>
                      {action === "completed" ? "Updating…" : "Mark completed"}
                    </button>
                    <button type="button" className="ws-button ws-button-danger" disabled={action !== null} onClick={() => void changeStatus("cancelled")}>
                      {action === "cancelled" ? "Cancelling…" : "Cancel interview"}
                    </button>
                  </div>
                )}
              </header>
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,.6fr)]">
                <div className="grid min-w-0 gap-4">
                  <section className="ws-card p-4 sm:p-5">
                    <h2 className="ws-heading">Schedule and logistics</h2>
                    <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
                      <div><dt className="ws-muted text-xs">Date and time</dt><dd><time dateTime={interview.scheduled_at}>{formatInterviewDate(interview.scheduled_at)} · {formatInterviewTime(interview.scheduled_at)}</time></dd></div>
                      <div><dt className="ws-muted text-xs">Duration</dt><dd>{interview.duration_minutes} minutes</dd></div>
                      <div><dt className="ws-muted text-xs">Mode</dt><dd>{interviewModeLabel(interview.mode)}</dd></div>
                      {(interview.location || interview.mode === "in_person") && <div><dt className="ws-muted text-xs">Location</dt><dd className="wrap-anywhere">{interview.location || "Not provided"}</dd></div>}
                      {(interview.meeting_link || interview.mode === "online") && (
                        <div className="sm:col-span-2"><dt className="ws-muted text-xs">Meeting link</dt><dd>
                          {interview.meeting_link ? <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer" className="ws-link inline-flex min-h-10 items-center">Open meeting link ↗</a> : "Not provided"}
                        </dd></div>
                      )}
                    </dl>
                  </section>
                  <section className="ws-card p-4 sm:p-5">
                    <h2 className="ws-heading">Notes</h2>
                    <p className="ws-muted mt-2 whitespace-pre-wrap wrap-anywhere text-sm leading-6">{interview.notes || "No notes provided."}</p>
                  </section>
                </div>
                <section className="ws-card p-4 sm:p-5">
                  <h2 className="ws-heading">Associated application</h2>
                  <p className="ws-muted mt-2 text-sm">Application #{interview.application.id}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/applications/${interview.application.id}`} className="ws-button">View application</Link>
                    <Link to={`/jobs/${interview.application.job.id}`} className="ws-button">View job</Link>
                  </div>
                  <dl className="ws-divider mt-4 grid gap-2 border-t pt-3 text-sm">
                    <div><dt className="ws-muted text-xs">Created</dt><dd><time dateTime={interview.created_at}>{formatDate(interview.created_at)}</time></dd></div>
                    <div><dt className="ws-muted text-xs">Last updated</dt><dd><time dateTime={interview.updated_at}>{formatInterviewDateTime(interview.updated_at)}</time></dd></div>
                  </dl>
                </section>
              </div>
            </article>
            {interview.id === interviewId && ["scheduled", "rescheduled"].includes(interview.status) && (
              <InterviewPreparationPanel key={`${interview.id}:${interview.updated_at}`} interviewId={interview.id} />
            )}
          </div>
        )}
      {rescheduleOpen && (
        <dialog ref={dialog} className="ws-dialog w-[min(28rem,calc(100vw-2rem))]" aria-labelledby="reschedule-title"
          onCancel={(event) => { event.preventDefault(); if (!action) setRescheduleOpen(false); }}
          onClick={(event) => { if (event.target === event.currentTarget && !action) setRescheduleOpen(false); }}>
          <div className="p-4 sm:p-6">
            <h2 id="reschedule-title" className="ws-heading">Reschedule interview</h2>
            <p className="ws-muted mt-2 text-sm">Choose a new date and time in your local timezone.</p>
            {rescheduleError && <p role="alert" className="ws-alert mt-3">{rescheduleError}</p>}
            <form onSubmit={(event) => void reschedule(event)} className="mt-4">
              <label className="block text-sm font-semibold">New date and time
                <input autoFocus required type="datetime-local" className="ws-control mt-2 min-w-0" value={rescheduleAt}
                  onChange={(event) => setRescheduleAt(event.target.value)} />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={action !== null} onClick={() => setRescheduleOpen(false)} className="ws-button">Cancel</button>
                <button type="submit" disabled={action !== null} className="ws-button ws-button-primary">
                  {action === "rescheduled" ? "Rescheduling…" : "Confirm reschedule"}
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </main>
  );
}
