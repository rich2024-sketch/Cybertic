# StudyMate / 유학메이트

A working hackathon starter for international students attending Korean university lectures.

**Korean lecture → English understanding → a separate study session under the right subject.**

## Start here

Requires Node.js 22.13 or newer and pnpm (the package manager version is pinned in package.json).

~~~bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:next --hostname 0.0.0.0 --port 3000
~~~

Open http://localhost:3000. On first local launch, StudyMate can use the optional dev-only Access mock from `.env.local` so you can create one authenticated student profile. Then press **Start Recording** and play a sample lecture. Let all five transcript segments appear, then save. Notes and a three-question quiz will be available inside that lecture.

For a normal Next.js production build:

~~~bash
pnpm build:next
pnpm start:next
~~~

The original dev and build scripts also support the included Vinext/Cloudflare development environment. Use the :next scripts for a conventional Genspark/Node environment.

## What works now

- Server-verified authenticated student profiles via Cloudflare Access.
- First-login profile setup linked to the verified Access session.
- Editable enrolled subjects with stable subject IDs.
- Backend workspace storage in Cloudflare D1 for profile, lecture text, notes, and quiz state.
- Separate lecture sessions with title, date, duration, and subject folder.
- Real microphone recording, pause/resume, replay, and audio download.
- Optional continuous Korean-to-English speech translation with Gemini Live Translate, with source and English captions.
- Korean browser speech recognition as a separate fallback where supported.
- Device-local audio blobs in IndexedDB, kept separate from the synced text workspace.
- Full Biology and History sample journeys with Korean/English segments.
- Sample subject matching, with manual correction or an Unfiled folder.
- Summary depth chosen by academic year; sample content has two prepared levels.
- Clickable terminology explanations, editable notes, and persistent quiz answers.
- English speech playback using an available device voice.
- Text export and a browser print/save-as-PDF action.
- Server-side Genspark OpenAI-compatible translation and study-note endpoints.
- Responsive English interface with accessible controls.

**Sample transcripts, translations, subject matches, notes, and questions are prepared fixtures. They are labelled as samples. Sample playback does not produce a microphone recording.**

Cloudflare Access identity is now the source of ownership. Lecture text, notes, subjects, and quiz answers sync to the authenticated backend workspace. Audio recordings still remain on the recording device unless the student downloads them.

## Continuous voice translation

See [GEMINI_LIVE_SETUP.md](GEMINI_LIVE_SETUP.md) for the hosted activation steps and short acceptance test. Live speech uses a direct Google API key; text AI can use either the existing Genspark proxy or direct Gemini text generation on the server.

The microphone streams through an AudioWorklet to Gemini Live Translate. English audio is played directly, with a three-second local playback buffer limit. Source and English captions are saved with the original recording. Live mode does not call `/api/translate` for each sentence and does not use the browser's speech recognition or speech synthesis queues.

This feature is disabled until its dedicated server flag, Google key, and app origin are configured. The hosted SSO allowlist must continue to protect `/api/live/*`.

## Authenticated profiles and backend storage

StudyMate now expects production traffic to arrive through Cloudflare Access. The app verifies the `Cf-Access-Jwt-Assertion` token server-side against your Cloudflare Access team domain and audience tag before loading or saving a student workspace.

Required production additions for authenticated profiles:

~~~dotenv
CF_ACCESS_TEAM_DOMAIN=https://<your-team>.cloudflareaccess.com
CF_ACCESS_AUD=<your-access-application-aud>
~~~

Required D1 setup:

1. Create a D1 database for StudyMate.
2. Bind it to the Worker as `DB`.
3. Apply `db/migrations/0001_access_workspaces.sql`.
4. Keep `/api/live/*`, `/api/profile`, and `/api/workspace` behind Cloudflare Access.

For local sandbox/localhost preview only, you may set:

~~~dotenv
STUDYMATE_ALLOW_DEV_AUTH_MOCK=true
STUDYMATE_DEV_ACCESS_EMAIL=student@example.com
STUDYMATE_DEV_ACCESS_NAME=Local Student
~~~

This mock is only for local development. Leave it disabled in production.

## Optional text AI

All sample features work without a key. No paid AI is called by default.

For a local/private demonstration, copy .env.example to .env.local and configure:

~~~dotenv
STUDYMATE_ENABLE_LIVE_AI=true
STUDYMATE_APP_ORIGIN=

# Option A: existing injected OpenAI-compatible proxy
OPENAI_API_KEY=your_server_side_proxy_key
OPENAI_BASE_URL=your_injected_proxy_base_url
OPENAI_MODEL=gpt-5.4-mini

# Option B: direct Gemini text generation using the server-side Google key
GEMINI_LIVE_API_KEY=your_server_side_google_key
GEMINI_TEXT_MODEL=gemini-2.5-flash
~~~

