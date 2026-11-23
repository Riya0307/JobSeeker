import { useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import WorkspaceIcon, { type WorkspaceIconName } from "../components/WorkspaceIcon";
import { useAuth } from "../features/auth/AuthContext";
import NotificationBell from "../features/notifications/NotificationBell";
import { NotificationProvider } from "../features/notifications/NotificationContext";

const groups: { title: string; links: [string, string, WorkspaceIconName][] }[] = [
  { title: "Workspace", links: [
    ["Dashboard", "/dashboard", "dashboard"], ["Find Jobs", "/jobs", "search"],
    ["Recommended Jobs", "/matching", "spark"], ["Saved Jobs", "/saved-jobs", "bookmark"],
  ] },
  { title: "My Career", links: [
    ["Applications", "/applications", "briefcase"], ["Interviews", "/interviews", "calendar"],
    ["Resumes", "/resumes", "resume"], ["Job Alerts", "/job-alerts", "bell"],
  ] },
  { title: "Account", links: [["My Profile", "/profile", "user"]] },
];

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/dashboard" onClick={onNavigate} className="inline-flex min-w-0 items-center gap-2.5 font-bold tracking-tight">
      <span className="ws-brand-mark grid size-9 shrink-0 place-items-center rounded-lg"><WorkspaceIcon name="brand" /></span>
      <span>JobSeeker</span>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Candidate navigation" className="space-y-6 px-3 pb-5 pt-3">
      {groups.map(({ title, links }) => (
        <div key={title}>
          <p className="ws-muted mb-2 px-2.5 text-xs font-semibold">{title}</p>
          <ul className="space-y-1">
            {links.map(([label, path, icon]) => (
              <li key={path}>
                <NavLink to={path} onClick={onNavigate} className="ws-menu-item">
                  <WorkspaceIcon name={icon} size={18} />{label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const menu = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node) && menu.current) menu.current.open = false;
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const name = [user?.first_name, user?.last_name].map((part) => part?.trim()).filter(Boolean).join(" ");
  const initials = name.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] ?? "").join("")
    || Array.from(user?.email ?? "")[0] || "U";

  return (
    <details ref={menu} className="relative" onKeyDown={(event) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        trigger.current?.focus();
      }
    }}>
      <summary ref={trigger} aria-label="Account menu"
        className="ws-button cursor-pointer list-none gap-2 p-1.5 sm:pr-2.5 [&::-webkit-details-marker]:hidden">
        <span className="ws-avatar grid size-8 shrink-0 place-items-center rounded-md text-xs font-bold uppercase">{initials}</span>
        <span className="hidden max-w-32 truncate sm:block">{name || "My account"}</span>
        <WorkspaceIcon name="chevron" size={14} />
      </summary>
      <div className="ws-popover absolute right-0 top-full z-40 mt-3 w-56 p-1.5">
        <div className="ws-divider border-b px-2.5 py-2">
          {name && <p className="break-words text-sm font-semibold">{name}</p>}
          <p className="ws-muted break-all text-xs">{user?.email}</p>
        </div>
        <Link to="/profile" className="ws-menu-item mt-1" onClick={() => { if (menu.current) menu.current.open = false; }}>
          <WorkspaceIcon name="user" size={17} /> My profile
        </Link>
        <button type="button" className="ws-menu-item" onClick={() => void handleLogout().catch(() => {})}>
          <WorkspaceIcon name="logout" size={17} /> Log out
        </button>
      </div>
    </details>
  );
}

export default function AuthenticatedLayout() {
  const { pathname } = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const lightContent = ["/dashboard", "/jobs", "/matching", "/saved-jobs", "/applications", "/interviews"]
    .some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const closeDrawer = () => drawer.current?.close();
  const currentSection = groups.flatMap(({ links }) => links)
    .find(([, path]) => pathname === path || pathname.startsWith(`${path}/`))?.[0] ?? "Notifications";

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    function closeAtDesktop() { if (desktop.matches && drawer.current?.open) drawer.current.close(); }
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);
  useEffect(() => { if (drawer.current?.open) drawer.current.close(); }, [pathname]);

  return (
    <NotificationProvider>
      <div className="workspace ws-shell min-h-dvh lg:grid lg:grid-cols-[var(--ws-sidebar)_minmax(0,1fr)]">
        <a href="#workspace-content" className="ws-button sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50">Skip to content</a>
        <aside className="ws-sidebar sticky top-0 hidden h-dvh overflow-y-auto lg:block">
          <div className="ws-header flex items-center px-5"><Brand /></div>
          <Navigation />
        </aside>
        <dialog id="candidate-drawer" ref={drawer} className="ws-dialog ws-drawer" aria-labelledby="drawer-title"
          onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
          <div className="min-h-full">
            <div className="ws-header flex items-center justify-between gap-3 px-4">
              <span id="drawer-title" className="sr-only">Candidate navigation</span>
              <Brand onNavigate={closeDrawer} />
              <button type="button" autoFocus className="ws-icon-button" onClick={closeDrawer} aria-label="Close navigation">
                <WorkspaceIcon name="close" />
              </button>
            </div>
            <Navigation onNavigate={closeDrawer} />
          </div>
        </dialog>
        <div className="flex min-w-0 flex-col">
          <header className="ws-header sticky top-0 z-30 flex items-center">
            <div className="mx-auto flex w-full max-w-[var(--ws-width)] items-center justify-between gap-3 px-[var(--ws-inset)]">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" className="ws-icon-button lg:hidden" onClick={() => drawer.current?.showModal()}
                  aria-label="Open navigation" aria-controls="candidate-drawer" aria-haspopup="dialog">
                  <WorkspaceIcon name="menu" />
                </button>
                <div className="lg:hidden"><Brand /></div>
                <p className="hidden text-sm font-semibold lg:block">{currentSection}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <NotificationBell />
                <AccountMenu />
              </div>
            </div>
          </header>
          <div id="workspace-content" tabIndex={-1} className={`min-w-0 flex-1 scroll-mt-20 ${lightContent ? "" : "bg-slate-950 text-slate-100"}`}>
            <Outlet />
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
}
