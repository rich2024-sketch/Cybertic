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

3. Apply the changes. In a signed-in browser, `/api/live/status` should report
   `enabled: true`. This checks configuration presence, not Google model access.
4. Run the short microphone acceptance test in `GEMINI_LIVE_SETUP.md`.

For live study-note generation, additionally configure `OPENAI_API_KEY` and
`OPENAI_BASE_URL` as runtime Secrets, `OPENAI_MODEL=gpt-5.4-mini`, and
`STUDYMATE_ENABLE_LIVE_AI=true`. The existing Genspark proxy's compatibility
from this separate host still needs verification. Its credentials do not
transfer automatically; do not expose them in chat or logs. Until configured,
sample/demo study behavior remains available.

Saved lectures belong to the browser origin. Existing Genspark-origin browser
recordings are not automatically visible at the new Cloudflare URL.

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
