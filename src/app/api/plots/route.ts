import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

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

type PlotsFile = {
  image: { src: string; width: number; height: number };
  plots: Plot[];
};

const dataFilePath = path.join(process.cwd(), "data", "plots.json");

async function readPlotsFile(): Promise<PlotsFile> {
  const raw = await fs.readFile(dataFilePath, "utf8");
  return JSON.parse(raw) as PlotsFile;
}

async function writePlotsFile(data: PlotsFile): Promise<void> {
  const serialized = JSON.stringify(data, null, 2) + "\n";
  await fs.writeFile(dataFilePath, serialized, "utf8");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp01(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export async function GET() {
  try {
    const data = await readPlotsFile();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to load plots" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const data = await readPlotsFile();

    if (
      typeof body === "object" &&
      body !== null &&
      "plots" in body &&
      Array.isArray((body as { plots: unknown }).plots)
    ) {
      const incoming = (body as { plots: unknown[] }).plots;
      const nextPlots = incoming
        .map((p) => {
          if (typeof p !== "object" || p === null) return null;
          const obj = p as Partial<Plot>;
          if (typeof obj.id !== "string") return null;
          const existing = data.plots.find((x) => x.id === obj.id);
          if (!existing) return null;

          const nextX = isFiniteNumber(obj.x) ? clamp01(obj.x) : existing.x;
          const nextY = isFiniteNumber(obj.y) ? clamp01(obj.y) : existing.y;

          return { ...existing, ...obj, x: nextX, y: nextY };
        })
        .filter((x): x is Plot => Boolean(x));

      data.plots = data.plots.map((p) => nextPlots.find((n) => n.id === p.id) ?? p);
      try {
        await writePlotsFile(data);
      } catch (e) {
        return NextResponse.json(
          {
            error: "Failed to persist plot positions",
            detail:
              "This deployment likely does not support writing to the project filesystem at runtime (common on Netlify/serverless). Use persistent storage (DB/KV) for saving positions.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(data, { status: 200 });
    }

    if (typeof body === "object" && body !== null && "id" in body) {
      const { id, x, y } = body as { id?: unknown; x?: unknown; y?: unknown };
      if (typeof id !== "string") {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
      }
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return NextResponse.json({ error: "Invalid x/y" }, { status: 400 });
      }

      const plot = data.plots.find((p) => p.id === id);
      if (!plot) {
        return NextResponse.json({ error: "Plot not found" }, { status: 404 });
      }

      plot.x = clamp01(x);
      plot.y = clamp01(y);
      try {
        await writePlotsFile(data);
      } catch (e) {
        return NextResponse.json(
          {
            error: "Failed to persist plot positions",
            detail:
              "This deployment likely does not support writing to the project filesystem at runtime (common on Netlify/serverless). Use persistent storage (DB/KV) for saving positions.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(data, { status: 200 });
    }

    return NextResponse.json({ error: "Unsupported payload" }, { status: 400 });
  } catch {
    return NextResponse.json(
      {
        error: "Failed to save plots",
        detail:
          "If this is deployed on Netlify/serverless, saving to data/plots.json will not persist. Use persistent storage (DB/KV) instead.",
      },
      { status: 500 }
    );
  }
}
