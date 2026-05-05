-- Immense Estate – PostgreSQL schema
-- Run once:  psql $DATABASE_URL -f db/schema.sql

BEGIN;

-- ─── Plots / villas ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS plots (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  type          TEXT NOT NULL DEFAULT 'Villa A',
  status        TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','reserved','sold')),
  x             DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  y             DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  blueprint_src TEXT NOT NULL DEFAULT '',
  area_sqft     INTEGER NOT NULL DEFAULT 0,
  bedrooms      INTEGER NOT NULL DEFAULT 0,
  bathrooms     INTEGER NOT NULL DEFAULT 0,
  description   TEXT NOT NULL DEFAULT '',
  maps_url      TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Villa floors ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS villa_floors (
  id        SERIAL PRIMARY KEY,
  plot_id   TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  name      TEXT NOT NULL DEFAULT 'Ground Floor',
  image_src TEXT NOT NULL DEFAULT '',
  width     INTEGER NOT NULL DEFAULT 3840,
  height    INTEGER NOT NULL DEFAULT 2160,
  UNIQUE(plot_id, name)
);

-- ─── Room labels (per plot, per floor) ────────────────────
CREATE TABLE IF NOT EXISTS room_labels (
  id        TEXT PRIMARY KEY,
  plot_id   TEXT NOT NULL REFERENCES plots(id) ON DELETE CASCADE,
  label     TEXT NOT NULL DEFAULT '',
  x         DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  y         DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  floor     TEXT NOT NULL DEFAULT 'Ground Floor'
);

-- ─── Overview diamonds ────────────────────────────────────
CREATE TABLE IF NOT EXISTS overview_diamonds (
  id        TEXT PRIMARY KEY,
  label     TEXT NOT NULL DEFAULT '',
  x         DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  y         DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  island_id TEXT NOT NULL DEFAULT 'murjan5'
);

-- ─── Overview island labels ───────────────────────────────
CREATE TABLE IF NOT EXISTS overview_island_labels (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL DEFAULT '',
  x          DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  y          DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  font_scale DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  island_id  TEXT
);
ALTER TABLE overview_island_labels ADD COLUMN IF NOT EXISTS font_scale DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE overview_island_labels ADD COLUMN IF NOT EXISTS island_id TEXT;

-- ─── POI categories (mosques, BBQ, F&B, etc.) ─────────────
CREATE TABLE IF NOT EXISTS poi_categories (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#0ea5e9',
  icon  TEXT
);

-- ─── POIs (admin-placed markers in different categories) ──
CREATE TABLE IF NOT EXISTS pois (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES poi_categories(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT '',
  x           DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  y           DOUBLE PRECISION NOT NULL DEFAULT 0.5
);
CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category_id);

-- Seed default POI categories
INSERT INTO poi_categories (id, label, color, icon) VALUES
  ('mosques',           'Mosques',              '#10b981', 'landmark'),
  ('bbq',               'BBQ Areas',            '#f97316', 'flame'),
  ('public-facilities', 'Public Facilities',    '#0ea5e9', 'users'),
  ('fnb',               'F & B',                '#eab308', 'utensils'),
  ('high-end',          'High End Restaurants', '#a855f7', 'wine')
ON CONFLICT (id) DO NOTHING;

-- ─── Islands ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS islands (
  id    TEXT PRIMARY KEY,
  label TEXT NOT NULL DEFAULT '',
  image_src TEXT NOT NULL DEFAULT '/api/assets/island',
  width     INTEGER NOT NULL DEFAULT 3840,
  height    INTEGER NOT NULL DEFAULT 2160
);

-- ─── Config (single-row key/value for global settings) ────
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

-- Seed default config rows
INSERT INTO config (key, value) VALUES
  ('overviewImage', '{"src":"/api/assets/overview","width":3840,"height":2160}'),
  ('islandImage',   '{"src":"/api/assets/island","width":3840,"height":2160}'),
  ('diamondPosition','{"x":0.29,"y":0.39}')
ON CONFLICT (key) DO NOTHING;

-- ─── Health / stats helper view ───────────────────────────
CREATE OR REPLACE VIEW stats AS
SELECT
  (SELECT count(*) FROM plots)                       AS total_plots,
  (SELECT count(*) FROM plots WHERE status='available') AS available,
  (SELECT count(*) FROM plots WHERE status='reserved')  AS reserved,
  (SELECT count(*) FROM plots WHERE status='sold')      AS sold,
  (SELECT count(*) FROM villa_floors)                AS total_floors,
  (SELECT count(*) FROM room_labels)                 AS total_room_labels,
  (SELECT count(*) FROM overview_diamonds)           AS total_diamonds,
  (SELECT count(*) FROM overview_island_labels)      AS total_island_labels,
  (SELECT count(*) FROM islands)                     AS total_islands;

COMMIT;
