import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const studymateWorkspaces = sqliteTable("studymate_workspaces", {
  ownerKey: text("owner_key").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  ownerName: text("owner_name"),
  workspaceJson: text("workspace_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, table => [
  index("studymate_workspaces_owner_email_idx").on(table.ownerEmail),
]);
