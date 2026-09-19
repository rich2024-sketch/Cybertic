import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { studymateWorkspaces } from "@/db/schema";
import type { AccessIdentity } from "./access-server";
import type { Store } from "./types";
import { mergeProfileIntoStore, normalizeStore, profileSetupSchema, storeSchema } from "./workspace";

export class WorkspaceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

async function requireDb() {
  try {
    return await getDb();
  } catch (error) {
    throw new WorkspaceError(error instanceof Error ? error.message : "StudyMate storage is unavailable.", 503);
  }
}

async function readRow(identity: AccessIdentity) {
  const db = await requireDb();
  const rows = await db.select().from(studymateWorkspaces).where(eq(studymateWorkspaces.ownerKey, identity.ownerKey)).limit(1);
  return rows[0] ?? null;
}

async function writeRow(identity: AccessIdentity, store: Store) {
  const db = await requireDb();
  const now = new Date().toISOString();
  await db.insert(studymateWorkspaces).values({
    ownerKey: identity.ownerKey,
    ownerEmail: identity.email,
    ownerName: identity.name,
    workspaceJson: JSON.stringify(store),
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: studymateWorkspaces.ownerKey,
    set: {
      ownerEmail: identity.email,
      ownerName: identity.name,
      workspaceJson: JSON.stringify(store),
      updatedAt: now,
    },
  });
}

export async function loadWorkspace(identity: AccessIdentity): Promise<Store | null> {
  const row = await readRow(identity);
  if (!row) return null;
  try {
    return normalizeStore(JSON.parse(row.workspaceJson));
  } catch {
    throw new WorkspaceError("The saved StudyMate workspace could not be read from the database.", 500);
  }
}

export async function saveWorkspace(identity: AccessIdentity, raw: unknown): Promise<Store> {
  const store = storeSchema.parse(raw) as Store;
  await writeRow(identity, store);
  return store;
}

export async function saveProfile(identity: AccessIdentity, raw: unknown): Promise<Store> {
  const profile = profileSetupSchema.parse(raw);
  const current = await loadWorkspace(identity);
  const store = mergeProfileIntoStore(current, profile);
  await writeRow(identity, store);
  return store;
}

export function workspaceApiFailure(error: unknown) {
  if (error instanceof WorkspaceError) {
    return Response.json({ error: error.message }, { status: error.status, headers: noStoreHeaders() });
  }
  if (error instanceof z.ZodError) {
    return Response.json({ error: "The StudyMate data was incomplete or invalid. Check the profile fields and try again." }, { status: 422, headers: noStoreHeaders() });
  }
  return Response.json({ error: "StudyMate could not save your workspace." }, { status: 500, headers: noStoreHeaders() });
}

export function workspaceHeaders() {
  return noStoreHeaders();
}
