import { z } from "zod";
import { AccessError, requireAccessIdentity } from "@/lib/studymate/access-server";
import { loadWorkspace, saveWorkspace, workspaceApiFailure, workspaceHeaders, WorkspaceError } from "@/lib/studymate/workspace-server";

export const dynamic = "force-dynamic";

function identityPayload(identity: Awaited<ReturnType<typeof requireAccessIdentity>>) {
  return { email: identity.email, name: identity.name, source: identity.source };
}

export async function GET(request: Request) {
  try {
    const identity = await requireAccessIdentity(request);
    const store = await loadWorkspace(identity);
    return Response.json({ identity: identityPayload(identity), store }, { headers: workspaceHeaders() });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status, headers: workspaceHeaders() });
    }
    return workspaceApiFailure(error);
  }
}

export async function PUT(request: Request) {
  try {
    const identity = await requireAccessIdentity(request);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new WorkspaceError("Send a JSON request.", 415);
    }
    const store = await saveWorkspace(identity, await request.json());
    return Response.json({ store }, { headers: workspaceHeaders() });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status, headers: workspaceHeaders() });
    }
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return workspaceApiFailure(error);
    }
    return workspaceApiFailure(error);
  }
}
