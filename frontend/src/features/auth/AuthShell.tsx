import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function AuthShell({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-slate-950 text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 bg-indigo-950 p-14 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <Link to="/" className="relative text-xl font-semibold tracking-tight">JobSeeker<span className="text-cyan-300">.</span></Link>
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Career command center</p>
          <h2 className="text-5xl font-semibold leading-[1.08] tracking-tight">A focused workspace for the work of finding work.</h2>
          <p className="mt-6 max-w-lg text-lg leading-8 text-indigo-100/70">Build a credible profile and keep your search moving with clarity, without recruiter noise.</p>
        </div>
        <p className="relative text-sm text-indigo-200/50">Designed for candidates, exclusively.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-12 block text-lg font-semibold lg:hidden">JobSeeker<span className="text-cyan-300">.</span></Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
          <div className="mt-8">{children}</div>
        </div>
      </section>
    </main>
  );
}
