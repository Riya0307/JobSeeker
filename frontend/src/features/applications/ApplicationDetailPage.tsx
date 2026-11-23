import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { RowsSkeleton, SectionError } from "../../components/dashboard/DashboardStates";
import { getApiError } from "../auth/formUtils";
import { formatDate, titleCase } from "../jobs/format";
import * as applicationsApi from "./api";
import { applicationStatusTone, applicationStatusLabel, formatFileSize } from "./format";
import type { Application } from "./types";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  return <ApplicationDetails key={id} applicationId={Number(id)} />;
}

function ApplicationDetails({ applicationId }: { applicationId: number }) {
  const location = useLocation();
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

  return (
    <main className="ws-page">
      <Link to="/applications" className="ws-link mb-4 inline-flex min-h-10 items-center text-sm">← Back to applications</Link>
      {success && <p role="status" className="ws-notice mb-4">{success}</p>}
      {loading ? <div className="ws-card px-4"><RowsSkeleton label="Loading application details" /></div> :
        !application ? <SectionError message={error || "Unable to load application."} onRetry={() => setRetry((value) => value + 1)} /> : (
          <article className="grid gap-4">
            {error && <p role="alert" className="ws-alert">{error}</p>}
            <header className="ws-card p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-[1_1_16rem]">
                  <p className="ws-muted mb-1 wrap-anywhere text-sm font-semibold">{application.job.company_name}</p>
                  <h1 className="ws-title wrap-anywhere">{application.job.title}</h1>
                  <p className="ws-muted mt-2 wrap-anywhere text-sm">{application.job.location} · {titleCase(application.job.work_mode)} · {titleCase(application.job.employment_type)}</p>
                </div>
                <span className="ws-badge" data-tone={applicationStatusTone(application.status)}>{applicationStatusLabel(application.status)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/jobs/${application.job.id}`} className="ws-button">View job</Link>
                {application.status === "applied" && <button type="button" className="ws-button ws-button-danger" disabled={withdrawing}
                  onClick={() => void withdraw()}>{withdrawing ? "Withdrawing…" : "Withdraw application"}</button>}
              </div>
            </header>

            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,.65fr)]">
              <section className="ws-card p-4 sm:p-6">
                <h2 className="ws-heading">Cover letter</h2>
                <p className="ws-muted mt-3 max-w-[72ch] whitespace-pre-wrap wrap-anywhere text-sm leading-7">{application.cover_letter || "No cover letter was included."}</p>
              </section>
              <div className="grid min-w-0 gap-4">
                <section className="ws-card p-4 sm:p-5">
                  <h2 className="ws-heading">Submitted resume</h2>
                  <p className="mt-2 wrap-anywhere text-sm font-semibold">{application.resume.title}</p>
                  <p className="ws-muted mt-1 wrap-anywhere text-sm">{application.resume.file_name} · {formatFileSize(application.resume.file_size)}</p>
                  {application.resume.is_primary && <span className="ws-badge mt-2">Primary resume</span>}
                </section>
                <section className="ws-card p-4 sm:p-5">
                  <h2 className="ws-heading">Application dates</h2>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div><dt className="ws-muted text-xs">Submitted</dt><dd><time dateTime={application.applied_at}>{formatDate(application.applied_at)}</time></dd></div>
                    <div><dt className="ws-muted text-xs">Last updated</dt><dd><time dateTime={application.updated_at}>{formatDate(application.updated_at)}</time></dd></div>
                    {application.withdrawn_at && <div><dt className="ws-muted text-xs">Withdrawn</dt><dd><time dateTime={application.withdrawn_at}>{formatDate(application.withdrawn_at)}</time></dd></div>}
                  </dl>
                </section>
              </div>
            </div>
          </article>
        )}
    </main>
  );
}
