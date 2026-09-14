import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getApiError } from "../auth/formUtils";
import Pagination from "../jobs/Pagination";
import * as notificationsApi from "./api";
import { notificationPath } from "./format";
import NotificationItem from "./NotificationItem";
import { useNotifications } from "./NotificationContext";
import type { Notification, PaginatedNotifications } from "./types";

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<PaginatedNotifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [retry, setRetry] = useState(0);
  const { unreadCount, noteRead, noteAllRead } = useNotifications();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const unreadOnly = params.get("unread") === "true";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await notificationsApi.listNotifications({ page, unread: unreadOnly }));
    } catch (reason) {
      setError(`Could not load notifications. ${getApiError(reason)}`);
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly, retry]);

  useEffect(() => { void load(); }, [load]);

  function setFilter(unread: boolean) {
    const next = new URLSearchParams();
    if (unread) next.set("unread", "true");
    setParams(next);
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function activate(notification: Notification) {
    const path = notificationPath(notification);
    if (!notification.is_read) {
      setMarkingId(notification.id);
      setError("");
      try {
        const updated = await notificationsApi.markNotificationRead(notification.id);
        noteRead();
        if (unreadOnly) {
          if (data?.results.length === 1 && page > 1) {
            const next = new URLSearchParams(params);
            next.set("page", String(page - 1));
            setParams(next);
          } else {
            setData((current) => current ? {
              ...current,
              count: Math.max(0, current.count - 1),
              results: current.results.filter((item) => item.id !== updated.id),
            } : current);
          }
        } else {
          setData((current) => current ? { ...current, results: current.results.map((item) => item.id === updated.id ? updated : item) } : current);
        }
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
    setSuccess("");
    try {
      const result = await notificationsApi.markAllNotificationsRead();
      noteAllRead();
      setSuccess(result.updated_count ? `${result.updated_count} notifications marked as read.` : "All notifications are already read.");
      if (unreadOnly) {
        setData((current) => current ? { ...current, count: 0, results: [], next: null, previous: null } : current);
        if (page > 1) setFilter(true);
      }
      else setData((current) => current ? { ...current, results: current.results.map((item) => ({ ...item, is_read: true })) } : current);
    } catch (reason) {
      setError(`Could not mark notifications as read. ${getApiError(reason)}`);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Activity updates</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Notifications</h1><p className="mt-2 text-slate-400">Keep track of applications and interviews.</p></div>
        <button type="button" disabled={!unreadCount || markingAll} onClick={() => void markAll()} className="rounded-xl border border-cyan-400/30 px-5 py-3 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-600">{markingAll ? "Marking…" : "Mark all as read"}</button>
      </header>
      <section className="mt-7 flex gap-2" aria-label="Notification filters">
        <button type="button" onClick={() => setFilter(false)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!unreadOnly ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-300"}`}>All</button>
        <button type="button" onClick={() => setFilter(true)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${unreadOnly ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-300"}`}>Unread{unreadCount ? ` (${unreadCount})` : ""}</button>
      </section>
      {success && <div role="status" className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{success}</div>}
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 font-semibold text-cyan-300">Try again</button></div>}
      <section className="mt-7" aria-live="polite">
        {loading ? <div className="space-y-3" aria-label="Loading notifications">{[1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl bg-white/5" />)}</div> : data?.results.length ? <><p className="mb-4 text-sm text-slate-400">{data.count} {unreadOnly ? "unread " : ""}{data.count === 1 ? "notification" : "notifications"}</p><div className="space-y-3">{data.results.map((notification) => <NotificationItem key={notification.id} notification={notification} disabled={markingId === notification.id} onActivate={(item) => void activate(item)} />)}</div><Pagination page={page} count={data.count} ariaLabel="Notification pages" onChange={changePage} /></> : <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-16 text-center"><h2 className="text-lg font-semibold">You're all caught up</h2><p className="mt-2 text-sm text-slate-400">{unreadOnly ? "You have no unread notifications." : "No notifications yet."}</p></div>}
      </section>
    </main>
  );
}
