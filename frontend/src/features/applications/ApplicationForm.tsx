import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import { getApiError } from "../auth/formUtils";
import * as resumesApi from "../resumes/api";
import type { Resume } from "../resumes/types";
import * as applicationsApi from "./api";
import type { Application, CoverLetterTone } from "./types";

const COVER_LETTER_LIMIT = 10_000;
const inputClass = "ws-control mt-1";

interface ApplicationFormProps {
  jobId: number;
  jobTitle: string;
  onClose: () => void;
  onSuccess: (application: Application) => void;
}

export default function ApplicationForm({ jobId, jobTitle, onClose, onSuccess }: ApplicationFormProps) {
  const dialog = useRef<HTMLDialogElement>(null);
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
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!resumeId) { setError("Select a resume before applying."); return; }
    if (submitting || !window.confirm(`Submit your application for ${jobTitle}?`)) return;
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
    if (aiLoading) return;
    if (aiDraft && !window.confirm("Generate a new draft? Your edits to the current AI draft will be replaced.")) return;
    setAiLoading(true); setAiError(""); setCopyStatus("");
    try {
      const result = await applicationsApi.generateCoverLetter(jobId, aiTone, aiInstructions.trim());
      if (!result.cover_letter) { setAiError(result.detail || "The draft is not ready. Please try again."); return; }
      setAiDraft(result.cover_letter);
    } catch (reason) { setAiError(`Cover-letter generation unavailable. ${getApiError(reason)}`); }
    finally { setAiLoading(false); }
  }

  function useDraft() {
    if (coverLetter && coverLetter !== aiDraft && !window.confirm("Replace the current cover letter with this draft?")) return;
    setCoverLetter(aiDraft);
  }

  async function copyDraft() {
    try { await navigator.clipboard.writeText(aiDraft); setCopyStatus("Copied to clipboard."); }
    catch { setCopyStatus("Copy failed. Select the text and copy it manually."); }
  }

  const selectedResume = resumes.find((resume) => String(resume.id) === resumeId);
  const hasPrimaryResume = resumes.some((resume) => resume.is_primary);

  return (
    <dialog ref={dialog} className="ws-dialog w-[min(36rem,calc(100vw-2rem))]" aria-labelledby="application-form-title"
      onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div className="w-full p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 id="application-form-title" className="ws-heading wrap-anywhere">Apply for {jobTitle}</h2><p className="mt-1 text-sm ws-muted">Choose the resume you want attached to this application.</p></div><button type="button" aria-label="Close application form" disabled={submitting} onClick={onClose} className="ws-icon-button" autoFocus><WorkspaceIcon name="close" size={18} /></button></div>
        {error && <div role="alert" className="mt-5 ws-alert">{error}</div>}
        {loading ? <div className="mt-6 ws-skeleton h-36" aria-label="Loading resumes" /> : error && resumes.length === 0 ? <div className="mt-6 ws-alert text-center"><p className="text-sm">Resumes could not be loaded.</p><button type="button" onClick={() => void loadResumes()} className="mt-4 ws-button">Try again</button></div> : resumes.length === 0 ? <div className="mt-6 ws-empty p-6 text-center"><h3 className="font-semibold">A resume is required</h3><p className="mt-2 text-sm ws-muted">Upload a resume before submitting your application.</p><Link to="/resumes" className="mt-4 ws-button ws-button-primary">Manage resumes</Link></div> : <form onSubmit={submit} className="mt-6 min-w-0 space-y-5">
          {!hasPrimaryResume && <div className="ws-empty"><p>You do not have a primary resume. Choose one below for this application.</p><Link to="/resumes" className="mt-2 ws-link inline-block">Manage resumes</Link></div>}
          <label className="block text-sm">Resume<select required className={inputClass} value={resumeId} onChange={(event) => setResumeId(event.target.value)}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.title}{resume.is_primary ? " — Primary" : ""}</option>)}</select></label>
          {selectedResume && <div className="ws-empty"><p className="font-semibold">Resume to submit</p><p className="mt-1 ws-muted"><span className="wrap-anywhere">{selectedResume.title}</span>{selectedResume.is_primary ? " — Primary" : ""}</p><p className="mt-1 break-all text-xs ws-muted">{selectedResume.file_name}</p></div>}
          <section className="ws-empty p-4">
            <button type="button" aria-expanded={aiOpen} aria-controls={aiOpen ? "application-ai-draft" : undefined} onClick={() => setAiOpen((value) => !value)} className="flex w-full items-center justify-between text-left min-h-10 text-sm font-semibold"><span>AI-assisted cover letter <span className="font-normal ws-muted">(optional)</span></span><span aria-hidden="true">{aiOpen ? "−" : "+"}</span></button>
            {aiOpen && <div id="application-ai-draft" className="mt-4 space-y-4">
              <p className="text-xs leading-5 ws-muted">Gemini creates an editable draft from your saved profile and this job. Review all claims before using it.</p>
              <label className="block text-sm">Tone<select className={inputClass} value={aiTone} onChange={(event) => setAiTone(event.target.value as CoverLetterTone)}><option value="professional">Professional</option><option value="warm">Warm</option><option value="concise">Concise</option><option value="enthusiastic">Enthusiastic</option></select></label>
              <label className="block text-sm">Optional instructions<textarea className={`${inputClass} min-h-24 resize-y`} maxLength={1500} value={aiInstructions} onChange={(event) => setAiInstructions(event.target.value)} placeholder="For example: emphasize API development. Do not add facts that are not in your profile." /><span className="mt-1 block text-right text-xs ws-muted">{aiInstructions.length} / 1,500</span></label>
              <button type="button" disabled={aiLoading} onClick={() => void generateDraft()} className="ws-button">{aiLoading ? "Generating draft..." : aiDraft ? "Regenerate draft" : "Generate draft"}</button>
              {aiError && <div role="alert" className="ws-alert">{aiError} <button type="button" onClick={() => void generateDraft()} className="font-semibold underline">Retry</button></div>}
              {aiDraft && <div className="space-y-3"><label className="block text-sm">Review and edit AI draft<textarea className={`${inputClass} min-h-64 resize-y`} maxLength={COVER_LETTER_LIMIT} value={aiDraft} onChange={(event) => setAiDraft(event.target.value)} /><span className="mt-1 block text-right text-xs ws-muted">{aiDraft.length.toLocaleString()} / {COVER_LETTER_LIMIT.toLocaleString()}</span></label><div className="flex flex-wrap gap-2"><button type="button" onClick={useDraft} className="ws-button">Use this draft</button><button type="button" onClick={() => void copyDraft()} className="ws-button">Copy</button></div>{copyStatus && <p role="status" className="text-xs ws-muted">{copyStatus}</p>}<p className="text-xs ws-muted">AI-generated content may be inaccurate. Verify every statement before applying.</p></div>}
            </div>}
          </section>
          <label className="block text-sm">Cover letter <span className="ws-muted">(optional)</span><textarea className={`${inputClass} min-h-48 resize-y`} maxLength={COVER_LETTER_LIMIT} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} placeholder="Explain why you're interested in this role..." /><span className="mt-1 block text-right text-xs ws-muted">{coverLetter.length.toLocaleString()} / {COVER_LETTER_LIMIT.toLocaleString()}</span></label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={submitting} onClick={onClose} className="ws-button">Cancel</button><button disabled={submitting} className="ws-button ws-button-primary">{submitting ? "Submitting..." : "Submit application"}</button></div>
        </form>}
      </div>
    </dialog>
  );
}
