const paths = {
  brand: "M4 17l5-5 4 3 7-8M14 7h6v6",
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  search: "M21 21l-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z",
  spark: "M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z",
  bookmark: "M6 4h12v16l-6-4-6 4V4z",
  briefcase: "M3 8h18v12H3zM8 8V5h8v3M3 13h18M10 13v2h4v-2",
  calendar: "M3 6h18v15H3zM7 3v6m10-6v6M3 11h18M8 15h2m4 0h2",
  resume: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  user: "M20 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "m6 9 6 6 6-6",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  logout: "M10 4H4v16h6m0-8h10m-4-4 4 4-4 4",
  pin: "M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1 1 16 0zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
} as const;

export type WorkspaceIconName = keyof typeof paths;

export default function WorkspaceIcon({ name, size = 20 }: { name: WorkspaceIconName; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d={paths[name]} />
    </svg>
  );
}
