import { formatDate, formatExperience, formatSalary, titleCase } from "../jobs/format";
import type { JobAlert } from "./types";

export { formatDate, formatExperience, formatSalary, titleCase };

export function alertCriteria(alert: JobAlert): string[] {
  const criteria: string[] = [];
  if (alert.keywords) criteria.push(`Keywords: ${alert.keywords}`);
  if (alert.location) criteria.push(`Location: ${alert.location}`);
  if (alert.work_mode) criteria.push(titleCase(alert.work_mode));
  if (alert.employment_type) criteria.push(titleCase(alert.employment_type));
  if (alert.experience_min !== null || alert.experience_max !== null) {
    criteria.push(formatExperience(alert.experience_min, alert.experience_max));
  }
  if (alert.salary_min !== null || alert.salary_max !== null) {
    criteria.push(formatSalary(alert.salary_min, alert.salary_max));
  }
  return criteria;
}
