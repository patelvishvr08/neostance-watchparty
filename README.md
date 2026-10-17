# Neostance

**Your people. One screen.** A small watch-party app for Vishv Ranoliya's VinnovateIT recruitment project.

Cinematic black glass, a Montserrat wordmark, and Manrope controls, open-film discovery, synchronized playback and a shared five-second start. The interface uses sampled damped-spring transitions via native Web Animations, with no animation runtime dependency. The editable project uses React + TypeScript, a plain Node.js HTTP server and SQLite. No external API key is needed.

## Public submission links and sign-in

Hosted Neostance: https://afterhours-watchparty-vishv.yogita18892009patel.chatgpt.site

STILL case study: https://afterhours-watchparty-vishv.yogita18892009patel.chatgpt.site/still/index.html

Both are public. The hosted app supports optional Sign in with ChatGPT, with Google available on the provider screen. This standalone edition supports guest rooms and links to the hosted app for account sign-in. Favourites and downloads remain browser-local. No standalone Google OAuth is configured.

## Run in two minutes

1. Install Node.js 24 from https://nodejs.org.
2. Extract the project completely.
3. On Windows, double-click `Start-Neostance.bat`. On macOS/Linux, run `node scripts/local-server.mjs`.
4. Open http://localhost:3000. Create a room and invite another browser/device.

The prebuilt client is included: **no npm install is needed to run it**. For a phone on the same Wi-Fi/hotspot, use the LAN address printed by the server. Do not send localhost to another device. Keep the host machine awake.

## What works

- Create/join by invite link or six-character code; up to 50 member records.
- Shared play, pause and seek; server timestamps, clock calibration and automatic drift correction.
- Ready checks and a server-timed five-second shared start; late joiners inherit the same countdown.
- Ranked multi-word discovery, fuzzy search, favourites, watch later, not-interested controls, muted video previews and custom direct HTTPS MP4/WebM links.
- Browser-cached clip downloads with local playback; recommendations based on shared genres and tags.
- Shared queue, host-only/shared controls, reactions, live chat, polls and vote replacement.
- Host transfer, locking, member removal, disconnect recovery and room export.
- Responsive cinema layout, muted animated lobby, optional motion, local audio, fullscreen and keyboard controls.
- SQLite persistence and media byte ranges; Docker-ready standalone deployment.

## Edit and verify

```sh
npm install
npm run typecheck
npm test
npm run build
npm start
```

Rebuild after editing React/CSS. The Dockerfile deploys the committed `local-dist` folder. `npm run dev` performs one build and starts the server; it is intentionally not a hot-reload development server.

```sh
npm run test:realtime
```

This opens ten actual HTTP/SSE clients, sends 30 control updates and records 300 deliveries per mode. It also checks reconnect snapshots and byte-range media serving. See `docs/benchmark-results.json` for the exact test environment and latest results.

## How it works

The server owns `{ position, playing, updatedAt, media }`. During playback:

```
expectedPosition = savedPosition + max(0, estimatedServerNow - updatedAt) / 1000
```

Clients estimate the clock difference from HTTP round trips. Every 500 ms the video follows the shared timeline: differences over 250 ms seek; smaller differences over 80 ms use a 0.97x/1.03x rate adjustment. A scheduled start uses a future timestamp and the client waits for it before playing.

Actions are authenticated POST requests; Server-Sent Events carry state updates. SQLite commits use a revision check to retry concurrent changes without losing another participant's action. The latest valid committed playback action wins. Host permissions are checked on the server. Session tokens are hashed before storage and are not returned to other members.

## Read the project

| File | Responsibility |
|---|---|
| `app/page.tsx` | Main interface, room session and playback controller |
| `components/cinema.tsx` | Cinematic opening, ambience, ready seats and shared start |
| `components/social-panel.tsx` | Chat, queue, poll and people panels |
| `components/film-grid.tsx` | Hover previews, mute toggle and library actions |
| `components/ui.tsx` | Logo, modal focus handling and avatars |
| `components/personal-library.tsx` | Search dialog, preferences, saved clips and shelves |
| `core/room-engine.mjs` | Room actions, permissions, timeline, API and SSE |
| `core/local-store.mjs` | SQLite and revision-safe commits |
| `core/playback.mjs` | Buffer-aware correction and replay policy |
| `core/motion.ts` | Native damped-spring room transitions |
| `app/neostance.css` | Neostance visual system and responsive cinema layout |
| `core/catalog.mjs` | Curated titles and fuzzy matching |
| `scripts/local-server.mjs` | HTTP server, health endpoint and media ranges |
| `tests/` | Integration tests and ten-client benchmark |

## Submission and hosting

Read [SUBMISSION.md](SUBMISSION.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [requirements coverage](docs/REQUIREMENTS.md). Upload this folder's contents to a **public GitHub repository**. The recruitment form accepts a repository link. A ZIP or private preview alone does not satisfy that instruction.

The Dockerfile runs the prebuilt app with Node.js 24; mount persistent storage at `/app/.afterhours`. Keep this SQLite edition at one service instance. This standalone edition is independent of the ChatGPT-hosted preview and has no Site identity or hosted account credentials.

## Verification and limits

21 automated integration/controller/server tests passed in the build environment. Latest ten-client loopback p95: **11.61 ms** (immediate local push), **139.42 ms** (125 ms polling adapter), with all 300 updates received in each run. These are protocol measurements over 127.0.0.1, not physical-device LAN tests or proof of video display synchronization. Actual browser video drift <=500 ms and LAN control p95 <=250 ms must still be measured on the demonstration network.

Browser rendering and physical video playback were not directly observed in this managed build environment. Use `docs/DEMO_AND_TESTING.md` for the remaining device checks. The Dockerfile is supplied; a Docker daemon was unavailable to execute its image here.

Every bundled MP4 has been remuxed for progressive playback; the stadium clip is now browser-compatible H.264 4:2:0. Existing rooms resolve bundled IDs to the current files. Full local decode checks are in `docs/media-audit.json`. This does not guarantee arbitrary external URLs or every browser.

Direct MP4/WebM only; no Netflix/DRM or YouTube integration. Included catalogue: one complete Caminandes short, four attributed Blender trailers/teasers, two original silent ambient studies and an original stadium animation. Sessions are tab-scoped, chat retains 100 entries and rooms expire after seven days. Audio starts muted; browser autoplay may require a tap. Single-instance SQLite is deliberate for a small-room project, not a large streaming platform.

## Design choices

Near-black glass, blue slate, soft copper and periwinkle light give Neostance a coherent palette. Montserrat anchors the wordmark and display hierarchy; Manrope handles controls and conversation. Bold sans-serif titles and larger labels keep the interface consistent. Motion explains state: readiness turns seats green, countdowns share one clock, reactions rise from the screen. Decorative motion can be paused and respects reduced-motion preferences. More detail is in `docs/NEOSTANCE_DESIGN.md`.

## Credits

Application source is MIT licensed. Bundled films and fonts retain their original licenses in `CREDITS.md` and `public/fonts`. Describe your own work and any assistance accurately when presenting the project.
