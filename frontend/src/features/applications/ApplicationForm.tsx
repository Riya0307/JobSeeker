import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getApiError, inputClass } from "../auth/formUtils";
import * as resumesApi from "../resumes/api";
import type { Resume } from "../resumes/types";
import * as applicationsApi from "./api";
import type { Application } from "./types";

const COVER_LETTER_LIMIT = 10_000;

interface ApplicationFormProps {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
  onSuccess: (application: Application) => void;
}

export default function ApplicationForm({ jobId, jobTitle, onClose, onSuccess }: ApplicationFormProps) {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    resumesApi.listResumes().then((items) => {
      setResumes(items);
      const primary = items.find((resume) => resume.is_primary);
      if (primary) setResumeId(String(primary.id));
    }).catch((reason) => setError(getApiError(reason))).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!resumeId) { setError("Select a resume before applying."); return; }
    setSubmitting(true); setError("");
    try {
      const application = await applicationsApi.createApplication({
        job_id: jobId,
        resume_id: Number(resumeId),
        cover_letter: coverLetter.trim(),
      });
      onSuccess(application);
    } catch (reason) { setError(getApiError(reason)); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="application-form-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="application-form-title" className="text-xl font-semibold">Apply for {jobTitle}</h2><p className="mt-1 text-sm text-slate-400">Choose the resume you want attached to this application.</p></div><button type="button" aria-label="Close application form" disabled={submitting} onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/5 hover:text-white">×</button></div>
        {error && <div role="alert" className="mt-5 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {loading ? <div className="mt-6 h-36 animate-pulse rounded-xl bg-white/5" aria-label="Loading resumes" /> : resumes.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-6 text-center"><h3 className="font-semibold">A resume is required</h3><p className="mt-2 text-sm text-slate-400">Upload a resume before submitting your application.</p><Link to="/resumes" className="mt-4 inline-block rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Manage resumes</Link></div> : <form onSubmit={submit} className="mt-6 space-y-5">
          <label className="block text-sm text-slate-300">Resume<select autoFocus required className={inputClass} value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}{resume.is_primary ? " — Primary" : ""}</option>)}</select></label>
          <label className="block text-sm text-slate-300">Cover letter <span className="text-slate-500">(optional)</span><textarea className={`${inputClass} min-h-48 resize-y`} maxLength={COVER_LETTER_LIMIT} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Explain why you're interested in this role..." /><span className="mt-1 block text-right text-xs text-slate-500">{coverLetter.length.toLocaleString()} / {COVER_LETTER_LIMIT.toLocaleString()}</span></label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={submitting} onClick={onClose} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">Cancel</button><button disabled={submitting} className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{submitting ? "Submitting..." : "Submit application"}</button></div>
        </form>}
      </div>
    </div>
  );
}
