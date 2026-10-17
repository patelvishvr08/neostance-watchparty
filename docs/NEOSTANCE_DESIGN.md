# Neostance - implementation and design

## Identity and hierarchy

A large Montserrat wordmark anchors the hero, with a custom N monogram used in the sidebar and favicon. Manrope handles controls and conversation. Featured screenings are actual entries from the shared-room catalogue: selecting a hero scene changes its poster/video and the film used by the hero's Create a room action. The small catalogue includes one complete Blender short, four attributed trailers/teasers and three labelled original motion studies; it does not pretend to be a commercial film library.

The palette is near-black #080A10, blue-black glass #151C2B, raised slate #202738, off-white #F5F5FA, soft copper #EDCCA4 and restrained periwinkle light #8DA6FF. Contrast and readable controls take priority over decorative details. The subtle player glow is visual styling, not a claim of AI processing.

## Layout

- Persistent navigation and a rounded Google-style search field. The field opens ranked results for titles, genres, years and multi-word moods; `/` also opens search.
- The featured hero leads into a poster grid, personal library shelves and preference-based recommendations.
- Create/Join cards share a visual language with the entry dialog's mode selector.
- The room pairs a wide 16:9 screen with a sticky conversation panel on desktop. Tablet and phone layouts stack the panels and enlarge touch controls.
- The background video layer sits outside the lobby/room conditional. Collection and room views therefore keep the same ambient environment; the source follows the selected screening.

## Motion

`core/motion.ts` samples a damped spring: stiffness 190, damping 24, mass 1, 48 keyframes across 850 ms. Room entry and collection changes use native Web Animations, then cancel the animation's fill so persistent transforms do not interfere with fixed mobile previews. No additional animation library is required.

Room cards use a short lift/scale and a restrained overshooting hover curve. Dialogs use a short reveal; poster previews lift above the grid. Scroll reveals use IntersectionObserver. Decorative media pauses in hidden tabs. Reduced-motion and data-saving preferences suppress autoplay decoration, and the background can be paused manually. The optional opening is skippable and does not block invite-link entry.

## Playback

All eight bundled videos are H264 High profile, yuv420p and fast-start MP4s. The five Blender selections also contain AAC audio; original motion studies are intentionally silent. The media audit fully decodes each local file and records codecs in `media-audit.json`.

Shared playback still belongs to the server timeline. Client correction avoids repeatedly seeking while a seek, scrub or initial buffer is pending. A short correction cooldown prevents repeated seeks from starving playback. Pressing Play after the end resets the shared position to zero. Timeouts, an autoplay gesture prompt, buffering recovery, retry, source inspection and alternative-screening controls are included.

Existing rooms resolve bundled IDs to current cache-safe media URLs; custom direct HTTPS sources retain their own URLs. External source compatibility depends on that source and the participant's browser.

## Source map

| File | Responsibility |
|---|---|
| app/page.tsx | Room state, hero, shared player and navigation |
| app/globals.css | Existing base component styles |
| app/neostance.css | Neostance tokens, typography, layouts and motion skin |
| components/cinema.tsx | Ambient video, intro and ready check |
| components/film-grid.tsx | Lifted previews and library actions |
| components/personal-library.tsx | Search, preferences, cache downloads and local playback |
| core/motion.ts | Damped-spring keyframes |
| core/playback.mjs | Buffer-aware correction and replay policy |
| core/room-engine.mjs | Server actions, permissions, timeline and legacy media resolution |
| scripts/local-server.mjs | HTTP, SQLite bridge, media ranges and health endpoint |

## Verification scope

The builds, unit/integration tests, actual HTTP range responses for every bundled video and full local media decode are checked. The managed environment has no permitted browser QA surface, so rendered layout, autoplay/audio behavior, CacheStorage and physical-device synchronization remain manual acceptance checks. A successful codec check is not a guarantee for every browser, external URL or network.

## Public access and optional identity

The hosted Site is public; reviewers can use the catalogue and create or join a room without signing in. An account control uses the platform-managed Sign in with ChatGPT flow. Google is supported through the Continue with Google option on that flow, rather than a separate Google OAuth implementation. Identity comes from the server helper, never from browser-supplied profile data. The account endpoint is dynamic and no-store. Top-level sign-in and sign-out anchors preserve a validated same-origin return path, including room invitation queries. Signed-in names prefill empty name fields; existing guest names and room tokens are preserved.

Favourites, watch later and downloads remain browser-local. The portable server returns an explicit guest-only identity response and ignores spoofed identity headers. No Google password, client secret or login token is collected by the app. A completed provider login remains a manual acceptance check.

## Submission surfaces

`public/still/index.html` embeds the existing ten-page STILL PDF and provides a direct download, without an account wall. It is a public website URL; an actual Canva design/share URL requires importing the PDF into a connected Canva account and reviewing its sharing settings. No Canva design is claimed to exist. The hosted source download omits media and generated builds to stay small; `scripts/fetch-media.mjs` restores and verifies bundled media with SHA-256 checksums. The complete downloadable submission includes all videos and a prebuilt client.
