-- content 初始表结构。说明见 docs/PRODUCT.md「数据模型」。时间都是 Unix 毫秒。

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  access_mode TEXT NOT NULL DEFAULT 'code' CHECK (access_mode IN ('code', 'paid')), -- paid：付费版预留
  price_cents INTEGER,      -- 付费版预留
  currency TEXT,            -- 付费版预留
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  published_at INTEGER
);

CREATE TABLE images (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  original_key TEXT NOT NULL,
  mosaic_key TEXT NOT NULL,
  thumb_key TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX images_project ON images (project_id, position);

CREATE TABLE code_batches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  count INTEGER NOT NULL,
  expires_at INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE access_codes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES code_batches(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,  -- 规范化：大写、无横线
  expires_at INTEGER,
  revoked_at INTEGER,
  note TEXT,
  source TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'purchase')), -- purchase：付费版预留
  order_ref TEXT,             -- 付费版预留
  created_at INTEGER NOT NULL
);
CREATE INDEX access_codes_project ON access_codes (project_id, created_at);

CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  code_id TEXT NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  ticket_hash TEXT NOT NULL UNIQUE,
  ticket_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  ip_hash TEXT,
  UNIQUE (code_id, image_id)  -- 每码每图一次
);
CREATE INDEX downloads_image ON downloads (image_id);
