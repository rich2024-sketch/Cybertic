import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const CLOUDFLARE_CONTEXT = Symbol.for("__cloudflare-context__");

async function runtimeEnv(): Promise<Cloudflare.Env | null> {
  try {
    const mod = await import("cloudflare:workers");
    return mod.env as Cloudflare.Env;
  } catch {}
  const fallback = (globalThis as { [CLOUDFLARE_CONTEXT]?: { env?: Cloudflare.Env; ctx?: { env?: Cloudflare.Env } } })[CLOUDFLARE_CONTEXT];
  return fallback?.env ?? fallback?.ctx?.env ?? null;
}

export async function getDb() {
  const env = await runtimeEnv();
  if (!env?.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Add a D1 binding named DB to the Worker before using authenticated StudyMate storage."
    );
  }

  return drizzle(env.DB, { schema });
}
