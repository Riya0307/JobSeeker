import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getApiError, inputClass } from "../auth/formUtils";
import Pagination from "../jobs/Pagination";
import * as interviewsApi from "./api";
import InterviewCard from "./InterviewCard";
import type { InterviewStatus, PaginatedInterviews } from "./types";

type TimeFilter = "all" | "upcoming" | "past";
const statuses: InterviewStatus[] = ["scheduled", "completed", "cancelled", "rescheduled"];

export default function InterviewsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [data, setData] = useState<PaginatedInterviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const timeFilter: TimeFilter = params.get("upcoming") === "true" ? "upcoming" : params.get("past") === "true" ? "past" : "all";
  const status = statuses.includes(params.get("status") as InterviewStatus) ? params.get("status") as InterviewStatus : "";

  const load = useCallback(async () => {
    const current = new URLSearchParams(query);
    setLoading(true); setError("");
    try { setData(await interviewsApi.listInterviews({ page, upcoming: current.get("upcoming") === "true", past: current.get("past") === "true", status: statuses.includes(current.get("status") as InterviewStatus) ? current.get("status") as InterviewStatus : undefined })); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, [page, query, retry]);
  useEffect(() => { void load(); }, [load]);

  function setFilter(time: TimeFilter, nextStatus = status) {
    const next = new URLSearchParams();
    if (time === "upcoming") next.set("upcoming", "true");
    if (time === "past") next.set("past", "true");
    if (nextStatus) next.set("status", nextStatus);
    setParams(next);
  }
  function goToPage(nextPage: number) { const next = new URLSearchParams(params); next.set("page", String(nextPage)); setParams(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Interview schedule</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your interviews</h1><p className="mt-2 text-slate-400">Review scheduled rounds and manage their candidate-facing status.</p>
      <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5" aria-label="Interview filters"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><span className="block text-sm font-medium text-slate-300">Schedule</span><div className="mt-2 flex flex-wrap gap-2">{(["all", "upcoming", "past"] as TimeFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${timeFilter === item ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-300 hover:border-slate-500"}`}>{item}</button>)}</div></div><label className="text-sm text-slate-300 sm:w-56">Status<select className={inputClass} value={status} onChange={(event) => setFilter(timeFilter, event.target.value as InterviewStatus | "")}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></label></div></section>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><p>We couldn't load your interviews. {error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg border border-red-300/30 px-4 py-2 font-semibold">Try again</button></div>}
      <section className="mt-8" aria-live="polite">{loading ? <div className="grid gap-5" aria-label="Loading interviews">{[1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-slate-900/70" />)}</div> : data?.results.length ? <><p className="mb-4 text-sm text-slate-400">{data.count} {data.count === 1 ? "interview" : "interviews"}</p><div className="grid gap-5">{data.results.map((interview) => <InterviewCard key={interview.id} interview={interview} />)}</div><Pagination page={page} count={data.count} ariaLabel="Interview pages" onChange={goToPage} /></> : <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No interviews found</h2><p className="mt-2 text-sm text-slate-400">There are no interviews matching the selected filters.</p>{timeFilter !== "all" || status ? <button onClick={() => setFilter("all", "")} className="mt-5 text-sm font-semibold text-cyan-300">Clear filters</button> : <Link to="/applications" className="mt-5 inline-block text-sm font-semibold text-cyan-300">View applications</Link>}</div>}</section>
    </main>
  );
}
