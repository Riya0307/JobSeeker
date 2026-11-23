import type { ReactNode } from "react";

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="ws-alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="ws-link mt-1 min-h-10">Try again</button>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="ws-empty"><p className="font-semibold">{title}</p><div className="mt-1">{children}</div></div>;
}

export function RowsSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="ws-divider flex items-center gap-3 border-b py-3 last:border-0">
          <div className="ws-skeleton size-9 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="ws-skeleton h-3.5 w-2/3" />
            <div className="ws-skeleton h-3 w-1/3" />
          </div>
          <div className="ws-skeleton h-5 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}
