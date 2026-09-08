import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import Pagination from "../jobs/Pagination";
import * as applicationsApi from "./api";
import ApplicationCard from "./ApplicationCard";
import type { Application, PaginatedApplications } from "./types";

export default function ApplicationsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedApplications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await applicationsApi.listApplications(page)); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, [page, retry]);
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
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Application tracker</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Your applications</h1><p className="mt-2 text-slate-400">Review your submitted applications and their current status.</p>
      {success && <div role="status" className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><p>We couldn't load or update your applications. {error}</p><button onClick={() => setRetry((value) => value + 1)} className="mt-3 rounded-lg border border-red-300/30 px-4 py-2 font-semibold hover:bg-red-300/10">Try again</button></div>}
      <section className="mt-8" aria-live="polite">{loading ? <div className="grid gap-5" aria-label="Loading applications">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-900/70" />)}</div> : data?.results.length ? <><p className="mb-4 text-sm text-slate-400">{data.count} {data.count === 1 ? "application" : "applications"}</p><div className="grid gap-5">{data.results.map((application) => <ApplicationCard key={application.id} application={application} withdrawing={withdrawingId === application.id} onWithdraw={(item) => void withdraw(item)} />)}</div><Pagination page={page} count={data.count} ariaLabel="Application pages" onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); }} /></> : <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No applications yet</h2><p className="mt-2 text-sm text-slate-400">When you apply for a job, it will appear here.</p><Link to="/jobs" className="mt-6 inline-block rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Browse jobs</Link></div>}</section>
    </main>
  );
}
