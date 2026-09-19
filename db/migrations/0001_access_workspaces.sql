CREATE TABLE IF NOT EXISTS studymate_workspaces (
  owner_key TEXT PRIMARY KEY NOT NULL,
  owner_email TEXT NOT NULL,
  owner_name TEXT,
  workspace_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS studymate_workspaces_owner_email_idx
  ON studymate_workspaces(owner_email);
