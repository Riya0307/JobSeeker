import WorkspaceIcon from "../../components/WorkspaceIcon";
import { formatDate, formatExperience, formatSalary, titleCase } from "./format";
import type { Job } from "./types";

export default function JobMetadata({ job }: { job: Job }) {
  const hasExperience = job.experience_min !== null || job.experience_max !== null;
  const hasSalary = job.salary_min !== null || job.salary_max !== null;
  return (
    <ul className="ws-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {job.location && <li className="flex min-w-0 items-start gap-1.5"><WorkspaceIcon name="pin" size={16} /><span className="wrap-anywhere">{job.location}</span></li>}
      <li>{titleCase(job.work_mode)}</li>
      <li>{titleCase(job.employment_type)}</li>
      {hasExperience && <li>{formatExperience(job.experience_min, job.experience_max)}</li>}
      {hasSalary && <li className="font-semibold">{formatSalary(job.salary_min, job.salary_max)}</li>}
      {job.posted_at && <li>Posted <time dateTime={job.posted_at}>{formatDate(job.posted_at)}</time></li>}
    </ul>
  );
}
