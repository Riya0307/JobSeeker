import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import * as jobsApi from "../jobs/api";
import JobCard from "../jobs/JobCard";
import { JobListEmpty, JobListSkeleton, SectionError } from "../jobs/JobListState";
import Pagination from "../jobs/Pagination";
import type { Job } from "../jobs/types";
import * as matchingApi from "./api";
import MatchReasons from "./MatchReasons";
import MatchScore from "./MatchScore";
import AIExplanation from "./AIExplanation";
import type { PaginatedJobMatches } from "./types";

export default function MatchingJobsPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<PaginatedJobMatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (params.has("page") && String(page) !== params.get("page")) {
      setParams(page > 1 ? { page: String(page) } : {}, { replace: true });
    }
  }, [page, params, setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    matchingApi.listJobMatches(page).then((result) => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (axios.isAxiosError(reason) && reason.response?.status === 404 && page > 1) {
        setParams({}, { replace: true });
      } else {
        setError(`We couldn't load your recommendations. ${getApiError(reason)}`);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, requestVersion, setParams]);

  async function toggleSave(job: Job) {
    if (busyId !== null) return;
    setBusyId(job.id); setSaveError("");
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id);
      setData((current) => current ? {
        ...current,
        results: current.results.map((match) => match.job.id === job.id
          ? { ...match, job: { ...match.job, is_saved: !job.is_saved } }
          : match),
      } : current);
    } catch (reason) { setSaveError(getApiError(reason)); }
    finally { setBusyId(null); }
  }

  return (
    <main className="ws-page">
      <header>
        <h1 className="ws-title">Recommended jobs</h1>
        <p className="ws-muted mt-2 text-sm sm:text-base">Explore roles ranked by how well they fit your profile and skills.</p>
      </header>
      <section aria-label="Ranked job matches" className="mt-5">
        {!loading && !error && data && <p role="status" className="ws-muted mb-3 text-sm">{data.count.toLocaleString()} ranked {data.count === 1 ? "match" : "matches"}</p>}
        {saveError && <p role="alert" className="ws-alert mb-3">{saveError}</p>}
        {loading ? <JobListSkeleton label="Loading matches" /> :
          error ? <SectionError message={error} onRetry={() => setRequestVersion((value) => value + 1)} /> :
          data?.results.length ? (
            <>
              <div className="grid gap-3">
                {data.results.map((match) => (
                  <JobCard key={match.job.id} job={match.job} disabled={busyId !== null}
                    onToggleSave={(job) => void toggleSave(job)} headerExtra={<MatchScore score={match.match_score} compact />}
                    detailState={{ fromMatching: true, returnTo: location.pathname + location.search }}>
                    <MatchReasons matchedSkills={match.matched_skills} missingSkills={match.missing_skills} reasons={match.reasons} />
                    <AIExplanation jobId={match.job.id} />
                  </JobCard>
                ))}
              </div>
              <Pagination light page={page} count={data.count} onChange={(next) => {
                setParams(next > 1 ? { page: String(next) } : {});
                window.scrollTo(0, 0);
              }} />
            </>
          ) : <JobListEmpty title="No matches yet"><Link to="/profile" className="ws-link">Update your profile and skills</Link> or <Link to="/jobs" className="ws-link">browse all jobs</Link>.</JobListEmpty>}
      </section>
    </main>
  );
}
