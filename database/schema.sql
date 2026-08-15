PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS import_runs (
  id INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  source_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS source_documents (
  id INTEGER PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  file_path TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('pdf', 'xlsx', 'xls', 'js', 'image', 'other')),
  title TEXT,
  checksum TEXT,
  page_count INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_series (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  line_label TEXT,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  source_document_id INTEGER REFERENCES source_documents(id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  product_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  english_name TEXT,
  series_id INTEGER NOT NULL REFERENCES product_series(id),
  catalog_serial TEXT,
  style TEXT,
  line_code TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  configurator_key TEXT,
  thumbnail_path TEXT,
  source_payload TEXT NOT NULL DEFAULT '{}',
  source_document_id INTEGER REFERENCES source_documents(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_attributes (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_key TEXT NOT NULL,
  attribute_value TEXT,
  value_type TEXT NOT NULL DEFAULT 'text' CHECK (value_type IN ('text', 'number', 'boolean', 'json')),
  source_document_id INTEGER REFERENCES source_documents(id),
  PRIMARY KEY (product_id, attribute_key)
);

CREATE TABLE IF NOT EXISTS door_types (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  width_min_mm INTEGER,
  width_default_mm INTEGER,
  width_max_mm INTEGER,
  height_min_mm INTEGER,
  height_default_mm INTEGER,
  height_max_mm INTEGER,
  leaf_ratio REAL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE IF NOT EXISTS product_door_types (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  door_type_id INTEGER NOT NULL REFERENCES door_types(id) ON DELETE CASCADE,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  source_document_id INTEGER REFERENCES source_documents(id),
  PRIMARY KEY (product_id, door_type_id)
);

CREATE TABLE IF NOT EXISTS option_groups (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  selection_mode TEXT NOT NULL DEFAULT 'single' CHECK (selection_mode IN ('single', 'multiple')),
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY,
  option_group_id INTEGER NOT NULL REFERENCES option_groups(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'each',
  asset_path TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE (option_group_id, option_key)
);

CREATE TABLE IF NOT EXISTS product_options (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  is_required INTEGER NOT NULL DEFAULT 0 CHECK (is_required IN (0, 1)),
  price_override_cents INTEGER,
  compatibility_note TEXT,
  source_document_id INTEGER REFERENCES source_documents(id),
  PRIMARY KEY (product_id, option_id)
);

CREATE TABLE IF NOT EXISTS product_door_type_options (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  door_type_id INTEGER NOT NULL REFERENCES door_types(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES options(id) ON DELETE CASCADE,
  compatible INTEGER NOT NULL DEFAULT 1 CHECK (compatible IN (0, 1)),
  note TEXT,
  PRIMARY KEY (product_id, door_type_id, option_id)
);

CREATE TABLE IF NOT EXISTS dimension_rules (
  id INTEGER PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  series_id INTEGER REFERENCES product_series(id) ON DELETE CASCADE,
  door_type_id INTEGER REFERENCES door_types(id) ON DELETE CASCADE,
  width_min_mm INTEGER NOT NULL,
  width_default_mm INTEGER NOT NULL,
  width_max_mm INTEGER NOT NULL,
  height_min_mm INTEGER NOT NULL,
  height_default_mm INTEGER NOT NULL,
  height_max_mm INTEGER NOT NULL,
  minimum_area_sqm REAL,
  maximum_area_sqm REAL,
  panel_thickness_mm REAL,
  door_depth_mm REAL,
  frame_depth_mm REAL,
  casing_depth_mm REAL,
  lock_gap_mm REAL,
  lock_height_mm REAL,
  notes TEXT,
  source_document_id INTEGER REFERENCES source_documents(id),
  CHECK (product_id IS NOT NULL OR series_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS price_rules (
  id INTEGER PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  series_id INTEGER REFERENCES product_series(id) ON DELETE CASCADE,
  door_type_id INTEGER REFERENCES door_types(id) ON DELETE CASCADE,
  option_id INTEGER REFERENCES options(id) ON DELETE CASCADE,
  price_kind TEXT NOT NULL CHECK (price_kind IN ('base_area', 'finish_area', 'option', 'per_meter', 'per_leaf', 'fixed', 'surcharge', 'formula')),
  amount_cents INTEGER,
  unit TEXT NOT NULL DEFAULT 'each',
  formula TEXT,
  effective_from TEXT,
  effective_to TEXT,
  notes TEXT,
  source_document_id INTEGER REFERENCES source_documents(id),
  source_locator TEXT
);

CREATE TABLE IF NOT EXISTS price_references (
  id INTEGER PRIMARY KEY,
  source_document_id INTEGER NOT NULL REFERENCES source_documents(id),
  section_title TEXT,
  page_start INTEGER,
  page_end INTEGER,
  category TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS asset_references (
  id INTEGER PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  option_id INTEGER REFERENCES options(id) ON DELETE CASCADE,
  asset_role TEXT NOT NULL,
  file_path TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_products_series_active ON products(series_id, active);
CREATE INDEX IF NOT EXISTS idx_products_configurator ON products(configurator_key);
CREATE INDEX IF NOT EXISTS idx_product_attributes_key ON product_attributes(attribute_key);
CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id);
CREATE INDEX IF NOT EXISTS idx_dimension_rules_lookup ON dimension_rules(product_id, series_id, door_type_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_lookup ON price_rules(product_id, series_id, door_type_id, option_id);
CREATE INDEX IF NOT EXISTS idx_price_references_category ON price_references(category);

-- Back-office business data. These tables are intentionally separate from the
-- catalog import tables so a catalog rebuild never deletes customer work.
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  dealer_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dealers (
  id INTEGER PRIMARY KEY,
  dealer_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  region TEXT,
  address TEXT,
  level TEXT NOT NULL DEFAULT 'standard' CHECK (level IN ('standard', 'silver', 'gold', 'strategic')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'closed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL DEFAULT 'text' CHECK (value_type IN ('text', 'number', 'boolean', 'json')),
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dealers_status ON dealers(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role, active);

CREATE TABLE IF NOT EXISTS saved_schemes (
  id INTEGER PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  series TEXT,
  product TEXT,
  product_label TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'quoted', 'archived')),
  config_json TEXT NOT NULL DEFAULT '{}',
  order_payload_json TEXT NOT NULL DEFAULT '{}',
  ai_scenes_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'website',
  series TEXT,
  product TEXT,
  product_label TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'closed', 'invalid')),
  config_json TEXT NOT NULL DEFAULT '{}',
  order_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY,
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_schemes_updated ON saved_schemes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);

DROP VIEW IF EXISTS v_configurable_products;
DROP VIEW IF EXISTS v_product_options;
DROP VIEW IF EXISTS v_product_dimensions;
DROP VIEW IF EXISTS v_price_book;

CREATE VIEW v_configurable_products AS
SELECT
  p.id,
  p.product_key,
  p.name AS product_name,
  p.configurator_key,
  s.code AS series_code,
  s.name AS series_name,
  p.style,
  p.active,
  dt.code AS default_door_type,
  dt.name AS default_door_type_name
FROM products p
JOIN product_series s ON s.id = p.series_id
LEFT JOIN product_door_types pdt ON pdt.product_id = p.id AND pdt.is_default = 1
LEFT JOIN door_types dt ON dt.id = pdt.door_type_id
WHERE p.configurator_key IS NOT NULL;

CREATE VIEW v_product_options AS
SELECT
  p.product_key,
  p.name AS product_name,
  og.code AS option_group,
  og.name AS option_group_name,
  o.option_key,
  o.name AS option_name,
  o.note,
  COALESCE(po.price_override_cents, o.price_cents) AS price_cents,
  o.unit,
  po.is_default,
  po.is_required,
  po.compatibility_note
FROM product_options po
JOIN products p ON p.id = po.product_id
JOIN options o ON o.id = po.option_id
JOIN option_groups og ON og.id = o.option_group_id;

CREATE VIEW v_product_dimensions AS
SELECT
  p.product_key,
  p.name AS product_name,
  dt.code AS door_type,
  dt.name AS door_type_name,
  dr.width_min_mm,
  dr.width_default_mm,
  dr.width_max_mm,
  dr.height_min_mm,
  dr.height_default_mm,
  dr.height_max_mm,
  dr.minimum_area_sqm,
  dr.maximum_area_sqm,
  dr.notes
FROM dimension_rules dr
JOIN products p ON p.id = dr.product_id
JOIN door_types dt ON dt.id = dr.door_type_id;

CREATE VIEW v_price_book AS
SELECT
  p.product_key,
  p.name AS product_name,
  s.code AS series_code,
  dt.code AS door_type,
  o.name AS option_name,
  pr.price_kind,
  pr.amount_cents,
  pr.unit,
  pr.formula,
  pr.notes,
  pr.source_locator
FROM price_rules pr
LEFT JOIN products p ON p.id = pr.product_id
LEFT JOIN product_series s ON s.id = pr.series_id OR s.id = p.series_id
LEFT JOIN door_types dt ON dt.id = pr.door_type_id
LEFT JOIN options o ON o.id = pr.option_id;
