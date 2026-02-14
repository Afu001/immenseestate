"use client";

import CityScene from "@/components/CityScene";

export default function CityClient() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <div className="text-xs font-semibold tracking-[0.32em] text-zinc-400">CITY VIEW</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">Procedural 3D Demo</div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Back
          </a>
          <a
            href="/masterplan"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Masterplan
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-12">
        <div className="relative h-[75vh] min-h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <CityScene className="absolute inset-0" />
        </div>
      </main>
    </div>
  );
}
