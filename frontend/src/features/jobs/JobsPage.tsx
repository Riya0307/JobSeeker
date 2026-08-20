import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError, inputClass } from "../auth/formUtils";
import * as jobsApi from "./api";
import JobCard from "./JobCard";
import Pagination from "./Pagination";
import type { Job, PaginatedJobs } from "./types";

interface Filters {
  search: string; location: string; work_mode: string; employment_type: string;
  experience_min: string; experience_max: string; salary_min: string; salary_max: string;
  skills: string; ordering: string;
}

function filtersFromParams(params: URLSearchParams): Filters {
  const lpa = (key: string) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value >= 0 && params.has(key) ? String(value / 100_000) : "";
  };
  return {
    search: params.get("search") ?? "", location: params.get("location") ?? "",
    work_mode: params.get("work_mode") ?? "", employment_type: params.get("employment_type") ?? "",
    experience_min: params.get("experience_min") ?? "", experience_max: params.get("experience_max") ?? "",
    salary_min: lpa("salary_min"), salary_max: lpa("salary_max"), skills: params.get("skills") ?? "",
    ordering: params.get("ordering") ?? "-posted_at",
  };
}

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [filters, setFilters] = useState(() => filtersFromParams(params));
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => { setFilters(filtersFromParams(new URLSearchParams(query))); }, [query]);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    jobsApi.listJobs(new URLSearchParams(query)).then((result) => { if (active) setData(result); })
      .catch((reason) => { if (active) setError(getApiError(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  function update(key: keyof Filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      const clean = value.trim();
      if (!clean || (key === "ordering" && clean === "-posted_at")) return;
      next.set(key, key.startsWith("salary_") ? String(Number(clean) * 100_000) : clean);
    });
    setParams(next);
  }
  function clearFilters() { setParams(new URLSearchParams()); }
  function goToPage(page: number) { const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function toggleSave(job: Job) {
    setBusyId(job.id); setError("");
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id);
      setData((current) => current ? { ...current, results: current.results.map((item) => item.id === job.id ? { ...item, is_saved: !job.is_saved } : item) } : current);
    } catch (reason) { setError(getApiError(reason)); } finally { setBusyId(null); }
  }

  const page = Number(params.get("page") ?? 1);
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Job discovery</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Find your next opportunity</h1><p className="mt-2 text-slate-400">Search active roles and save the ones worth revisiting.</p></div>
      <form onSubmit={submit} className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm text-slate-300 lg:col-span-2">Keyword<input className={inputClass} placeholder="Title, company, skill..." value={filters.search} onChange={(e) => update("search", e.target.value)} /></label>
          <label className="text-sm text-slate-300 lg:col-span-2">Location<input className={inputClass} placeholder="Delhi, Bengaluru..." value={filters.location} onChange={(e) => update("location", e.target.value)} /></label>
          <label className="text-sm text-slate-300">Work mode<select className={inputClass} value={filters.work_mode} onChange={(e) => update("work_mode", e.target.value)}><option value="">Any mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
          <label className="text-sm text-slate-300">Employment type<select className={inputClass} value={filters.employment_type} onChange={(e) => update("employment_type", e.target.value)}><option value="">Any type</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="temporary">Temporary</option></select></label>
          <label className="text-sm text-slate-300">Min experience<input type="number" min="0" className={inputClass} placeholder="Years" value={filters.experience_min} onChange={(e) => update("experience_min", e.target.value)} /></label>
          <label className="text-sm text-slate-300">Max experience<input type="number" min="0" className={inputClass} placeholder="Years" value={filters.experience_max} onChange={(e) => update("experience_max", e.target.value)} /></label>
          <label className="text-sm text-slate-300">Min salary<input type="number" min="0" step="0.1" className={inputClass} placeholder="LPA" value={filters.salary_min} onChange={(e) => update("salary_min", e.target.value)} /></label>
          <label className="text-sm text-slate-300">Max salary<input type="number" min="0" step="0.1" className={inputClass} placeholder="LPA" value={filters.salary_max} onChange={(e) => update("salary_max", e.target.value)} /></label>
          <label className="text-sm text-slate-300 lg:col-span-2">Skills<input className={inputClass} placeholder="Python, Django, SQL" value={filters.skills} onChange={(e) => update("skills", e.target.value)} /><span className="mt-1 block text-xs text-slate-500">Separate multiple skills with commas.</span></label>
          <label className="text-sm text-slate-300 lg:col-span-2">Sort by<select className={inputClass} value={filters.ordering} onChange={(e) => update("ordering", e.target.value)}><option value="-posted_at">Newest first</option><option value="posted_at">Oldest first</option><option value="-salary_min">Highest salary</option><option value="salary_min">Lowest salary</option><option value="title">Job title A–Z</option><option value="company_name">Company A–Z</option></select></label>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={clearFilters} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-slate-500">Clear filters</button><button className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Search jobs</button></div>
      </form>
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <section className="mt-8" aria-live="polite">
        {loading ? <div className="grid gap-5"><div className="h-56 animate-pulse rounded-2xl bg-slate-900/70" /><div className="h-56 animate-pulse rounded-2xl bg-slate-900/70" /></div> : data?.results.length ? <><p className="mb-4 text-sm text-slate-400">{data.count} {data.count === 1 ? "job" : "jobs"} found</p><div className="grid gap-5">{data.results.map((job) => <JobCard key={job.id} job={job} busy={busyId === job.id} onToggleSave={(item) => void toggleSave(item)} />)}</div><Pagination page={page} count={data.count} onChange={goToPage} /></> : <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No jobs found</h2><p className="mt-2 text-sm text-slate-400">Try broadening your search or clearing some filters.</p><button onClick={clearFilters} className="mt-5 text-sm font-semibold text-cyan-300 hover:text-cyan-200">Clear all filters</button></div>}
      </section>
    </main>
  );
}
