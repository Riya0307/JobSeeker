import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import ApplicationForm from "../applications/ApplicationForm";
import * as applicationsApi from "../applications/api";
import { applicationStatusLabel } from "../applications/format";
import type { Application } from "../applications/types";
import * as matchingApi from "../matching/api";
import MatchReasons from "../matching/MatchReasons";
import MatchScore from "../matching/MatchScore";
import AIExplanation from "../matching/AIExplanation";
import type { JobMatch } from "../matching/types";
import * as jobsApi from "./api";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import JobMetadata from "./JobMetadata";
import { JobListSkeleton, SectionError } from "./JobListState";
import type { Job } from "./types";

export default function JobDetailPage() {
  const { id } = useParams();
  return <JobDetail key={id} jobId={Number(id)} />;
}

function JobDetail({ jobId }: { jobId: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [match, setMatch] = useState<JobMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchingLoading, setMatchingLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [checkingApplication, setCheckingApplication] = useState(true);
  const [applicationError, setApplicationError] = useState("");
  const [applicationRetry, setApplicationRetry] = useState(0);
  const [applicationFormOpen, setApplicationFormOpen] = useState(false);
  const [jobRetry, setJobRetry] = useState(0);

  const loadJob = useCallback(async () => {
    if (!Number.isSafeInteger(jobId) || jobId <= 0) {
      setError("This job could not be found."); setLoading(false); return;
    }
    setLoading(true); setError(""); setJob(null);
    try { setJob(await jobsApi.getJob(jobId)); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, [jobId]);

  useEffect(() => { void loadJob(); }, [loadJob, jobRetry]);

  useEffect(() => {
    if (!Number.isSafeInteger(jobId) || jobId <= 0) { setCheckingApplication(false); return; }
    let active = true;
    setCheckingApplication(true); setApplicationError("");
    applicationsApi.findApplicationForJob(jobId).then((result) => { if (active) setApplication(result); })
      .catch((reason) => { if (active) setApplicationError(getApiError(reason)); })
      .finally(() => { if (active) setCheckingApplication(false); });
    return () => { active = false; };
  }, [jobId, applicationRetry]);

  useEffect(() => {
    if (!Number.isSafeInteger(jobId) || jobId <= 0) { setMatchingLoading(false); return; }
    let active = true;
    matchingApi.getJobMatch(jobId).then((result) => { if (active) setMatch(result); })
      .catch(() => undefined).finally(() => { if (active) setMatchingLoading(false); });
    return () => { active = false; };
  }, [jobId]);

  async function toggleSave() {
    if (!job) return;
    setSaving(true); setError("");
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id);
      const isSaved = !job.is_saved;
      setJob({ ...job, is_saved: isSaved });
      setMatch((current) => current ? { ...current, job: { ...current.job, is_saved: isSaved } } : current);
    } catch (reason) { setError(getApiError(reason)); }
    finally { setSaving(false); }
  }

  const returnTo = typeof location.state?.returnTo === "string" &&
    /^\/(?:jobs|matching|saved-jobs)(?:\?|$)/.test(location.state.returnTo)
    ? location.state.returnTo
    : location.state?.fromMatching ? "/matching" : "/jobs";
  const backLabel = returnTo.startsWith("/matching") ? "Recommendations" :
    returnTo.startsWith("/saved-jobs") ? "Saved jobs" : "Find jobs";
  const eligible = job?.is_active && (job.expires_at === null || Date.parse(job.expires_at) > Date.now());

  return (
    <main className="ws-page">
      <Link to={returnTo} className="ws-link mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm">
        <span className="rotate-180"><WorkspaceIcon name="arrow" size={16} /></span>{backLabel}
      </Link>
      {loading ? <JobListSkeleton label="Loading job details" /> :
        !job ? <div className="ws-card p-4">
          <h1 className="ws-heading mb-3">Unable to load job</h1>
          {Number.isSafeInteger(jobId) && jobId > 0
            ? <SectionError message={error} onRetry={() => setJobRetry((value) => value + 1)} />
            : <p role="alert" className="ws-alert">{error}</p>}
        </div> : (
          <>
            {error && <div role="alert" className="ws-alert mb-4">{error}</div>}
            <article>
              <header className="ws-card p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-[1_1_15rem]">
                    <p className="ws-muted mb-1 wrap-anywhere text-sm font-semibold">{job.company_name}</p>
                    <h1 className="ws-title wrap-anywhere">{job.title}</h1>
                  </div>
                  <button type="button" disabled={saving} onClick={() => void toggleSave()} className="ws-button" aria-pressed={job.is_saved}>
                    <WorkspaceIcon name="bookmark" size={17} />{saving ? "Updating…" : job.is_saved ? "Saved · Unsave" : "Save job"}
                  </button>
                </div>
                <div className="mt-4"><JobMetadata job={job} /></div>
              </header>

              <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,.42fr)]">
                <aside className="ws-card p-4 sm:p-5 xl:col-start-2 xl:row-start-1" aria-labelledby="job-application-heading">
                  <h2 id="job-application-heading" className="ws-heading">Application</h2>
                  <div className="mt-3 grid gap-2">
                    {checkingApplication ? <p role="status" className="ws-muted text-sm">Checking your application status…</p> :
                      application ? <Link to={`/applications/${application.id}`} className="ws-button">{applicationStatusLabel(application.status)} · View application</Link> :
                      applicationError ? <SectionError message={`Unable to check your application status. ${applicationError}`} onRetry={() => setApplicationRetry((value) => value + 1)} /> :
                      eligible ? <button type="button" className="ws-button ws-button-primary" onClick={() => setApplicationFormOpen(true)}>Apply for this job</button> :
                      <p className="ws-muted text-sm">This job is no longer accepting applications.</p>}
                    {eligible && job.application_url && (
                      <a href={job.application_url} target="_blank" rel="noopener noreferrer" className="ws-button text-center">
                        Company application page <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                </aside>

                <div className="grid min-w-0 gap-5 xl:col-start-1 xl:row-start-1">
                  <section className="ws-card p-4 sm:p-6">
                    <h2 className="ws-heading">About the role</h2>
                    <div className="ws-muted mt-3 max-w-[72ch] whitespace-pre-wrap wrap-anywhere text-sm leading-7 sm:text-base">{job.description}</div>
                    <div className="ws-divider mt-5 border-t pt-5">
                      <h3 className="font-semibold">Required skills</h3>
                      {job.skills.length ? <ul className="mt-3 flex flex-wrap gap-2">
                        {job.skills.map((skill) => <li key={skill} className="ws-badge max-w-full wrap-anywhere" data-tone="neutral">{skill}</li>)}
                      </ul> : <p className="ws-muted mt-2 text-sm">No skills specified.</p>}
                    </div>
                  </section>
                  {matchingLoading ? <JobListSkeleton label="Loading your match summary" /> : match && (
                    <section className="ws-card p-4 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="ws-heading">Your match for this role</h2><MatchScore score={match.match_score} />
                      </div>
                      <MatchReasons matchedSkills={match.matched_skills} missingSkills={match.missing_skills} reasons={match.reasons} />
                      <AIExplanation jobId={job.id} />
                    </section>
                  )}
                </div>
              </div>
            </article>
            {applicationFormOpen && eligible && <ApplicationForm jobId={job.id} jobTitle={job.title}
              onClose={() => setApplicationFormOpen(false)} onSuccess={(created) => {
                setApplication(created);
                setApplicationFormOpen(false);
                navigate(`/applications/${created.id}`, { state: { created: true } });
              }} />}
          </>
        )}
    </main>
  );
}
