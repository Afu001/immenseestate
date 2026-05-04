# Immense Estate — Interactive Masterplan

## Overview
A premium real-estate interactive masterplan web application with 3-level zoom navigation, built with **Vite + React 18 + Tailwind CSS v3** and an **Express API server**. Designed for a luxury villa development on palm-shaped islands.

---

## Tech Stack
| Layer       | Technology                                     |
|-------------|------------------------------------------------|
| Frontend    | React 18, TypeScript, Vite 5, Tailwind CSS 3  |
| Animations  | Framer Motion                                  |
| Icons       | Lucide React                                   |
| Routing     | React Router DOM v6                            |
| API Server  | Express.js (Node.js, ESM)                      |
| Uploads     | Multer (multipart file upload)                 |
| Data Store  | `data/plots.json` (file-based)                 |

---

## Project Structure
```
khalidproject/
├── data/
│   └── plots.json              # All plot data, diamond position, villa floors, room labels
├── uploads/
│   └── villas/                 # Uploaded villa floor images (per plot ID)
│       └── {plotId}/
│           └── floor-{ts}.png
├── public/                     # Static assets served by Vite
├── src/
│   ├── main.tsx                # React entry point (BrowserRouter)
│   ├── App.tsx                 # Routes: / → HomePage, /masterplan → MasterplanPage
│   ├── index.css               # Tailwind directives + custom styles
│   ├── types.ts                # TypeScript types + helpers
│   ├── vite-env.d.ts           # Vite env types
│   ├── components/
│   │   ├── PlotDrawer.tsx      # Side drawer for plot details
│   │   └── CompassRose.tsx     # Animated SVG compass rose widget
│   └── pages/
│       ├── HomePage.tsx        # Premium landing page
│       └── MasterplanPage.tsx  # Core interactive masterplan (3-level zoom)
├── server.js                   # Express API server
├── vite.config.ts              # Vite config (proxy /api → :3001)
├── tailwind.config.js          # Tailwind theme config
├── postcss.config.mjs          # PostCSS plugins
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies + scripts
├── index.html                  # Vite HTML entry
├── PROJECT_MAP.md              # This file
├── HighresScreenshot00001.png  # Overview masterplan image (~55MB)
└── HighresScreenshot00000.png  # Island detail image (~55MB)
```

---

## Data Model (`data/plots.json`)
```jsonc
{
  "overviewImage": { "src": "/api/assets/overview", "width": 3840, "height": 2160 },
  "islandImage":   { "src": "/api/assets/island",   "width": 3840, "height": 2160 },
  "diamondPosition": { "x": 0.29, "y": 0.39 },  // normalized 0-1
  "overviewDiamonds": [{ "id": "diamond-murjan5", "label": "MURJAN5", "x": 0.29, "y": 0.38, "islandId": "murjan5" }],
  "overviewIslandLabels": [{ "id": "label-murjan5", "label": "MURJAN5", "x": 0.29, "y": 0.36 }],
  "islands": [{ "id": "murjan5", "label": "MURJAN5", "image": { "src": "/api/assets/island", "width": 3840, "height": 2160 } }],
  "plots": [
    {
      "id": "1",
      "label": "1",
      "name": "Villa 1",
      "type": "Villa A",         // used for type filter
      "status": "available",     // available | reserved | sold
      "x": 0.35, "y": 0.75,     // normalized position on island image
      "blueprintSrc": "/blueprints/plot-a1.svg",
      "areaSqft": 2450,
      "bedrooms": 4,
      "bathrooms": 3,
      "description": "...",
      "mapsUrl": "https://maps.google.com/...",
      "villaFloors": [           // optional — 3rd zoom level images
        { "name": "Ground Floor", "imageSrc": "/api/villa-image/1/floor-xxx.png", "width": 3840, "height": 2160 }
      ],
      "roomLabels": [            // optional — labels on villa floor plan
        { "id": "r1", "label": "GRAND LIVING AREA", "x": 0.3, "y": 0.7, "floor": "Ground Floor" }
      ]
    }
  ]
}
```

---

## 3-Level Zoom Navigation
```
Level 1: OVERVIEW (full masterplan)
   ↓ click blinking diamond marker
Level 2: ISLAND VIEW (MURJAN 5 - residential area)
   ↓ click villa label (e.g. label "18")
Level 3: VILLA DETAIL (interior floor plan with room labels)
   ↓ floor tabs: Ground Floor / 1st Floor / etc.
```

### Level 1 → 2 (Diamond → Island)
- Diamond marker is a pulsing amber icon on the overview image
- Click triggers smooth zoom transition (1.2s cubic-bezier)
- After transition, switches to `islandImage` with villa labels
- Admin: can drag diamond to reposition, double-click to enter island

### Level 2 → 3 (Villa Label → Villa Detail)
- Each villa label can have `villaFloors` array in its plot data
- Labels with floors show a zoom icon indicator
- Click triggers zoom transition into villa detail view
- If no floors uploaded, admin goes directly to upload view; non-admin opens drawer
- Admin: can drag labels to reposition on island

### Level 3 (Villa Detail)
- Shows uploaded HD floor plan image
- Room labels positioned with normalized coordinates
- Bottom bar: floor tabs (Ground Floor, 1st Floor, etc.)
- Right panel: villa info + admin upload controls
- Title: "VILLA (type) INTERIOR"
- Admin: can upload floor images, drag room labels

---

## UI Layout (matches reference design)

