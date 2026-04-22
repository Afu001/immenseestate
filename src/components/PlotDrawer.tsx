import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, BedDouble, Bath, Ruler, ExternalLink } from "lucide-react";
import type { Plot } from "../types";
import { statusMeta, formatNumber } from "../types";

type Props = {
  plot: Plot | null;
  onClose: () => void;
};

export default function PlotDrawer({ plot, onClose }: Props) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (plot) {
      window.addEventListener("keydown", handleKey);
      drawerRef.current?.focus();
    }
    return () => window.removeEventListener("keydown", handleKey);
  }, [plot, onClose]);

  const meta = plot ? statusMeta(plot.status) : null;

  return (
    <AnimatePresence>
      {plot && meta && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            tabIndex={-1}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[440px] flex-col border-l border-white/[0.06] bg-navy-900/95 backdrop-blur-xl outline-none"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
              <div>
                <div className="text-[10px] font-semibold tracking-[0.25em] text-zinc-500 uppercase">Plot</div>
                <div className="mt-1 text-2xl font-bold text-white">{plot.name || `Villa ${plot.label}`}</div>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                  {meta.label}
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Blueprint */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Blueprint</div>
                <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30">
                  <img
                    src={plot.blueprintSrc}
                    alt={`Blueprint for ${plot.label}`}
                    className="h-auto w-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <Ruler className="h-3.5 w-3.5 text-sky-400" />
                  <div className="mt-2 text-lg font-bold text-white">{formatNumber(plot.areaSqft)}</div>
                  <div className="text-[10px] text-zinc-500">sqft</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <BedDouble className="h-3.5 w-3.5 text-sky-400" />
                  <div className="mt-2 text-lg font-bold text-white">{plot.bedrooms}</div>
                  <div className="text-[10px] text-zinc-500">Bedrooms</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <Bath className="h-3.5 w-3.5 text-sky-400" />
                  <div className="mt-2 text-lg font-bold text-white">{plot.bathrooms}</div>
                  <div className="text-[10px] text-zinc-500">Bathrooms</div>
                </div>
              </div>

              {/* Type & ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Villa Type</div>
                  <div className="mt-1 text-sm font-semibold text-white">{plot.type || "—"}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Plot ID</div>
                  <div className="mt-1 text-sm font-semibold text-white">{plot.id}</div>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">Description</div>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{plot.description}</p>
              </div>
            </div>

            {/* Footer CTA */}
            <div className="border-t border-white/[0.06] p-5">
              <a
                href={plot.mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:shadow-sky-500/30 hover:brightness-110"
              >
                <MapPin className="h-4 w-4" />
                Open in Google Maps
                <ExternalLink className="h-3.5 w-3.5 opacity-60" />
              </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
