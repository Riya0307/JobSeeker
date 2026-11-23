import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import { EmptyState, RowsSkeleton, SectionError } from "../../components/dashboard/DashboardStates";
import { interviewStatusLabel } from "./format";
import Pagination from "../jobs/Pagination";
import * as interviewsApi from "./api";
import InterviewCard from "./InterviewCard";
import type { InterviewStatus, PaginatedInterviews } from "./types";

type TimeFilter = "all" | "upcoming" | "past";
const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "rescheduled"];

function normalizedInterviewParams(params: URLSearchParams) {
  const normalized = new URLSearchParams();
  if (params.get("upcoming") === "true") normalized.set("upcoming", "true");
  else if (params.get("past") === "true") normalized.set("past", "true");
  const status = params.get("status") as InterviewStatus | null;
  if (status && statuses.includes(status)) normalized.set("status", status);
  const page = params.get("page")?.trim();
  if (page && /^\d+$/.test(page) && Number(page) > 1) normalized.set("page", String(Number(page)));
  return normalized;
}

export default function InterviewsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const normalizedParams = normalizedInterviewParams(new URLSearchParams(query));
  const normalizedQuery = normalizedParams.toString();
  const [data, setData] = useState<PaginatedInterviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const page = Number(normalizedParams.get("page") ?? 1);
  const timeFilter: TimeFilter = normalizedParams.get("upcoming") === "true" ? "upcoming" : normalizedParams.get("past") === "true" ? "past" : "all";
  const status = statuses.includes(normalizedParams.get("status") as InterviewStatus) ? normalizedParams.get("status") as InterviewStatus : "";

  useEffect(() => {
    if (query !== normalizedQuery) setParams(new URLSearchParams(normalizedQuery), { replace: true });
  }, [normalizedQuery, query, setParams]);

  const load = useCallback(async () => {
    const current = new URLSearchParams(normalizedQuery);
    setLoading(true); setError("");
    try { setData(await interviewsApi.listInterviews({ page, upcoming: current.get("upcoming") === "true", past: current.get("past") === "true", status: statuses.includes(current.get("status") as InterviewStatus) ? current.get("status") as InterviewStatus : undefined })); }
    catch (reason) {
      if (axios.isAxiosError(reason) && reason.response?.status === 404 && page > 1) {
        const firstPage = new URLSearchParams(normalizedQuery); firstPage.delete("page");
        setParams(firstPage, { replace: true }); return;
      }
      setError(getApiError(reason));
    }
    finally { setLoading(false); }
  }, [normalizedQuery, page, retry, setParams]);
  useEffect(() => { void load(); }, [load]);

  function setFilter(time: TimeFilter, nextStatus = status) {
    const next = new URLSearchParams();
    if (time === "upcoming") next.set("upcoming", "true");
    if (time === "past") next.set("past", "true");
    if (nextStatus) next.set("status", nextStatus);
    setParams(next);
  }
  function goToPage(nextPage: number) { const next = new URLSearchParams(params); if (nextPage > 1) next.set("page", String(nextPage)); else next.delete("page"); setParams(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return (
    <main className="ws-page">
      <header>
        <h1 className="ws-title">Your interviews</h1>
        <p className="ws-muted mt-2 text-sm sm:text-base">Review interview rounds, schedules, and preparation.</p>
      </header>
      <section className="ws-card mt-5 flex flex-wrap items-end justify-between gap-4 p-4" aria-label="Interview filters">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold">Scheduled date</legend>
          <div className="flex flex-wrap gap-2">
            {(["all", "upcoming", "past"] as const).map((item) => (
              <button key={item} type="button" aria-pressed={timeFilter === item}
                className={`ws-button capitalize ${timeFilter === item ? "ws-button-primary" : ""}`} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
        </fieldset>
        <label className="w-full text-sm font-semibold sm:w-48">Status
          <select className="ws-control mt-2" value={status} onChange={(event) => setFilter(timeFilter, event.target.value as InterviewStatus | "")}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{interviewStatusLabel(item)}</option>)}
          </select>
        </label>
      </section>
      <section className="mt-5" aria-label="Interview results">
        {loading ? <div className="ws-card px-4"><RowsSkeleton label="Loading interviews" /></div> :
          error ? <SectionError message={error} onRetry={() => setRetry((value) => value + 1)} /> :
          data?.results.length ? (
            <>
              <p role="status" className="ws-muted mb-3 text-sm">{data.count.toLocaleString()} {data.count === 1 ? "interview" : "interviews"}</p>
              <div className="grid gap-3">{data.results.map((interview) => <InterviewCard key={interview.id} interview={interview} />)}</div>
              <Pagination light page={page} count={data.count} ariaLabel="Interview pages" onChange={goToPage} />
            </>
          ) : timeFilter !== "all" || status ? (
            <EmptyState title="No interviews match these filters">
              <button type="button" className="ws-link min-h-10" onClick={() => setFilter("all", "")}>Clear filters</button>
            </EmptyState>
          ) : <EmptyState title="No interviews yet"><Link to="/applications" className="ws-link">View your applications</Link>.</EmptyState>}
      </section>
    </main>
  );
}
