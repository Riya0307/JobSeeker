import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import WorkspaceIcon from "../WorkspaceIcon";

export default function DashboardSection({ title, actionLabel, actionPath, children }: {
  title: string;
  actionLabel: string;
  actionPath: string;
  children: ReactNode;
}) {
  return (
    <section className="ws-card p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="ws-heading">{title}</h2>
        <Link to={actionPath} className="ws-link inline-flex min-h-10 items-center gap-1 text-sm">
          {actionLabel}<WorkspaceIcon name="arrow" size={15} />
        </Link>
      </header>
      {children}
    </section>
  );
}
