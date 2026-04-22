import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Compass, ArrowRight, Building2, Shield, MousePointerClick } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-900 text-white">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute -right-56 top-24 h-[680px] w-[680px] rounded-full bg-emerald-500/8 blur-[120px]" />
        <div className="absolute bottom-[-200px] left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-500/6 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex w-full items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <Building2 className="h-5 w-5 text-white/90" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold tracking-[0.3em] text-zinc-500 uppercase">Immense</div>
            <div className="text-sm font-semibold text-white">Estate</div>
          </div>
        </div>

        <nav className="flex items-center gap-2">
          <button
            onClick={() => navigate("/masterplan")}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/10"
          >
            Masterplan
          </button>
          <button
            onClick={() => navigate("/masterplan?admin=1")}
            className="hidden sm:inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition hover:bg-white/10"
          >
            Admin
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex min-h-[calc(100vh-72px)] w-full flex-col justify-center px-6 pb-20 md:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Left — Copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Live Availability
              </div>

              <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-white">Premium island</span>
                <br />
                <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
                  living, redefined.
                </span>
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">
                Explore our exclusive waterfront masterplan. See every villa, check availability in real-time, and find your dream home on the island.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate("/masterplan")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:shadow-sky-500/40 hover:brightness-110"
                >
                  Explore Masterplan
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate("/masterplan?admin=1")}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
                >
                  Admin Panel
                </button>
              </div>

              {/* Feature cards */}
              <div className="mt-12 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { icon: MapPin, title: "Availability", desc: "Real-time status for every plot" },
                  { icon: MousePointerClick, title: "Interactive", desc: "Click to explore each villa" },
                  { icon: Shield, title: "Admin Tools", desc: "Drag, position & save labels" },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm"
                  >
                    <f.icon className="h-4 w-4 text-sky-400" />
                    <div className="mt-2 text-xs font-semibold text-white">{f.title}</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-zinc-500">{f.desc}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — Preview card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
              className="relative hidden lg:block"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-emerald-500/5" />
                <div className="relative p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="h-4 w-4 text-sky-400" />
                      <span className="text-sm font-semibold text-white">Masterplan Overview</span>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-medium text-zinc-400">
                      Click to explore
                    </span>
                  </div>

                  <button
                    onClick={() => navigate("/masterplan")}
                    className="mt-4 block w-full overflow-hidden rounded-xl border border-white/[0.06] transition hover:border-white/20"
                  >
                    <img
                      src="/api/assets/overview"
                      alt="Masterplan overview"
                      className="h-auto w-full object-cover"
                      loading="lazy"
                    />
                  </button>

                  {/* Legend */}
                  <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Available
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Reserved
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Sold
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
