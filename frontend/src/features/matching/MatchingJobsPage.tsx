import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import * as jobsApi from "../jobs/api";
import JobCard from "../jobs/JobCard";
import Pagination from "../jobs/Pagination";
import type { Job } from "../jobs/types";
import * as matchingApi from "./api";
import MatchReasons from "./MatchReasons";
import MatchScore from "./MatchScore";
import type { PaginatedJobMatches } from "./types";

export default function MatchingJobsPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedJobMatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await matchingApi.listJobMatches(page)); }
    catch (reason) { setError(`We couldn't load your recommendations. ${getApiError(reason)}`); }
    finally { setLoading(false); }
  }, [page, requestVersion]);

  useEffect(() => { void load(); }, [load]);

  async function toggleSave(job: Job) {
    setBusyId(job.id); setError("");
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id);
      setData((current) => current ? {
        ...current,
        results: current.results.map((match) => match.job.id === job.id
          ? { ...match, job: { ...match.job, is_saved: !job.is_saved } }
          : match),
      } : current);
    } catch (reason) { setError(getApiError(reason)); }
    finally { setBusyId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Personalized recommendations</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Jobs for You</h1>
      <p className="mt-2 max-w-2xl text-slate-400">Jobs ranked by how well they match your profile and skills.</p>

      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button onClick={() => setRequestVersion((version) => version + 1)} className="mt-3 rounded-lg border border-red-300/30 px-4 py-2 font-semibold hover:bg-red-300/10">Try again</button></div>}

      <section className="mt-8" aria-live="polite">
        {loading ? (
          <div className="grid gap-5" aria-label="Loading job matches">
            {[1, 2, 3].map((item) => <div key={item} className="h-96 animate-pulse rounded-2xl border border-white/5 bg-slate-900/70" />)}
          </div>
        ) : data?.results.length ? (
          <>
            <p className="mb-4 text-sm text-slate-400">{data.count} ranked {data.count === 1 ? "match" : "matches"}</p>
            <div className="grid gap-5">
              {data.results.map((match) => (
                <JobCard key={match.job.id} job={match.job} busy={busyId === match.job.id} onToggleSave={(job) => void toggleSave(job)} detailState={{ fromMatching: true }} headerExtra={<MatchScore score={match.match_score} compact />}>
                  <MatchReasons matchedSkills={match.matched_skills} missingSkills={match.missing_skills} reasons={match.reasons} />
                </JobCard>
              ))}
            </div>
            <Pagination page={page} count={data.count} onChange={(next) => { setPage(next); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No matches yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Complete your candidate profile and add more skills to improve your recommendations.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/profile" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Complete profile</Link><Link to="/jobs" className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-slate-500">Browse all jobs</Link></div></div>
        )}
      </section>
    </main>
  );
}
