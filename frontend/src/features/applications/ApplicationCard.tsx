import { Link } from "react-router-dom";
import { formatDate, titleCase } from "../jobs/format";
import { applicationStatusLabel, applicationStatusTone } from "./format";
import type { Application } from "./types";

interface ApplicationCardProps {
  application: Application;
  withdrawing: boolean;
  onWithdraw: (application: Application) => void;
}

export default function ApplicationCard({ application, withdrawing, onWithdraw }: ApplicationCardProps) {
  const { job, resume, status, applied_at, updated_at } = application;
  return (
    <article className="ws-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_12rem]">
          <h2 className="ws-heading wrap-anywhere"><Link to={`/applications/${application.id}`} className="hover:underline">{job.title}</Link></h2>
          <p className="ws-muted mt-1 wrap-anywhere text-sm">{job.company_name} · {job.location} · {titleCase(job.work_mode)}</p>
        </div>
        <span className="ws-badge" data-tone={applicationStatusTone(status)}>{applicationStatusLabel(status)}</span>
      </header>
      <dl className="ws-divider mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
        <div><dt className="ws-muted text-xs">Applied</dt><dd><time dateTime={applied_at}>{formatDate(applied_at)}</time></dd></div>
        <div className="min-w-0"><dt className="ws-muted text-xs">Submitted resume</dt><dd className="wrap-anywhere" title={resume.file_name}>{resume.title}</dd></div>
        <div><dt className="ws-muted text-xs">Last updated</dt><dd><time dateTime={updated_at}>{formatDate(updated_at)}</time></dd></div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/applications/${application.id}`} className="ws-button">View details</Link>
        <Link to={`/jobs/${job.id}`} className="ws-button">View job</Link>
        {status === "applied" && <button type="button" disabled={withdrawing} onClick={() => onWithdraw(application)} className="ws-button ws-button-danger">{withdrawing ? "Withdrawing…" : "Withdraw"}</button>}
      </div>
    </article>
  );
}
