import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getApiError, inputClass } from "../auth/formUtils";
import * as resumesApi from "../resumes/api";
import type { Resume } from "../resumes/types";
import * as applicationsApi from "./api";
import type { Application, CoverLetterTone } from "./types";

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
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTone, setAiTone] = useState<CoverLetterTone>("professional");
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const loadResumes = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const items = await resumesApi.listResumes();
      setResumes(items);
      const primary = items.find((resume) => resume.is_primary);
      setResumeId(primary ? String(primary.id) : "");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadResumes(); }, [loadResumes]);

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

  async function generateDraft() {
    if (aiDraft && !window.confirm("Generate a new draft? Your edits to the current AI draft will be replaced.")) return;
    setAiLoading(true); setAiError(""); setCopyStatus("");
    try {
      const result = await applicationsApi.generateCoverLetter(jobId, aiTone, aiInstructions.trim());
      if (!result.cover_letter) { setAiError(result.detail || "The draft is not ready. Please try again."); return; }
      setAiDraft(result.cover_letter);
    } catch (reason) { setAiError(`Cover-letter generation unavailable. ${getApiError(reason)}`); }
    finally { setAiLoading(false); }
  }

  async function copyDraft() {
    try { await navigator.clipboard.writeText(aiDraft); setCopyStatus("Copied to clipboard."); }
    catch { setCopyStatus("Copy failed. Select the text and copy it manually."); }
  }

  const selectedResume = resumes.find((resume) => String(resume.id) === resumeId);
  const hasPrimaryResume = resumes.some((resume) => resume.is_primary);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="application-form-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 id="application-form-title" className="text-xl font-semibold">Apply for {jobTitle}</h2><p className="mt-1 text-sm text-slate-400">Choose the resume you want attached to this application.</p></div><button type="button" aria-label="Close application form" disabled={submitting} onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-white/5 hover:text-white">×</button></div>
        {error && <div role="alert" className="mt-5 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        {loading ? <div className="mt-6 h-36 animate-pulse rounded-xl bg-white/5" aria-label="Loading resumes" /> : error && resumes.length === 0 ? <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 p-6 text-center"><p className="text-sm text-red-200">Resumes could not be loaded.</p><button type="button" onClick={() => void loadResumes()} className="mt-4 rounded-lg border border-cyan-400/40 px-4 py-2 text-sm font-semibold text-cyan-300">Try again</button></div> : resumes.length === 0 ? <div className="mt-6 rounded-xl border border-dashed border-slate-700 p-6 text-center"><h3 className="font-semibold">A resume is required</h3><p className="mt-2 text-sm text-slate-400">Upload a resume before submitting your application.</p><Link to="/resumes" className="mt-4 inline-block rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">Manage resumes</Link></div> : <form onSubmit={submit} className="mt-6 space-y-5">
          {!hasPrimaryResume && <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><p>You do not have a primary resume. Choose one below for this application.</p><Link to="/resumes" className="mt-2 inline-block font-semibold text-cyan-300">Manage resumes</Link></div>}
          <label className="block text-sm text-slate-300">Resume<select autoFocus required className={inputClass} value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}{resume.is_primary ? " — Primary" : ""}</option>)}</select></label>
          {selectedResume && <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><p className="font-semibold text-slate-200">Resume to submit</p><p className="mt-1 text-slate-300">{selectedResume.title}{selectedResume.is_primary ? " — Primary" : ""}</p><p className="mt-1 break-all text-xs text-slate-500">{selectedResume.file_name}</p></div>}
          <section className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-4">
            <button type="button" onClick={() => setAiOpen((value) => !value)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-violet-100"><span>AI-assisted cover letter <span className="font-normal text-slate-500">(optional)</span></span><span aria-hidden="true">{aiOpen ? "−" : "+"}</span></button>
            {aiOpen && <div className="mt-4 space-y-4">
              <p className="text-xs leading-5 text-slate-400">Gemini creates an editable draft from your saved profile and this job. Review all claims before using it.</p>
              <label className="block text-sm text-slate-300">Tone<select className={inputClass} value={aiTone} onChange={(event) => setAiTone(event.target.value as CoverLetterTone)}><option value="professional">Professional</option><option value="warm">Warm</option><option value="concise">Concise</option><option value="enthusiastic">Enthusiastic</option></select></label>
              <label className="block text-sm text-slate-300">Optional instructions<textarea className={`${inputClass} min-h-24 resize-y`} maxLength={1500} value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} placeholder="For example: emphasize API development. Do not add facts that are not in your profile." /><span className="mt-1 block text-right text-xs text-slate-500">{aiInstructions.length} / 1,500</span></label>
              <button type="button" disabled={aiLoading} onClick={() => void generateDraft()} className="rounded-lg border border-violet-400/40 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-400/10 disabled:opacity-50">{aiLoading ? "Generating draft..." : aiDraft ? "Regenerate draft" : "Generate draft"}</button>
              {aiError && <div role="alert" className="rounded-lg bg-red-400/10 p-3 text-sm text-red-200">{aiError} <button type="button" onClick={() => void generateDraft()} className="font-semibold underline">Retry</button></div>}
              {aiDraft && <div className="space-y-3"><label className="block text-sm text-slate-300">Review and edit AI draft<textarea className={`${inputClass} min-h-64 resize-y`} maxLength={COVER_LETTER_LIMIT} value={aiDraft} onChange={(event) => setAiDraft(event.target.value)} /><span className="mt-1 block text-right text-xs text-slate-500">{aiDraft.length.toLocaleString()} / {COVER_LETTER_LIMIT.toLocaleString()}</span></label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setCoverLetter(aiDraft)} className="rounded-lg bg-violet-300 px-4 py-2 text-sm font-semibold text-slate-950">Use this draft</button><button type="button" onClick={() => void copyDraft()} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300">Copy</button></div>{copyStatus && <p role="status" className="text-xs text-slate-400">{copyStatus}</p>}<p className="text-xs text-amber-200">AI-generated content may be inaccurate. Verify every statement before applying.</p></div>}
            </div>}
          </section>
          <label className="block text-sm text-slate-300">Cover letter <span className="text-slate-500">(optional)</span><textarea className={`${inputClass} min-h-48 resize-y`} maxLength={COVER_LETTER_LIMIT} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Explain why you're interested in this role..." /><span className="mt-1 block text-right text-xs text-slate-500">{coverLetter.length.toLocaleString()} / {COVER_LETTER_LIMIT.toLocaleString()}</span></label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={submitting} onClick={onClose} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-300">Cancel</button><button disabled={submitting} className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50">{submitting ? "Submitting..." : "Submit application"}</button></div>
        </form>}
      </div>
    </div>
  );
}
