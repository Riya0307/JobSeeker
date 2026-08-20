import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import * as jobsApi from "./api";
import JobCard from "./JobCard";
import Pagination from "./Pagination";
import type { Job, PaginatedJobs } from "./types";

export default function SavedJobsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  useEffect(() => { let active = true; setLoading(true); jobsApi.listSavedJobs(page).then((result) => { if (active) setData(result); }).catch((reason) => { if (active) setError(getApiError(reason)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [page]);
  async function unsave(job: Job) {
    setBusyId(job.id); setError("");
    try {
      await jobsApi.unsaveJob(job.id);
      if (data?.results.length === 1 && page > 1) setPage((current) => current - 1);
      else setData((current) => current ? { ...current, count: current.count - 1, results: current.results.filter((item) => item.id !== job.id) } : current);
    }
    catch (reason) { setError(getApiError(reason)); } finally { setBusyId(null); }
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Your shortlist</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Saved jobs</h1><p className="mt-2 text-slate-400">Keep promising opportunities close at hand.</p>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <section className="mt-8" aria-live="polite">{loading ? <div className="grid gap-5"><div className="h-56 animate-pulse rounded-2xl bg-slate-900/70" /><div className="h-56 animate-pulse rounded-2xl bg-slate-900/70" /></div> : data?.results.length ? <><p className="mb-4 text-sm text-slate-400">{data.count} saved {data.count === 1 ? "job" : "jobs"}</p><div className="grid gap-5">{data.results.map((job) => <JobCard key={job.id} job={job} busy={busyId === job.id} onToggleSave={(item) => void unsave(item)} />)}</div><Pagination page={page} count={data.count} onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); }} /></> : <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No saved jobs yet</h2><p className="mt-2 text-sm text-slate-400">Save interesting roles while browsing and they will appear here.</p><Link to="/jobs" className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Browse jobs</Link></div>}</section>
    </main>
  );
}
