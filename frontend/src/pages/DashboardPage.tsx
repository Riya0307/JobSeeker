import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ActivityCard from "../components/dashboard/ActivityCard";
import DashboardSection from "../components/dashboard/DashboardSection";
import ProfileCompletion from "../components/dashboard/ProfileCompletion";
import * as applicationsApi from "../features/applications/api";
import { applicationStatusClass, applicationStatusLabel } from "../features/applications/format";
import type { PaginatedApplications } from "../features/applications/types";
import { useAuth } from "../features/auth/AuthContext";
import { getApiError } from "../features/auth/formUtils";
import * as interviewsApi from "../features/interviews/api";
import { formatInterviewDateTime, interviewModeLabel, interviewStatusClass, interviewStatusLabel } from "../features/interviews/format";
import type { PaginatedInterviews } from "../features/interviews/types";
import * as jobsApi from "../features/jobs/api";
import JobCard from "../features/jobs/JobCard";
import { formatDate } from "../features/jobs/format";
import type { Job, PaginatedJobs } from "../features/jobs/types";
import * as matchingApi from "../features/matching/api";
import MatchScore from "../features/matching/MatchScore";
import type { PaginatedJobMatches } from "../features/matching/types";
import * as profileApi from "../features/profile/api";
import type { CandidateProfile } from "../features/profile/types";
import * as resumesApi from "../features/resumes/api";

interface LoadState<T> { data: T | null; loading: boolean; error: string }
const initialState = <T,>(): LoadState<T> => ({ data: null, loading: true, error: "" });

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><p>{message}</p><button onClick={onRetry} className="mt-3 font-semibold text-cyan-300">Try again</button></div>;
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-3" aria-label="Loading section">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-white/5" />)}</div>;
}

