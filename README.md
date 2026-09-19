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

Open http://localhost:3000. Choose a demo student, press **Start Recording**, and play a sample lecture. Let all five transcript segments appear, then save. Notes and a three-question quiz will be available inside that lecture.

For a normal Next.js production build:

~~~bash
pnpm build:next
pnpm start:next
~~~

The original dev and build scripts also support the included Vinext/Cloudflare development environment. Use the :next scripts for a conventional Genspark/Node environment.

## What works now

- Two editable demo profiles from different majors and academic years.
- Any major and editable enrolled subjects, with stable subject IDs.
- Separate lecture sessions with title, date, duration, and subject folder.
- Real microphone recording, pause/resume, replay, and audio download.
- Optional continuous Korean-to-English speech translation with Gemini Live Translate, with source and English captions.
- Korean browser speech recognition as a separate fallback where supported.
- Browser storage: profile/text data in localStorage; audio blobs in IndexedDB.
- Full Biology and History sample journeys with Korean/English segments.
- Sample subject matching, with manual correction or an Unfiled folder.
- Summary depth chosen by academic year; sample content has two prepared levels.
- Clickable terminology explanations, editable notes, and persistent quiz answers.
- English speech playback using an available device voice.
- Text export and a browser print/save-as-PDF action.
- Server-side Genspark OpenAI-compatible translation and study-note endpoints.
- Responsive English interface with accessible controls.

**Sample transcripts, translations, subject matches, notes, and questions are prepared fixtures. They are labelled as samples. Sample playback does not produce a microphone recording.**

Demo profile selection is not authentication. It separates interface data, not access permissions. School data is fictional. Clearing browser storage removes local work; this version does not sync across devices.

## Continuous voice translation

See [GEMINI_LIVE_SETUP.md](GEMINI_LIVE_SETUP.md) for the hosted activation steps and short acceptance test. Live speech uses a direct Google API key; study notes keep the existing Genspark proxy.

The microphone streams through an AudioWorklet to Gemini Live Translate. English audio is played directly, with a three-second local playback buffer limit. Source and English captions are saved with the original recording. Live mode does not call `/api/translate` for each sentence and does not use the browser's speech recognition or speech synthesis queues.

This feature is disabled until its dedicated server flag, Google key, and app origin are configured. The hosted SSO allowlist must continue to protect `/api/live/*`.

## Optional text AI

All sample features work without a key. No paid AI is called by default.

For a local/private demonstration, copy .env.example to .env.local and configure:

~~~dotenv
STUDYMATE_ENABLE_LIVE_AI=true
OPENAI_API_KEY=your_server_side_proxy_key
OPENAI_BASE_URL=your_injected_proxy_base_url
OPENAI_MODEL=gpt-5.4-mini
STUDYMATE_APP_ORIGIN=
~~~

Use the injected Genspark OpenAI-compatible proxy. The dedicated Google live-speech key is configured separately and does not replace these credentials.

Restart the server. Behind a proxy, set STUDYMATE_APP_ORIGIN to the exact browser origin (scheme, hostname, and port if present).

- /api/status returns only whether live AI is configured.
- /api/translate translates each final Korean speech segment.
- /api/study translates a saved transcript, suggests an enrolled subject, and generates level-aware notes and three review questions.
- The student confirms an AI subject suggestion before the lecture moves.
- Requests are validated, bounded, timed out, and limited per server process. There are no automatic paid retries.
- API keys remain server-side and are excluded from Git. Do not use NEXT_PUBLIC_ for a key.
- Genspark proxy calls spend Genspark credits; direct Google calls follow the selected Google project's tier and quotas.

Text AI sends recognised/pasted lecture text and academic context to the configured proxy. When continuous translation is enabled, microphone audio also streams to Google. The original recording remains in browser storage. Browser speech recognition, when explicitly used as a fallback, may use the browser vendor's online service.

This API is a private-demo adapter, not a production multi-user service. Keep live AI disabled on public unauthenticated deployments until authentication, per-user quotas, durable rate limiting, and server-side account isolation have been added.

## Recording and voice limitations

Use a supported browser on HTTPS or localhost and allow microphone access. Browsers differ in Korean recognition and English voices. Permission denial and unavailable recognition have explicit messages; recording can continue without transcription.

If recognition is unavailable, save the audio, open **Transcript → Add transcript**, and paste Korean text. With live AI connected, generate study notes to translate it.

The browser fallback uses:

**Browser Korean STT → server-side English translation → device English speech**

This fallback waits for speech pauses. Select live translation for continuous voice output. Wear earphones to avoid translated speech entering the microphone. Network gaps or provider limits can interrupt captions; the original recording continues and the app displays the interruption. Live captions are grouped by connection interval, not word-aligned bilingual timestamps. The existing study-note request limit remains 45,000 source characters.

## Files to edit in Genspark

| Path | Purpose |
| --- | --- |
| components/studymate/app.tsx | Demo login, dashboard, subjects, profile |
| components/studymate/recording.tsx | Microphone, sample playback, transcript, saving |
| components/studymate/session.tsx | Summary, transcript, quiz, export |
| app/globals.css | Theme and responsive layouts |
| lib/studymate/demo.ts | Fictional profiles and prepared lessons |
| lib/studymate/storage.ts | Local text/audio persistence |
| lib/studymate/ai-server.ts | Provider adapter, limits, validation |
| app/api/study/route.ts | Subject suggestion and study-note prompt |
| app/api/translate/route.ts | Translation prompt |

Bundled components/ui primitives and infrastructure are supporting code. Genspark usually needs only the task-relevant StudyMate files in its prompt.

## Continue in Genspark

Import the source/repository using its existing-code workflow, then use **GENSPARK_HANDOFF.md**. Preserve current functionality and request one concrete change per prompt.

One teammate can manage app changes while the other prepares Korean demo material and the pitch. Test the complete demo together.

## Checks

~~~bash
pnpm typecheck
pnpm test
pnpm build:next
~~~

Tests cover account separation, persistence, corrupted data, valid subject moves, level-specific samples, quiz validity, disabled AI, unexpected AI subject IDs, and API boundaries.

Microphone hardware, browser-specific STT/TTS, and real paid AI responses require a final test in your browser with configured access. They have not been represented as verified live integrations.

## Reference documentation

- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Browser SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)

Future scope includes production login, cross-device storage, dedicated streaming speech services, and the original calendar and faculty-board ideas.
