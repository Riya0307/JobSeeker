import { Link } from "react-router-dom";
import WorkspaceIcon, { type WorkspaceIconName } from "../WorkspaceIcon";

interface ActivityCardProps {
  label: string;
  value: number | null;
  path: string;
  icon: WorkspaceIconName;
  error: string;
  onRetry: () => void;
}

export default function ActivityCard({ label, value, path, icon, error, onRetry }: ActivityCardProps) {
  return (
    <div className="ws-card p-3.5 sm:p-4">
      <Link to={path} className="group block rounded-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="ws-avatar grid size-8 place-items-center rounded-lg"><WorkspaceIcon name={icon} size={17} /></span>
          <span className="ws-muted transition-transform group-hover:translate-x-0.5"><WorkspaceIcon name="arrow" size={15} /></span>
        </div>
        {value !== null ? <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p> :
          error ? <p className="mt-2 text-sm font-semibold">Unavailable</p> :
          <div className="ws-skeleton mt-2 h-8 w-12" role="status" aria-label={`Loading ${label.toLowerCase()}`} />}
        <p className="ws-muted mt-0.5 text-xs font-semibold sm:text-sm">{label}</p>
      </Link>
      {error && <button type="button" className="ws-link mt-2 text-sm" onClick={onRetry}>Retry {label.toLowerCase()}</button>}
    </div>
  );
}
