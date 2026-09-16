# First prompt after importing this project

Continue this existing StudyMate app. Do not rebuild it.

Install with pnpm using the existing lockfile. Run:
~~~bash
pnpm dev:next --hostname 0.0.0.0 --port 3000
~~~

First verify this flow:
1. Choose Maya's demo profile.
2. Open a sample Biology lecture and let it finish.
3. Save it under General Biology.
4. Open its study notes, transcript, and quiz.
5. Change the summary level from Year 1 to Year 4 and update the notes.
6. Refresh and confirm the lecture still exists.
7. Switch to Daniel and confirm Maya's lecture does not appear.

Fix only failures found in this flow. Preserve the mobile layout, all-major support, English-only translation, academic-year summaries, subject confirmation, and separate lecture sessions. Keep live AI disabled until server credentials are configured. Never present sample outputs as real microphone transcription.

Keep your completion summary brief.

# Later: connect live AI

Read the optional live-AI section in README.md. Keep API credentials on the server. Use the existing /api/translate and /api/study adapters, then test with a short Korean lecture and confirm its subject before saving.

Do not rebuild authentication or connect a real university system for the hackathon demo.
