import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import ActivityCard from "../components/dashboard/ActivityCard";
import DashboardSection from "../components/dashboard/DashboardSection";
import { EmptyState, RowsSkeleton, SectionError } from "../components/dashboard/DashboardStates";
import ProfileCompletion from "../components/dashboard/ProfileCompletion";
import { useDashboardData } from "../components/dashboard/useDashboardData";
import WorkspaceIcon from "../components/WorkspaceIcon";
import { applicationStatusLabel } from "../features/applications/format";
import type { ApplicationStatus } from "../features/applications/types";
import { useAuth } from "../features/auth/AuthContext";
import { getApiError } from "../features/auth/formUtils";
import { formatInterviewDateTime, interviewModeLabel } from "../features/interviews/format";
import * as jobsApi from "../features/jobs/api";
import { formatDate, titleCase } from "../features/jobs/format";
import type { Job } from "../features/jobs/types";

const statusTones: Partial<Record<ApplicationStatus, string>> = {
  under_review: "warning", shortlisted: "success", interview: "success",
  rejected: "error", withdrawn: "error",
};

const interviewDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

export default function DashboardPage() {
  const { user } = useAuth();
  const { profile, resumes, applications, interviews, savedJobs, matches } = useDashboardData();
  const [savingJobId, setSavingJobId] = useState<number | null>(null);
  const saving = useRef(false);
  const [saveError, setSaveError] = useState("");

  async function toggleSave(job: Job) {
    if (saving.current) return;
    saving.current = true;
    setSavingJobId(job.id);
    setSaveError("");
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id);
      else await jobsApi.saveJob(job.id);
      matches.setData((result) => result && ({
        ...result,
        results: result.results.map((match) => match.job.id === job.id
          ? { ...match, job: { ...match.job, is_saved: !job.is_saved } }
          : match),
      }));
      savedJobs.retry();
    } catch (error) {
      setSaveError(getApiError(error));
    } finally {
      saving.current = false;
      setSavingJobId(null);
    }
  }

  if (!user) return null;
  const name = [user.first_name.trim(), user.last_name.trim()].filter(Boolean).join(" ");
  const upcoming = interviews.data?.results.filter((interview) => Date.parse(interview.scheduled_at) >= Date.now());

  return (
    <main className="ws-page">
      <section className="ws-card ws-welcome grid gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(17rem,0.58fr)] xl:items-center">
        <div className="min-w-0">
          <h1 className="ws-title wrap-anywhere">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
          <p className="ws-muted mt-2 text-sm sm:text-base">Find your next role and keep track of your progress.</p>
          {profile.data?.headline && <p className="ws-muted mt-1 break-words text-sm">{profile.data.headline}</p>}
          <Link to="/jobs" className="ws-button ws-button-primary mt-4"><WorkspaceIcon name="search" size={17} /> Find jobs</Link>
        </div>
        <div className="ws-card p-3.5 sm:p-4">
          {profile.loading || resumes.loading ? <RowsSkeleton rows={1} label="Loading profile completion" /> :
            profile.error ? <SectionError message={profile.error} onRetry={profile.retry} /> :
            resumes.error ? <SectionError message={resumes.error} onRetry={resumes.retry} /> :
            profile.data && resumes.data !== null && <ProfileCompletion user={user} profile={profile.data} resumeCount={resumes.data} />}
        </div>
      </section>

      <section className="mt-6" aria-labelledby="career-overview">
        <h2 id="career-overview" className="ws-heading mb-3">Career overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <ActivityCard label="Applications" icon="briefcase" value={applications.data?.count ?? null} path="/applications" error={applications.error} onRetry={applications.retry} />
          <ActivityCard label="Upcoming interviews" icon="calendar" value={interviews.data?.count ?? null} path="/interviews?upcoming=true" error={interviews.error} onRetry={interviews.retry} />
          <ActivityCard label="Saved jobs" icon="bookmark" value={savedJobs.data?.count ?? null} path="/saved-jobs" error={savedJobs.error} onRetry={savedJobs.retry} />
          <ActivityCard label="Recommended jobs" icon="spark" value={matches.data?.count ?? null} path="/matching" error={matches.error} onRetry={matches.retry} />
        </div>
        {savedJobs.data?.count === 0 && !savedJobs.loading && !savedJobs.error && (
          <p className="ws-muted mt-3 text-sm">No saved jobs yet. <Link to="/jobs" className="ws-link">Browse roles to save</Link>.</p>
        )}
      </section>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <DashboardSection title="Recommended jobs" actionLabel="All recommendations" actionPath="/matching">
          {matches.loading ? <RowsSkeleton label="Loading recommendations" /> :
            matches.error ? <SectionError message={matches.error} onRetry={matches.retry} /> :
            matches.data?.results.length ? (
              <>
                {saveError && <p role="alert" className="ws-alert mb-2">{saveError}</p>}
                <ul>
                  {matches.data.results.map((match) => {
                    const { job } = match;
                    return (
                      <li key={job.id} className="ws-divider flex items-start gap-3 border-b py-3 last:border-0">
                        <span className="ws-avatar grid size-10 shrink-0 place-items-center rounded-lg"><WorkspaceIcon name="briefcase" size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <Link to={`/jobs/${job.id}`} state={{ fromMatching: true }} className="ws-link break-words text-sm">{job.title}</Link>
                          <p className="mt-0.5 break-words text-sm">{job.company_name}</p>
                          <p className="ws-muted mt-1 flex gap-1 break-words text-xs">
                            <WorkspaceIcon name="pin" size={14} /><span>{job.location} · {titleCase(job.work_mode)}</span>
                          </p>
                          {match.reasons[0] && <p className="ws-muted mt-2 break-words text-xs leading-relaxed">{match.reasons[0]}</p>}
                          <p className="ws-badge mt-2" data-tone="success">{match.match_score}% match</p>
                        </div>
                        <button type="button" className={`ws-icon-button ${job.is_saved ? "ws-avatar" : ""}`}
                          aria-label={`Save ${job.title}`} aria-pressed={job.is_saved} disabled={savingJobId !== null}
                          title={job.is_saved ? "Remove from saved jobs" : "Save job"}
                          onClick={() => void toggleSave(job)}><WorkspaceIcon name="bookmark" size={18} /></button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : <EmptyState title="No recommendations yet"><Link to="/profile" className="ws-link">Update your profile and skills</Link> to improve your recommendations.</EmptyState>}
        </DashboardSection>

        <div className="grid min-w-0 gap-5">
          <DashboardSection title="Upcoming interviews" actionLabel="All interviews" actionPath="/interviews?upcoming=true">
            {interviews.loading ? <RowsSkeleton rows={2} label="Loading interviews" /> :
              interviews.error ? <SectionError message={interviews.error} onRetry={interviews.retry} /> :
              upcoming?.length ? (
                <ul>
                  {upcoming.map((interview) => (
                    <li key={interview.id} className="ws-divider border-b last:border-0">
                      <Link to={`/interviews/${interview.id}`} className="ws-row flex items-start gap-3 rounded-md px-1 py-3">
                        <span aria-hidden="true" className="ws-badge shrink-0">{interviewDate.format(new Date(interview.scheduled_at))}</span>
                        <div className="min-w-0 break-words text-sm">
                          <p className="font-semibold">{interview.round_name}</p>
                          <p className="ws-muted mt-0.5">{interview.application.job.title} · {interview.application.job.company_name}</p>
                          <p className="ws-muted mt-1 text-xs">
                            <time dateTime={interview.scheduled_at}>{formatInterviewDateTime(interview.scheduled_at)}</time> · {interviewModeLabel(interview.mode)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No upcoming interviews">Scheduled interviews will appear here.</EmptyState>}
          </DashboardSection>
          <DashboardSection title="Recent applications" actionLabel="All applications" actionPath="/applications">
            {applications.loading ? <RowsSkeleton label="Loading applications" /> :
              applications.error ? <SectionError message={applications.error} onRetry={applications.retry} /> :
              applications.data?.results.length ? (
                <ul>
                  {applications.data.results.map((application) => (
                    <li key={application.id} className="ws-divider border-b last:border-0">
                      <Link to={`/applications/${application.id}`} className="ws-row flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md px-1 py-3">
                        <div className="min-w-0 flex-[1_1_8rem] break-words text-sm">
                          <p className="font-semibold">{application.job.title}</p>
                          <p className="ws-muted mt-0.5">{application.job.company_name}</p>
                          <p className="ws-muted mt-1 text-xs">Applied <time dateTime={application.applied_at}>{formatDate(application.applied_at)}</time></p>
                        </div>
                        <span className="ws-badge shrink-0" data-tone={statusTones[application.status]}>{applicationStatusLabel(application.status)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState title="No applications yet"><Link to="/jobs" className="ws-link">Find jobs to apply for</Link>.</EmptyState>}
          </DashboardSection>
        </div>
      </div>
    </main>
  );
}
