import { issueLiveSession } from "@/lib/studymate/live-server";

export async function POST(request: Request) {
  return issueLiveSession(request);
}
