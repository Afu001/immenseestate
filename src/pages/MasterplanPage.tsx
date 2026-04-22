import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Save,
  ArrowLeft,
  Diamond,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  Sun,
  Cloud,
  Upload,
  Building2,
  Layers,
} from "lucide-react";
import PlotDrawer from "../components/PlotDrawer";
import CompassRose from "../components/CompassRose";
import type { Plot, PlotStatus, PlotsResponse, ViewMode, RoomLabel } from "../types";
import { statusMeta, clamp, formatNumber } from "../types";

/* ───────────────────────── Constants ───────────────────────── */

const MIN_SCALE = 0.15;
const MAX_SCALE = 8;
const ZOOM_INTENSITY = 0.0012;

const DEFAULT_DIAMOND_X = 0.115;
const DEFAULT_DIAMOND_Y = 0.72;

const ISLAND_TABS = [
  { id: "home", label: "HOME", icon: "home" as const },
  { id: "murjan1", label: "MURJAN 1" },
  { id: "murjan2", label: "MURJAN 2" },
  { id: "murjan3", label: "MURJAN 3" },
  { id: "murjan4", label: "MURJAN 4" },
  { id: "murjan5", label: "MURJAN 5" },
  { id: "murjan6", label: "MURJAN 6" },
  { id: "fayrooze1", label: "FAYROOZE 1" },
  { id: "fayrooze2", label: "FAYROOZE 2" },
  { id: "fayrooze3", label: "FAYROOZE 3" },
  { id: "fayrooze4", label: "FAYROOZE 4" },
  { id: "fayrooze5", label: "FAYROOZE 5" },
];

const VILLA_TYPES = ["Villa A", "Villa B", "Villa C", "Villa D", "Villa E", "TIP Villa"];

/* ───────────────────────── Component ───────────────────────── */

