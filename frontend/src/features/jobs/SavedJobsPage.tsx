import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import { getApiError } from "../auth/formUtils";
import * as jobsApi from "./api";
import JobCard from "./JobCard";
import { JobListEmpty, JobListSkeleton, SectionError } from "./JobListState";
import Pagination from "./Pagination";
import type { Job, PaginatedJobs } from "./types";

export default function SavedJobsPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (params.has("page") && String(page) !== params.get("page")) {
      setParams(page > 1 ? { page: String(page) } : {}, { replace: true });
    }
  }, [page, params, setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    jobsApi.listSavedJobs(page).then((result) => {
      if (active) setData(result);
    }).catch((reason: unknown) => {
      if (!active) return;
      if (axios.isAxiosError(reason) && reason.response?.status === 404 && page > 1) {
        setParams({}, { replace: true });
      } else {
        setError(getApiError(reason));
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, retry, setParams]);

  async function unsave(job: Job) {
    if (busy) return;
    setBusy(true);
    setRemoveError("");
    try {
      await jobsApi.unsaveJob(job.id);
      setLoading(true);
      if (data?.results.length === 1 && page > 1) {
        setParams(page > 2 ? { page: String(page - 1) } : {}, { replace: true });
      }
      setRetry((value) => value + 1);
    } catch (reason) {
      setRemoveError(getApiError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ws-page">
      <header>
        <h1 className="ws-title">Saved jobs</h1>
        <p className="ws-muted mt-2 text-sm sm:text-base">Revisit the roles you’ve shortlisted.</p>
      </header>
      <section aria-label="Saved job results" className="mt-5">
        {!loading && !error && data && <p role="status" className="ws-muted mb-3 text-sm">{data.count.toLocaleString()} saved {data.count === 1 ? "job" : "jobs"}</p>}
        {removeError && <p role="alert" className="ws-alert mb-3">{removeError}</p>}
        {loading ? <JobListSkeleton label="Loading saved jobs" /> :
          error ? <SectionError message={error} onRetry={() => setRetry((value) => value + 1)} /> :
          data?.results.length ? (
            <>
              <div className="grid gap-3">
                {data.results.map((job) => <JobCard key={job.id} job={job} disabled={busy}
                  detailState={{ returnTo: location.pathname + location.search }} onToggleSave={(item) => void unsave(item)} />)}
              </div>
              <Pagination light disabled={busy} page={page} count={data.count} ariaLabel="Saved job pages"
                onChange={(next) => { setParams(next > 1 ? { page: String(next) } : {}); window.scrollTo(0, 0); }} />
            </>
          ) : <JobListEmpty title="No saved jobs yet"><Link to="/jobs" className="ws-link">Find jobs</Link> and bookmark roles to revisit here.</JobListEmpty>}
      </section>
    </main>
  );
}
