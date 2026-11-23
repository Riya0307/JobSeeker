import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import { EmptyState, RowsSkeleton, SectionError } from "../../components/dashboard/DashboardStates";
import Pagination from "../jobs/Pagination";
import * as applicationsApi from "./api";
import ApplicationCard from "./ApplicationCard";
import type { Application, PaginatedApplications } from "./types";

export default function ApplicationsPage() {
  const [params, setParams] = useSearchParams();
  const requestedPage = Number(params.get("page") ?? 1);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [data, setData] = useState<PaginatedApplications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (params.has("page") && String(page) !== params.get("page")) {
      setParams(page > 1 ? { page: String(page) } : {}, { replace: true });
    }
  }, [page, params, setParams]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await applicationsApi.listApplications(page)); }
    catch (reason) {
      if (axios.isAxiosError(reason) && reason.response?.status === 404 && page > 1) {
        setParams({}, { replace: true }); return;
      }
      setError(getApiError(reason));
    }
    finally { setLoading(false); }
  }, [page, retry, setParams]);
  useEffect(() => { void load(); }, [load]);

  async function withdraw(application: Application) {
    if (!window.confirm(`Withdraw your application for ${application.job.title}? This cannot be reversed.`)) return;
    setWithdrawingId(application.id); setError(""); setSuccess("");
    try {
      const updated = await applicationsApi.withdrawApplication(application.id);
      setData((current) => current ? { ...current, results: current.results.map((item) => item.id === updated.id ? updated : item) } : current);
      setSuccess("Application withdrawn successfully.");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setWithdrawingId(null); }
  }

  return (
    <main className="ws-page">
      <header>
        <h1 className="ws-title">Your applications</h1>
        <p className="ws-muted mt-2 text-sm sm:text-base">Track the roles you’ve applied for and review your submissions.</p>
      </header>
      {success && <p role="status" className="ws-notice mt-4">{success}</p>}
      {error && <div className="mt-4"><SectionError message={error} onRetry={() => setRetry((value) => value + 1)} /></div>}
      <section className="mt-5" aria-label="Application results">
        {loading ? <div className="ws-card px-4"><RowsSkeleton label="Loading applications" /></div> : data && (
          <>
            <p role="status" className="ws-muted mb-3 text-sm">{data.count.toLocaleString()} {data.count === 1 ? "application" : "applications"}</p>
            {data.results.length ? (
              <>
                <div className="grid gap-3">{data.results.map((application) => (
                  <ApplicationCard key={application.id} application={application} withdrawing={withdrawingId === application.id}
                    onWithdraw={(item) => void withdraw(item)} />
                ))}</div>
                <Pagination light page={page} count={data.count} ariaLabel="Application pages" onChange={(next) => {
                  setParams(next > 1 ? { page: String(next) } : {});
                  window.scrollTo(0, 0);
                }} />
              </>
            ) : !error && <EmptyState title="No applications yet"><Link to="/jobs" className="ws-link">Find jobs to apply for</Link>.</EmptyState>}
          </>
        )}
      </section>
    </main>
  );
}
