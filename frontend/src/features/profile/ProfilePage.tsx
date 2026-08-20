import { useEffect, useState, type FormEvent } from "react";
import { getApiError, inputClass } from "../auth/formUtils";
import * as profileApi from "./api";
import type { CandidateProfileUpdate } from "./types";

const emptyProfile: CandidateProfileUpdate = {
  phone: "", location: "", headline: "", bio: "", years_of_experience: 0,
  current_job_title: "", current_company: "", skills: [],
};

export default function ProfilePage() {
  const [form, setForm] = useState<CandidateProfileUpdate>(emptyProfile);
  const [saved, setSaved] = useState<CandidateProfileUpdate>(emptyProfile);
  const [skill, setSkill] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    profileApi.getProfile().then((data) => {
      const editable = { phone: data.phone, location: data.location, headline: data.headline, bio: data.bio, years_of_experience: data.years_of_experience, current_job_title: data.current_job_title, current_company: data.current_company, skills: data.skills };
      setForm(editable); setSaved(editable);
    }).catch((reason) => setError(getApiError(reason))).finally(() => setLoading(false));
  }, []);

  function setField<K extends keyof CandidateProfileUpdate>(key: K, value: CandidateProfileUpdate[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSuccess("");
  }

  function addSkill() {
    const value = skill.trim();
    if (!value || form.skills.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    setField("skills", [...form.skills, value]); setSkill("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    try {
      const data = await profileApi.updateProfile(form);
      const editable = { ...form, skills: data.skills, years_of_experience: data.years_of_experience };
      setForm(editable); setSaved(editable); setSuccess("Profile saved successfully.");
    } catch (reason) { setError(getApiError(reason)); } finally { setSaving(false); }
  }

  if (loading) return <main className="mx-auto max-w-6xl px-4 py-12 text-sm text-slate-400 sm:px-6">Loading profile...</main>;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-slate-400">Keep your professional information up to date.</p>
      {success && <div role="status" className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      <form onSubmit={submit} className="mt-8 space-y-6">
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Basic information</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm text-slate-300">Phone<input className={inputClass} value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
            <label className="text-sm text-slate-300">Location<input className={inputClass} value={form.location} onChange={(e) => setField("location", e.target.value)} /></label>
          </div>
        </section>
        <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Professional information</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm text-slate-300 sm:col-span-2">Headline<input className={inputClass} value={form.headline} onChange={(e) => setField("headline", e.target.value)} /></label>
            <label className="text-sm text-slate-300 sm:col-span-2">Bio<textarea className={`${inputClass} min-h-32 resize-y`} value={form.bio} onChange={(e) => setField("bio", e.target.value)} /></label>
            <label className="text-sm text-slate-300">Years of experience<input type="number" min="0" max="65535" className={inputClass} value={form.years_of_experience} onChange={(e) => setField("years_of_experience", Number(e.target.value))} /></label>
            <label className="text-sm text-slate-300">Current job title<input className={inputClass} value={form.current_job_title} onChange={(e) => setField("current_job_title", e.target.value)} /></label>
            <label className="text-sm text-slate-300 sm:col-span-2">Current company<input className={inputClass} value={form.current_company} onChange={(e) => setField("current_company", e.target.value)} /></label>
          </div>
          <div className="mt-7 border-t border-white/10 pt-6">
            <h3 className="text-sm font-medium text-slate-200">Skills</h3>
            <p className="mt-1 text-xs text-slate-500">Existing skills</p>
            <div className="mt-3 flex min-h-10 flex-wrap gap-2">
              {form.skills.length ? form.skills.map((item, index) => (
                <span key={`${item}-${index}`} className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200">
                  <input aria-label={`Edit ${item}`} className="w-24 bg-transparent outline-none" value={item} onChange={(e) => setField("skills", form.skills.map((current, i) => i === index ? e.target.value : current))} />
                  <button type="button" aria-label={`Remove ${item}`} onClick={() => setField("skills", form.skills.filter((_, i) => i !== index))} className="text-cyan-400 hover:text-white">×</button>
                </span>
              )) : <span className="text-sm text-slate-500">No skills added yet.</span>}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input aria-label="Add skill" placeholder="Add a skill" className={`${inputClass} mt-0`} value={skill} onChange={(e) => setSkill(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
              <button type="button" onClick={addSkill} className="rounded-xl border border-cyan-400/40 px-5 py-3 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">Add</button>
            </div>
          </div>
        </section>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => { setForm(saved); setSkill(""); setError(""); setSuccess(""); }} disabled={saving} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-slate-500">Cancel changes</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">{saving ? "Saving..." : "Save profile"}</button>
        </div>
      </form>
    </main>
  );
}