If the OpenAI-compatible proxy is configured, StudyMate keeps using it for text AI. Otherwise, when `STUDYMATE_ENABLE_LIVE_AI=true` and `GEMINI_LIVE_API_KEY` is present, `/api/status`, `/api/translate`, `/api/study`, and `/api/assignments` can use direct Gemini text generation on the server. The Google key stays server-side and is never sent to the OpenAI-compatible proxy.

Restart the server. Behind a proxy, set STUDYMATE_APP_ORIGIN to the exact browser origin (scheme, hostname, and port if present).

- /api/status returns only whether text AI is configured.
- /api/translate translates each final Korean speech segment.
- /api/study translates a saved transcript, suggests an enrolled subject, and generates level-aware notes and three review questions.
- /api/assignments extracts transcript-grounded assignments and deadlines in one server-side request when that feature is enabled.
- The student confirms an AI subject suggestion before the lecture moves.
- Requests are validated, bounded, timed out, and limited per server process. There are no automatic paid retries.
- API keys remain server-side and are excluded from Git. Do not use NEXT_PUBLIC_ for a key.
- Genspark proxy calls spend Genspark credits; direct Google text calls follow the selected Google project's tier and quotas.

Text AI sends recognised/pasted lecture text and academic context either to the configured proxy or directly to Gemini, depending on server configuration. When continuous translation is enabled, microphone audio also streams to Google. The original recording remains in browser storage. Browser speech recognition, when explicitly used as a fallback, may use the browser vendor's online service.

This API is a private-demo adapter, not a public self-serve AI product. If text AI is disabled, StudyMate should clearly fall back to saved recordings and sample/demo study flows instead of fabricating notes or deadlines. Keep live AI disabled on public unauthenticated deployments until authentication, per-user quotas, durable rate limiting, and server-side account isolation have been added.

## Recording and voice limitations

Use a supported browser on HTTPS or localhost and allow microphone access. Browsers differ in Korean recognition and English voices. Permission denial and unavailable recognition have explicit messages; recording can continue without transcription.

If recognition is unavailable, save the audio, open **Transcript → Add transcript**, and paste Korean text. With live AI connected, generate study notes to translate it.

The browser fallback uses:

**Browser Korean STT → server-side English translation → device English speech**

This fallback waits for speech pauses. Select live translation for continuous voice output. Wear earphones to avoid translated speech entering the microphone. Network gaps or provider limits can interrupt captions; the original recording continues and the app displays the interruption. Live captions are grouped by connection interval, not word-aligned bilingual timestamps. The existing study-note request limit remains 45,000 source characters.

## Files to edit in Genspark

| Path | Purpose |
| --- | --- |
| components/studymate/app.tsx | Authenticated workspace shell, first-login setup, dashboard, subjects, profile |
| components/studymate/recording.tsx | Microphone, sample playback, transcript, saving |
| components/studymate/session.tsx | Summary, transcript, quiz, export |
| app/globals.css | Theme and responsive layouts |
| lib/studymate/demo.ts | Prepared sample lessons |
| lib/studymate/storage.ts | Device-local audio persistence |
| lib/studymate/access-server.ts | Cloudflare Access JWT verification |
| lib/studymate/workspace.ts | Shared authenticated workspace schemas and profile helpers |
| lib/studymate/workspace-server.ts | D1-backed workspace/profile persistence |
| app/api/workspace/route.ts | Authenticated workspace load/save route |
| app/api/profile/route.ts | First-login and profile update route |
| lib/studymate/ai-server.ts | Proxy/Gemini text provider adapter, limits, validation |
| app/api/study/route.ts | Subject suggestion and study-note prompt |
| app/api/translate/route.ts | Translation prompt |
| app/api/assignments/route.ts | Assignment/deadline extraction prompt |

Bundled components/ui primitives and infrastructure are supporting code. Genspark usually needs only the task-relevant StudyMate files in its prompt.

## Continue in Genspark

Import the source/repository using its existing-code workflow, then use **GENSPARK_HANDOFF.md**. Preserve current functionality and request one concrete change per prompt.

One teammate can manage app changes while the other prepares Korean demo material and the pitch. Test the complete demo together.

## Checks

~~~bash
pnpm typecheck
pnpm test
pnpm build:next
pnpm build:cloudflare
~~~

Tests cover account separation, persistence, corrupted data, valid subject moves, level-specific samples, quiz validity, disabled AI, unexpected AI subject IDs, and API boundaries.

Microphone hardware, browser-specific STT/TTS, and real paid AI responses require a final test in your browser with configured access. They have not been represented as verified live integrations.

## Reference documentation

- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Browser SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

Future scope includes durable server-side audio uploads (for cross-device playback), dedicated streaming speech services, and the original calendar and faculty-board ideas.
