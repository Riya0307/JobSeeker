import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface DashboardSectionProps {
  title: string;
  actionLabel: string;
  actionPath: string;
  children: ReactNode;
  className?: string;
}

export default function DashboardSection({ title, actionLabel, actionPath, children, className = "" }: DashboardSectionProps) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">{title}</h2><Link to={actionPath} className="shrink-0 text-sm font-semibold text-cyan-300 hover:text-cyan-200">{actionLabel} →</Link></div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
