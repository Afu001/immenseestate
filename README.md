# Immense Estate — Masterplan Viewer

Interactive 3-level masterplan (Overview → Island → Villa) with admin tools, POI markers, PostgreSQL persistence, and one-command deploy to Vultr.

## Stack

- **Frontend**: React 18, Vite 5, TailwindCSS, Framer Motion, Lucide icons, React Router
- **Backend**: Express 4 (Node 22), Multer for uploads
- **Database**: PostgreSQL 16 (with JSON fallback at `data/plots.json`)
- **Deploy**: Bash script (`deploy.sh`) → Vultr VPS, Nginx + PM2
- **Process manager**: PM2

## Quick start (local dev)

```bash
npm install
npm run dev          # vite (5173) + api (3001) concurrently
# admin mode: append ?admin=1 to any URL
```

## Production deploy (one command)

```bash
./deploy.sh setup    # first-time provision (Node, PG, PM2, Nginx, UFW)
./deploy.sh deploy   # build + push + restart on every code change
./deploy.sh status   # check server health
./deploy.sh logs     # tail PM2 logs
./deploy.sh ssl <domain>  # set up HTTPS (requires DNS)
```

All commands, including `.env` generation, DB password sync, schema creation, asset & uploads sync are automated. See `deploy.sh --help`.

## Features

### Three-level masterplan view

| Level | What you see | Navigation |
|-------|--------------|------------|
| **Overview** | Aerial view of all islands with clickable text labels (`MURJAN5`, etc.), legacy diamond pins, and POI markers | Click a label to zoom into that island |
| **Island** | Single island with all villa plots colored by status | Click a villa label to preview, then "Enter Villa" |
| **Villa** | Per-floor blueprint with admin-uploaded image and draggable room labels | Esc or "Island" button to go back |

### Points of Interest (POI) system

- Configurable categories: **Mosques, BBQ Areas, Public Facilities, F&B, High End Restaurants** (admin can add/rename/recolor/delete)
- Color-coded markers placed by admin on the overview, hidden by default
- Bottom MapPin button opens the **POI panel** — toggle individual categories on/off
- Each category gets its own color and icon

### Status / villa-type filters (island view)

- "All" toggle now selects/deselects all 3 statuses (Available/Reserved/Sold)
- Villa type filter: tap to enable/disable each type
- Reset button clears both filters

### Admin mode (`?admin=1`)

| Section | What you can do |
|---------|-----------------|
| Overview | Add/move/delete diamond pins · add/move/delete island labels · edit label text, font size and link-to-island · add/manage POI categories (color, label, icon) · add/move/delete POIs |
| Island | Drag villa labels to position · add new villas |
| Villa | Upload floor images per floor · drag room labels |
| Save | A single **Save** button persists everything to `data/plots.json` (and PostgreSQL when wired) |

### Responsive scaling

- Root font-size is fluid (`clamp(14px, 0.55vw + 9px, 22px)`) so all `rem`-based UI scales smoothly from 1280px laptops to 4K monitors.
- A CSS variable `--ui-scale` is also exposed for custom components.

### Zoom

- Cover-fit minimum lock: users **cannot zoom out below the image's cover-fit** so there are never empty letterbox bars.
- Wheel, pinch, +/- keys, and on-screen buttons all share the same clamped logic.

### Branding

- DB logo top-right (`public/logo-db.png`)
- CV logo bottom-left (`public/logo-cv.png`)
- "Immense Estate" wordmark removed from header — view-context label kept

## Data model

The single source of truth on disk is `data/plots.json`. Schema in `db/schema.sql` mirrors it for PostgreSQL. Key shapes (see `src/types.ts`):

- `OverviewIslandLabel`: `{ id, label, x, y, fontScale?, islandId? }` — clickable when `islandId` is set
- `OverviewDiamond`: `{ id, label, x, y, islandId }` — legacy decorative pin (no longer clickable for navigation)
- `PoiCategory`: `{ id, label, color, icon? }`
- `Poi`: `{ id, categoryId, label, x, y }`
- `Plot`: full villa record incl. `villaFloors[]` and `roomLabels[]`

Coordinates are normalized `0..1` of the underlying image so they survive image swaps.

## Server endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/plots` | Read full data |
| `PUT`  | `/api/plots` | Save plots, diamonds, labels, POIs, room labels, etc. |
| `POST` | `/api/upload-villa-image/:plotId` | Upload a floor image |
| `GET`  | `/api/villa-image/:plotId/:filename` | Serve uploaded floor image |
| `GET`  | `/api/assets/:name` | Stream the big map images (`overview`, `island`, `villaview`) |
| `GET`  | `/api/health` | JSON health |
| `GET`  | `/health` | HTML dashboard |

## Asset upload (large images)

The big aerial images are kept out of git (gitignored) and uploaded once via:

```bash
./deploy.sh assets    # uploads HighresScreenshot00000.png, HighresScreenshot00001.png, villaview.jpg
./deploy.sh uploads   # syncs uploads/villas/* to server
```

Both run automatically inside `./deploy.sh deploy`.

## Project layout

```
.
├── deploy.sh            # full automation (setup/deploy/db/env/ssh/logs/ssl/...)
├── server.js            # express api + static dist + health
├── db/
│   ├── index.js         # pg pool with JSON fallback
│   └── schema.sql       # full PG schema (plots, poi, etc.)
├── data/plots.json      # JSON source of truth (mirrored to PG)
├── public/
│   ├── logo-db.png      # top-right brand
│   ├── logo-cv.png      # bottom-left brand
│   └── blueprints/      # villa blueprint SVGs
├── src/
│   ├── pages/MasterplanPage.tsx   # main 3-level viewer
│   ├── components/                # PlotDrawer, CompassRose
│   └── types.ts
└── uploads/villas/<plotId>/<file> # admin-uploaded floor images
```
