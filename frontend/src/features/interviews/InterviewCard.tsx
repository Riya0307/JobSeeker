import { Link } from "react-router-dom";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import { formatInterviewDateTime, interviewModeLabel, interviewStatusTone, interviewStatusLabel } from "./format";
import type { Interview } from "./types";

export default function InterviewCard({ interview }: { interview: Interview }) {
  const { job } = interview.application;
  const upcoming = (interview.status === "scheduled" || interview.status === "rescheduled")
    && Date.parse(interview.scheduled_at) >= Date.now();
  const logistics = interview.mode === "online"
    ? (interview.meeting_link ? "Meeting link available" : "Online meeting details pending")
    : interview.mode === "in_person" ? (interview.location || "Location pending") : "";
  return (
    <article className="ws-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-[1_1_12rem]">
          <h2 className="ws-heading wrap-anywhere"><Link className="hover:underline" to={`/interviews/${interview.id}`}>{job.title}</Link></h2>
          <p className="ws-muted mt-1 wrap-anywhere text-sm">{job.company_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="ws-badge" data-tone={interviewStatusTone(interview.status)}>{interviewStatusLabel(interview.status)}</span>
          {upcoming && <span className="ws-badge" data-tone="neutral">Upcoming</span>}
        </div>
      </header>
      <p className="mt-3 wrap-anywhere text-sm font-semibold">{interview.round_name}</p>
      <div className="ws-muted mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="flex items-center gap-2"><WorkspaceIcon name="calendar" size={17} />
          <time dateTime={interview.scheduled_at}>{formatInterviewDateTime(interview.scheduled_at)}</time>
        </span>
        <span>{interviewModeLabel(interview.mode)} · {interview.duration_minutes} minutes</span>
      </div>
      {logistics && <p className="ws-muted mt-2 wrap-anywhere text-sm">{logistics}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/interviews/${interview.id}`} className="ws-button">View interview</Link>
        <Link to={`/applications/${interview.application.id}`} className="ws-button">View application</Link>
      </div>
    </article>
  );
}
