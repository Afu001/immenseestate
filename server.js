import express from "express";
import cors from "cors";
import { promises as fs, createReadStream, statSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const dataFilePath = path.join(__dirname, "data", "plots.json");
const uploadsDir = path.join(__dirname, "uploads", "villas");
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(uploadsDir, req.params.plotId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `floor-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Serve large image assets via streaming
const imageMap = {
  overview: { file: "HighresScreenshot00001.png", type: "image/png" },
  island: { file: "HighresScreenshot00000.png", type: "image/png" },
  villaview: { file: "villaview.jpg", type: "image/jpeg" },
};

app.get("/api/assets/:name", (req, res) => {
  const entry = imageMap[req.params.name];
  if (!entry) return res.status(404).send("Not found");
  try {
    const filePath = path.join(__dirname, entry.file);
    const stat = statSync(filePath);
    res.set({
      "Content-Type": entry.type,
      "Content-Length": stat.size,
      "Cache-Control": "public, max-age=86400",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.status(404).send("Not found");
  }
});

// GET plots data
app.get("/api/plots", async (_req, res) => {
  try {
    const raw = await fs.readFile(dataFilePath, "utf8");
    res.json(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "Failed to load plots" });
  }
});

// PUT plots data (save positions / status updates)
app.put("/api/plots", async (req, res) => {
  try {
    const body = req.body;
    const raw = await fs.readFile(dataFilePath, "utf8");
    const data = JSON.parse(raw);

    // Save diamond position if provided
    if (body.diamondPosition && typeof body.diamondPosition.x === "number" && typeof body.diamondPosition.y === "number") {
      data.diamondPosition = {
        x: Math.max(0, Math.min(1, body.diamondPosition.x)),
        y: Math.max(0, Math.min(1, body.diamondPosition.y)),
      };
    }

    if (body.plots && Array.isArray(body.plots)) {
      const incoming = body.plots;
      const nextPlots = incoming
        .map((p) => {
          if (!p || typeof p.id !== "string") return null;
          const existing = data.plots.find((x) => x.id === p.id);
          if (!existing) return null;
          const nx = typeof p.x === "number" && isFinite(p.x) ? Math.max(0, Math.min(1, p.x)) : existing.x;
          const ny = typeof p.y === "number" && isFinite(p.y) ? Math.max(0, Math.min(1, p.y)) : existing.y;
          return { ...existing, ...p, x: nx, y: ny };
        })
        .filter(Boolean);

      data.plots = data.plots.map((p) => nextPlots.find((n) => n.id === p.id) || p);
    }

    // Save roomLabels if provided
    if (body.roomLabels && typeof body.roomLabels === "object") {
      for (const [plotId, labels] of Object.entries(body.roomLabels)) {
        const plot = data.plots.find((p) => p.id === plotId);
        if (plot && Array.isArray(labels)) plot.roomLabels = labels;
      }
    }

    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    return res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Failed to save plots", detail: e.message });
  }
});

// Upload villa floor image
app.post("/api/upload-villa-image/:plotId", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { plotId } = req.params;
    const floorName = req.body.floorName || "Ground Floor";
    const raw = await fs.readFile(dataFilePath, "utf8");
    const data = JSON.parse(raw);
    const plot = data.plots.find((p) => p.id === plotId);
    if (!plot) return res.status(404).json({ error: "Plot not found" });
    if (!plot.villaFloors) plot.villaFloors = [];
    const imgSrc = `/api/villa-image/${plotId}/${req.file.filename}`;
    const floor = { name: floorName, imageSrc: imgSrc, width: 3840, height: 2160 };
    const idx = plot.villaFloors.findIndex((f) => f.name === floorName);
    if (idx >= 0) plot.villaFloors[idx] = floor;
    else plot.villaFloors.push(floor);
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    res.json({ floor, data });
  } catch (e) {
    res.status(500).json({ error: "Upload failed", detail: e.message });
  }
});

// Serve uploaded villa images
app.get("/api/villa-image/:plotId/:filename", (req, res) => {
  const filePath = path.join(uploadsDir, req.params.plotId, req.params.filename);
  try {
    const stat = statSync(filePath);
    const ext = path.extname(req.params.filename).toLowerCase();
    const mimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
    res.set({ "Content-Type": mimeMap[ext] || "application/octet-stream", "Content-Length": stat.size, "Cache-Control": "public, max-age=86400" });
    createReadStream(filePath).pipe(res);
  } catch {
    res.status(404).send("Not found");
  }
});

// In production, serve the built Vite output
const distPath = path.join(__dirname, "dist");
try {
  await fs.access(distPath);
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} catch {
  // dist doesn't exist yet (dev mode) — that's fine
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
