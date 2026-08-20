interface PaginationProps {
  page: number;
  count: number;
  pageSize?: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, count, pageSize = 10, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Job results pages" className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-6">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 disabled:opacity-40">Previous</button>
      <span className="text-sm text-slate-400">Page <strong className="text-slate-200">{page}</strong> of {pages}</span>
      <button disabled={page >= pages} onClick={() => onChange(page + 1)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 disabled:opacity-40">Next</button>
    </nav>
  );
}
