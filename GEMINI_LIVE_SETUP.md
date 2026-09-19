# Enable Gemini live translation in Genspark

This update is based on Cybertic main commit `a230b57a298aa2f7dac44e1fb116c916a2e6fc39`. It preserves the app bootstrap fix, `gpt-5.4-mini` proxy adapter, existing study routes, and hosted origin. It adds a separate Google connection for continuous Korean-to-English voice translation.

## Apply and configure

1. Apply this GitHub change to the existing `/home/user/webapp` project. Keep its existing hosted access rules and server secrets.
2. Obtain a Gemini API key from the Google AI Studio project where you tested Live Translate. Start with its free tier if available. API quotas are account/project dependent. The Genspark “Inject to Sandbox” proxy key cannot authenticate directly to Google.
3. Store that key in **the hosted runtime secret** named `GEMINI_LIVE_API_KEY`. Do not paste the key into chat, source files, `wrangler.jsonc`, a `NEXT_PUBLIC_*` variable, or a client-side form. Use Genspark's secure secret-entry mechanism. If only the CLI is available, it must be an interactive terminal controlled by the user; a chat/code-generation box is not a terminal.
4. Set `STUDYMATE_ENABLE_LIVE_TRANSLATION=true` in hosted runtime vars. Keep `STUDYMATE_APP_ORIGIN` equal to the exact deployed browser origin. Keep `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` as they are for summaries.
5. Run `pnpm typecheck`, `pnpm test`, and the hosted build, then redeploy. Check `/api/live/status` in an authenticated browser; it should return `{"enabled":true}`. This confirms configuration presence, not provider connectivity.

If the user has an actual interactive Bash terminal, this command prompts without echoing the key or putting its literal value in shell history:

```bash
cd /home/user/webapp
read -r -s -p "Google live API key: " STUDYMATE_GOOGLE_KEY
echo
gsk hosted secret_put --name GEMINI_LIVE_API_KEY --value "$STUDYMATE_GOOGLE_KEY"
unset STUDYMATE_GOOGLE_KEY
```

Do not ask the user to paste a key in chat if that terminal is unavailable. Identify the available secure entry UI first. Existing Genspark CLI support was established in this project; it has not been invoked from this integration workspace.

## Access and cost

- The existing hosted SSO allowlist must cover the page **and `/api/live/session`**. Test that a signed-out visitor cannot mint a token. Demo student selection is not authentication.
- The new endpoint requires the explicit feature flag, dedicated server secret, matching Origin, a small empty JSON body, and a supplemental eight-starts-per-minute per-worker limit. This in-memory limit is not a replacement for hosted access control or a durable public-service quota.
- Google receives the microphone audio. Its published free tier may use submitted content for product improvement. Test with a practice lecture. Check the project's quota before the hackathon; do not enable billing or auto-upgrade as part of this task.
- Browser tokens are single-use, expire for new connections after one minute, and are locked to the dedicated translation model, English output, and enabled transcripts. The permanent API key stays on the server.
- When provider quota is exhausted the app displays the failure and keeps recording. It does not silently switch to another paid voice model or the text proxy.

## Two-minute acceptance test

In the private hosted site, choose a student, select **Microphone**, leave **Live Korean → English** enabled, start recording, then enable **Listen in English** with earphones.

1. Speak Korean continuously for 30–60 seconds. English captions and audio should begin while speaking continues. Judge actual latency and academic vocabulary accuracy.
2. Mute and unmute English. Captions and the original recording must continue; unmuting must not replay old audio.
3. Pause and resume. Pausing flushes the final captions and closes the Google connection. Resuming starts a new connection in the same lecture.
4. End the lecture. Wait for final captions before Save becomes available. Save under a subject, refresh, and verify original audio and both transcripts remain.
5. Generate study notes. The existing Genspark proxy should still suggest the subject and use the selected academic year. This step consumes Genspark credits.
6. During a separate short test, interrupt the network. Original audio must continue; reconnection/offline status must be visible. A fresh connection can miss words during the gap; the original recording preserves them.

Do not claim the live deployment is verified until these microphone checks pass. Local tests mock Google, WebSocket, and browser audio APIs; they do not prove credentials, provider compatibility, or Korean recognition quality.

## Checks completed before upload

- `pnpm test`: all 18 tests passed (existing study behavior and new live-stream lifecycle tests).
- `pnpm typecheck`, `pnpm build:next`, and `pnpm exec vinext build`: passed. Run the two builds sequentially because they share generated type files.
- Local production HTTP checks: disabled status returned `200` with `enabled: false`, session creation returned `503` while disabled, and the AudioWorklet asset returned `200`.
- No paid provider calls or hosted microphone tests were made from this integration workspace. Live translation remains disabled in the committed configuration until the hosted secret and feature flag are set.

## Implementation notes

- `app/api/live/session/route.ts` mints a constrained ephemeral Google token. `app/api/live/status/route.ts` reports configuration presence.
- `lib/studymate/live-server.ts` uses the REST `bidiGenerateContentSetup` field documented in the API reference. The SDK's `liveConnectConstraints` name is not used as a wire-format substitute.
- `lib/studymate/live-client.ts` uses the `v1beta` constrained WebSocket endpoint, waits for `setupComplete`, streams microphone chunks, receives captions/audio, and drains final output before stopping.
- `public/audio/pcm-capture.js` converts microphone samples to mono PCM16 at 16 kHz in 100 ms chunks. It outputs silence locally to avoid microphone monitoring.
- `lib/studymate/live-audio.ts` schedules English PCM output in order, caps the local queued playback at roughly three seconds, and reports skips. This bounds the browser queue, not total model/network latency.
- Connections rotate about every nine minutes or on a server reconnect notice. Retries are bounded. This is a fresh session, not lossless session resumption; the UI announces a possible transcript gap.
- Source and target transcript streams are accumulated independently in one segment per connection. Save retains them; existing summaries consume source segments. Recording storage, dummy accounts, subject confirmation, and year-based summaries are unchanged.
- The existing note generator still has its 45,000-source-character / 200-segment limit; this change does not implement long-lecture summary chunking.

Official references checked for this integration:

- [Live Translate guide](https://ai.google.dev/gemini-api/docs/live-api/live-translate)
- [WebSocket setup and ephemeral-token wire format](https://ai.google.dev/api/live)
- [Ephemeral token usage](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens)
- [Pricing and free-tier data use](https://ai.google.dev/gemini-api/docs/pricing)

## Roll back

Set `STUDYMATE_ENABLE_LIVE_TRANSLATION=false` and redeploy. Microphone recording, the browser fallback, samples, and the existing Genspark study service remain available. Saved lectures need no migration.
