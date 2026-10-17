# Verification record

## Implemented and checked automatically

- TypeScript compilation and both production clients: passed at delivery (see build output).
- 20 automated tests: ten-user concurrent membership/messages; host controls; shared controls; invalid sessions; cross-origin writes; secret omission; lock/unlock; direct URL validation; stale video commands; concurrent polls; vote replacement; host transfer; kicking; leave; host absence; late-join snapshots; database restart; closed rooms; fuzzy search; controller math; bounded chat.
- Two ten-client HTTP/SSE runs, 30 control events and 300 deliveries per run.
- Reconnect snapshot restored final committed state.
- Byte-range video response returned exactly the requested bytes.
- Bundled video files decode in ffmpeg; posters were inspected.
- Source package excludes credentials, runtime room databases, dependencies and local tool state.

The exact benchmark environment, date, Node version and output are in `benchmark-results.json`. Recorded local push p95: 11.61 ms; recorded polling-adapter p95: 139.42 ms. A rerun can legitimately produce different numbers.

Ready-check gates, host-only scheduled starts, cancellation, inherited countdown timestamps for late joiners and readiness reset after a media change are checked by two additional integration tests.

## Hosted HTTP checks (previous version; new version checked separately)

The deployed private Site passed HTTP checks for homepage HTML, bundled media and fonts, source ZIP availability, D1-backed room creation/joining, guest playback denial, authoritative guest snapshots and the initial SSE state. The temporary test room was ended afterward. This is API verification, not browser rendering. The hosting gateway returned status 200 with the full video for a Range request; the local Node server independently passed its 206 byte-range test. Hosted seeking may need the video to buffer.

## Not claimed as verified

No browser-control skill was available in the managed build environment. No alternative browser automation was started. Therefore the rendered interface, physical video playback, autoplay permissions, real-device drift and ten-device LAN latency have not been directly observed here. A controller unit simulation is not a video-element test. The loopback benchmark is not hosted-cloud latency.

`DEMO_AND_TESTING.md` contains the remaining manual acceptance procedure. The implementation targets the brief, but ≤500 ms decoded playback drift and ≤250 ms p95 control delivery on the user's actual network must be measured there.

## Known product boundaries

- Direct MP4/WebM sources only; no subscription-provider or YouTube integration.
- Default catalogue: two open-movie trailers plus two original silent ambient motion studies. It is not a commercial movie streaming library.
- 50 member records per room; chat retains the most recent 100 entries; rooms expire after seven days.
- Session identity is tab-scoped, not permanent account authentication. Server checks membership secrets and host role.
- The hosted preview is owner-private until its audience is explicitly changed. Room invitations do not grant platform access.
- Cloud SSE reads D1 every 125 ms per open stream. Suitable for a small prototype, not a claim of large-scale efficiency.
- Network buffering, suspended/background tabs, media decoding and autoplay restrictions can affect real playback. Recovery resynchronizes to the current server state.

The standalone deployment smoke test also passed: health endpoint, prebuilt HTML, exact byte ranges, accepted HTTPS proxy origin and rejected unrelated origin. Docker image execution remains unverified because no Docker daemon is available.

Interface revision 1.2: TypeScript and local/hosted production builds checked. Two additional business-rule tests cover ranked multi-word/typo search and preference-based recommendations with exclusions. The new browser CacheStorage, hover-video/audio, opening and responsive layout remain manual browser acceptance checks; these are not misrepresented as protocol test coverage. The bundled stadium MP4 was rendered locally and decoded successfully.

Neostance 2.0 adds four regression checks: pending-seek/buffer safety, restart after end, compatible/fast-start container configuration for every bundled MP4, and canonical media paths for existing rooms. The standalone HTTP smoke test requests byte ranges for every catalogue video. `media-audit.json` records full decode and stream details for all five clips. Browser rendering and actual device playback remain unobserved here.
