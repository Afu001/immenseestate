import express from "express";
import cors from "cors";
import { promises as fs, createReadStream, statSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { isDbConnected, query as dbQuery } from "./db/index.js";

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

    if (Array.isArray(body.overviewDiamonds)) {
      data.overviewDiamonds = body.overviewDiamonds
        .filter((d) => d && typeof d.id === "string")
        .map((d) => ({
          ...d,
          x: typeof d.x === "number" && isFinite(d.x) ? Math.max(0, Math.min(1, d.x)) : 0.5,
          y: typeof d.y === "number" && isFinite(d.y) ? Math.max(0, Math.min(1, d.y)) : 0.5,
          islandId: typeof d.islandId === "string" ? d.islandId : "murjan5",
        }));
    }

    if (Array.isArray(body.overviewIslandLabels)) {
      data.overviewIslandLabels = body.overviewIslandLabels
        .filter((l) => l && typeof l.id === "string")
        .map((l) => ({
          ...l,
          x: typeof l.x === "number" && isFinite(l.x) ? Math.max(0, Math.min(1, l.x)) : 0.5,
          y: typeof l.y === "number" && isFinite(l.y) ? Math.max(0, Math.min(1, l.y)) : 0.5,
        }));
    }

    if (Array.isArray(body.islands)) {
      data.islands = body.islands.filter((i) => i && typeof i.id === "string");
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

// ─── Health API (JSON) ───────────────────────────────────
const startedAt = new Date();

app.get("/api/health", async (_req, res) => {
  try {
    const raw = await fs.readFile(dataFilePath, "utf8");
    const data = JSON.parse(raw);
    const plots = data.plots || [];
    const uptimeMs = Date.now() - startedAt.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;

    let dbStatus = "not configured";
    let dbStats = null;
    if (isDbConnected()) {
      try {
        const r = await dbQuery("SELECT * FROM stats");
        dbStats = r.rows[0] || null;
        dbStatus = "connected";
      } catch {
        dbStatus = "error";
      }
    }

    res.json({
      status: "ok",
      app: process.env.APP_NAME || "Immense Estate",
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      startedAt: startedAt.toISOString(),
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      uptimeSeconds: uptimeSec,
      database: { status: dbStatus, stats: dbStats },
      plots: {
        total: plots.length,
        available: plots.filter((p) => p.status === "available").length,
        reserved: plots.filter((p) => p.status === "reserved").length,
        sold: plots.filter((p) => p.status === "sold").length,
      },
      diamonds: (data.overviewDiamonds || []).length,
      islandLabels: (data.overviewIslandLabels || []).length,
      islands: (data.islands || []).length,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
      },
      node: process.version,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ status: "error", message: e.message });
  }
});

// ─── Health UI (HTML dashboard) ──────────────────────────
app.get("/health", async (_req, res) => {
  try {
    const raw = await fs.readFile(dataFilePath, "utf8");
    const data = JSON.parse(raw);
    const plots = data.plots || [];
    const uptimeMs = Date.now() - startedAt.getTime();
    const uptimeSec = Math.floor(uptimeMs / 1000);
    const hours = Math.floor(uptimeSec / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    const seconds = uptimeSec % 60;
    const mem = process.memoryUsage();
    const dbOk = isDbConnected();
    const available = plots.filter((p) => p.status === "available").length;
    const reserved = plots.filter((p) => p.status === "reserved").length;
    const sold = plots.filter((p) => p.status === "sold").length;

    res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Immense Estate - Health Dashboard</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0e1a;color:#e2e8f0;min-height:100vh;padding:2rem}
    .container{max-width:900px;margin:0 auto}
    h1{font-size:1.8rem;font-weight:800;background:linear-gradient(135deg,#38bdf8,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.25rem}
    .subtitle{color:#64748b;font-size:.85rem;margin-bottom:2rem}
    .status-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem 1rem;border-radius:9999px;font-size:.8rem;font-weight:600}
    .status-ok{background:#065f4620;color:#34d399;border:1px solid #34d39940}
    .status-warn{background:#78350f20;color:#fbbf24;border:1px solid #fbbf2440}
    .status-err{background:#7f1d1d20;color:#f87171;border:1px solid #f8717140}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin:1.5rem 0}
    .card{background:#111827;border:1px solid #1e293b;border-radius:12px;padding:1.25rem}
    .card-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin-bottom:.5rem}
    .card-value{font-size:1.6rem;font-weight:700;color:#f1f5f9}
    .card-sub{font-size:.75rem;color:#475569;margin-top:.25rem}
    .section{margin:2rem 0}
    .section-title{font-size:1rem;font-weight:700;color:#94a3b8;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid #1e293b}
    table{width:100%;border-collapse:collapse}
    th,td{text-align:left;padding:.6rem .8rem;font-size:.8rem}
    th{color:#64748b;font-weight:600;border-bottom:1px solid #1e293b}
    td{color:#cbd5e1;border-bottom:1px solid #1e293b20}
    .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:.4rem}
    .dot-green{background:#34d399}
    .dot-yellow{background:#fbbf24}
    .dot-red{background:#f87171}
    .dot-gray{background:#475569}
    .bar{height:6px;border-radius:3px;background:#1e293b;overflow:hidden;margin-top:.5rem}
    .bar-fill{height:100%;border-radius:3px;transition:width .3s}
    .refresh{position:fixed;bottom:1.5rem;right:1.5rem;background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:.6rem 1.2rem;border-radius:8px;cursor:pointer;font-size:.8rem}
    .refresh:hover{background:#334155;color:#e2e8f0}
    footer{text-align:center;color:#334155;font-size:.7rem;margin-top:3rem;padding-top:1rem;border-top:1px solid #1e293b}
  </style>
</head>
<body>
  <div class="container">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem">
      <div>
        <h1>Immense Estate</h1>
        <div class="subtitle">Production Health Dashboard</div>
      </div>
      <span class="status-badge status-ok"><span class="dot dot-green"></span> System Operational</span>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-label">Uptime</div>
        <div class="card-value">${hours}h ${minutes}m ${seconds}s</div>
        <div class="card-sub">Since ${startedAt.toISOString().replace('T',' ').slice(0,19)} UTC</div>
      </div>
      <div class="card">
        <div class="card-label">Total Villas</div>
        <div class="card-value">${plots.length}</div>
        <div class="card-sub">${available} available &middot; ${reserved} reserved &middot; ${sold} sold</div>
      </div>
      <div class="card">
        <div class="card-label">Memory (RSS)</div>
        <div class="card-value">${Math.round(mem.rss/1024/1024)}MB</div>
        <div class="card-sub">Heap: ${Math.round(mem.heapUsed/1024/1024)}/${Math.round(mem.heapTotal/1024/1024)}MB</div>
      </div>
      <div class="card">
        <div class="card-label">Database</div>
        <div class="card-value" style="font-size:1.1rem">${dbOk ? '<span class="dot dot-green"></span> Connected' : '<span class="dot dot-yellow"></span> JSON Fallback'}</div>
        <div class="card-sub">${dbOk ? 'PostgreSQL' : 'Using data/plots.json'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Villa Status Breakdown</div>
      <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.75rem">
        <span style="color:#34d399;font-weight:700">${available}</span><span style="color:#64748b;font-size:.8rem">Available</span>
        <span style="margin:0 .5rem;color:#1e293b">|</span>
        <span style="color:#fbbf24;font-weight:700">${reserved}</span><span style="color:#64748b;font-size:.8rem">Reserved</span>
        <span style="margin:0 .5rem;color:#1e293b">|</span>
        <span style="color:#f87171;font-weight:700">${sold}</span><span style="color:#64748b;font-size:.8rem">Sold</span>
      </div>
      <div class="bar" style="width:100%">
        <div style="display:flex;height:100%">
          <div class="bar-fill" style="width:${plots.length?Math.round(available/plots.length*100):0}%;background:#34d399"></div>
          <div class="bar-fill" style="width:${plots.length?Math.round(reserved/plots.length*100):0}%;background:#fbbf24"></div>
          <div class="bar-fill" style="width:${plots.length?Math.round(sold/plots.length*100):0}%;background:#f87171"></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">System Information</div>
      <table>
        <tr><th>Property</th><th>Value</th></tr>
        <tr><td>Node.js</td><td>${process.version}</td></tr>
        <tr><td>Environment</td><td>${process.env.NODE_ENV || 'development'}</td></tr>
        <tr><td>PID</td><td>${process.pid}</td></tr>
        <tr><td>Platform</td><td>${process.platform} ${process.arch}</td></tr>
        <tr><td>Diamonds</td><td>${(data.overviewDiamonds||[]).length}</td></tr>
        <tr><td>Island Labels</td><td>${(data.overviewIslandLabels||[]).length}</td></tr>
        <tr><td>Islands</td><td>${(data.islands||[]).length}</td></tr>
      </table>
    </div>

    <footer>Immense Estate v1.0.0 &middot; Health Dashboard &middot; ${new Date().toISOString()}</footer>
  </div>
  <button class="refresh" onclick="location.reload()">Refresh</button>
</body>
</html>`);
  } catch (e) {
    res.status(500).send(`<h1>Error</h1><pre>${e.message}</pre>`);
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
