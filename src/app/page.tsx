import Image from "next/image";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -right-56 top-24 h-[680px] w-[680px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-240px] left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 flex w-full items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold tracking-[0.32em] text-zinc-400">IMMERSIVE</div>
            <div className="text-sm font-semibold text-white">Masterplan Experience</div>
          </div>
        </div>

        <nav className="flex items-center gap-3">
          <a
            href="/masterplan"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            Masterplan
          </a>
          <a
            href="/masterplan?admin=1"
            className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
          >
            Admin
          </a>
        </nav>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-88px)] w-full flex-col justify-center px-6 pb-16">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-100 backdrop-blur">
                Live availability · Precise labeling
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                A premium masterplan,
                <span className="block text-white/80">built for sales speed.</span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-200/90">
                Label every villa with accurate placement, show availability at a glance, and open a beautiful details panel for buyers.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/masterplan"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-sky-950 transition hover:bg-sky-400"
                >
                  Open Masterplan
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14" />
                    <path d="M13 5l7 7-7 7" />
                  </svg>
                </a>

                <a
                  href="/masterplan?admin=1"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Admin: Drag & Save
                </a>
              </div>

              <div className="mt-10 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-xs text-zinc-300">Statuses</div>
                  <div className="mt-1 text-sm font-semibold text-white">Available / Reserved / Sold</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-xs text-zinc-300">Details</div>
                  <div className="mt-1 text-sm font-semibold text-white">Blueprint + specs + map</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-xs text-zinc-300">Admin</div>
                  <div className="mt-1 text-sm font-semibold text-white">Pixel-accurate placement</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-emerald-500/10" />
                <div className="relative p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">Masterplan preview</div>
                    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-zinc-200 backdrop-blur">
                      Hover labels for details
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                    <Image
                      src="/api/assets/villaview"
                      alt="Masterplan preview"
                      width={8064}
                      height={4536}
                      className="h-auto w-full"
                      priority
                      unoptimized
                    />
                  </div>

                  <div className="mt-4 text-xs text-zinc-300">
                    Tip: Open <span className="font-semibold text-white">/masterplan?admin=1</span> to reposition labels.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
