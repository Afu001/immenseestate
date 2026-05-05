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
  X,
  Eye,
  GripVertical,
  Sun,
  Cloud,
  Upload,
  Building2,
  Layers,
  MapPin,
  Type,
  Volume2,
  Plus,
  Trash2,
  Landmark,
  Flame,
  Users,
  Utensils,
  Wine,
  Pin,
} from "lucide-react";
import PlotDrawer from "../components/PlotDrawer";
import CompassRose from "../components/CompassRose";
import type { Plot, PlotStatus, PlotsResponse, ViewMode, RoomLabel, OverviewDiamond, OverviewIslandLabel, IslandConfig, PoiCategory, Poi } from "../types";
import { statusMeta, clamp, formatNumber } from "../types";

/* ── Icon registry for POI categories (admin can pick a key) ── */
const POI_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  landmark: Landmark,
  flame: Flame,
  users: Users,
  utensils: Utensils,
  wine: Wine,
  pin: Pin,
  mappin: MapPin,
};
function getPoiIcon(key?: string) {
  if (!key) return Pin;
  return POI_ICONS[key.toLowerCase()] ?? Pin;
}

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
  const [overviewDiamonds, setOverviewDiamonds] = useState<OverviewDiamond[]>([]);
  const [overviewIslandLabels, setOverviewIslandLabels] = useState<OverviewIslandLabel[]>([]);
  const [islands, setIslands] = useState<IslandConfig[]>([]);
  const [poiCategories, setPoiCategories] = useState<PoiCategory[]>([]);
  const [pois, setPois] = useState<Poi[]>([]);
  const [activePoiCategories, setActivePoiCategories] = useState<Set<string>>(new Set());
  const [showPoiPanel, setShowPoiPanel] = useState(false);
  const [draggingPoiId, setDraggingPoiId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  /* ── View state ── */
  const [view, setView] = useState<ViewMode>("overview");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedPlot = useMemo(() => plots.find((p) => p.id === selectedId) ?? null, [plots, selectedId]);
  const [previewPlotId, setPreviewPlotId] = useState<string | null>(null);
  const previewPlot = useMemo(() => plots.find((p) => p.id === previewPlotId) ?? null, [plots, previewPlotId]);

  /* ── Diamond position state ── */
  const [diamondX, setDiamondX] = useState(DEFAULT_DIAMOND_X);
  const [diamondY, setDiamondY] = useState(DEFAULT_DIAMOND_Y);
  const [draggingDiamond, setDraggingDiamond] = useState<string | null>(null);
  const [draggingOverviewLabelId, setDraggingOverviewLabelId] = useState<string | null>(null);
  const [showOverviewDiamonds, setShowOverviewDiamonds] = useState(true);
  const [showOverviewLabels, setShowOverviewLabels] = useState(true);

  /* ── Villa detail state (3rd zoom level) ── */
  const [villaPlotId, setVillaPlotId] = useState<string | null>(null);
  const [activeFloor, setActiveFloor] = useState("Ground Floor");
  const [localRoomLabels, setLocalRoomLabels] = useState<Record<string, RoomLabel[]>>({});
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── Type filter state ── */
  const [villaTypeFilter, setVillaTypeFilter] = useState<Set<string>>(new Set(VILLA_TYPES));

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
  const [statusFilter, setStatusFilter] = useState<Set<PlotStatus>>(new Set(["available", "reserved", "sold"]));

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
        setOverviewDiamonds(
          json.overviewDiamonds?.length
            ? json.overviewDiamonds
            : [{ id: "diamond-murjan5", label: "MURJAN5", x: json.diamondPosition?.x ?? DEFAULT_DIAMOND_X, y: json.diamondPosition?.y ?? DEFAULT_DIAMOND_Y, islandId: "murjan5" }]
        );
        setOverviewIslandLabels(json.overviewIslandLabels ?? []);
        setIslands(json.islands ?? [{ id: "murjan5", label: "MURJAN5", image: json.islandImage }]);
        setPoiCategories(json.poiCategories ?? []);
        setPois(json.pois ?? []);
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

  /* ── Dynamic min scale: cover-fit so users cannot zoom out smaller than the image ── */
  const [minScale, setMinScale] = useState(MIN_SCALE);

  /* ── Fit to view (cover — fills screen fully, no empty bars) ── */
  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    const fit = Math.max(cw / imgW, ch / imgH);
    const s = clamp(fit, MIN_SCALE, 4);
    setMinScale(fit); // lock minimum to cover-fit
    setScale(s);
    setTx((cw - imgW * s) / 2);
    setTy((ch - imgH * s) / 2);
  }, [imgW, imgH]);

  /* Recompute min scale on resize */
  useEffect(() => {
    const onResize = () => {
      const el = containerRef.current;
      if (!el) return;
      const { width: cw, height: ch } = el.getBoundingClientRect();
      setMinScale(Math.max(cw / imgW, ch / imgH));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [imgW, imgH]);

  useEffect(() => {
    if (data && !isTransitioning) fitToView();
  }, [data, view, fitToView, isTransitioning]);

  /* ── Zoom helpers ── */
  const zoomAt = useCallback(
    (next: number, cx: number, cy: number) => {
      const el = containerRef.current;
      if (!el) return;
      // Clamp to dynamic minScale so we never zoom smaller than cover-fit
      const clamped = clamp(next, minScale, MAX_SCALE);
      const rect = el.getBoundingClientRect();
      const mx = cx - rect.left;
      const my = cy - rect.top;
      const bx = (mx - tx) / scale;
      const by = (my - ty) / scale;
      setScale(clamped);
      setTx(mx - bx * clamped);
      setTy(my - by * clamped);
    },
    [scale, tx, ty, minScale]
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
      zoomAt(clamp(scale * factor, minScale, MAX_SCALE), r.left + r.width / 2, r.top + r.height / 2);
    },
    [scale, zoomAt, minScale]
  );

  /* ── Wheel zoom (native listener for passive:false) ── */
  const wheelHandler = useRef<((e: WheelEvent) => void) | null>(null);
  wheelHandler.current = (e: WheelEvent) => {
    e.preventDefault();
    const next = clamp(scale * (1 - e.deltaY * ZOOM_INTENSITY), minScale, MAX_SCALE);
    zoomAt(next, e.clientX, e.clientY);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelHandler.current?.(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  /* ── Pointer pan (locked when fully zoomed-out at cover-fit) ── */
  const beginPan = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".plot-label-chip, .diamond-marker, .island-label, .poi-marker")) return;
      if (draggingId) return;
      if (e.button !== 0) return;
      // Lock panning at cover-fit zoom — only allow once user has zoomed in
      if (scale <= minScale + 0.001) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setIsPanning(true);
      panRef.current = { sx: e.clientX, sy: e.clientY, stx: tx, sty: ty };
    },
    [tx, ty, draggingId, scale, minScale]
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
        body: JSON.stringify({ plots, diamondPosition: { x: diamondX, y: diamondY }, overviewDiamonds, overviewIslandLabels, islands, poiCategories, pois, roomLabels: localRoomLabels }),
      });
      if (!res.ok) throw new Error("Could not save.");
      const json = (await res.json()) as PlotsResponse;
      setData(json);
      setPlots(json.plots);
      setOverviewDiamonds(json.overviewDiamonds ?? overviewDiamonds);
      setOverviewIslandLabels(json.overviewIslandLabels ?? overviewIslandLabels);
      setIslands(json.islands ?? islands);
      setPoiCategories(json.poiCategories ?? poiCategories);
      setPois(json.pois ?? pois);
      if (json.diamondPosition) {
        setDiamondX(json.diamondPosition.x);
        setDiamondY(json.diamondPosition.y);
      }
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  };

  /** Generic 'enter island' transition — used by both legacy diamonds AND clickable island labels */
  const enterIsland = useCallback((nx: number, ny: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const el = containerRef.current;
    if (!el) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();

    const targetScale = scale * 3.5;
    const imgPxX = nx * imgW;
    const imgPxY = ny * imgH;

    setScale(targetScale);
    setTx(cw / 2 - imgPxX * targetScale);
    setTy(ch / 2 - imgPxY * targetScale);

    setTimeout(() => {
      setView("island");
      setIsTransitioning(false);
    }, 1300);
  }, [isTransitioning, scale, imgW, imgH]);

  const onIslandLabelClick = useCallback((label: OverviewIslandLabel) => {
    if (!label.islandId || isAdmin) return; // admin clicks are for editing
    enterIsland(label.x, label.y);
  }, [enterIsland, isAdmin]);

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

  const enterVilla = useCallback(
    (plotId: string) => {
      const p = plots.find((pl) => pl.id === plotId);
      if (!p || isTransitioning) return;
      setPreviewPlotId(null);
      if (!p.villaFloors?.length && !isAdmin) {
        setSelectedId(plotId);
        return;
      }
      if (!p.villaFloors?.length && isAdmin) {
        setVillaPlotId(plotId);
        setActiveFloor("Ground Floor");
        setView("villa");
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

  const onVillaLabelClick = useCallback(
    (plotId: string) => {
      const p = plots.find((pl) => pl.id === plotId);
      if (!p) return;
      setSelectedId(null);
      setPreviewPlotId(plotId);
    },
    [plots]
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

  const resetVillaTypeFilter = () => {
    setVillaTypeFilter(new Set(VILLA_TYPES));
  };

  /** "All" button: toggles all statuses on/off, independent of villa type card */
  const toggleAllStatuses = () => {
    setStatusFilter((prev) => {
      const allOn = prev.size === 3;
      return allOn ? new Set<PlotStatus>() : new Set<PlotStatus>(["available", "reserved", "sold"]);
    });
  };

  const addOverviewDiamond = () => {
    const label = window.prompt("Island label for new diamond", "MURJAN");
    if (!label) return;
    const id = `diamond-${Date.now()}`;
    setOverviewDiamonds((prev) => [...prev, { id, label, x: 0.5, y: 0.5, islandId: "murjan5" }]);
    setShowOverviewDiamonds(true);
    setDirty(true);
  };

  const removeOverviewDiamond = (id: string) => {
    setOverviewDiamonds((prev) => prev.filter((d) => d.id !== id));
    setDirty(true);
  };

  const addOverviewIslandLabel = () => {
    const label = window.prompt("Overview island label", "MURJAN");
    if (!label) return;
    const islandId = window.prompt("Link to island id (e.g. murjan5) — leave empty for no navigation", "murjan5") || undefined;
    setOverviewIslandLabels((prev) => [...prev, { id: `label-${Date.now()}`, label, x: 0.5, y: 0.5, fontScale: 1, islandId }]);
    setShowOverviewLabels(true);
    setDirty(true);
  };

  const removeOverviewIslandLabel = (id: string) => {
    setOverviewIslandLabels((prev) => prev.filter((l) => l.id !== id));
    setDirty(true);
  };

  const updateLabel = (id: string, patch: Partial<OverviewIslandLabel>) => {
    setOverviewIslandLabels((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setDirty(true);
  };

  /* ── POI category CRUD ── */
  const addPoiCategory = () => {
    const label = window.prompt("Category name", "New Category");
    if (!label) return;
    const color = window.prompt("Hex color (e.g. #22c55e)", "#22c55e") || "#22c55e";
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    setPoiCategories((prev) => [...prev, { id, label, color, icon: "pin" }]);
    setDirty(true);
  };

  const removePoiCategory = (id: string) => {
    if (!window.confirm("Delete this category and all its POIs?")) return;
    setPoiCategories((prev) => prev.filter((c) => c.id !== id));
    setPois((prev) => prev.filter((p) => p.categoryId !== id));
    setActivePoiCategories((prev) => { const n = new Set(prev); n.delete(id); return n; });
    setDirty(true);
  };

  const updatePoiCategory = (id: string, patch: Partial<PoiCategory>) => {
    setPoiCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirty(true);
  };

  /* ── POI CRUD ── */
  const addPoi = (categoryId: string) => {
    const label = window.prompt("POI label (e.g. Mosque #1)", "") || "";
    const id = `poi-${Date.now()}`;
    setPois((prev) => [...prev, { id, categoryId, label, x: 0.5, y: 0.5 }]);
    setActivePoiCategories((prev) => new Set(prev).add(categoryId));
    setDirty(true);
  };

  const removePoi = (id: string) => {
    setPois((prev) => prev.filter((p) => p.id !== id));
    setDirty(true);
  };

  const togglePoiCategory = (id: string) => {
    setActivePoiCategories((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const visiblePois = useMemo(
    () => pois.filter((p) => activePoiCategories.has(p.categoryId)),
    [pois, activePoiCategories]
  );

  /* ── Plot CRUD (admin) ── */
  const updatePlot = useCallback((id: string, patch: Partial<Plot>) => {
    setPlots((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setDirty(true);
  }, []);

  const removePlot = useCallback((id: string) => {
    if (!window.confirm("Delete this villa? This cannot be undone before save.")) return;
    setPlots((prev) => prev.filter((p) => p.id !== id));
    setEditingPlotId(null);
    setPreviewPlotId(null);
    setDirty(true);
  }, []);

  /* ── Room label CRUD (admin) ── */
  const addRoomLabel = useCallback(() => {
    if (!villaPlotId) return;
    const text = window.prompt("Room name", "Bedroom");
    if (!text) return;
    const id = `room-${Date.now()}`;
    setLocalRoomLabels((prev) => {
      const all = prev[villaPlotId] ?? villaPlot?.roomLabels ?? [];
      return { ...prev, [villaPlotId]: [...all, { id, label: text, x: 0.5, y: 0.5, floor: activeFloor }] };
    });
    setDirty(true);
  }, [villaPlotId, villaPlot, activeFloor]);

  const updateRoomLabel = useCallback((id: string, patch: Partial<RoomLabel>) => {
    if (!villaPlotId) return;
    setLocalRoomLabels((prev) => {
      const all = prev[villaPlotId] ?? villaPlot?.roomLabels ?? [];
      return { ...prev, [villaPlotId]: all.map((r) => (r.id === id ? { ...r, ...patch } : r)) };
    });
    setDirty(true);
  }, [villaPlotId, villaPlot]);

  const removeRoomLabel = useCallback((id: string) => {
    if (!villaPlotId) return;
    setLocalRoomLabels((prev) => {
      const all = prev[villaPlotId] ?? villaPlot?.roomLabels ?? [];
      return { ...prev, [villaPlotId]: all.filter((r) => r.id !== id) };
    });
    setEditingRoomId(null);
    setDirty(true);
  }, [villaPlotId, villaPlot]);

  const addIslandPlotLabel = () => {
    const label = window.prompt("New villa label", `${plots.length + 1}`);
    if (!label) return;
    const name = window.prompt("Villa name", `Villa ${label}`) ?? `Villa ${label}`;
    setPlots((prev) => [
      ...prev,
      {
        id: `plot-${Date.now()}`,
        label,
        name,
        type: "Villa A",
        status: "available",
        x: 0.5,
        y: 0.5,
        blueprintSrc: "/blueprints/plot-a1.svg",
        areaSqft: 2500,
        bedrooms: 4,
        bathrooms: 5,
        description: "",
        mapsUrl: "",
        villaFloors: [],
        roomLabels: [],
      },
    ]);
    setDirty(true);
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
        <div className="pointer-events-auto" />

        <div className="pointer-events-auto flex items-center gap-3">
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
          {/* DB logo top-right */}
          <img
            src="/logo-db.png"
            alt="DB"
            className="h-12 md:h-14 lg:h-16 w-auto select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            draggable={false}
          />
        </div>
      </header>

      {/* ═══════════ CV LOGO (bottom-left, overview only — island/villa shows it next to back button) ═══════════ */}
      {view === "overview" && (
        <div className="absolute left-3 bottom-14 z-20 pointer-events-none">
          <img
            src="/logo-cv.png"
            alt="CV"
            className="h-6 md:h-7 lg:h-8 w-auto select-none opacity-85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            draggable={false}
          />
        </div>
      )}

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

            {/* Decorative overview diamond pins (glowing, non-clickable for navigation) */}
            {view === "overview" && !isTransitioning && showOverviewDiamonds && overviewDiamonds.map((diamond) => (
              <div
                key={diamond.id}
                onPointerDown={(e) => {
                  if (!isAdmin) return;
                  e.preventDefault(); e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setDraggingDiamond(diamond.id);
                }}
                onPointerMove={(e) => {
                  if (!isAdmin || draggingDiamond !== diamond.id) return;
                  const el = containerRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  const nx = clamp((e.clientX - rect.left - tx) / scale / imgW, 0, 1);
                  const ny = clamp((e.clientY - rect.top - ty) / scale / imgH, 0, 1);
                  setOverviewDiamonds((prev) => prev.map((d) => (d.id === diamond.id ? { ...d, x: nx, y: ny } : d)));
                  setDirty(true);
                }}
                onPointerUp={() => setDraggingDiamond(null)}
                className={`diamond-marker absolute group ${isAdmin ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
                style={{ left: diamond.x * imgW, top: diamond.y * imgH, transform: `translate(-50%, -50%) scale(${clamp((1 / scale) * 0.85, 0.6, 4)})` }}
              >
                <span className="absolute inset-[-12px] animate-ping rounded-full bg-amber-400/20" />
                <span className="absolute inset-[-8px] animate-pulse rounded-full bg-amber-400/10" />
                <span className="relative flex h-10 w-10 items-center justify-center">
                  <Diamond
                    className="h-8 w-8 text-amber-400 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)] transition group-hover:text-amber-300 group-hover:drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]"
                    fill="rgba(234,179,8,0.3)"
                  />
                </span>
                {isAdmin && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeOverviewDiamond(diamond.id); }}
                    className="absolute -right-3 -top-3 z-10 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-400 pointer-events-auto"
                    title="Delete"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}

            {/* POI markers (colored, per active category) */}
            {view === "overview" && !isTransitioning && visiblePois.map((poi) => {
              const cat = poiCategories.find((c) => c.id === poi.categoryId);
              if (!cat) return null;
              const Icon = getPoiIcon(cat.icon);
              const cScale = cat.scale ?? 1;
              return (
                <div
                  key={poi.id}
                  onPointerDown={(e) => {
                    if (!isAdmin) return;
                    e.preventDefault(); e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setDraggingPoiId(poi.id);
                  }}
                  onPointerMove={(e) => {
                    if (!isAdmin || draggingPoiId !== poi.id) return;
                    const el = containerRef.current;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    const nx = clamp((e.clientX - rect.left - tx) / scale / imgW, 0, 1);
                    const ny = clamp((e.clientY - rect.top - ty) / scale / imgH, 0, 1);
                    setPois((prev) => prev.map((p) => (p.id === poi.id ? { ...p, x: nx, y: ny } : p)));
                    setDirty(true);
                  }}
                  onPointerUp={() => setDraggingPoiId(null)}
                  className={`poi-marker absolute group ${isAdmin ? "cursor-grab active:cursor-grabbing" : "pointer-events-auto"}`}
                  style={{ left: poi.x * imgW, top: poi.y * imgH, transform: `translate(-50%, -50%) scale(${clamp((1 / scale) * 0.7 * cScale, 0.5, 6)})` }}
                >
                  <span
                    className="relative flex h-9 w-9 items-center justify-center rounded-full ring-2 ring-white/30"
                    style={{ backgroundColor: cat.color, boxShadow: `0 0 12px ${cat.color}aa` }}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </span>
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-10 whitespace-nowrap rounded-md glass-panel px-2 py-1 text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100">
                    {poi.label || cat.label}
                  </span>
                  {isAdmin && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); removePoi(poi.id); }}
                      className="absolute -right-3 -top-3 z-10 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-white shadow-lg hover:bg-rose-400 pointer-events-auto"
                      title="Delete"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {view === "overview" && !isTransitioning && showOverviewLabels && overviewIslandLabels.map((label) => {
              const fScale = label.fontScale ?? 1;
              const isClickable = !!label.islandId;
              return (
                <div
                  key={label.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isAdmin && draggingOverviewLabelId === label.id) { setDraggingOverviewLabelId(null); return; }
                    if (isAdmin) { setEditingLabelId(label.id); return; }
                    onIslandLabelClick(label);
                  }}
                  onDoubleClick={(e) => {
                    // Admin: double-click navigates into the island
                    if (!isAdmin || !label.islandId) return;
                    e.stopPropagation();
                    setEditingLabelId(null);
                    enterIsland(label.x, label.y);
                  }}
                  onPointerDown={(e) => {
                    if (!isAdmin) return;
                    e.preventDefault(); e.stopPropagation();
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setDraggingOverviewLabelId(label.id);
                  }}
                  onPointerMove={(e) => {
                    if (!isAdmin || draggingOverviewLabelId !== label.id) return;
                    const el = containerRef.current;
                    if (!el) return;
                    const rect = el.getBoundingClientRect();
                    const nx = clamp((e.clientX - rect.left - tx) / scale / imgW, 0, 1);
                    const ny = clamp((e.clientY - rect.top - ty) / scale / imgH, 0, 1);
                    setOverviewIslandLabels((prev) => prev.map((l) => (l.id === label.id ? { ...l, x: nx, y: ny } : l)));
                    setDirty(true);
                  }}
                  onPointerUp={() => setDraggingOverviewLabelId(null)}
                  className={`island-label absolute group font-extrabold tracking-[0.08em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] ${
                    isAdmin ? "cursor-grab active:cursor-grabbing" : isClickable ? "cursor-pointer hover:text-sky-300 transition-colors" : ""
                  }`}
                  style={{
                    left: label.x * imgW,
                    top: label.y * imgH,
                    fontSize: `${12 * fScale}px`,
                    transform: `translate(-50%, -50%) scale(${clamp((1 / scale) * 0.7, 0.45, 2.5)})`,
                  }}
                >
                  {label.label}
                  {isAdmin && (
                    <button
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); removeOverviewIslandLabel(label.id); }}
                      className="absolute -right-4 -top-3 z-10 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              );
            })}

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
                    if (isAdmin) { setEditingPlotId(p.id); return; }
                    onVillaLabelClick(p.id);
                  }}
                  onDoubleClick={(e) => {
                    if (!isAdmin) return;
                    e.stopPropagation();
                    setEditingPlotId(null);
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
                onClick={(e) => {
                  if (!isAdmin) return;
                  e.stopPropagation();
                  if (draggingRoomId === r.id) return;
                  setEditingRoomId(r.id);
                }}
                className={`room-label-chip group rounded-md border border-white/20 bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white tracking-wide uppercase ${
                  isAdmin ? "cursor-grab active:cursor-grabbing" : ""
                }`}
                style={{ left: r.x * imgW, top: r.y * imgH, "--label-scale": labelScale } as React.CSSProperties}
              >
                {r.label}
                {isAdmin && (
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); removeRoomLabel(r.id); }}
                    className="absolute -right-2.5 -top-2.5 z-10 grid h-4 w-4 place-items-center rounded-full bg-rose-500 text-white opacity-0 group-hover:opacity-100"
                    title="Delete room label"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════ RIGHT PANEL (island view) ═══════════ */}
      <AnimatePresence>
        {view === "island" && !isTransitioning && !previewPlot && (
          <motion.div
            key="island-panel"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute right-3 top-20 z-20 w-48 md:w-56 flex flex-col gap-2 pointer-events-auto max-h-[calc(100vh-140px)] overflow-y-auto hide-scrollbar"
          >
            <div className="glass-panel rounded-xl px-4 py-3">
              <div className="text-2xl font-black leading-none tracking-wide text-sky-400">MURJAN5</div>
              <div className="mt-2 grid grid-cols-2 gap-x-5 text-[10px]">
                <div><span className="text-white/80">Waterfront</span><span className="block text-white font-bold">1,250 m</span></div>
                <div><span className="text-white/80">Area</span><span className="block text-white font-bold">85,000 sqft</span></div>
              </div>
            </div>

            {/* Status filter */}
            <div className="glass-panel rounded-xl p-3">
              <div className="text-[10px] font-semibold tracking-wider text-zinc-500 uppercase mb-2">Status</div>
              {(() => {
                const allActive = statusFilter.size === 3;
                return (
                  <button onClick={toggleAllStatuses} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition hover:bg-white/5" title="Show all">
                    <span className={`h-2.5 w-2.5 rounded-sm ${allActive ? "bg-sky-400" : "bg-zinc-700"} transition`} />
                  </button>
                );
              })()}
              {(["available", "reserved", "sold"] as PlotStatus[]).map((s) => {
                const m = statusMeta(s);
                const active = statusFilter.has(s);
                return (
                  <button key={s} onClick={() => toggleStatus(s)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition ${active ? "text-white" : "text-zinc-600"} hover:bg-white/5`}>
                    <span className={`h-2.5 w-2.5 rounded-sm ${active ? m.dot : "bg-zinc-700"} transition`} />
                    <span className="font-medium">{m.label}</span>
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
                    </button>
                  );
                })}
              </div>
              <button onClick={resetVillaTypeFilter} className="mt-2 w-full rounded-md border border-white/20 py-1 text-[9px] font-semibold text-white/80 hover:bg-white/10 transition">
                RESET
              </button>
            </div>

            {/* Admin info */}
            {isAdmin && (
              <div className="glass-panel rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400">
                  <GripVertical className="h-3 w-3" /> ADMIN MODE
                </div>
                <div className="mt-1 text-[10px] text-zinc-500 leading-relaxed">
                  Drag labels · Click to <b>edit</b> · Double-click to enter villa
                </div>
                <button onClick={addIslandPlotLabel} className="mt-2 w-full flex items-center justify-center gap-1 rounded-md border border-white/20 py-1.5 text-[10px] font-semibold text-white/80 transition hover:bg-white/10">
                  <Plus className="h-3 w-3" /> Add Villa Plot
                </button>
                <div className="mt-1 text-[10px] text-zinc-500">
                  Unsaved: <span className={dirty ? "text-amber-400" : "text-zinc-600"}>{dirty ? "Yes" : "No"}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewPlot && view === "island" && !isTransitioning && (
          <motion.div
            key="villa-preview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
            className="absolute right-3 top-[118px] z-30 w-[190px] rounded-2xl border border-white/10 bg-navy-900/85 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl pointer-events-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-black tracking-wide text-white">VILLA {previewPlot.label}</div>
                <div className="mt-1 text-[10px] text-white/80">sqft {formatNumber(previewPlot.areaSqft)}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-right text-[10px] leading-4">
                  <div className="font-bold text-white">plans:</div>
                  <button className="block text-sky-400 hover:text-sky-300">1Floor</button>
                  <button className="block text-zinc-500 hover:text-zinc-300">2Floor</button>
                </div>
                <button
                  onClick={() => setPreviewPlotId(null)}
                  className="rounded-md border border-white/10 p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
                  title="Close preview"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-white/10 bg-black/35">
              <img
                src={previewPlot.blueprintSrc}
                alt={`Preview for villa ${previewPlot.label}`}
                className="h-auto w-full"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <button
              onClick={() => enterVilla(previewPlot.id)}
              className="mt-4 w-full rounded-md border border-sky-400/40 py-2 text-[10px] font-bold tracking-[0.18em] text-sky-300 transition hover:bg-sky-400/10 hover:text-sky-200"
            >
              ENTER VILLA
            </button>
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
                <button onClick={addRoomLabel} className="w-full flex items-center justify-center gap-1 rounded-md border border-white/20 py-1.5 text-[10px] font-semibold text-white/80 transition hover:bg-white/10">
                  <Plus className="h-3 w-3" /> Add Room Label
                </button>
                <div className="text-[10px] text-zinc-500 leading-relaxed">
                  Drag to position · Click a label to <b>rename</b>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ ZOOM CONTROLS (top center) ═══════════ */}
      <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-start gap-2 pointer-events-auto">
        <div className="flex flex-col gap-1">
          <button onClick={() => zoomBtn("in")} className="glass-panel rounded-sm p-2 text-zinc-300 transition hover:text-white hover:bg-white/10" aria-label="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => zoomBtn("out")} className="glass-panel rounded-sm p-2 text-zinc-300 transition hover:text-white hover:bg-white/10" aria-label="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-3 rounded-full bg-navy-950/85 px-4 py-2 text-[10px] shadow-lg shadow-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-1.5 text-sky-300">
            <Building2 className="h-3 w-3" />
            <span className="font-bold">{Math.round(scale * 100)}%</span>
          </div>
          <span className="text-zinc-300">
          {view === "overview"
            ? "Click an island label to explore"
            : view === "island"
            ? "Click any villa to view its details"
            : "Explore floors and rooms of this villa"}
        </span>
      </div>
      </div>

      {(view === "island" || view === "villa") && (
        <div className="absolute bottom-12 left-3 z-30 flex items-center gap-2 pointer-events-auto">
          <img
            src="/logo-cv.png"
            alt="CV"
            className="h-6 md:h-7 lg:h-8 w-auto select-none opacity-85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            draggable={false}
          />
          <button onClick={fitToView} className="glass-panel rounded-sm p-2 text-zinc-300 transition hover:text-white hover:bg-white/10" aria-label="Reset view">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button onClick={view === "villa" ? backToIsland : backToOverview} className="glass-panel flex items-center gap-2 rounded-sm px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-white/10">
            <ArrowLeft className="h-3 w-3" />
            {view === "villa" ? "Island" : "Overview"}
          </button>
        </div>
      )}

      {/* ═══════════ ADMIN OVERVIEW PANEL ═══════════ */}
      {isAdmin && view === "overview" && (
        <div className="absolute right-3 top-20 z-30 w-64 max-h-[calc(100vh-180px)] overflow-y-auto hide-scrollbar flex flex-col gap-2 pointer-events-auto">
          <div className="glass-panel rounded-xl p-3 space-y-2">
            <div className="text-[10px] font-bold tracking-wider text-amber-400 uppercase flex items-center gap-1.5">
              <GripVertical className="h-3 w-3" /> Admin — Overview
            </div>
            <button onClick={addOverviewIslandLabel} className="w-full flex items-center justify-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-1.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20">
              <Plus className="h-3 w-3" /> Add Island Label
            </button>
            <button onClick={addOverviewDiamond} className="w-full flex items-center justify-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20">
              <Plus className="h-3 w-3" /> Add Diamond Pin
            </button>
          </div>

          {/* POI categories management */}
          <div className="glass-panel rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold tracking-wider text-white uppercase">POI Categories</div>
              <button onClick={addPoiCategory} className="grid h-5 w-5 place-items-center rounded bg-sky-500 text-white hover:bg-sky-400" title="Add category">
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {poiCategories.length === 0 && (
              <div className="text-[10px] text-zinc-500">No categories. Click + to add.</div>
            )}
            {poiCategories.map((cat) => {
              const Icon = getPoiIcon(cat.icon);
              const count = pois.filter((p) => p.categoryId === cat.id).length;
              return (
                <div key={cat.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="grid h-5 w-5 place-items-center rounded" style={{ backgroundColor: cat.color }}>
                      <Icon className="h-3 w-3 text-white" />
                    </span>
                    <input
                      value={cat.label}
                      onChange={(e) => updatePoiCategory(cat.id, { label: e.target.value })}
                      className="flex-1 min-w-0 bg-transparent text-[10px] font-semibold text-white outline-none border-b border-transparent focus:border-white/20"
                    />
                    <input
                      type="color"
                      value={cat.color}
                      onChange={(e) => updatePoiCategory(cat.id, { color: e.target.value })}
                      className="h-5 w-5 cursor-pointer rounded border border-white/20 bg-transparent"
                      title="Pick color"
                    />
                    <button onClick={() => removePoiCategory(cat.id)} className="text-rose-400 hover:text-rose-300" title="Delete category">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-zinc-500">{count} POI{count === 1 ? "" : "s"}</span>
                    <button onClick={() => addPoi(cat.id)} className="flex items-center gap-1 rounded border border-white/20 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 hover:bg-white/10">
                      <Plus className="h-2.5 w-2.5" /> Add POI
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-0.5">
                      <span>Marker size</span>
                      <span className="font-mono text-white/80">{(cat.scale ?? 1).toFixed(2)}×</span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={3}
                      step={0.05}
                      value={cat.scale ?? 1}
                      onChange={(e) => updatePoiCategory(cat.id, { scale: parseFloat(e.target.value) })}
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[9px] text-zinc-500 px-1">
            Drag any pin/label to reposition. Click a label to edit its font size.
          </div>
        </div>
      )}

      {/* ═══════════ LABEL EDIT POPOVER (admin) ═══════════ */}
      {isAdmin && editingLabelId && (() => {
        const label = overviewIslandLabels.find((l) => l.id === editingLabelId);
        if (!label) return null;
        return (
          <div className="absolute left-1/2 top-20 z-40 -translate-x-1/2 w-72 rounded-xl border border-white/10 bg-navy-900/95 p-4 shadow-2xl backdrop-blur-xl pointer-events-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">Edit Label</div>
              <button onClick={() => setEditingLabelId(null)} className="text-zinc-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[9px] text-zinc-500 mb-1">Text</div>
                <input
                  value={label.label}
                  onChange={(e) => updateLabel(label.id, { label: e.target.value })}
                  className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400"
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[9px] text-zinc-500 mb-1">
                  <span>Font size</span>
                  <span className="font-mono text-white/80">{(label.fontScale ?? 1).toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={4}
                  step={0.05}
                  value={label.fontScale ?? 1}
                  onChange={(e) => updateLabel(label.id, { fontScale: parseFloat(e.target.value) })}
                  className="w-full accent-sky-400"
                />
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 mb-1">Links to island id (empty = no navigation)</div>
                <input
                  value={label.islandId ?? ""}
                  onChange={(e) => updateLabel(label.id, { islandId: e.target.value || undefined })}
                  placeholder="e.g. murjan5"
                  className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400"
                />
              </div>
              <button
                onClick={() => { removeOverviewIslandLabel(label.id); setEditingLabelId(null); }}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3 w-3" /> Delete Label
              </button>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ PLOT EDIT POPOVER (island view, admin) ═══════════ */}
      {isAdmin && view === "island" && editingPlotId && (() => {
        const p = plots.find((x) => x.id === editingPlotId);
        if (!p) return null;
        return (
          <div className="absolute left-1/2 top-20 z-40 -translate-x-1/2 w-80 rounded-xl border border-white/10 bg-navy-900/95 p-4 shadow-2xl backdrop-blur-xl pointer-events-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">Edit Villa Plot</div>
              <button onClick={() => setEditingPlotId(null)} className="text-zinc-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[9px] text-zinc-500 mb-1">Label (chip)</span>
                  <input value={p.label} onChange={(e) => updatePlot(p.id, { label: e.target.value })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400" />
                </label>
                <label className="block">
                  <span className="block text-[9px] text-zinc-500 mb-1">Status</span>
                  <select value={p.status} onChange={(e) => updatePlot(p.id, { status: e.target.value as PlotStatus })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400">
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-[9px] text-zinc-500 mb-1">Name</span>
                <input value={p.name} onChange={(e) => updatePlot(p.id, { name: e.target.value })}
                  className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[9px] text-zinc-500 mb-1">Type</span>
                  <input value={p.type} onChange={(e) => updatePlot(p.id, { type: e.target.value })}
                    placeholder="e.g. Villa A1"
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400" />
                </label>
                <label className="block">
                  <span className="block text-[9px] text-zinc-500 mb-1">Area (sqft)</span>
                  <input type="number" value={p.areaSqft} onChange={(e) => updatePlot(p.id, { areaSqft: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400" />
                </label>
                <label className="block">
                  <span className="block text-[9px] text-zinc-500 mb-1">Bedrooms</span>
                  <input type="number" value={p.bedrooms} onChange={(e) => updatePlot(p.id, { bedrooms: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400" />
                </label>
                <label className="block">
                  <span className="block text-[9px] text-zinc-500 mb-1">Bathrooms</span>
                  <input type="number" value={p.bathrooms} onChange={(e) => updatePlot(p.id, { bathrooms: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400" />
                </label>
              </div>
              <label className="block">
                <span className="block text-[9px] text-zinc-500 mb-1">Description</span>
                <textarea value={p.description} onChange={(e) => updatePlot(p.id, { description: e.target.value })} rows={2}
                  className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400 resize-none" />
              </label>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setEditingPlotId(null); onVillaLabelClick(p.id); }}
                  className="flex-1 rounded-md border border-sky-400/40 bg-sky-500/10 py-1.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/20">
                  Open Villa
                </button>
                <button onClick={() => removePlot(p.id)}
                  className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ ROOM RENAME POPOVER (villa view, admin) ═══════════ */}
      {isAdmin && view === "villa" && editingRoomId && (() => {
        const r = currentRoomLabels.find((x) => x.id === editingRoomId);
        if (!r) return null;
        return (
          <div className="absolute left-1/2 top-20 z-40 -translate-x-1/2 w-72 rounded-xl border border-white/10 bg-navy-900/95 p-4 shadow-2xl backdrop-blur-xl pointer-events-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">Edit Room Label</div>
              <button onClick={() => setEditingRoomId(null)} className="text-zinc-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-[9px] text-zinc-500 mb-1">Label</span>
                <input
                  autoFocus
                  value={r.label}
                  onChange={(e) => updateRoomLabel(r.id, { label: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingRoomId(null); }}
                  className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400"
                />
              </label>
              <label className="block">
                <span className="block text-[9px] text-zinc-500 mb-1">Floor</span>
                <input
                  value={r.floor}
                  onChange={(e) => updateRoomLabel(r.id, { floor: e.target.value })}
                  className="w-full rounded-md bg-white/5 border border-white/10 px-2 py-1.5 text-[11px] text-white outline-none focus:border-sky-400"
                />
              </label>
              <button
                onClick={() => removeRoomLabel(r.id)}
                className="w-full flex items-center justify-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3 w-3" /> Delete Room Label
              </button>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ POI CATEGORY TOGGLE PANEL ═══════════ */}
      <AnimatePresence>
        {showPoiPanel && view === "overview" && (
          <motion.div
            key="poi-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-14 right-3 z-30 w-60 rounded-xl border border-white/10 bg-navy-900/90 p-3 shadow-2xl backdrop-blur-xl pointer-events-auto"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold tracking-wider text-white uppercase">Points of Interest</div>
              <button onClick={() => setShowPoiPanel(false)} className="text-zinc-400 hover:text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
            {poiCategories.length === 0 ? (
              <div className="text-[10px] text-zinc-500 py-2">No categories yet.</div>
            ) : (
              <div className="space-y-1">
                {poiCategories.map((cat) => {
                  const Icon = getPoiIcon(cat.icon);
                  const active = activePoiCategories.has(cat.id);
                  const count = pois.filter((p) => p.categoryId === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => togglePoiCategory(cat.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition ${
                        active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <span className="grid h-5 w-5 place-items-center rounded" style={{ backgroundColor: active ? cat.color : `${cat.color}55` }}>
                        <Icon className="h-3 w-3 text-white" />
                      </span>
                      <span className="flex-1 text-left font-semibold">{cat.label}</span>
                      <span className="text-[9px] text-zinc-500">{count}</span>
                    </button>
                  );
                })}
                {activePoiCategories.size > 0 && (
                  <button
                    onClick={() => setActivePoiCategories(new Set())}
                    className="mt-2 w-full rounded-md border border-white/20 py-1 text-[9px] font-semibold text-white/70 hover:bg-white/10"
                  >
                    HIDE ALL
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════ QUICK ZOOM CONTROLS (right) ═══════════ */}
      <div className="absolute right-3 bottom-14 z-20 hidden flex-col gap-1 pointer-events-auto">
        <button onClick={() => zoomBtn("in")} className="glass-panel rounded-lg p-2 text-zinc-400 transition hover:text-white hover:bg-white/10" aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </button>
        <button onClick={() => zoomBtn("out")} className="glass-panel rounded-lg p-2 text-zinc-400 transition hover:text-white hover:bg-white/10" aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>

      {/* ═══════════ BOTTOM NAV BAR ═══════════ */}
      {(view === "overview" || view === "island") && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto">
          <div className="glass-panel border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center overflow-x-auto hide-scrollbar">
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
              <div className="flex flex-shrink-0 items-center border-l border-white/[0.06]">
                {/* Type — toggle island labels (overview only) */}
                <button
                  disabled={view !== "overview"}
                  onClick={() => setShowOverviewLabels((v) => !v)}
                  className={`px-3 py-2.5 transition ${
                    view !== "overview"
                      ? "text-zinc-700 cursor-not-allowed"
                      : showOverviewLabels
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                  title={view === "overview" ? "Toggle island labels" : "Available in overview only"}
                >
                  <Type className="h-3.5 w-3.5" />
                </button>
                {/* MapPin — toggle POI category panel (overview only) */}
                <button
                  disabled={view !== "overview"}
                  onClick={() => setShowPoiPanel((v) => !v)}
                  className={`px-3 py-2.5 transition ${
                    view !== "overview"
                      ? "text-zinc-700 cursor-not-allowed"
                      : showPoiPanel || activePoiCategories.size > 0
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                  title={view === "overview" ? "Points of interest" : "Available in overview only"}
                >
                  <MapPin className="h-3.5 w-3.5" />
                </button>
                {/* Eye — reserved (no current behaviour) */}
                <button disabled className="px-3 py-2.5 text-zinc-700 cursor-not-allowed" title="View options (coming soon)">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                {/* Volume — reserved (no current behaviour) */}
                <button disabled className="px-3 py-2.5 text-zinc-700 cursor-not-allowed" title="Sound (coming soon)">
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "villa" && villaPlot && (
        <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-auto">
          <div className="glass-panel border-t border-white/[0.06]">
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
          </div>
        </div>
      )}

      {/* ═══════════ OVERVIEW BOTTOM BAR ═══════════ */}
      {view === "overview" && null}

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
