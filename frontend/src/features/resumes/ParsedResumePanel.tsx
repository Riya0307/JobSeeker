import { useState } from "react";
import type { ParsedDataSelection, ParsedResumeData, Resume } from "./types";

interface Props {
  resume: Resume;
  data: ParsedResumeData | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
  onRetry: () => void;
  onApply: (selection: ParsedDataSelection) => Promise<void>;
}

export default function ParsedResumePanel({ resume, data, loading, error, onClose, onRefresh, onRetry, onApply }: Props) {
  const [selection, setSelection] = useState<ParsedDataSelection>({ apply_skills: false, apply_experience: false, apply_current_job: false });
  const [applying, setApplying] = useState(false);
  const current = data?.employment_history.find((item) => item.is_current);
  async function apply() { setApplying(true); try { await onApply(selection); } finally { setApplying(false); } }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Parsed data for ${resume.title}`}>
    <div className="mx-auto my-8 max-w-3xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">Review parsed resume</h2><p className="mt-1 text-sm text-slate-400">Nothing changes in your profile until you select and apply fields.</p></div><button onClick={onClose} aria-label="Close parsed resume" className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Close</button></div>
      {loading && <p role="status" className="mt-6 text-sm text-slate-400">Loading parsed data...</p>}
      {error && <div role="alert" className="mt-6 rounded-xl bg-red-400/10 p-4 text-sm text-red-200">{error}<button onClick={onRefresh} className="ml-3 font-semibold text-cyan-300">Try again</button></div>}
      {data && <div className="mt-6 space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-white/10 p-4"><span className="capitalize">Status: {data.status}</span>{(data.status === "pending" || data.status === "processing") && <button onClick={onRefresh} className="text-sm font-semibold text-cyan-300">Refresh results</button>}{data.status === "failed" && <button onClick={onRetry} className="text-sm font-semibold text-cyan-300">Try parsing again</button>}</div>
        {data.parsing_error && <p className="rounded-xl bg-amber-400/10 p-4 text-sm text-amber-200">{data.parsing_error}</p>}
        {data.status === "completed" && <>
          <section><h3 className="font-semibold">Skills</h3><div className="mt-2 flex flex-wrap gap-2">{data.skills.length ? data.skills.map((skill) => <span key={skill} className="rounded-full bg-cyan-400/10 px-3 py-1 text-sm text-cyan-200">{skill}</span>) : <span className="text-sm text-slate-500">None confidently detected.</span>}</div></section>
          <section><h3 className="font-semibold">Employment</h3><div className="mt-2 space-y-2">{data.employment_history.length ? data.employment_history.map((item, index) => <div key={`${item.title}-${index}`} className="rounded-xl border border-white/10 p-3 text-sm"><strong>{item.title || "Role not identified"}</strong>{item.company && ` · ${item.company}`}<p className="text-slate-400">{item.date_range}</p></div>) : <p className="text-sm text-slate-500">None confidently detected.</p>}</div></section>
          {(["education", "projects", "certifications"] as const).map((section) => <section key={section}><h3 className="capitalize font-semibold">{section}</h3><ul className="mt-2 space-y-1 text-sm text-slate-300">{data[section].length ? data[section].map((item, index) => <li key={index}>{item.summary ?? item.name}</li>) : <li className="text-slate-500">None confidently detected.</li>}</ul></section>)}
          <section className="rounded-xl border border-white/10 p-4"><h3 className="font-semibold">Apply selected data to profile</h3><div className="mt-3 space-y-3 text-sm">
            <label className="flex gap-3"><input type="checkbox" checked={selection.apply_skills} disabled={!data.skills.length} onChange={(e) => setSelection({ ...selection, apply_skills: e.target.checked })} />Skills ({data.skills.length})</label>
            <label className="flex gap-3"><input type="checkbox" checked={selection.apply_experience} disabled={data.estimated_experience_months === null} onChange={(e) => setSelection({ ...selection, apply_experience: e.target.checked })} />Estimated experience ({data.estimated_experience_years ?? "not detected"} years)</label>
            <label className="flex gap-3"><input type="checkbox" checked={selection.apply_current_job} disabled={!current} onChange={(e) => setSelection({ ...selection, apply_current_job: e.target.checked })} />Current role {current ? `(${current.title}${current.company ? ` at ${current.company}` : ""})` : "(not detected)"}</label>
          </div><button disabled={applying || !Object.values(selection).some(Boolean)} onClick={() => void apply()} className="mt-4 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{applying ? "Applying..." : "Apply selected fields"}</button></section>
        </>}
      </div>}
    </div>
  </div>;
}
