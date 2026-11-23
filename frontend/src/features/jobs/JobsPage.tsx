import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import { getApiError } from "../auth/formUtils";
import * as jobsApi from "./api";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import { JobListEmpty, JobListSkeleton, SectionError } from "./JobListState";
import { titleCase } from "./format";
import JobCard from "./JobCard";
import Pagination from "./Pagination";
import type { Job, PaginatedJobs } from "./types";

interface Filters {
  search: string; location: string; work_mode: string; employment_type: string;
  experience_min: string; experience_max: string; salary_min: string; salary_max: string;
  skills: string; ordering: string;
}

const workModes = new Set(["remote", "hybrid", "onsite"]);
const employmentTypes = new Set(["full-time", "part-time", "contract", "internship", "temporary"]);
const orderings = new Set(["-posted_at", "posted_at", "-salary_min", "salary_min", "title", "company_name"]);

function normalizedJobParams(params: URLSearchParams) {
  const normalized = new URLSearchParams();
  for (const key of ["search", "location", "skills"] as const) {
    const value = params.get(key)?.trim();
    if (value) normalized.set(key, value);
  }
  const workMode = params.get("work_mode")?.trim().toLowerCase();
  if (workMode && workModes.has(workMode)) normalized.set("work_mode", workMode);
  const employmentType = params.get("employment_type")?.trim().toLowerCase();
  if (employmentType && employmentTypes.has(employmentType)) normalized.set("employment_type", employmentType);
  for (const key of ["experience_min", "experience_max", "salary_min", "salary_max"] as const) {
    const value = params.get(key)?.trim();
    if (value && /^\d+$/.test(value)) normalized.set(key, value);
  }
  const ordering = params.get("ordering")?.trim();
  if (ordering && orderings.has(ordering) && ordering !== "-posted_at") normalized.set("ordering", ordering);
  const page = params.get("page")?.trim();
  if (page && /^\d+$/.test(page) && Number.isSafeInteger(Number(page)) && Number(page) > 1) normalized.set("page", String(Number(page)));
  return normalized;
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
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const normalizedParams = normalizedJobParams(new URLSearchParams(query));
  const normalizedQuery = normalizedParams.toString();
  const page = Number(normalizedParams.get("page") ?? 1);
  const [filters, setFilters] = useState(() => filtersFromParams(normalizedParams));
  const [data, setData] = useState<PaginatedJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setValidationError("");
    setFilters(filtersFromParams(new URLSearchParams(normalizedQuery)));
    if (query !== normalizedQuery) setParams(new URLSearchParams(normalizedQuery), { replace: true });
  }, [normalizedQuery, query, setParams]);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    jobsApi.listJobs(new URLSearchParams(normalizedQuery)).then((result) => { if (active) setData(result); })
      .catch((reason) => {
        if (!active) return;
        if (axios.isAxiosError(reason) && reason.response?.status === 404 && page > 1) {
          const firstPage = new URLSearchParams(normalizedQuery); firstPage.delete("page");
          setParams(firstPage, { replace: true }); return;
        }
        setError(getApiError(reason));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [normalizedQuery, page, retry, setParams]);

  function update(key: keyof Filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); setValidationError(""); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const experienceMin = filters.experience_min.trim() ? Number(filters.experience_min) : null;
    const experienceMax = filters.experience_max.trim() ? Number(filters.experience_max) : null;
    const salaryMin = filters.salary_min.trim() ? Number(filters.salary_min) : null;
    const salaryMax = filters.salary_max.trim() ? Number(filters.salary_max) : null;
    if ([experienceMin, experienceMax].some((value) => value !== null && (!Number.isSafeInteger(value) || value < 0))) {
      setValidationError("Experience values must be non-negative whole numbers."); return;
    }
    if ([salaryMin, salaryMax].some((value) => value !== null && (!Number.isSafeInteger(Math.round(value * 100_000)) || value < 0))) {
      setValidationError("Salary values must be non-negative numbers."); return;
    }
    if (experienceMin !== null && experienceMax !== null && experienceMin > experienceMax) {
      setValidationError("Maximum experience must be at least the minimum."); return;
    }
    if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
      setValidationError("Maximum salary must be at least the minimum."); return;
    }
    const next = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      const clean = value.trim();
      if (!clean || (key === "ordering" && clean === "-posted_at")) return;
      next.set(key, key.startsWith("salary_") ? String(Math.round(Number(clean) * 100_000)) : clean);
    });
    setValidationError(""); setFiltersOpen(false); setParams(next);
  }
  function clearFilters() {
    const empty = new URLSearchParams();
    setValidationError(""); setFilters(filtersFromParams(empty)); setParams(empty);
  }
  function goToPage(page: number) { const next = new URLSearchParams(params); if (page > 1) next.set("page", String(page)); else next.delete("page"); setParams(next); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function toggleSave(job: Job) {
    if (busyId !== null) return;
    setBusyId(job.id); setSaveError("");
    try {
      if (job.is_saved) await jobsApi.unsaveJob(job.id); else await jobsApi.saveJob(job.id);
      setData((current) => current ? { ...current, results: current.results.map((item) => item.id === job.id ? { ...item, is_saved: !job.is_saved } : item) } : current);
    } catch (reason) { setSaveError(getApiError(reason)); } finally { setBusyId(null); }
  }

  const applied = filtersFromParams(normalizedParams);
  const appliedFilters = [
    applied.location && `Location: ${applied.location}`,
    applied.work_mode && titleCase(applied.work_mode),
    applied.employment_type && titleCase(applied.employment_type),
    applied.skills && `Skills: ${applied.skills}`,
    applied.experience_min && `Min. experience: ${applied.experience_min} yr`,
    applied.experience_max && `Max. experience: ${applied.experience_max} yr`,
    applied.salary_min && `Min. salary: ${applied.salary_min} LPA`,
    applied.salary_max && `Max. salary: ${applied.salary_max} LPA`,
  ].filter(Boolean);
  const orderingOptions = [
    ["-posted_at", "Newest first"], ["posted_at", "Oldest first"], ["-salary_min", "Highest salary"],
    ["salary_min", "Lowest salary"], ["title", "Job title A–Z"], ["company_name", "Company A–Z"],
  ];
  const fieldClass = "ws-control mt-1 text-sm";

  return (
    <main className="ws-page">
      <header>
        <h1 className="ws-title">Find jobs</h1>
        <p className="ws-muted mt-2 text-sm sm:text-base">Search active roles and save opportunities to revisit.</p>
      </header>
      <form id="job-search" onSubmit={submit} className="ws-card mt-5 flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-0 flex-[1_1_12rem] text-sm font-semibold">Keyword
          <input className={fieldClass} type="search" placeholder="Job title, company, or skill" value={filters.search} onChange={(e) => update("search", e.target.value)} />
        </label>
        <button type="submit" className="ws-button ws-button-primary"><WorkspaceIcon name="search" size={17} /> Search</button>
        <button type="button" className="ws-button xl:hidden" aria-controls="job-filters" aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}>
          Filters{appliedFilters.length > 0 && ` (${appliedFilters.length})`} <WorkspaceIcon name="chevron" size={15} />
        </button>
      </form>
      {validationError && <div role="alert" className="ws-alert mt-3">{validationError}</div>}
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside id="job-filters" aria-labelledby="job-filters-heading" className={`ws-card space-y-4 p-4 xl:block ${filtersOpen ? "block" : "hidden"}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="job-filters-heading" className="ws-heading">Filters</h2>
            <button type="button" onClick={clearFilters} className="ws-link min-h-11 text-sm">Clear all</button>
          </div>
          <label className="block text-sm font-semibold">Location
            <input form="job-search" className={fieldClass} placeholder="City or region" value={filters.location} onChange={(e) => update("location", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Work mode
            <select form="job-search" className={fieldClass} value={filters.work_mode} onChange={(e) => update("work_mode", e.target.value)}>
              <option value="">Any mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Employment type
            <select form="job-search" className={fieldClass} value={filters.employment_type} onChange={(e) => update("employment_type", e.target.value)}>
              <option value="">Any type</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="temporary">Temporary</option>
            </select>
          </label>
          {([["experience", "Experience (years)", 1], ["salary", "Salary (LPA)", 0.1]] as const).map(([key, label, step]) => (
            <fieldset key={key} className="grid grid-cols-2 gap-2">
              <legend className="mb-1 text-sm font-semibold">{label}</legend>
              {(["min", "max"] as const).map((bound) => (
                <label key={bound} className="ws-muted min-w-0 text-xs">
                  {bound === "min" ? "Minimum" : "Maximum"}
                  <input form="job-search" className={fieldClass} type="number" min="0" step={step}
                    value={filters[`${key}_${bound}`]} onChange={(e) => update(`${key}_${bound}`, e.target.value)} />
                </label>
              ))}
            </fieldset>
          ))}
          <label className="block text-sm font-semibold">Skills
            <input form="job-search" className={fieldClass} placeholder="Python, SQL" value={filters.skills} onChange={(e) => update("skills", e.target.value)} />
            <span className="ws-muted mt-1 block text-xs font-normal">Separate skills with commas.</span>
          </label>
          <label className="block text-sm font-semibold">Sort by
            <select form="job-search" className={fieldClass} value={filters.ordering} onChange={(e) => update("ordering", e.target.value)}>
              {orderingOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" form="job-search" className="ws-button ws-button-primary w-full">Apply filters</button>
        </aside>

        <section aria-label="Job results" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p role="status" className="ws-muted text-sm">
              {loading ? "Loading jobs…" : error ? "Job results unavailable" : data && `${data.count.toLocaleString()} ${data.count === 1 ? "job" : "jobs"} found`}
            </p>
            {applied.ordering !== "-posted_at" && (
              <p className="ws-muted text-sm">{orderingOptions.find(([value]) => value === applied.ordering)?.[1]}</p>
            )}
          </div>
          {(applied.search || appliedFilters.length > 0) && (
            <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Applied filters">
              {applied.search && <span className="ws-badge max-w-full wrap-anywhere">Keyword: {applied.search}</span>}
              {appliedFilters.map((filter) => <span key={filter} className="ws-badge max-w-full wrap-anywhere">{filter}</span>)}
              <button type="button" className="ws-link min-h-10 text-sm" onClick={clearFilters}>Clear all</button>
            </div>
          )}
          {saveError && <p role="alert" className="ws-alert mb-3">{saveError}</p>}
          {loading ? <JobListSkeleton label="Loading jobs" /> :
            error ? <SectionError message={error} onRetry={() => setRetry((value) => value + 1)} /> :
            data?.results.length ? (
              <>
                <div className="grid gap-3">
                  {data.results.map((job) => <JobCard key={job.id} job={job} disabled={busyId !== null}
                    detailState={{ returnTo: location.pathname + location.search }}
                    onToggleSave={(item) => void toggleSave(item)} />)}
                </div>
                <Pagination light page={page} count={data.count} onChange={goToPage} />
              </>
            ) : (
              <JobListEmpty title="No jobs found">
                Try a different keyword or <button type="button" className="ws-link" onClick={clearFilters}>clear your filters</button>.
              </JobListEmpty>
            )}
        </section>
      </div>
    </main>
  );
}
