export type PlotStatus = "available" | "reserved" | "sold";

export type RoomLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
  floor: string;
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
};

export type IslandConfig = {
  id: string;
  label: string;
  image: { src: string; width: number; height: number };
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
};

export type PlotsResponse = {
  overviewImage: { src: string; width: number; height: number };
  islandImage: { src: string; width: number; height: number };
  diamondPosition: { x: number; y: number };
  overviewDiamonds?: OverviewDiamond[];
  overviewIslandLabels?: OverviewIslandLabel[];
  islands?: IslandConfig[];
  plots: Plot[];
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