const quickActions = [
  ["Browse jobs", "/jobs"], ["Find matching jobs", "/matching"],
  ["View applications", "/applications"], ["View interviews", "/interviews"],
  ["Manage resumes", "/resumes"], ["Edit profile", "/profile"],
] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LoadState<CandidateProfile>>(initialState);
  const [resumeCount, setResumeCount] = useState<LoadState<number>>(initialState);
  const [applications, setApplications] = useState<LoadState<PaginatedApplications>>(initialState);
  const [interviews, setInterviews] = useState<LoadState<PaginatedInterviews>>(initialState);
  const [savedJobs, setSavedJobs] = useState<LoadState<PaginatedJobs>>(initialState);
  const [matches, setMatches] = useState<LoadState<PaginatedJobMatches>>(initialState);
  const [profileRetry, setProfileRetry] = useState(0);
  const [resumeRetry, setResumeRetry] = useState(0);
  const [applicationRetry, setApplicationRetry] = useState(0);
  const [interviewRetry, setInterviewRetry] = useState(0);
  const [savedRetry, setSavedRetry] = useState(0);
  const [matchRetry, setMatchRetry] = useState(0);
  const [savingJobId, setSavingJobId] = useState<number | null>(null);

  useEffect(() => { let active = true; setProfile((state) => ({ ...state, loading: true, error: "" })); profileApi.getProfile().then((data) => { if (active) setProfile({ data, loading: false, error: "" }); }).catch((reason) => { if (active) setProfile({ data: null, loading: false, error: getApiError(reason) }); }); return () => { active = false; }; }, [profileRetry]);
  useEffect(() => { let active = true; setResumeCount((state) => ({ ...state, loading: true, error: "" })); resumesApi.listResumes().then((data) => { if (active) setResumeCount({ data: data.length, loading: false, error: "" }); }).catch((reason) => { if (active) setResumeCount({ data: null, loading: false, error: getApiError(reason) }); }); return () => { active = false; }; }, [resumeRetry]);
  useEffect(() => { let active = true; setApplications((state) => ({ ...state, loading: true, error: "" })); applicationsApi.listApplications(1, 5).then((data) => { if (active) setApplications({ data, loading: false, error: "" }); }).catch((reason) => { if (active) setApplications({ data: null, loading: false, error: getApiError(reason) }); }); return () => { active = false; }; }, [applicationRetry]);
  useEffect(() => { let active = true; setInterviews((state) => ({ ...state, loading: true, error: "" })); interviewsApi.listInterviews({ upcoming: true, status: "scheduled", pageSize: 3 }).then((data) => { if (active) setInterviews({ data, loading: false, error: "" }); }).catch((reason) => { if (active) setInterviews({ data: null, loading: false, error: getApiError(reason) }); }); return () => { active = false; }; }, [interviewRetry]);
  useEffect(() => { let active = true; setSavedJobs((state) => ({ ...state, loading: true, error: "" })); jobsApi.listSavedJobs(1, 1).then((data) => { if (active) setSavedJobs({ data, loading: false, error: "" }); }).catch((reason) => { if (active) setSavedJobs({ data: null, loading: false, error: getApiError(reason) }); }); return () => { active = false; }; }, [savedRetry]);
  useEffect(() => { let active = true; setMatches((state) => ({ ...state, loading: true, error: "" })); matchingApi.listJobMatches(1, 3).then((data) => { if (active) setMatches({ data, loading: false, error: "" }); }).catch((reason) => { if (active) setMatches({ data: null, loading: false, error: getApiError(reason) }); }); return () => { active = false; }; }, [matchRetry]);

  async function toggleMatchSave(job: Job) {
    setSavingJobId(job.id);
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id);
      setMatches((state) => state.data ? { ...state, data: { ...state.data, results: state.data.results.map((match) => match.job.id === job.id ? { ...match, job: { ...match.job, is_saved: !job.is_saved } } : match) } } : state);
      setSavedJobs((state) => state.data ? { ...state, data: { ...state.data, count: Math.max(0, state.data.count + (job.is_saved ? -1 : 1)) } } : state);
    } catch (reason) { setMatches((state) => ({ ...state, error: getApiError(reason) })); }
    finally { setSavingJobId(null); }
  }

  if (!user) return null;
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Candidate command center</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {displayName}.</h1>{profile.data ? <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400"><span>{profile.data.headline || profile.data.current_job_title || "Job seeker"}</span>{profile.data.current_company && <span>{profile.data.current_company}</span>}{profile.data.location && <span>{profile.data.location}</span>}</div> : profile.loading ? <div className="mt-3 h-5 w-72 animate-pulse rounded bg-white/5" /> : <button onClick={() => setProfileRetry((value) => value + 1)} className="mt-3 text-sm text-red-200">Candidate summary unavailable · Retry</button>}</header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key activity">
        <ActivityCard label="Applications" value={applications.data?.count ?? null} path="/applications" error={Boolean(applications.error)} onRetry={() => setApplicationRetry((value) => value + 1)} />
        <ActivityCard label="Upcoming interviews" value={interviews.data?.count ?? null} path="/interviews" error={Boolean(interviews.error)} onRetry={() => setInterviewRetry((value) => value + 1)} />
        <ActivityCard label="Saved jobs" value={savedJobs.data?.count ?? null} path="/saved-jobs" error={Boolean(savedJobs.error)} onRetry={() => setSavedRetry((value) => value + 1)} />
        <ActivityCard label="Matching jobs" value={matches.data?.count ?? null} path="/matching" error={Boolean(matches.error)} onRetry={() => setMatchRetry((value) => value + 1)} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <DashboardSection title="Upcoming interviews" actionLabel="View all interviews" actionPath="/interviews">{interviews.loading ? <RowsSkeleton /> : interviews.error ? <SectionError message={interviews.error} onRetry={() => setInterviewRetry((value) => value + 1)} /> : interviews.data?.results.length ? <ul className="space-y-3">{interviews.data.results.map((interview) => <li key={interview.id}><Link to={`/interviews/${interview.id}`} className="block rounded-xl bg-white/5 p-4 transition hover:bg-white/10"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-100">{interview.round_name}</p><p className="mt-1 text-sm text-cyan-300">{interview.application.job.title} · {interview.application.job.company_name}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${interviewStatusClass(interview.status)}`}>{interviewStatusLabel(interview.status)}</span></div><p className="mt-3 text-sm text-slate-400">{formatInterviewDateTime(interview.scheduled_at)} · {interviewModeLabel(interview.mode)}</p></Link></li>)}</ul> : <div className="rounded-xl border border-dashed border-slate-700 p-7 text-center"><p className="font-medium">No upcoming interviews</p><p className="mt-2 text-sm text-slate-400">Keep applying to relevant opportunities.</p></div>}</DashboardSection>

        <DashboardSection title="Profile and resume" actionLabel="Edit profile" actionPath="/profile">{profile.loading ? <RowsSkeleton rows={2} /> : profile.error ? <SectionError message={profile.error} onRetry={() => setProfileRetry((value) => value + 1)} /> : profile.data && (resumeCount.loading ? <RowsSkeleton rows={2} /> : resumeCount.error ? <SectionError message={resumeCount.error} onRetry={() => setResumeRetry((value) => value + 1)} /> : <ProfileCompletion user={user} profile={profile.data} resumeCount={resumeCount.data} />)}</DashboardSection>

        <DashboardSection title="Recent applications" actionLabel="View all applications" actionPath="/applications">{applications.loading ? <RowsSkeleton /> : applications.error ? <SectionError message={applications.error} onRetry={() => setApplicationRetry((value) => value + 1)} /> : applications.data?.results.length ? <ul className="space-y-3">{applications.data.results.map((application) => <li key={application.id}><Link to={`/applications/${application.id}`} className="flex items-start justify-between gap-3 rounded-xl bg-white/5 p-4 transition hover:bg-white/10"><div className="min-w-0"><p className="truncate font-semibold">{application.job.title}</p><p className="mt-1 truncate text-sm text-cyan-300">{application.job.company_name}</p><p className="mt-2 text-xs text-slate-500">Applied {formatDate(application.applied_at)}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${applicationStatusClass(application.status)}`}>{applicationStatusLabel(application.status)}</span></Link></li>)}</ul> : <div className="rounded-xl border border-dashed border-slate-700 p-7 text-center"><p className="font-medium">You haven't applied to any jobs yet</p><Link to="/jobs" className="mt-3 inline-block text-sm font-semibold text-cyan-300">Browse jobs →</Link></div>}</DashboardSection>

        <DashboardSection title="Quick actions" actionLabel="Browse jobs" actionPath="/jobs"><div className="grid gap-3 sm:grid-cols-2">{quickActions.map(([label, path]) => <Link key={path} to={path} className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-300">{label} →</Link>)}</div></DashboardSection>
      </div>

      <DashboardSection title="Top matching jobs" actionLabel="View all matches" actionPath="/matching" className="mt-6">{matches.loading ? <div className="grid gap-5 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-white/5" />)}</div> : matches.error ? <SectionError message={matches.error} onRetry={() => setMatchRetry((value) => value + 1)} /> : matches.data?.results.length ? <div className="grid gap-5 lg:grid-cols-3">{matches.data.results.map((match) => <JobCard key={match.job.id} job={match.job} busy={savingJobId === match.job.id} onToggleSave={(job) => void toggleMatchSave(job)} detailState={{ fromMatching: true }} headerExtra={<MatchScore score={match.match_score} compact />} />)}</div> : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center"><p className="font-medium">No matching jobs are available right now</p><p className="mt-2 text-sm text-slate-400">Update your profile and skills, then check again later.</p><Link to="/profile" className="mt-4 inline-block text-sm font-semibold text-cyan-300">Update profile →</Link></div>}</DashboardSection>
    </main>
  );
}
