# Verification and demo checklist

Verified on 16 September 2026 with Node.js 24.19.0:

- TypeScript check passed.
- All nine data and API-boundary tests passed.
- Next.js production build passed, including all three API routes.
- The bundled Vinext build also passed.

No paid AI request was made. Browser rendering, microphone hardware, Korean speech recognition, English speech playback, and the optional browser agent tool have not been verified in a live browser. API tests validate safeguards and expected data shapes; they do not prove a provider response is accurate.

Before presenting, run the seven-step sample flow in GENSPARK_HANDOFF.md. Then allow microphone access, record a short Korean passage, pause/resume, save, refresh, and replay the audio. If recognition is unavailable, add a transcript manually. Enable live AI only when you are ready to configure and test it.

For real translation, check the English against the Korean, confirm the suggested subject, and compare summaries at two academic years. Use earphones when spoken English is enabled.

This starter uses fictional profiles and browser-local data. It does not yet provide production login or cross-device storage.
