import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as notificationsApi from "./api";

interface NotificationContextValue {
  unreadCount: number;
  unreadLoading: boolean;
  unreadError: string;
  refreshUnreadCount: () => Promise<void>;
  noteRead: () => void;
  noteAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadLoading, setUnreadLoading] = useState(true);
  const [unreadError, setUnreadError] = useState("");

  async function refreshUnreadCount() {
    setUnreadLoading(true);
    setUnreadError("");
    try {
      const response = await notificationsApi.listNotifications({ unread: true, pageSize: 1 });
      setUnreadCount(response.count);
    } catch {
      setUnreadError("Unread notifications could not be loaded.");
    } finally {
      setUnreadLoading(false);
    }
  }

  useEffect(() => {
    void refreshUnreadCount();
  }, []);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unreadCount,
      unreadLoading,
      unreadError,
      refreshUnreadCount,
      noteRead: () => setUnreadCount((count) => Math.max(0, count - 1)),
      noteAllRead: () => setUnreadCount(0),
    }),
    [unreadCount, unreadLoading, unreadError],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}
