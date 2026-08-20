import { useCallback, useEffect, useState, type FormEvent } from "react";
import { getApiError, inputClass } from "../auth/formUtils";
import * as resumesApi from "./api";
import type { Resume } from "./types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

interface ModalProps { title: string; children: React.ReactNode; onClose: () => void }
function Modal({ title, children, onClose }: ModalProps) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl"><h2 className="text-xl font-semibold">{title}</h2>{children}</div>
  </div>;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [viewing, setViewing] = useState<Resume | null>(null);
  const [editing, setEditing] = useState<Resume | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Resume | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [primaryBusy, setPrimaryBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setResumes(await resumesApi.listResumes()); setError(""); }
    catch (reason) { setError(getApiError(reason)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function validateFile(selected: File | null) {
    if (!selected) return "Select a PDF file.";
    if (!selected.name.toLowerCase().endsWith(".pdf") || (selected.type && selected.type !== "application/pdf")) return "File must be a PDF.";
    if (selected.size > MAX_FILE_SIZE) return "File size must not exceed 5 MB.";
    if (!selected.size) return "The selected file is empty.";
    return "";
  }

  async function submitUpload(event: FormEvent) {
    event.preventDefault();
    const validation = validateFile(file);
    if (!title.trim()) { setUploadError("Resume title is required."); return; }
    if (validation) { setUploadError(validation); return; }
    setUploading(true); setUploadError("");
    try {
      const created = await resumesApi.uploadResume({ title: title.trim(), file: file! });
      setResumes((current) => [created, ...current]); setUploadOpen(false); setTitle(""); setFile(null);
      setSuccess("Resume uploaded successfully."); setError("");
    } catch (reason) { setUploadError(getApiError(reason)); }
    finally { setUploading(false); }
  }

  async function makePrimary(resume: Resume) {
    setPrimaryBusy(resume.id); setError(""); setSuccess("");
    try {
      const updated = await resumesApi.setPrimaryResume(resume.id);
      setResumes((current) => current.map((item) => item.id === updated.id ? updated : { ...item, is_primary: false }));
      setSuccess(`${updated.title} is now your primary resume.`);
    } catch (reason) { setError(getApiError(reason)); }
    finally { setPrimaryBusy(null); }
  }

  async function saveTitle(event: FormEvent) {
    event.preventDefault(); if (!editing || !editTitle.trim()) return;
    setSaving(true); setError("");
    try {
      const updated = await resumesApi.updateResumeTitle(editing.id, editTitle.trim());
      setResumes((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditing(null); setSuccess("Resume title updated successfully.");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleting) return; setDeleteBusy(true); setError("");
    try {
      await resumesApi.deleteResume(deleting.id);
      setDeleting(null); await load(); setSuccess("Resume deleted successfully.");
    } catch (reason) { setError(getApiError(reason)); }
    finally { setDeleteBusy(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-3xl font-semibold tracking-tight">Resumes</h1><p className="mt-2 text-slate-400">Upload and manage the resumes you use for applications.</p></div>
        <button onClick={() => { setUploadOpen(true); setUploadError(""); }} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Upload resume</button>
      </div>
      {success && <div role="status" className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {loading ? <p className="mt-10 text-sm text-slate-400">Loading resumes...</p> : resumes.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">No resumes yet</h2><p className="mt-2 text-sm text-slate-400">Upload your first PDF resume to get started.</p></section>
      ) : <section className="mt-8 grid gap-5 md:grid-cols-2">{resumes.map((resume) => (
        <article key={resume.id} className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <div className="flex items-start justify-between gap-3"><h2 className="text-lg font-semibold">{resume.title}</h2>{resume.is_primary && <span className="shrink-0 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300">★ Primary Resume</span>}</div>
          <p className="mt-5 truncate text-sm text-slate-200" title={resume.file_name}>{resume.file_name}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{resume.file_type === "application/pdf" ? "PDF" : resume.file_type} • {formatSize(resume.file_size)}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs text-slate-500"><div><dt>Created</dt><dd className="mt-1 text-slate-300">{formatDate(resume.created_at)}</dd></div><div><dt>Updated</dt><dd className="mt-1 text-slate-300">{formatDate(resume.updated_at)}</dd></div></dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => setViewing(resume)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium hover:border-slate-500">View</button>
            <button onClick={() => { setEditing(resume); setEditTitle(resume.title); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium hover:border-slate-500">Edit</button>
            {!resume.is_primary && <button disabled={primaryBusy !== null} onClick={() => void makePrimary(resume)} className="rounded-lg border border-cyan-400/30 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-50">{primaryBusy === resume.id ? "Setting..." : "Set Primary"}</button>}
            <button onClick={() => setDeleting(resume)} className="ml-auto rounded-lg border border-red-400/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-400/10">Delete</button>
          </div>
        </article>
      ))}</section>}

      {uploadOpen && <Modal title="Upload Resume" onClose={() => !uploading && setUploadOpen(false)}><form onSubmit={submitUpload} className="mt-5 space-y-5">
        {uploadError && <p role="alert" className="rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{uploadError}</p>}
        <label className="block text-sm text-slate-300">Resume Title<input autoFocus className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm text-slate-300">PDF File<input type="file" accept=".pdf,application/pdf" className="mt-2 block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-cyan-300" onChange={(e) => { const selected = e.target.files?.[0] ?? null; setFile(selected); setUploadError(validateFile(selected)); }} /></label>
        <p className="text-xs text-slate-500">PDF only, up to 5 MB.</p><div className="flex justify-end gap-3"><button type="button" disabled={uploading} onClick={() => setUploadOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancel</button><button disabled={uploading} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{uploading ? "Uploading..." : "Upload"}</button></div>
      </form></Modal>}
      {viewing && <Modal title={viewing.title} onClose={() => setViewing(null)}><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-slate-500">File name</dt><dd className="mt-1 break-all">{viewing.file_name}</dd></div><div><dt className="text-slate-500">File</dt><dd className="mt-1">PDF • {formatSize(viewing.file_size)}</dd></div><div><dt className="text-slate-500">Updated</dt><dd className="mt-1">{formatDate(viewing.updated_at)}</dd></div></dl><button onClick={() => setViewing(null)} className="mt-6 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm">Close</button></Modal>}
      {editing && <Modal title="Edit Resume" onClose={() => !saving && setEditing(null)}><form onSubmit={saveTitle} className="mt-5"><label className="text-sm text-slate-300">Resume Title<input autoFocus required className={inputClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button></div></form></Modal>}
      {deleting && <Modal title="Delete this resume?" onClose={() => !deleteBusy && setDeleting(null)}><p className="mt-3 text-sm text-slate-400">This action cannot be undone.</p><div className="mt-6 flex justify-end gap-3"><button disabled={deleteBusy} onClick={() => setDeleting(null)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm">Cancel</button><button disabled={deleteBusy} onClick={() => void confirmDelete()} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{deleteBusy ? "Deleting..." : "Delete"}</button></div></Modal>}
    </main>
  );
}
