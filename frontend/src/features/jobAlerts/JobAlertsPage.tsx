import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import Pagination from "../jobs/Pagination";
import * as jobAlertsApi from "./api";
import JobAlertCard from "./JobAlertCard";
import JobAlertForm from "./JobAlertForm";
import type { JobAlert, JobAlertPayload, PaginatedJobAlerts } from "./types";

export default function JobAlertsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const [data, setData] = useState<PaginatedJobAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [retry, setRetry] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JobAlert | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await jobAlertsApi.listJobAlerts(page)); }
    catch (reason) { setError(`Could not load job alerts. ${getApiError(reason)}`); }
    finally { setLoading(false); }
  }, [page, retry]);
  useEffect(() => { void load(); }, [load]);

  function openCreate() { setEditing(null); setFormOpen(true); setError(""); setSuccess(""); }
  function openEdit(alert: JobAlert) { setEditing(alert); setFormOpen(true); setError(""); setSuccess(""); }
  function changePage(nextPage: number) { const next = new URLSearchParams(); next.set("page", String(nextPage)); setParams(next); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function save(payload: JobAlertPayload) {
    if (editing) await jobAlertsApi.updateJobAlert(editing.id, payload);
    else await jobAlertsApi.createJobAlert(payload);
    setFormOpen(false); setEditing(null);
    setSuccess(editing ? "Job alert updated successfully." : "Job alert created successfully.");
    if (!editing && page !== 1) setParams(new URLSearchParams());
    else await load();
  }

  async function toggle(alert: JobAlert) {
    setBusyId(alert.id); setError(""); setSuccess("");
    try { const updated = await jobAlertsApi.toggleJobAlert(alert.id); setData((current) => current ? { ...current, results: current.results.map((item) => item.id === updated.id ? updated : item) } : current); setSuccess(`Job alert ${updated.is_active ? "activated" : "deactivated"}.`); }
    catch (reason) { setError(`Could not update the job alert. ${getApiError(reason)}`); }
    finally { setBusyId(null); }
  }

  async function remove(alert: JobAlert) {
    if (!window.confirm(`Delete “${alert.name}”? Existing notifications will remain available.`)) return;
    setBusyId(alert.id); setError(""); setSuccess("");
    try {
      await jobAlertsApi.deleteJobAlert(alert.id);
      setSuccess("Job alert deleted successfully.");
      if (data?.results.length === 1 && page > 1) changePage(page - 1);
      else setData((current) => current ? { ...current, count: Math.max(0, current.count - 1), results: current.results.filter((item) => item.id !== alert.id) } : current);
    } catch (reason) { setError(`Could not delete the job alert. ${getApiError(reason)}`); }
    finally { setBusyId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Opportunity tracking</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Job alerts</h1><p className="mt-2 max-w-2xl text-slate-400">Save deterministic search criteria and get notified when new jobs match.</p></div><button type="button" onClick={openCreate} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Create alert</button></header>
      {success && <div role="status" className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 font-semibold text-cyan-300">Try again</button></div>}
      <section className="mt-8" aria-live="polite">{loading ? <div className="grid gap-5 md:grid-cols-2" aria-label="Loading job alerts">{[1, 2, 3, 4].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-white/5" />)}</div> : data?.results.length ? <><p className="mb-4 text-sm text-slate-400">{data.count} {data.count === 1 ? "alert" : "alerts"}</p><div className="grid gap-5 md:grid-cols-2">{data.results.map((alert) => <JobAlertCard key={alert.id} alert={alert} busy={busyId === alert.id} onEdit={openEdit} onToggle={(item) => void toggle(item)} onDelete={(item) => void remove(item)} />)}</div><Pagination page={page} count={data.count} ariaLabel="Job alert pages" onChange={changePage} /></> : <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No job alerts yet</h2><p className="mt-2 text-sm text-slate-400">Create an alert to be notified when newly available jobs match your criteria.</p><button type="button" onClick={openCreate} className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950">Create your first alert</button></div>}</section>
      {formOpen && <JobAlertForm alert={editing} onSave={save} onClose={() => { setFormOpen(false); setEditing(null); }} />}
    </main>
  );
}
