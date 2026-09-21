import { useState, type FormEvent } from "react";
import { getApiError, inputClass } from "../auth/formUtils";
import type { JobAlert, JobAlertPayload } from "./types";

const MAX_SKILLS = 25;

interface JobAlertFormProps {
  alert: JobAlert | null;
  onSave: (payload: JobAlertPayload) => Promise<void>;
  onClose: () => void;
}

function lpa(value: number | null) {
  if (value === null) return "";
  return String(value / 100_000);
}

export default function JobAlertForm({ alert, onSave, onClose }: JobAlertFormProps) {
  const [name, setName] = useState(alert?.name ?? "");
  const [keywords, setKeywords] = useState(alert?.keywords ?? "");
  const [location, setLocation] = useState(alert?.location ?? "");
  const [workMode, setWorkMode] = useState(alert?.work_mode ?? "");
  const [employmentType, setEmploymentType] = useState(alert?.employment_type ?? "");
  const [experienceMin, setExperienceMin] = useState(alert?.experience_min?.toString() ?? "");
  const [experienceMax, setExperienceMax] = useState(alert?.experience_max?.toString() ?? "");
  const [salaryMin, setSalaryMin] = useState(lpa(alert?.salary_min ?? null));
  const [salaryMax, setSalaryMax] = useState(lpa(alert?.salary_max ?? null));
  const [skills, setSkills] = useState(alert?.skills.join(", ") ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function optionalNumber(value: string, multiplier = 1): number | null {
    return value.trim() ? Math.round(Number(value) * multiplier) : null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const minExperience = optionalNumber(experienceMin);
    const maxExperience = optionalNumber(experienceMax);
    const minSalary = optionalNumber(salaryMin, 100_000);
    const maxSalary = optionalNumber(salaryMax, 100_000);
    const rawSkills = skills.split(",");
    const parsedSkills = skills.trim() ? rawSkills.map((skill) => skill.trim()) : [];

    if ([minExperience, maxExperience, minSalary, maxSalary].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) {
      setError("Experience and salary values must be non-negative numbers."); return;
    }
    if ((minExperience !== null && !Number.isInteger(minExperience)) || (maxExperience !== null && !Number.isInteger(maxExperience))) {
      setError("Experience must be entered in whole years."); return;
    }
    if (minExperience !== null && maxExperience !== null && minExperience > maxExperience) {
      setError("Maximum experience must be at least the minimum."); return;
    }
    if (minSalary !== null && maxSalary !== null && minSalary > maxSalary) {
      setError("Maximum salary must be at least the minimum."); return;
    }
    if (parsedSkills.length > MAX_SKILLS) {
      setError(`Enter no more than ${MAX_SKILLS} skills.`); return;
    }
    if (skills.trim() && (parsedSkills.some((skill) => !skill || !/[\p{L}\p{N}+#]/u.test(skill)))) {
      setError("Skills must be comma-separated, non-empty names."); return;
    }
    if (![keywords, location, workMode, employmentType].some((value) => value.trim()) && minExperience === null && maxExperience === null && minSalary === null && maxSalary === null && parsedSkills.length === 0) {
      setError("Provide at least one job alert criterion."); return;
    }

    setSaving(true); setError("");
    try {
      await onSave({
        name: name.trim(), keywords: keywords.trim(), location: location.trim(),
        work_mode: workMode, employment_type: employmentType,
        experience_min: minExperience, experience_max: maxExperience,
        salary_min: minSalary, salary_max: maxSalary, skills: parsedSkills,
      });
    } catch (reason) {
      setError(getApiError(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="job-alert-form-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div className="mx-auto my-6 w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="job-alert-form-title" className="text-xl font-semibold">{alert ? "Edit job alert" : "Create job alert"}</h2><p className="mt-1 text-sm text-slate-400">All populated criteria must match a job.</p></div><button type="button" aria-label="Close job alert form" disabled={saving} onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/5 hover:text-white">×</button></div>
        {error && <div role="alert" className="mt-5 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        <form onSubmit={(event) => void submit(event)} className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm text-slate-300 sm:col-span-2">Alert name <span className="text-slate-500">(optional)</span><input autoFocus maxLength={255} className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Python Backend Jobs" /></label>
          <label className="text-sm text-slate-300">Keywords<input maxLength={255} className={inputClass} value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="Python Developer" /></label>
          <label className="text-sm text-slate-300">Location<input maxLength={255} className={inputClass} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Bangalore" /></label>
          <label className="text-sm text-slate-300">Work mode<select className={inputClass} value={workMode} onChange={(event) => setWorkMode(event.target.value as typeof workMode)}><option value="">Any mode</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label>
          <label className="text-sm text-slate-300">Employment type<select className={inputClass} value={employmentType} onChange={(event) => setEmploymentType(event.target.value as typeof employmentType)}><option value="">Any type</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option><option value="temporary">Temporary</option></select></label>
          <label className="text-sm text-slate-300">Minimum experience<input type="number" min="0" step="1" className={inputClass} value={experienceMin} onChange={(event) => setExperienceMin(event.target.value)} placeholder="Years" /></label>
          <label className="text-sm text-slate-300">Maximum experience<input type="number" min="0" step="1" className={inputClass} value={experienceMax} onChange={(event) => setExperienceMax(event.target.value)} placeholder="Years" /></label>
          <label className="text-sm text-slate-300">Minimum salary<input type="number" min="0" step="0.1" className={inputClass} value={salaryMin} onChange={(event) => setSalaryMin(event.target.value)} placeholder="LPA" /></label>
          <label className="text-sm text-slate-300">Maximum salary<input type="number" min="0" step="0.1" className={inputClass} value={salaryMax} onChange={(event) => setSalaryMax(event.target.value)} placeholder="LPA" /></label>
          <label className="text-sm text-slate-300 sm:col-span-2">Skills<input className={inputClass} value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Python, Django, REST API" /><span className="mt-1 block text-xs text-slate-500">Separate up to 25 skills with commas.</span></label>
          <div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">Cancel</button><button disabled={saving} className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{saving ? "Saving…" : alert ? "Save changes" : "Create alert"}</button></div>
        </form>
      </div>
    </div>
  );
}
