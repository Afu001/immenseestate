"use client";

import Image from "next/image";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type PlotStatus = "available" | "reserved" | "sold";

type Plot = {
  id: string;
  label: string;
  name?: string;
  type?: string;
  status: PlotStatus;
  x: number;
  y: number;
  blueprintSrc: string;
  areaSqft: number;
  bedrooms: number;
  bathrooms: number;
  description: string;
  mapsUrl: string;
};

type PlotsResponse = {
  image: { src: string; width: number; height: number };
  plots: Plot[];
};

function statusMeta(status: PlotStatus) {
  switch (status) {
    case "available":
      return {
        label: "Available",
        chip: "bg-emerald-500 text-white border-emerald-200",
        ring: "ring-emerald-200",
        dot: "bg-emerald-400",
        glow: "bg-emerald-400",
      } as const;
    case "reserved":
      return {
        label: "Reserved",
        chip: "bg-amber-400 text-black border-amber-200",
        ring: "ring-amber-200",
        dot: "bg-amber-400",
        glow: "bg-amber-300",
      } as const;
    case "sold":
      return {
        label: "Sold",
        chip: "bg-red-500 text-white border-red-200",
        ring: "ring-red-200",
        dot: "bg-red-500",
        glow: "bg-red-400",
      } as const;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export default function MasterplanClient({ admin = false }: { admin?: boolean }) {

  const demoBlueprintSrc =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <rect width="1200" height="800" fill="#0b1220"/>
  <rect x="90" y="80" width="1020" height="640" rx="28" fill="#0f1b2d" stroke="rgba(255,255,255,0.22)" stroke-width="4"/>
  <path d="M140 160H1060" stroke="rgba(56,189,248,0.55)" stroke-width="6"/>
  <text x="140" y="140" fill="rgba(255,255,255,0.72)" font-family="ui-sans-serif, system-ui" font-size="28" font-weight="700">DEMO BLUEPRINT</text>
  <g stroke="rgba(255,255,255,0.20)" stroke-width="3" fill="none">
    <rect x="160" y="210" width="420" height="250" rx="18"/>
    <rect x="620" y="210" width="420" height="170" rx="18"/>
    <rect x="620" y="410" width="420" height="230" rx="18"/>
    <path d="M370 210V460"/>
    <path d="M160 335H580"/>
  </g>
  <g fill="rgba(255,255,255,0.60)" font-family="ui-sans-serif, system-ui" font-size="18" font-weight="650">
    <text x="180" y="250">Living</text>
    <text x="390" y="250">Dining</text>
    <text x="640" y="250">Kitchen</text>
    <text x="640" y="450">Bedrooms</text>
  </g>
</svg>`);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlotsResponse | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPlot = useMemo(
    () => plots.find((p) => p.id === selectedId) ?? null,
    [plots, selectedId]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(
    null
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/plots", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const json = (await res.json()) as PlotsResponse;
        if (!mounted) return;
        setData(json);
        setPlots(json.plots);
        setDirty(false);
      } catch {
        if (!mounted) return;
        setError("Could not load the masterplan data.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const el = containerRef.current;
    if (!el) return;

    const { width: cw, height: ch } = el.getBoundingClientRect();
    const fit = Math.min(cw / data.image.width, ch / data.image.height);
    const nextScale = clamp(fit, 0.35, 2);
    setScale(nextScale);

    const centerTx = (cw - data.image.width * nextScale) / 2;
    const centerTy = (ch - data.image.height * nextScale) / 2;
    setTx(centerTx);
    setTy(centerTy);
  }, [data]);

  const zoomAt = (nextScale: number, clientX: number, clientY: number) => {
    if (!data) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const baseX = (mouseX - tx) / scale;
    const baseY = (mouseY - ty) / scale;

    const nextTx = mouseX - baseX * nextScale;
    const nextTy = mouseY - baseY * nextScale;

    setScale(nextScale);
    setTx(nextTx);
    setTy(nextTy);
  };

  const zoomByButton = (direction: "in" | "out") => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const factor = direction === "in" ? 1.14 : 1 / 1.14;
    const next = clamp(scale * factor, 0.35, 6);
    zoomAt(next, centerX, centerY);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomByButton("in");
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomByButton("out");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scale]);

  const onWheel = (e: React.WheelEvent) => {
    if (!data) return;
    e.preventDefault();

    const zoomIntensity = 0.0015;
    const nextScale = clamp(scale * (1 - e.deltaY * zoomIntensity), 0.35, 6);
    zoomAt(nextScale, e.clientX, e.clientY);
  };

  const beginPan = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".plot-label")) return;
    if (draggingId) return;
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStateRef.current = { startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty };
  };

  const onPanMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    const state = panStateRef.current;
    if (!state) return;
    setTx(state.startTx + (e.clientX - state.startX));
    setTy(state.startTy + (e.clientY - state.startY));
  };

  const endPan = () => {
    setIsPanning(false);
    panStateRef.current = null;
  };

  const screenToBase = (clientX: number, clientY: number) => {
    if (!data) return null;
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();

    const x = (clientX - rect.left - tx) / scale;
    const y = (clientY - rect.top - ty) / scale;

    return {
      x: clamp(x, 0, data.image.width),
      y: clamp(y, 0, data.image.height),
    };
  };

  const beginDrag = (plotId: string) => (e: React.PointerEvent) => {
    if (!admin) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingId(plotId);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!data) return;
    if (!admin) return;
    if (!draggingId) return;

    const base = screenToBase(e.clientX, e.clientY);
    if (!base) return;

    const nx = base.x / data.image.width;
    const ny = base.y / data.image.height;

    setPlots((prev) => prev.map((p) => (p.id === draggingId ? { ...p, x: nx, y: ny } : p)));
    setDirty(true);
  };

  const endDrag = () => {
    setDraggingId(null);
  };

  const save = async () => {
    if (!admin) return;
    try {
      setError(null);
      const res = await fetch("/api/plots", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plots }),
      });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as PlotsResponse;
      setData(json);
      setPlots(json.plots);
      setDirty(false);
    } catch {
      setError("Could not save positions. Please try again.");
    }
  };

  const resetView = () => {
    if (!data) return;
    const el = containerRef.current;
    if (!el) return;

    const { width: cw, height: ch } = el.getBoundingClientRect();
    const fit = Math.min(cw / data.image.width, ch / data.image.height);
    const nextScale = clamp(fit, 0.35, 2);

    setScale(nextScale);
    setTx((cw - data.image.width * nextScale) / 2);
    setTy((ch - data.image.height * nextScale) / 2);
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-50">
      <header className="relative z-10 flex w-full items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11l9-8 9 8" />
              <path d="M5 10v10h14V10" />
              <path d="M9 20v-6h6v6" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold tracking-[0.32em] text-zinc-400">MASTERPLAN</div>
            <div className="text-base font-semibold text-white">Villa View</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            Home
          </a>

          <button
            type="button"
            onClick={resetView}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
          >
            Reset
          </button>

          {admin ? (
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                dirty
                  ? "bg-sky-500 text-sky-950 hover:bg-sky-400"
                  : "cursor-not-allowed bg-white/10 text-white/40"
              }`}
            >
              Save
            </button>
          ) : null}
        </div>
      </header>

      <div className="relative h-[calc(100vh-84px)] w-full overflow-hidden">
        <div
          ref={containerRef}
          className="absolute inset-0 touch-none"
          onWheel={onWheel}
          onPointerDown={beginPan}
          onPointerMove={(e) => {
            onPanMove(e);
            onDragMove(e);
          }}
          onPointerUp={() => {
            endPan();
            endDrag();
          }}
          onPointerCancel={() => {
            endPan();
            endDrag();
          }}
        >
          {loading ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-zinc-300">
              Loading masterplan…
            </div>
          ) : null}

          {error ? (
            <div className="absolute left-5 top-5 z-20 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {data ? (
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: data.image.width,
                height: data.image.height,
                transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              }}
            >
              <Image
                src={data.image.src}
                alt="Masterplan"
                width={data.image.width}
                height={data.image.height}
                priority
                unoptimized
                className="select-none"
                draggable={false}
              />

              {plots.map((p) => {
                const meta = statusMeta(p.status);
                const labelScale = clamp((1 / scale) * 0.85, 0.9, 2.4);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (admin && draggingId === p.id) return;
                      setSelectedId(p.id);
                    }}
                    onPointerDown={beginDrag(p.id)}
                    className={`plot-label group absolute rounded-full border px-10 text-[1.6rem] font-extrabold tracking-wide shadow-[0_26px_64px_-24px_rgba(0,0,0,0.85)] ring-2 backdrop-blur-md transition-transform ${
                      meta.chip
                    } ${meta.ring} ${admin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
                    style={
                      {
                        left: p.x * data.image.width,
                        top: p.y * data.image.height,
                        "--plot-label-scale": labelScale,
                      } as React.CSSProperties
                    }
                  >
                    <span
                      aria-hidden
                      className={`pointer-events-none absolute inset-0 -z-10 rounded-full blur-xl opacity-90 ${meta.glow}`}
                    />

                    <span className="plot-float inline-flex items-center gap-2">
                      <span
                        className={`h-[18px] w-[18px] rounded-full ${meta.dot} shadow-[0_0_0_7px_rgba(255,255,255,0.12)]`}
                      />
                      <span className="text-white/95">{p.label}</span>
                    </span>

                    <span className="pointer-events-none absolute left-1/2 top-0 z-10 w-max -translate-x-1/2 -translate-y-[115%] rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-[12px] font-semibold text-white opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
                      {(p.name ?? `Villa ${p.label}`) + " "}
                      <span className="text-white/70">
                        ({p.type ?? "Type"}, {formatNumber(p.areaSqft)} sqft)
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="fixed left-0 right-0 top-[84px] bottom-0 z-20 pointer-events-none">
          <div className="pointer-events-auto absolute right-6 top-6 flex flex-col gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
              <div className="text-xs font-semibold tracking-wide text-zinc-200">STATUS</div>
              <div className="mt-2 flex flex-col gap-2 text-sm text-zinc-200">
                {(["available", "reserved", "sold"] as PlotStatus[]).map((s) => {
                  const meta = statusMeta(s);
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                      <span className="text-zinc-100">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div
  className="pointer-events-auto absolute"
  style={{ right: 24, bottom: -540 }}
>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
              <button
                type="button"
                onClick={() => zoomByButton("in")}
                className="grid h-12 w-12 place-items-center text-white transition hover:bg-white/10"
                aria-label="Zoom in"
              >
                <span className="text-xl font-semibold">+</span>
              </button>
              <div className="h-px w-full bg-white/10" />
              <button
                type="button"
                onClick={() => zoomByButton("out")}
                className="grid h-12 w-12 place-items-center text-white transition hover:bg-white/10"
                aria-label="Zoom out"
              >
                <span className="text-xl font-semibold">−</span>
              </button>
            </div>
          </div>

          <div className="pointer-events-auto absolute left-1/2 bottom-6 -translate-x-1/2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/40 text-zinc-100 backdrop-blur transition hover:bg-white/10"
                aria-label="Previous"
              >
                <span className="text-lg">‹</span>
              </button>

              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs text-zinc-200 backdrop-blur">
                <div className="font-semibold text-white/90">W</div>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 17 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${
                        i === 8 ? "h-4 w-px bg-white/70" : i % 2 === 0 ? "h-3 w-px bg-white/35" : "h-2 w-px bg-white/20"
                      }`}
                    />
                  ))}
                </div>
                <div className="font-semibold text-white/90">N</div>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: 17 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${
                        i === 8 ? "h-4 w-px bg-white/70" : i % 2 === 0 ? "h-3 w-px bg-white/35" : "h-2 w-px bg-white/20"
                      }`}
                    />
                  ))}
                </div>
                <div className="font-semibold text-white/90">E</div>

                <div className="ml-2 h-4 w-px bg-white/10" />
                <div className="text-white/70">{Math.round(scale * 100)}%</div>
              </div>

              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/40 text-zinc-100 backdrop-blur transition hover:bg-white/10"
                aria-label="Next"
              >
                <span className="text-lg">›</span>
              </button>
            </div>
          </div>

          {admin ? (
            <div className="pointer-events-auto absolute left-6 bottom-28 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs text-zinc-200 backdrop-blur">
              <div className="font-semibold text-white">Admin mode</div>
              <div className="mt-1 text-white/70">Drag labels · Wheel / +/- to zoom</div>
              <div className="mt-2 text-white/60">Dirty: {dirty ? "Yes" : "No"}</div>
            </div>
          ) : null}
        </div>

      </div>

      <div
        className={`fixed inset-0 z-50 ${selectedPlot ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!selectedPlot}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${selectedPlot ? "opacity-100" : "opacity-0"}`}
          onClick={() => setSelectedId(null)}
        />

        <div
          className={`absolute right-0 top-0 h-full w-full max-w-[460px] transform border-l border-white/10 bg-zinc-950/95 backdrop-blur transition-transform ${
            selectedPlot ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {selectedPlot ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-6">
                <div className="flex flex-col">
                  <div className="text-xs font-medium tracking-[0.28em] text-zinc-400">PLOT</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{selectedPlot.label}</div>
                  <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-100">
                    <span className={`h-2 w-2 rounded-full ${statusMeta(selectedPlot.status).dot}`} />
                    {statusMeta(selectedPlot.status).label}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-zinc-200 transition hover:bg-white/10"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 6l12 12" />
                    <path d="M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-auto px-6 py-6">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold tracking-wide text-zinc-300">Blueprint</div>
                  <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    <Image
                      src={selectedPlot.blueprintSrc || demoBlueprintSrc}
                      alt={`Blueprint for ${selectedPlot.label}`}
                      width={720}
                      height={520}
                      unoptimized
                      className="h-auto w-full"
                    />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-zinc-400">Area</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {formatNumber(selectedPlot.areaSqft)}
                    </div>
                    <div className="text-xs text-zinc-400">sqft</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-zinc-400">Bedrooms</div>
                    <div className="mt-1 text-lg font-semibold text-white">{selectedPlot.bedrooms}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs text-zinc-400">Bathrooms</div>
                    <div className="mt-1 text-lg font-semibold text-white">{selectedPlot.bathrooms}</div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold tracking-wide text-zinc-300">Description</div>
                  <p className="mt-2 text-sm leading-6 text-zinc-200">{selectedPlot.description}</p>
                </div>
              </div>

              <div className="border-t border-white/10 p-6">
                <a
                  href={selectedPlot.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-sky-950 transition hover:bg-sky-400"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0Z" />
                    <path d="M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  </svg>
                  Open in Google Maps
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .plot-float {
            animation: none !important;
          }
        }

        .plot-label {
          height: calc(var(--plot-label-base-height, 56px) * var(--plot-label-tall-mult, 2.5));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%) translateY(70%) scale(var(--plot-label-scale, 1));
          transform-origin: center;
        }

        .plot-label:hover {
          transform: translate(-50%, -50%) translateY(70%) scale(calc(var(--plot-label-scale, 1) * 1.03));
        }

        .plot-float {
          will-change: transform;
          animation: plot-float 3.2s ease-in-out infinite;
        }

        @keyframes plot-float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-3px);
          }
        }
      `}</style>
    </div>
  );
}
