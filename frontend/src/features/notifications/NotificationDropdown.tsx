import { Link } from "react-router-dom";
import NotificationItem from "./NotificationItem";
import type { Notification } from "./types";

interface NotificationDropdownProps {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  markingId: number | null;
  markingAll: boolean;
  onActivate: (notification: Notification) => void;
  onMarkAll: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export default function NotificationDropdown({
  notifications,
  unreadCount,
  loading,
  error,
  markingId,
  markingAll,
  onActivate,
  onMarkAll,
  onRetry,
  onClose,
}: NotificationDropdownProps) {
  return (
    <section id="recent-notifications" className="ws-popover ws-notification-panel z-50" aria-label="Recent notifications">
      <header className="flex items-center justify-between gap-3 ws-divider border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">Notifications</h2>
          <p className="ws-muted text-xs">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        <button type="button" disabled={!unreadCount || markingAll} onClick={onMarkAll} className="ws-link min-h-11 text-xs disabled:opacity-50">
          {markingAll ? "Marking..." : "Mark all as read"}
        </button>
      </header>
      <div className="max-h-[min(28rem,65vh)] overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2" aria-label="Loading notifications">{[1, 2, 3].map((item) => <div key={item} className="ws-skeleton h-20" />)}</div>
        ) : error ? (
          <div role="alert" className="ws-alert"><p>{error}</p><button type="button" onClick={onRetry} className="ws-link mt-3">Try again</button></div>
        ) : notifications.length ? (
          <div className="space-y-2">{notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} compact disabled={markingId === notification.id} onActivate={onActivate} />)}</div>
        ) : (
          <div className="ws-empty text-center"><p className="font-medium">You're all caught up</p><p className="mt-1 text-sm">No notifications yet.</p></div>
        )}
      </div>
      <footer className="ws-divider border-t p-3">
        <Link to="/notifications" onClick={onClose} className="ws-button w-full">View all notifications</Link>
      </footer>
    </section>
  );
}
