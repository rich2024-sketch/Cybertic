import { LIVE_MODEL, translationSetup } from "./live-protocol";

const responseHeaders = { "Cache-Control": "no-store", Vary: "Origin" };
class LiveError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function liveTranslationEnabled() {
  return process.env.STUDYMATE_ENABLE_LIVE_TRANSLATION === "true" &&
    !!process.env.GEMINI_LIVE_API_KEY?.trim() && !!process.env.STUDYMATE_APP_ORIGIN?.trim();
}

// Supplemental per-worker limit. The hosted SSO allowlist must cover this route;
// Origin checks and the fictional student selector are NOT authentication.
let starts: number[] = [];
export async function issueLiveSession(request: Request): Promise<Response> {
  try {
    if (!liveTranslationEnabled()) throw new LiveError("Live speech translation is not configured. You can still record audio.", 503);
    const origin = request.headers.get("origin");
    if (!origin || origin !== process.env.STUDYMATE_APP_ORIGIN?.trim()) throw new LiveError("Open this request from StudyMate.", 403);
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new LiveError("Open this request from StudyMate.", 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new LiveError("Send a JSON request.", 415);

    const reader = request.body?.getReader();
    if (!reader) throw new LiveError("The request was empty.", 400);
    let body = "";
    let length = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 128) { await reader.cancel(); throw new LiveError("The request is too large.", 413); }
        body += decoder.decode(part.value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    let input: unknown;
    try { input = JSON.parse(body); } catch { throw new LiveError("Send an empty JSON object.", 400); }
    if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) throw new LiveError("Send an empty JSON object.", 400);

    const now = Date.now();
    starts = starts.filter(t => now - t < 60_000);
    if (starts.length >= 8) throw new LiveError("Too many connection attempts. Wait a minute, then reconnect.", 429);
    starts.push(now);
    const expiresAt = new Date(now + 30 * 60_000).toISOString();
    let response: Response;
    try {
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_LIVE_API_KEY!.trim() },
        body: JSON.stringify({
          uses: 1,
          expireTime: expiresAt,
          newSessionExpireTime: new Date(now + 60_000).toISOString(),
          // Empty fieldMask locks the complete setup, including model and language.
          bidiGenerateContentSetup: translationSetup(),
        }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch { throw new LiveError("The live translation service did not respond. Audio recording can continue.", 504); }
    if (!response.ok) throw new LiveError(response.status === 429
      ? "Google's live translation quota is unavailable. Try again later."
      : "Google could not start live translation. Check the hosted Google key and model access.", response.status === 429 ? 429 : 502);
    const result = await response.json() as { name?: unknown };
    if (typeof result.name !== "string" || !result.name.startsWith("auth_tokens/") || result.name.length > 16_384) throw new LiveError("Google returned an invalid session token.", 502);
    return Response.json({ token: result.name, model: LIVE_MODEL, expiresAt }, { headers: responseHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof LiveError ? error.message : "Live translation could not start." }, {
      status: error instanceof LiveError ? error.status : 500, headers: responseHeaders,
    });
  }
}
