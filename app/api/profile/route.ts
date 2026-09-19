import { AccessError, requireAccessIdentity } from "@/lib/studymate/access-server";
import { saveProfile, workspaceApiFailure, workspaceHeaders, WorkspaceError } from "@/lib/studymate/workspace-server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const identity = await requireAccessIdentity(request);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      throw new WorkspaceError("Send a JSON request.", 415);
    }
    const store = await saveProfile(identity, await request.json());
    return Response.json({ store }, { headers: workspaceHeaders() });
  } catch (error) {
    if (error instanceof AccessError) {
      return Response.json({ error: error.message }, { status: error.status, headers: workspaceHeaders() });
    }
    return workspaceApiFailure(error);
  }
}
