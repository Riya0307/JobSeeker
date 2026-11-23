import type { ReactNode } from "react";
import { EmptyState, RowsSkeleton, SectionError } from "../../components/dashboard/DashboardStates";

export { SectionError };

export function JobListSkeleton({ label }: { label: string }) {
  return <div className="ws-card px-4 sm:px-5"><RowsSkeleton label={label} /></div>;
}

export function JobListEmpty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ws-card p-3"><EmptyState title={title}>{children}</EmptyState></div>;
}
