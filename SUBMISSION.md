# Submission checklist

1. Extract the GitHub-ready edition and run `Start-Neostance.bat` with Node.js 24.
2. Confirm the public GitHub repository contains the source, tests, README, Dockerfile and local-dist folder. Submit the repository link, not a ZIP or private Site URL.
3. Run a two-device demo: create/join → ready check → shared countdown → play/pause/seek → chat/reactions → queue → poll → host transfer.
4. Read `docs/REQUIREMENTS.md`, `docs/VERIFICATION.md` and `docs/DEMO_AND_TESTING.md`.
5. Finish the ten-device LAN and video-drift checks if possible. Report the conditions honestly; loopback protocol timings are not physical-device results.
6. Update the repository About section with your independent live URL if deployed.
7. Check links in a signed-out browser before submitting, ideally by 11:15 PM.

## 30-second explanation to practise in your own words

Neostance gives friends one shared screen without the countdown-in-chat problem. The server owns the playback position and timestamp. Each client calculates the expected position, corrects drift and receives room changes over a live stream. Ready checks and a shared five-second start help the group begin together. The local edition uses React, a Node HTTP server and SQLite so the code stays understandable and runs without external API keys.

Explain your own decisions and any assistance accurately. There is no promised selection outcome; the best preparation is being able to demonstrate and modify the code.

## Know these five files

- `app/page.tsx`: client room session, playback correction and main interface.
- `core/room-engine.mjs`: permission checks, actions, timeline and concurrency.
- `core/local-store.mjs`: SQLite persistence and revision-safe updates.
- `scripts/local-server.mjs`: HTTP server, SSE bridge and seekable video files.
- `components/cinema.tsx`: optional cinematic ambience and shared ready/start controls.
