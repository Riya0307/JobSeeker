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
    <section className="absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40" aria-label="Recent notifications">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <h2 className="font-semibold text-white">Notifications</h2>
          <p className="text-xs text-slate-400">{unreadCount ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        <button type="button" disabled={!unreadCount || markingAll} onClick={onMarkAll} className="text-xs font-semibold text-cyan-300 disabled:cursor-not-allowed disabled:text-slate-600">
          {markingAll ? "Marking…" : "Mark all as read"}
        </button>
      </header>
      <div className="max-h-[min(28rem,65vh)] overflow-y-auto p-3">
        {loading ? (
          <div className="space-y-2" aria-label="Loading notifications">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-white/5" />)}</div>
        ) : error ? (
          <div role="alert" className="rounded-xl bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 font-semibold text-cyan-300">Try again</button></div>
        ) : notifications.length ? (
          <div className="space-y-2">{notifications.map((notification) => <NotificationItem key={notification.id} notification={notification} compact disabled={markingId === notification.id} onActivate={onActivate} />)}</div>
        ) : (
          <div className="px-4 py-10 text-center"><p className="font-medium text-slate-200">You're all caught up</p><p className="mt-1 text-sm text-slate-500">No notifications yet.</p></div>
        )}
      </div>
      <footer className="border-t border-white/10 p-3">
        <Link to="/notifications" onClick={onClose} className="block rounded-lg px-3 py-2 text-center text-sm font-semibold text-cyan-300 hover:bg-white/5">View all notifications</Link>
      </footer>
    </section>
  );
}
