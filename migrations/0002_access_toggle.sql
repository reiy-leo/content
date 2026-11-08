-- 获取码开关与免码下载。说明见 docs/PRODUCT.md「获取码开关」。

-- 1 = 要获取码才能下载（默认）；0 = 免码，任何人都能下载原图
ALTER TABLE projects ADD COLUMN code_required INTEGER NOT NULL DEFAULT 1;
-- 免码时整个项目最多下载多少次；NULL = 不限
ALTER TABLE projects ADD COLUMN max_downloads INTEGER;

-- 免码下载记录：和 downloads 一样先占位、一次性票据，但不限每图一次
CREATE TABLE free_downloads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  ticket_hash TEXT NOT NULL UNIQUE,
  ticket_expires_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  ip_hash TEXT
);
CREATE INDEX free_downloads_project ON free_downloads (project_id, status);
CREATE INDEX free_downloads_image ON free_downloads (image_id);
