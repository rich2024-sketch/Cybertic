# Deploy StudyMate into your own Cloudflare account

This target is separate from the existing Genspark-managed site. Keep using
Genspark to develop the app. Its existing `wrangler.jsonc` is unchanged.

## Workers Builds settings

For the Worker connected to `rich2024-sketch/Cybertic`, use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `pnpm run deploy:cloudflare` |

The separate `wrangler.cloudflare.jsonc` targets the Worker named `cybertic`.
If you created it under a different name, change that configuration's `name`
to match before deployment. The build generates both the server and browser
assets; deploying a fresh checkout without the build step cannot work.
If non-production builds are enabled, set their deploy command to
`pnpm exec wrangler versions upload --config wrangler.cloudflare.jsonc`.

The configuration uses `keep_vars: true` and declares no runtime variables, so
future deployments retain values entered in the dashboard. No API keys belong
in GitHub or build commands. Dependencies use the existing pnpm lockfile.

## Activate only after private access is configured

Initially the app has no configured AI credentials. Both live speech and the
text AI service stay disabled until their required runtime settings exist.

1. Protect the new Worker with Cloudflare Access for the owner's email and any
   approved teammate. Cover the entire app, including `/api/live/session`,
   `/api/translate`, and `/api/study`. Verify signed-out requests are blocked.
   Genspark's SSO rules do not transfer to this account. Check every enabled
   hostname and preview URL; disable unused public alternatives.
2. In **Workers & Pages > cybertic > Settings > Variables and Secrets**, add
   the following **runtime** settings (not Build variables):

| Name | Type | Value |
| --- | --- | --- |
| `GEMINI_LIVE_API_KEY` | Secret | Your Google AI Studio API key, entered directly in Cloudflare |
| `STUDYMATE_ENABLE_LIVE_TRANSLATION` | Text | `true` |
| `STUDYMATE_APP_ORIGIN` | Text | The exact new HTTPS app origin, with no trailing slash |
| `CF_ACCESS_TEAM_DOMAIN` | Text | `https://<your-team>.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Text | The Access application AUD tag for this StudyMate app |

3. Apply the changes. In a signed-in browser, `/api/live/status` should report
   `enabled: true`. This checks configuration presence, not Google model access.
4. Run the short microphone acceptance test in `GEMINI_LIVE_SETUP.md`.

For authenticated student profiles and backend workspace storage, also create a
Cloudflare D1 database named `cybertic-studymate`, bind it to the Worker as
`DB`, then replace the placeholder `database_id` in `wrangler.cloudflare.jsonc`.
Apply `db/migrations/0001_access_workspaces.sql` afterwards. The app verifies
`Cf-Access-Jwt-Assertion` server-side against `CF_ACCESS_TEAM_DOMAIN` and
`CF_ACCESS_AUD` before it loads or saves a workspace. Without the D1 binding,
live translation can still work, but the authenticated workspace cannot open.

Suggested Wrangler commands after your database exists:

~~~bash
pnpm exec wrangler d1 create cybertic-studymate
pnpm run db:migrate:cloudflare
~~~

For a local Worker preview backed by local D1 state:

~~~bash
pnpm run db:migrate:local
~~~

For live study-note generation and assignment extraction, set
`STUDYMATE_ENABLE_LIVE_AI=true`. Then choose one server-side text backend:

1. **Existing OpenAI-compatible proxy**: configure `OPENAI_API_KEY`,
   `OPENAI_BASE_URL`, and `OPENAI_MODEL=gpt-5.4-mini`.
2. **Direct Gemini text generation**: keep the existing
   `GEMINI_LIVE_API_KEY`, optionally add `GEMINI_TEXT_MODEL`
   (default: `gemini-2.5-flash`), and do not set `OPENAI_*` variables unless
   you intentionally want the proxy to take precedence.

The Google key stays server-side and is never forwarded to the OpenAI-
compatible proxy. Until one of these text backends is enabled, sample/demo
study behavior remains available and `/api/status` stays false even if
`/api/live/status` is true.

Lecture text, notes, quiz answers, and subject edits belong to the
authenticated D1-backed workspace. Audio recordings still belong to the local
browser origin and are not automatically visible on another device or at a new
origin unless the student downloads them. Development mock authentication is
restricted to localhost-style preview hosts and still requires
`STUDYMATE_ALLOW_DEV_AUTH_MOCK=true`; it cannot be used on production domains.

Do not enable paid plans or Google billing as part of this setup. Build success
does not establish that the app fits every Free-plan runtime limit; check the
actual deployment and invocation results before any upgrade decision.

## Validation

`pnpm run build:cloudflare` and `pnpm run deploy:cloudflare --dry-run`
passed locally. Wrangler packaged the server modules and 26 static assets;
the upload estimate was about 304 KiB compressed. This was a dry run only:
the new hosted Worker, private access, and live Google requests remain untested.

References:
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/configuration/access/
