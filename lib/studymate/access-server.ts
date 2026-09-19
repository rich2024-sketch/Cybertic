import { createRemoteJWKSet, jwtVerify } from "jose";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

type AccessSource = "cloudflare-access" | "dev-mock";

export type AccessIdentity = {
  ownerKey: string;
  email: string;
  name: string;
  subject: string | null;
  source: AccessSource;
};

export class AccessError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function cleanUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, "") ?? "";
}

function localPreviewAllowed(request: Request) {
  const { hostname } = new URL(request.url);
  const isLocalHost = LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");
  if (!isLocalHost) return false;
  return process.env.STUDYMATE_ALLOW_DEV_AUTH_MOCK === "true";
}

function devIdentity(): AccessIdentity {
  const email = (process.env.STUDYMATE_DEV_ACCESS_EMAIL?.trim() || "student@example.com").toLowerCase();
  return {
    ownerKey: `email:${email}`,
    email,
    name: process.env.STUDYMATE_DEV_ACCESS_NAME?.trim() || "Local Student",
    subject: null,
    source: "dev-mock",
  };
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(teamDomain: string) {
  let existing = jwksCache.get(teamDomain);
  if (!existing) {
    existing = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, existing);
  }
  return existing;
}

export async function requireAccessIdentity(request: Request): Promise<AccessIdentity> {
  const token = request.headers.get("cf-access-jwt-assertion")?.trim();
  if (!token) {
    if (localPreviewAllowed(request)) return devIdentity();
    throw new AccessError("StudyMate could not verify your Cloudflare Access session.", 401);
  }

  const issuer = cleanUrl(process.env.CF_ACCESS_TEAM_DOMAIN);
  const audience = process.env.CF_ACCESS_AUD?.trim() || "";
  if (!issuer || !audience) {
    throw new AccessError("Cloudflare Access verification is not configured on the server.", 503);
  }

  try {
    const { payload } = await jwtVerify(token, jwksFor(issuer), {
      issuer,
      audience,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) throw new AccessError("Your Cloudflare Access identity did not include an email address.", 403);
    const subject = typeof payload.sub === "string" && payload.sub.trim() ? payload.sub.trim() : null;
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : email;
    return {
      ownerKey: subject ? `sub:${subject}` : `email:${email}`,
      email,
      name,
      subject,
      source: "cloudflare-access",
    };
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError("StudyMate could not validate your Cloudflare Access token.", 403);
  }
}
