import type { Store } from "./types";
import type { ProfileSetup } from "./workspace";

export type ViewerIdentity = {
  email: string;
  name: string;
  source: "cloudflare-access" | "dev-mock";
};

type WorkspaceResponse = {
  identity: ViewerIdentity;
  store: Store | null;
};

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new Error("StudyMate could not reach the server. Check your connection and try again.");
  }
  let payload: unknown = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "StudyMate could not complete this request.";
    throw new Error(message);
  }
  return payload as T;
}

export function loadWorkspace() {
  return requestJson<WorkspaceResponse>("/api/workspace");
}

export async function persistWorkspace(store: Store) {
  const result = await requestJson<{ store: Store }>("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(store),
  });
  return result.store;
}

export async function saveProfile(profile: ProfileSetup) {
  const result = await requestJson<{ store: Store }>("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  return result.store;
}