### Left Sidebar (all views)
- **CompassRose**: Animated SVG compass with N/S/E/W, 8-point rose, subtle rotation
- **Altitude**: "Altitude : 5 Km"
- **Time**: Live clock (HH:MM AM/PM)
- **Temperature**: "24°" with sun/cloud icons

### Top Bar
- Back button (island → overview, villa → island)
- Building icon + view label ("Masterplan" / "Island View" / "Villa X")
- Home button, Reset view, Admin Save

### Right Panel (Island View)
- MURJAN 5 info card (waterfront length, area)
- **Status filter**: Available ☑ / Sold ☑ / Reserved ☑
- **Villa type filter**: Villa A, B, C, D, E, TIP Villa (2-column grid)
- RESET button
- Admin mode indicator

### Right Panel (Villa View)
- Villa info card (name, type, area, beds, baths)
- Admin: floor select dropdown, upload button, drag instructions

### Bottom Nav (Island View)
- Horizontal scrollable tabs: HOME, MURJAN 1–6, FAYROOZE 1–5
- MURJAN 5 is active (highlighted); others show "Coming soon"

### Bottom Nav (Villa View)
- Home icon (back to island), floor tabs, "VILLA (type) INTERIOR" label

### Other
- **CITY VIEW** watermark (top right)
- **Zoom controls**: +/− buttons (bottom right)
- **Overview bottom bar**: zoom percentage + hint text

---

## API Endpoints

| Method | Path                                  | Description                      |
|--------|---------------------------------------|----------------------------------|
| GET    | `/api/plots`                          | Get all plot data + image refs   |
| PUT    | `/api/plots`                          | Save plots, diamond, roomLabels  |
| GET    | `/api/assets/:name`                   | Stream large images (overview/island/villaview) |
| POST   | `/api/upload-villa-image/:plotId`     | Upload villa floor image (multer)|
| GET    | `/api/villa-image/:plotId/:filename`  | Serve uploaded villa images      |

### PUT `/api/plots` Body
```json
{
  "plots": [...],                          // updated plot positions
  "diamondPosition": { "x": 0.29, "y": 0.39 },
  "overviewDiamonds": [...],
  "overviewIslandLabels": [...],
  "islands": [...],
  "roomLabels": { "plotId": [{ "id": "r1", "label": "...", "x": 0.5, "y": 0.5, "floor": "Ground Floor" }] }
}
```

### POST `/api/upload-villa-image/:plotId` Body (multipart/form-data)
- `image`: file
- `floorName`: string (e.g. "Ground Floor")

---

## Admin Mode
Access via `/masterplan?admin=1`

### Capabilities
1. **Drag diamond marker** on overview → saves position
2. **Drag villa labels** on island view → saves positions
3. **Click villa label** → enters villa detail (even without images)
4. **Upload floor images** per villa per floor (Ground Floor, 1st Floor, 2nd Floor, Roof)
5. **Drag room labels** on villa detail → saves positions
6. **Save button** persists all changes to `data/plots.json`

---

## Key Files Detail

### `src/pages/MasterplanPage.tsx` (~970 lines)
Core component. Handles:
- 3-level view state (`overview` → `island` → `villa`)
- Pan/zoom with native event listeners (passive:false for wheel/touch)
- Diamond marker rendering + admin drag
- Villa labels with status colors + zoom-in indicator
- Villa detail view with room labels + floor tabs
- All filter state (status + villa type)
- Admin upload flow via FormData + multer
- Save handler (plots + diamond + roomLabels)

### `src/components/CompassRose.tsx`
SVG compass rose with:
- Outer ring with 72 degree ticks
- 8-point star rose pattern
- North needle (red gradient)
- Cardinal labels (N/S/E/W)
- Subtle oscillating rotation animation

### `src/components/PlotDrawer.tsx`
Side panel drawer for plot details:
- Blueprint image, metrics (area, beds, baths)
- Villa type, plot ID, description
- Google Maps link
- Framer Motion slide-in animation

### `server.js`
Express API server:
- Streams large images (55MB PNGs) via `createReadStream`
- Multer for villa image uploads → `uploads/villas/{plotId}/`
- JSON read/write for `data/plots.json`
- Production: serves built Vite output from `dist/`

### `src/types.ts`
Type definitions:
- `Plot`, `PlotStatus`, `RoomLabel`, `VillaFloor`, `PlotsResponse`, `ViewMode`
- Helper functions: `statusMeta()`, `formatNumber()`, `clamp()`

---

## Scripts
```bash
npm run dev        # Start Vite (3000) + Express API (3001) concurrently
npm run build      # Build Vite for production
npm start          # Start Express server (serves /dist + /api)
```

---

## Deployment Notes
- Requires Node.js server (not static hosting) due to Express API + file uploads
- Image uploads stored in `uploads/` directory — needs writable filesystem
- `data/plots.json` is read/written at runtime — needs writable filesystem
- Large images (~55MB each) served via streaming to avoid memory issues
- Vite proxy in dev: `/api` → `http://localhost:3001`

---

## Version History
| Date       | Changes                                                    |
|------------|-----------------------------------------------------------|
| 2026-04-19 | Initial Next.js → Vite migration, core masterplan         |
| 2026-04-20 | Diamond drag + save, native event listeners fix           |
| 2026-04-22 | 3-level zoom, compass, bottom nav, villa detail, uploads  |
| 2026-04-22 | Cover-fit images, zoom-out transitions, glass-panel sidebar |
| 2026-04-26 | Overview footer toggles, multiple diamonds/island labels, villa preview drawer, island panel refinements |
