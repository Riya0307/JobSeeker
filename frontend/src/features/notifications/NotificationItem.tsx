import { formatNotificationTime, notificationPath } from "./format";
import type { Notification } from "./types";

interface NotificationItemProps {
  notification: Notification;
  onActivate: (notification: Notification) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function NotificationItem({
  notification,
  onActivate,
  disabled = false,
  compact = false,
}: NotificationItemProps) {
  const interactive = !notification.is_read || Boolean(notificationPath(notification));
  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? "bg-slate-700" : "bg-cyan-300"}`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className={`font-semibold ${notification.is_read ? "text-slate-300" : "text-white"}`}>
              {notification.title}
            </p>
            {!notification.is_read && <span className="sr-only">Unread notification</span>}
          </div>
          <p className={`mt-1 text-sm leading-5 text-slate-400 ${compact ? "line-clamp-2" : ""}`}>
            {notification.message}
          </p>
          <p className="mt-2 text-xs text-slate-500">{formatNotificationTime(notification.created_at)}</p>
        </div>
      </div>
    </>
  );

  const className = `w-full rounded-xl border px-4 py-3 text-left transition ${
    notification.is_read
      ? "border-white/5 bg-slate-900/40"
      : "border-cyan-400/20 bg-cyan-400/5"
  } ${interactive ? "hover:border-cyan-400/40 hover:bg-white/5" : ""}`;

  return interactive ? (
    <button type="button" disabled={disabled} onClick={() => onActivate(notification)} className={`${className} disabled:opacity-60`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
