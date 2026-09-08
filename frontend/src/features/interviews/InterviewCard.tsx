import { Link } from "react-router-dom";
import { formatInterviewDateTime, interviewModeLabel, interviewStatusClass, interviewStatusLabel } from "./format";
import type { Interview } from "./types";

export default function InterviewCard({ interview }: { interview: Interview }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-sm font-semibold text-cyan-300">{interview.application.job.company_name}</p><h2 className="mt-1 text-xl font-semibold tracking-tight">{interview.application.job.title}</h2><p className="mt-3 text-sm font-medium text-slate-200">{interview.round_name}</p></div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${interviewStatusClass(interview.status)}`}>{interviewStatusLabel(interview.status)}</span>
      </div>
      <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 text-sm sm:grid-cols-3"><div><dt className="text-xs uppercase tracking-wider text-slate-500">Schedule</dt><dd className="mt-1 text-slate-200">{formatInterviewDateTime(interview.scheduled_at)}</dd></div><div><dt className="text-xs uppercase tracking-wider text-slate-500">Duration</dt><dd className="mt-1 text-slate-200">{interview.duration_minutes} minutes</dd></div><div><dt className="text-xs uppercase tracking-wider text-slate-500">Mode</dt><dd className="mt-1 text-slate-200">{interviewModeLabel(interview.mode)}</dd></div></dl>
      <p className="mt-4 text-sm text-slate-400">{interview.mode === "online" ? (interview.meeting_link ? "Meeting link available" : "Online meeting details pending") : interview.mode === "in_person" ? (interview.location || "Location pending") : "Phone interview"}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row"><Link to={`/interviews/${interview.id}`} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-300">View interview</Link><Link to={`/applications/${interview.application.id}`} className="rounded-lg border border-slate-700 px-4 py-2.5 text-center text-sm font-semibold text-slate-300 hover:border-slate-500">View application</Link></div>
    </article>
  );
}
