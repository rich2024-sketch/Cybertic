import { liveConfig } from "@/lib/studymate/ai-server";
export function GET() { return Response.json({ enabled: liveConfig().enabled }, { headers: { "Cache-Control": "no-store" } }); }
