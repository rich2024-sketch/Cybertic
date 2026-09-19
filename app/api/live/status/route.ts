import { liveTranslationEnabled } from "@/lib/studymate/live-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ enabled: liveTranslationEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
