import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import JobMetadata from "./JobMetadata";
import type { Job } from "./types";

interface JobCardProps {
  job: Job;
  busy?: boolean;
  disabled?: boolean;
  onToggleSave: (job: Job) => void;
  children?: ReactNode;
  headerExtra?: ReactNode;
  detailState?: { fromMatching?: boolean; returnTo?: string };
}

export default function JobCard({ job, busy = false, disabled = false, onToggleSave, children, headerExtra, detailState }: JobCardProps) {
  return (
    <article className="ws-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="ws-heading wrap-anywhere">
            <Link to={`/jobs/${job.id}`} state={detailState} className="hover:underline">{job.title}</Link>
          </h2>
          <p className="ws-muted mt-1 wrap-anywhere text-sm">{job.company_name}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {headerExtra}
          <button type="button" className="ws-icon-button" aria-pressed={job.is_saved} disabled={busy || disabled}
            aria-label={`Save ${job.title}`} title={job.is_saved ? "Remove from saved jobs" : "Save job"}
            onClick={() => onToggleSave(job)}>
            <WorkspaceIcon name="bookmark" size={19} />
          </button>
        </div>
      </div>
      <div className="mt-3"><JobMetadata job={job} /></div>
      {job.skills.length > 0 && (
        <ul aria-label="Required skills" className="mt-3 flex flex-wrap items-center gap-2">
          {job.skills.slice(0, 6).map((skill) => <li key={skill} className="ws-badge max-w-full wrap-anywhere" data-tone="neutral">{skill}</li>)}
          {job.skills.length > 6 && <li className="ws-muted text-xs">+{job.skills.length - 6} more</li>}
        </ul>
      )}
      {children}
    </article>
  );
}
