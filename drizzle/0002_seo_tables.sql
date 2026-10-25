DROP TABLE IF EXISTS entries;
--> statement-breakpoint
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  keyword TEXT NOT NULL,
  cluster TEXT NOT NULL DEFAULT '',
  intent TEXT NOT NULL DEFAULT 'informational',
  volume INTEGER,
  difficulty INTEGER,
  position INTEGER,
  target_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  keyword_id INTEGER,
  status TEXT NOT NULL DEFAULT 'idea',
  author TEXT NOT NULL DEFAULT '',
  word_count INTEGER,
  publish_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE backlinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '',
  anchor TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'other',
  dofollow INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'live',
  cost INTEGER,
  acquired_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
