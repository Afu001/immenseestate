export type PlotStatus = "available" | "reserved" | "sold";

export type RoomLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
  floor: string;
  /** Multiplier on the room label's base font-size (admin-editable). Defaults to 1. */
  fontScale?: number;
};

export type VillaFloor = {
  name: string;
  imageSrc: string;
  width: number;
  height: number;
};

export type OverviewDiamond = {
  id: string;
  label: string;
  x: number;
  y: number;
  islandId: string;
};

export type OverviewIslandLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Multiplier on the label's base font-size (admin-editable). Defaults to 1. */
  fontScale?: number;
  /** Optional islandId — when set, clicking the label will zoom into that island. */
  islandId?: string;
};

export type PoiCategory = {
  id: string;
  label: string;
  color: string; // hex color e.g. "#22c55e"
  icon?: string; // lucide icon name (optional, falls back to a generic dot)
  /** Marker size multiplier (admin-editable). Defaults to 1. */
  scale?: number;
};

export type Poi = {
  id: string;
  categoryId: string;
  label: string;
  x: number;
  y: number;
  /** When set, the POI belongs to a specific island (rendered in that island view). When unset, the POI is for the overview. */
  islandId?: string;
};

export type IslandTextLabel = {
  id: string;
  islandId: string;
  label: string;
  x: number;
  y: number;
  /** Multiplier on base font size. Defaults to 1. */
  fontScale?: number;
};

export type IslandConfig = {
  id: string;
  label: string;
  image: { src: string; width: number; height: number };
  waterfront?: string;
  area?: string;
  /** Bottom-center watermark text (defaults to label if omitted). */
  watermarkText?: string;
  /** Watermark font scale multiplier. Defaults to 1. */
  watermarkScale?: number;
  /** Watermark opacity 0..1. Defaults to 0.2. */
  watermarkOpacity?: number;
};

export type Plot = {
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
  villaFloors?: VillaFloor[];
  roomLabels?: RoomLabel[];
  floorPlans?: { name: string; src: string }[];
};

export type PlotsResponse = {
  overviewImage: { src: string; width: number; height: number };
  islandImage: { src: string; width: number; height: number };
  diamondPosition: { x: number; y: number };
  overviewDiamonds?: OverviewDiamond[];
  overviewIslandLabels?: OverviewIslandLabel[];
  islands?: IslandConfig[];
  poiCategories?: PoiCategory[];
  pois?: Poi[];
  islandTextLabels?: IslandTextLabel[];
  plots: Plot[];
  /** Optional project-level Google Maps URL (admin-editable) for the globe button. */
  mapsUrl?: string;
};

export type ViewMode = "overview" | "island" | "villa";

export function statusMeta(status: PlotStatus) {
  switch (status) {
    case "available":
      return {
        label: "Available",
        bg: "bg-emerald-500",
        bgHover: "bg-emerald-400",
        border: "border-emerald-400/50",
        dot: "bg-emerald-400",
        glow: "shadow-[0_0_10px_3px_rgba(16,185,129,0.5)]",
        text: "text-white",
      };
    case "reserved":
      return {
        label: "Reserved",
        bg: "bg-amber-500",
        bgHover: "bg-amber-400",
        border: "border-amber-400/50",
        dot: "bg-amber-400",
        glow: "shadow-[0_0_10px_3px_rgba(245,158,11,0.5)]",
        text: "text-white",
      };
    case "sold":
      return {
        label: "Sold",
        bg: "bg-rose-500",
        bgHover: "bg-rose-400",
        border: "border-rose-400/50",
        dot: "bg-rose-500",
        glow: "shadow-[0_0_10px_3px_rgba(244,63,94,0.5)]",
        text: "text-white",
      };
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
