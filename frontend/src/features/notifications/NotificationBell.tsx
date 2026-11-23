import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import WorkspaceIcon from "../../components/WorkspaceIcon";
import { getApiError } from "../auth/formUtils";
import * as notificationsApi from "./api";
import { notificationPath } from "./format";
import NotificationDropdown from "./NotificationDropdown";
import { useNotifications } from "./NotificationContext";
import type { Notification } from "./types";

export default function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const { unreadCount, unreadLoading, unreadError, refreshUnreadCount, noteRead, noteAllRead } = useNotifications();

  async function loadLatest() {
    setLoading(true);
    setError("");
    try {
      const result = await notificationsApi.listNotifications({ pageSize: 8 });
      setNotifications(result.results);
    } catch (reason) {
      setError(`Could not load notifications. ${getApiError(reason)}`);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void loadLatest();
      void refreshUnreadCount();
    }
  }

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => setOpen(false), [location.pathname]);

  async function activate(notification: Notification) {
    const path = notificationPath(notification);
    if (!notification.is_read) {
      setMarkingId(notification.id);
      try {
        const updated = await notificationsApi.markNotificationRead(notification.id);
        setNotifications((items) => items.map((item) => item.id === updated.id ? updated : item));
        noteRead();
      } catch (reason) {
        setError(`Could not mark the notification as read. ${getApiError(reason)}`);
      } finally {
        setMarkingId(null);
      }
    }
    if (path) navigate(path);
  }

  async function markAll() {
    setMarkingAll(true);
    setError("");
    try {
      await notificationsApi.markAllNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
      noteAllRead();
    } catch (reason) {
      setError(`Could not mark notifications as read. ${getApiError(reason)}`);
    } finally {
      setMarkingAll(false);
    }
  }

  const badge = unreadCount > 99 ? "99+" : String(unreadCount);
  return (
    <div ref={containerRef} className="relative">
      <button ref={triggerRef} type="button" onClick={toggle} aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={open} aria-controls={open ? "recent-notifications" : undefined} className="ws-icon-button relative">
        <WorkspaceIcon name="bell" />
        {!unreadLoading && unreadCount > 0 && <span className="ws-brand-mark absolute -right-1 -top-1 min-w-5 rounded-full px-1 py-0.5 text-center text-[10px] font-bold">{badge}</span>}
      </button>
      {unreadError && !open && <button type="button" aria-label="Retry unread notification count" onClick={() => void refreshUnreadCount()} className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-300" />}
      {open && <NotificationDropdown notifications={notifications} unreadCount={unreadCount} loading={loading} error={error} markingId={markingId} markingAll={markingAll} onActivate={(item) => void activate(item)} onMarkAll={() => void markAll()} onRetry={() => void loadLatest()} onClose={() => setOpen(false)} />}
    </div>
  );
}