export default function MasterplanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdmin = searchParams.get("admin") === "1";

  /* ── Data state ── */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlotsResponse | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);

  /* ── View state ── */
  const [view, setView] = useState<ViewMode>("overview");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPlot = useMemo(() => plots.find((p) => p.id === selectedId) ?? null, [plots, selectedId]);

  /* ── Diamond position state ── */
  const [diamondX, setDiamondX] = useState(DEFAULT_DIAMOND_X);
  const [diamondY, setDiamondY] = useState(DEFAULT_DIAMOND_Y);
  const [draggingDiamond, setDraggingDiamond] = useState(false);

  /* ── Villa detail state (3rd zoom level) ── */
  const [villaPlotId, setVillaPlotId] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState("Ground Floor");
  const [localRoomLabels, setLocalRoomLabels] = useState<Record<string, RoomLabel[]>>({});
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── Type filter state ── */
  const [villaTypeFilter, setVillaTypeFilter] = useState<Set<string>>(new Set());

  /* ── Clock ── */
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ── Transform state (pan/zoom) ── */
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Pan state ── */
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; stx: number; sty: number } | null>(null);

  /* ── Admin drag state ── */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  /* ── Touch pinch state ── */
  const pinchRef = useRef<{ d0: number; s0: number; cx: number; cy: number } | null>(null);
  const touchScaleRef = useRef(scale);
  const touchZoomAtRef = useRef<((next: number, cx: number, cy: number) => void) | null>(null);

  /* ── Filter state ── */
  const [statusFilter, setStatusFilter] = useState<Set<PlotStatus>>(new Set());

  /* ── Fetch data ── */
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/plots", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const json = (await res.json()) as PlotsResponse;
        if (!ok) return;
        setData(json);
        setPlots(json.plots);
        if (json.diamondPosition) {
          setDiamondX(json.diamondPosition.x);
          setDiamondY(json.diamondPosition.y);
        }
      } catch {
        if (!ok) return;
        setError("Could not load masterplan data.");
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => { ok = false; };
  }, []);

  /* ── Current villa plot (3rd level) ── */
  const villaPlot = useMemo(() => plots.find((p) => p.id === villaPlotId) ?? null, [plots, villaPlotId]);
  const villaFloor = useMemo(() => villaPlot?.villaFloors?.find((f) => f.name === activeFloor) ?? null, [villaPlot, activeFloor]);
  const currentRoomLabels = useMemo(() => {
    if (!villaPlotId) return [];
    return (localRoomLabels[villaPlotId] ?? villaPlot?.roomLabels ?? []).filter((r) => r.floor === activeFloor);
  }, [villaPlotId, localRoomLabels, villaPlot, activeFloor]);

  /* ── Current image dimensions ── */
  const imgW = view === "villa"
    ? (villaFloor?.width ?? 3840)
    : view === "overview"
    ? (data?.overviewImage.width ?? 3840)
    : (data?.islandImage.width ?? 3840);
  const imgH = view === "villa"
    ? (villaFloor?.height ?? 2160)
    : view === "overview"
    ? (data?.overviewImage.height ?? 2160)
    : (data?.islandImage.height ?? 2160);
  const imgSrc = view === "villa"
    ? (villaFloor?.imageSrc ?? "")
    : view === "overview"
    ? (data?.overviewImage.src ?? "")
    : (data?.islandImage.src ?? "");

  /* ── Fit to view (cover — fills screen fully, no empty bars) ── */
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const fit = Math.max(cw / imgW, ch / imgH);
    const s = clamp(fit, MIN_SCALE, 4);
    setScale(s);
    setTx((cw - imgW * s) / 2);
    setTy((ch - imgH * s) / 2);
  }, [imgW, imgH]);

  useEffect(() => {
    if (data && !isTransitioning) fitToView();
  }, [data, view, fitToView, isTransitioning]);

  /* ── Zoom helpers ── */
  const zoomAt = useCallback(
    (next: number, cx: number, cy: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = cx - rect.left;
      const my = cy - rect.top;
      const bx = (mx - tx) / scale;
      const by = (my - ty) / scale;
      setScale(next);
      setTx(mx - bx * next);
      setTy(my - by * next);
    },
    [scale, tx, ty]
  );

  // Keep refs in sync after zoomAt is defined
  touchScaleRef.current = scale;
  touchZoomAtRef.current = zoomAt;

  const zoomBtn = useCallback(
    (dir: "in" | "out") => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const factor = dir === "in" ? 1.25 : 1 / 1.25;
      zoomAt(clamp(scale * factor, MIN_SCALE, MAX_SCALE), r.left + r.width / 2, r.top + r.height / 2);
    },
    [scale, zoomAt]
  );

  /* ── Wheel zoom (native listener for passive:false) ── */
  const wheelHandler = useRef<((e: WheelEvent) => void) | null>(null);
  wheelHandler.current = (e: WheelEvent) => {
    e.preventDefault();
    const next = clamp(scale * (1 - e.deltaY * ZOOM_INTENSITY), MIN_SCALE, MAX_SCALE);
    zoomAt(next, e.clientX, e.clientY);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelHandler.current?.(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  /* ── Pointer pan ── */
  const beginPan = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".plot-label-chip, .diamond-marker")) return;
      if (draggingId) return;
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setIsPanning(true);
      panRef.current = { sx: e.clientX, sy: e.clientY, stx: tx, sty: ty };
    },
    [tx, ty, draggingId]
  );

  const onPanMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning || !panRef.current) return;
      setTx(panRef.current.stx + (e.clientX - panRef.current.sx));
      setTy(panRef.current.sty + (e.clientY - panRef.current.sy));
    },
    [isPanning]
  );

  const endPan = useCallback(() => {
    setIsPanning(false);
    panRef.current = null;
  }, []);

  /* ── Admin label drag ── */
  const beginDrag = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (!isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingId(id);
    },
    [isAdmin]
  );

  const onDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isAdmin || !draggingId || !data) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const bx = (e.clientX - rect.left - tx) / scale;
      const by = (e.clientY - rect.top - ty) / scale;
      const nx = clamp(bx / imgW, 0, 1);
      const ny = clamp(by / imgH, 0, 1);
      setPlots((prev) => prev.map((p) => (p.id === draggingId ? { ...p, x: nx, y: ny } : p)));
      setDirty(true);
    },
    [isAdmin, draggingId, data, tx, ty, scale, imgW, imgH]
  );

  const endDrag = useCallback(() => setDraggingId(null), []);

  /* ── Touch pinch-to-zoom (native listeners for passive:false) ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchRef.current = {
          d0: Math.hypot(dx, dy),
          s0: touchScaleRef.current,
          cx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          cy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const d = Math.hypot(dx, dy);
        const next = clamp(pinchRef.current.s0 * (d / pinchRef.current.d0), MIN_SCALE, MAX_SCALE);
        touchZoomAtRef.current?.(next, pinchRef.current.cx, pinchRef.current.cy);
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  /* ── Save (admin) ── */
  const save = async () => {
    if (!isAdmin) return;
    try {
      setError(null);
      const res = await fetch("/api/plots", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plots, diamondPosition: { x: diamondX, y: diamondY }, roomLabels: localRoomLabels }),
      });
      if (!res.ok) throw new Error("Could not save.");
      const json = (await res.json()) as PlotsResponse;
      setData(json);
      setPlots(json.plots);
      if (json.diamondPosition) {
        setDiamondX(json.diamondPosition.x);
        setDiamondY(json.diamondPosition.y);
      }
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  };

  /* ── Diamond click → zoom to island ── */
  const onDiamondClick = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();

    // Zoom towards the diamond position
    const targetScale = scale * 3.5;
    const imgPxX = diamondX * imgW;
    const imgPxY = diamondY * imgH;

    const targetTx = cw / 2 - imgPxX * targetScale;
    const targetTy = ch / 2 - imgPxY * targetScale;

    setScale(targetScale);
    setTx(targetTx);
    setTy(targetTy);

    // After zoom animation, switch to island view
    setTimeout(() => {
      setView("island");
      setIsTransitioning(false);
    }, 1300);
  }, [isTransitioning, scale, imgW, imgH, diamondX, diamondY]);

  /* ── Back to overview (zoom-out transition) ── */
  const backToOverview = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSelectedId(null);
    setVillaPlotId(null);

    const el = containerRef.current;
    if (!el) {
      setView("overview");
      setIsTransitioning(false);
      return;
    }
    const { width: cw, height: ch } = el.getBoundingClientRect();

    // Zoom out to show the overview image centered
    const overW = data?.overviewImage.width ?? 3840;
    const overH = data?.overviewImage.height ?? 2160;
    const fitS = Math.max(cw / overW, ch / overH);
    const s = clamp(fitS, MIN_SCALE, 4);
    setScale(s);
    setTx((cw - overW * s) / 2);
    setTy((ch - overH * s) / 2);

    setTimeout(() => {
      setView("overview");
      setIsTransitioning(false);
    }, 1300);
  }, [isTransitioning, data]);

  /* ── Villa label click → zoom to villa detail (3rd level) ── */
  const onVillaLabelClick = useCallback(
    (plotId: string) => {
      const p = plots.find((pl) => pl.id === plotId);
      if (!p || isTransitioning) return;
      if (!p.villaFloors?.length) {
        if (isAdmin) {
          setVillaPlotId(plotId);
          setActiveFloor("Ground Floor");
          setView("villa");
          return;
        }
        setSelectedId(plotId);
        return;
      }
      setIsTransitioning(true);
      const el = containerRef.current;
      if (!el) return;
      const { width: cw, height: ch } = el.getBoundingClientRect();
      const targetScale = scale * 3;
      const imgPxX = p.x * imgW;
      const imgPxY = p.y * imgH;
      setScale(targetScale);
      setTx(cw / 2 - imgPxX * targetScale);
      setTy(ch / 2 - imgPxY * targetScale);
      setTimeout(() => {
        setVillaPlotId(plotId);
        setActiveFloor(p.villaFloors?.[0]?.name ?? "Ground Floor");
        setView("villa");
        setIsTransitioning(false);
      }, 1300);
    },
    [plots, isTransitioning, scale, imgW, imgH, isAdmin]
  );

  /* ── Back to island from villa (zoom-out transition) ── */
  const backToIsland = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setDraggingRoomId(null);

    const el = containerRef.current;
    if (!el) {
      setView("island");
      setVillaPlotId(null);
      setIsTransitioning(false);
      return;
    }
    const { width: cw, height: ch } = el.getBoundingClientRect();

    // Zoom out to fit the island image
    const islW = data?.islandImage.width ?? 3840;
    const islH = data?.islandImage.height ?? 2160;
    const fitS = Math.max(cw / islW, ch / islH);
    const s = clamp(fitS, MIN_SCALE, 4);
    setScale(s);
    setTx((cw - islW * s) / 2);
    setTy((ch - islH * s) / 2);

    setTimeout(() => {
      setView("island");
      setVillaPlotId(null);
      setIsTransitioning(false);
    }, 1300);
  }, [isTransitioning, data]);

  /* ── Upload villa floor image ── */
  const uploadVillaImage = async (plotId: string, file: File, floorName: string) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("floorName", floorName);
      const res = await fetch(`/api/upload-villa-image/${plotId}`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setPlots(json.data.plots);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  /* ── Admin room label drag ── */
  const beginRoomDrag = useCallback(
    (id: string) => (e: React.PointerEvent) => {
      if (!isAdmin) return;
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingRoomId(id);
    },
    [isAdmin]
  );

  const onRoomDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isAdmin || !draggingRoomId || !villaPlotId) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const bx = (e.clientX - rect.left - tx) / scale;
      const by = (e.clientY - rect.top - ty) / scale;
      const nx = clamp(bx / imgW, 0, 1);
      const ny = clamp(by / imgH, 0, 1);
      setLocalRoomLabels((prev) => {
        const all = prev[villaPlotId] ?? villaPlot?.roomLabels ?? [];
        return { ...prev, [villaPlotId]: all.map((r) => (r.id === draggingRoomId ? { ...r, x: nx, y: ny } : r)) };
      });
      setDirty(true);
    },
    [isAdmin, draggingRoomId, villaPlotId, villaPlot, tx, ty, scale, imgW, imgH]
  );

  const endRoomDrag = useCallback(() => setDraggingRoomId(null), []);

  /* ── Keyboard ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBtn("in"); }
      if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBtn("out"); }
      if (e.key === "Escape" && view === "villa") backToIsland();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBtn, view, backToIsland]);

  /* ── Filtered plots ── */
  const visiblePlots = useMemo(
    () => plots.filter((p) => statusFilter.has(p.status) && villaTypeFilter.has(p.type ?? "")),
    [plots, statusFilter, villaTypeFilter]
  );

  const toggleStatus = (s: PlotStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleVillaType = (t: string) => {
    setVillaTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const resetFilters = () => {
    setStatusFilter(new Set(["available", "reserved", "sold"]));
    setVillaTypeFilter(new Set(VILLA_TYPES));
  };

  /* ── Label scale (counter-zoom so labels stay readable) ── */
  const labelScale = clamp((1 / scale) * 0.55, 0.3, 3);

  /* ── File upload ref ── */
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ───────────────────────── Render ───────────────────────── */
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-navy-900 text-white no-select">

      {/* ═══════════ LEFT SIDEBAR: Compass + Weather ═══════════ */}
      <div className="absolute left-3 top-3 z-30 pointer-events-auto w-[110px] md:w-[130px]">
        <div className="glass-panel rounded-2xl p-3 flex flex-col items-center gap-1.5">
          <CompassRose className="w-[85px] h-[85px] md:w-[105px] md:h-[105px]" />
          <div className="text-[9px] text-zinc-400 tracking-wider text-center">Altitude : 5 Km</div>
        </div>
        <div className="glass-panel rounded-2xl p-3 mt-2 space-y-2">
          <div className="text-[10px] text-zinc-300 font-medium">
            {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-white">24</span>
            <span className="text-[10px] text-zinc-400">°C</span>
          </div>
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-300" />
            <Cloud className="h-4 w-4 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* ═══════════ TOP BAR ═══════════ */}
      <header className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3 md:px-6 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 ml-[110px] md:ml-[130px]">
          {(view === "island" || view === "villa") && (
            <button
              onClick={view === "villa" ? backToIsland : backToOverview}
              className="flex items-center gap-1.5 rounded-lg glass-panel px-3 py-2 text-xs font-medium text-zinc-300 transition hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{view === "villa" ? "Island" : "Overview"}</span>
            </button>
          )}
          <div className="flex items-center gap-2 rounded-lg glass-panel px-3 py-2">
            <Building2 className="h-4 w-4 text-sky-400" />
            <div className="leading-tight">
              <div className="text-[9px] font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                {view === "overview" ? "Masterplan" : view === "island" ? "Island View" : `Villa ${villaPlot?.label ?? ""}`}
              </div>
              <div className="text-xs font-semibold text-white">Immense Estate</div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button onClick={() => navigate("/")} className="rounded-lg glass-panel p-2 text-zinc-400 transition hover:text-white hover:bg-white/10" title="Home">
            <Home className="h-4 w-4" />
          </button>
          <button onClick={fitToView} className="rounded-lg glass-panel p-2 text-zinc-400 transition hover:text-white hover:bg-white/10" title="Reset view">
            <RotateCcw className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              onClick={save}
              disabled={!dirty}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                dirty ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25 hover:bg-sky-400" : "glass-panel text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
          )}
        </div>
      </header>

      {/* ═══════════ CITY VIEW WATERMARK ═══════════ */}
      <div className="absolute right-3 top-14 z-20 pointer-events-none city-view-watermark flex items-center gap-1.5 opacity-60">
        <Building2 className="h-4 w-4 text-white/50" />
        <span className="text-[10px] font-bold tracking-[0.15em] text-white/40 uppercase">City View</span>
      </div>

      {/* ═══════════ LOADING / ERROR ═══════════ */}
      {loading && (
        <div className="absolute inset-0 z-40 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            <span className="text-sm text-zinc-400">Loading masterplan…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute left-[140px] top-16 z-40 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* ═══════════ CANVAS ═══════════ */}
      <div
        ref={containerRef}
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={beginPan}
        onPointerMove={(e) => { onPanMove(e); onDragMove(e); onRoomDragMove(e); }}
        onPointerUp={() => { endPan(); endDrag(); endRoomDrag(); }}
        onPointerCancel={() => { endPan(); endDrag(); endRoomDrag(); }}
      >
        {data && (
          <div
            className={`absolute left-0 top-0 origin-top-left ${isTransitioning ? "zoom-canvas" : ""}`}
            style={{ width: imgW, height: imgH, transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          >
            {/* Base image */}
            {imgSrc ? (
              <img src={imgSrc} alt="Masterplan" width={imgW} height={imgH} className="pointer-events-none select-none" draggable={false} />
            ) : view === "villa" ? (
              <div className="w-full h-full bg-navy-900/80 grid place-items-center" style={{ width: imgW, height: imgH }}>
                <div className="text-center space-y-3">
                  <Layers className="h-12 w-12 text-zinc-600 mx-auto" />
                  <div className="text-sm text-zinc-500">No floor image uploaded yet</div>
                  {isAdmin && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 flex items-center gap-2 mx-auto rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 transition"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Floor Image
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* ── Overview: Diamond marker ── */}
            {view === "overview" && !isTransitioning && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAdmin && draggingDiamond) { setDraggingDiamond(false); return; }
                  if (!isAdmin) onDiamondClick();
                }}
                onDoubleClick={(e) => { e.stopPropagation(); if (isAdmin) onDiamondClick(); }}
                onPointerDown={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault(); e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setDraggingDiamond(true);
                }}
                onPointerMove={(e) => {
                  if (!isAdmin || !draggingDiamond) return;
                  const el = containerRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  setDiamondX(clamp((e.clientX - rect.left - tx) / scale / imgW, 0, 1));
                  setDiamondY(clamp((e.clientY - rect.top - ty) / scale / imgH, 0, 1));
                  setDirty(true);
                }}
                onPointerUp={() => setDraggingDiamond(false)}
                className={`diamond-marker absolute group ${isAdmin ? "cursor-grab active:cursor-grabbing" : ""}`}
                style={{ left: diamondX * imgW, top: diamondY * imgH, transform: `translate(-50%, -50%) scale(${clamp((1 / scale) * 0.7, 0.5, 4)})` }}
              >
                <span className="absolute inset-[-12px] animate-ping rounded-full bg-amber-400/20" />
                <span className="absolute inset-[-8px] animate-pulse-slow rounded-full bg-amber-400/10" />
                <span className="relative flex h-10 w-10 items-center justify-center">
                  <Diamond className="h-8 w-8 text-amber-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)] transition group-hover:text-amber-300 group-hover:drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" fill="rgba(234,179,8,0.3)" />
                </span>
                <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-14 w-max rounded-lg glass-panel px-3 py-1.5 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                  {isAdmin ? "Drag to reposition" : "Explore Island"}
                  <ChevronRight className="h-3 w-3 text-amber-400" />
                </span>
              </button>
            )}

            {/* ── Island view: Plot labels (with zoom-in icon for villas with floors) ── */}
            {view === "island" && !isTransitioning && visiblePlots.map((p) => {
              const meta = statusMeta(p.status);
              const hasFloors = !!(p.villaFloors?.length);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isAdmin && draggingId === p.id) return;
                    onVillaLabelClick(p.id);
                  }}
                  onPointerDown={beginDrag(p.id)}
                  className={`plot-label-chip group rounded-md border ${meta.border} ${meta.bg} px-2 py-0.5 text-[11px] font-bold ${meta.text} ${meta.glow} ${
                    isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                  }`}
                  style={{ left: p.x * imgW, top: p.y * imgH, "--label-scale": labelScale } as React.CSSProperties}
                >
                  {p.label}
                  {hasFloors && <ZoomIn className="inline-block ml-0.5 h-2.5 w-2.5 opacity-70" />}
                  <span className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 w-max max-w-[200px] rounded-lg glass-panel px-3 py-2 text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <span className="block text-white/90">{p.name || `Villa ${p.label}`}</span>
                    <span className="block text-zinc-400 mt-0.5">
                      {p.type || "Type"} · {formatNumber(p.areaSqft)} sqft
                      {hasFloors && " · Click to zoom"}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* ── Villa detail: Room labels ── */}
            {view === "villa" && !isTransitioning && currentRoomLabels.map((r) => (
              <div
                key={r.id}
                onPointerDown={beginRoomDrag(r.id)}
                className={`room-label-chip rounded-md border border-white/20 bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white tracking-wide uppercase ${
                  isAdmin ? "cursor-grab active:cursor-grabbing" : ""
                }`}
                style={{ left: r.x * imgW, top: r.y * imgH, "--label-scale": labelScale } as React.CSSProperties}
              >
                {r.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ RIGHT PANEL (island view) ═══════════ */}
      <AnimatePresence>
        {view === "island" && !isTransitioning && (
          <motion.div
            key="island-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute right-3 top-20 z-20 w-48 md:w-56 flex flex-col gap-2 pointer-events-auto max-h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar"
          >
            <div className="glass-panel rounded-xl p-3">
              <div className="text-xs font-bold text-sky-400 tracking-wide">MURJAN 5</div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div><span className="text-zinc-500">Waterfront</span><span className="block text-white font-semibold">1,250 m</span></div>
                <div><span className="text-zinc-500">Area</span><span className="block text-white font-semibold">85,000 sqft</span></div>
              </div>
            </div>

            {/* Status filter */}
            <div className="glass-panel rounded-xl p-3">
              <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase mb-2">Status</div>
              {(["available", "reserved", "sold"] as PlotStatus[]).map((s) => {
                const m = statusMeta(s);
                const active = statusFilter.has(s);
                return (
                  <button key={s} onClick={() => toggleStatus(s)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition ${active ? "text-white" : "text-zinc-600"} hover:bg-white/5`}>
                    <span className={`h-2.5 w-2.5 rounded-sm ${active ? m.dot : "bg-zinc-700"} transition`} />
                    <span className="font-medium">{m.label}</span>
                    <span className="ml-auto text-[9px] text-zinc-600">☑</span>
                  </button>
                );
              })}
            </div>

            {/* Villa type filter */}
            <div className="glass-panel rounded-xl p-3">
              <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase mb-2">Villa Type</div>
              <div className="grid grid-cols-2 gap-1">
                {VILLA_TYPES.map((t) => {
                  const active = villaTypeFilter.has(t);
                  return (
                    <button key={t} onClick={() => toggleVillaType(t)} className={`rounded-md px-1.5 py-1 text-[9px] font-semibold transition border ${active ? "border-sky-500/40 text-white bg-sky-500/10" : "border-zinc-700 text-zinc-600"} hover:bg-white/5`}>
                      {t.replace("Villa ", "").replace("TIP ", "TIP ")}
                      <span className="ml-0.5 text-[8px]">{active ? "☑" : "☐"}</span>
                    </button>
                  );
                })}
              </div>
              <button onClick={resetFilters} className="mt-2 w-full rounded-md border border-rose-500/30 py-1 text-[9px] font-semibold text-rose-400 hover:bg-rose-500/10 transition">
                RESET
              </button>
            </div>

            {/* Admin info */}
            {isAdmin && (
              <div className="glass-panel rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400">
                  <GripVertical className="h-3 w-3" /> ADMIN MODE
                </div>
                <div className="mt-1 text-[10px] text-zinc-500">Drag labels · Click label to zoom villa</div>
                <div className="mt-1 text-[10px] text-zinc-500">
                  Unsaved: <span className={dirty ? "text-amber-400" : "text-zinc-600"}>{dirty ? "Yes" : "No"}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ RIGHT PANEL (villa view) ═══════════ */}
      <AnimatePresence>
        {view === "villa" && villaPlot && !isTransitioning && (
          <motion.div
            key="villa-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute right-3 top-20 z-20 w-48 md:w-56 flex flex-col gap-2 pointer-events-auto"
          >
            <div className="glass-panel rounded-xl p-3">
              <div className="text-xs font-bold text-sky-400 tracking-wide">
                {villaPlot.name || `VILLA ${villaPlot.label}`}
              </div>
              <div className="mt-1 text-[10px] text-zinc-400">{villaPlot.type} · {formatNumber(villaPlot.areaSqft)} sqft</div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div><span className="text-zinc-500">Beds</span><span className="block text-white font-semibold">{villaPlot.bedrooms}</span></div>
                <div><span className="text-zinc-500">Baths</span><span className="block text-white font-semibold">{villaPlot.bathrooms}</span></div>
              </div>
            </div>

            {isAdmin && (
              <div className="glass-panel rounded-xl p-3 space-y-2">
                <div className="text-[10px] font-semibold text-amber-400">ADMIN: Upload Floor</div>
                <select
                  value={activeFloor}
                  onChange={(e) => setActiveFloor(e.target.value)}
                  className="w-full rounded-md bg-white/5 border border-white/10 text-[10px] text-white px-2 py-1.5"
                >
                  <option value="Ground Floor">Ground Floor</option>
                  <option value="1st Floor">1st Floor</option>
                  <option value="2nd Floor">2nd Floor</option>
                  <option value="Roof">Roof</option>
                </select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-sky-500 py-1.5 text-[10px] font-semibold text-white hover:bg-sky-400 transition disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {uploading ? "Uploading…" : "Upload Image"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && villaPlotId) uploadVillaImage(villaPlotId, file, activeFloor);
                    e.target.value = "";
                  }}
                />
                <div className="mt-1 text-[10px] text-zinc-500">Drag room labels to position</div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ ZOOM CONTROLS (bottom right) ═══════════ */}
      <div className="absolute right-3 bottom-14 z-20 flex flex-col gap-1 pointer-events-auto">
        <button onClick={() => zoomBtn("in")} className="glass-panel rounded-lg p-2 text-zinc-400 transition hover:text-white hover:bg-white/10" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => zoomBtn("out")} className="glass-panel rounded-lg p-2 text-zinc-400 transition hover:text-white hover:bg-white/10" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>

      {/* ═══════════ BOTTOM NAV BAR ═══════════ */}
      {view !== "overview" && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto">
          <div className="glass-panel border-t border-white/[0.06]">
            {view === "island" && (
              <div className="flex items-center overflow-x-auto hide-scrollbar">
                {ISLAND_TABS.map((tab) => {
                  const isActive = tab.id === "murjan5";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        if (tab.id === "home") navigate("/");
                        else if (!isActive) setError(`${tab.label} — Coming soon`);
                      }}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-semibold tracking-wider transition whitespace-nowrap border-b-2 ${
                        isActive
                          ? "border-sky-400 text-sky-400 bg-sky-400/5"
                          : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                      }`}
                    >
                      {tab.icon === "home" && <Home className="h-3 w-3" />}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {view === "villa" && villaPlot && (
              <div className="flex items-center justify-between px-4">
                <div className="flex items-center overflow-x-auto hide-scrollbar">
                  <button
                    onClick={backToIsland}
                    className="flex-shrink-0 flex items-center gap-1 px-3 py-2.5 text-[10px] font-semibold text-zinc-400 hover:text-white transition border-b-2 border-transparent"
                  >
                    <Home className="h-3 w-3" />
                  </button>
                  {(villaPlot.villaFloors?.length ? villaPlot.villaFloors.map((f) => f.name) : ["Ground Floor", "1st Floor"]).map((fname) => (
                    <button
                      key={fname}
                      onClick={() => setActiveFloor(fname)}
                      className={`flex-shrink-0 px-3 py-2.5 text-[10px] font-semibold tracking-wider transition whitespace-nowrap border-b-2 ${
                        activeFloor === fname
                          ? "border-sky-400 text-sky-400 bg-sky-400/5"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {fname.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-zinc-500 tracking-wider font-semibold whitespace-nowrap pl-3">
                  VILLA ({villaPlot.type?.replace("Villa ", "") ?? ""}) INTERIOR
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ OVERVIEW BOTTOM BAR ═══════════ */}
      {view === "overview" && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="flex items-center gap-3 glass-panel rounded-full px-4 py-2">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <Building2 className="h-3 w-3 text-sky-400" />
              <span className="font-semibold text-white/80">{Math.round(scale * 100)}%</span>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="text-[10px] text-zinc-500">Click diamond to explore island</div>
          </div>
        </div>
      )}

      {/* ═══════════ MURJAN 5 center label (island) ═══════════ */}
      {view === "island" && !isTransitioning && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="text-[11px] font-bold tracking-[0.4em] text-white/20 uppercase">MURJAN 5</div>
        </div>
      )}

      {/* ═══════════ TRANSITION OVERLAY ═══════════ */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div key="transition-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4, delay: 0.8 }} className="absolute inset-0 z-40 bg-navy-900" />
        )}
      </AnimatePresence>

      {/* ═══════════ PLOT DRAWER ═══════════ */}
      <PlotDrawer plot={selectedPlot} onClose={() => setSelectedId(null)} />
    </div>
  );
}
