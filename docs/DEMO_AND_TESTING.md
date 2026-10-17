# Club demonstration and final device checks

## Before showing it

Run `Start-Neostance.bat` and open http://localhost:3000. Read `README.md`. Personalize the default room name, one piece of interface copy and a color choice you can explain. Keep the source open in your editor.

For a second identity, use a different browser/private session or another device, rather than duplicating the host tab (some browsers duplicate session storage). For phones, open the printed LAN address while on the same Wi-Fi/hotspot. Keep the host computer awake.

## A 90-second demonstration

1. Show Discover. Search **sintal** to demonstrate typo tolerance; clear search and filter Ambient. Bookmark a title.
2. Create a room as Vishv. Invite a second browser/device by code. Keep both screens visible.
3. Mark both participants ready. Start together and show the five-second countdown. Play Sintel, pause and seek. Show that the second client follows. Unmute locally to explain that audio preferences are independent.
4. Add Big Buck Bunny from the guest. Reorder it as host, send chat from the guest, and trigger a reaction.
5. Start a poll as host; vote from both clients. Change a vote to demonstrate one active vote per person.
6. Lock the room and attempt a new join. Unlock it; pass hosting to the other participant. The original host should lose privileged controls.
7. Briefly disconnect a guest and reconnect; show current state restoration.
8. Show the recorded test conditions and explain the boundary between measured results and physical-device tests.

## The honest pitch

“Neostance is a small watch-party app. I wanted the experience to feel like inviting friends over, so I used warm colors, quiet motion and a simple room layout. The important part is the shared playback timeline: the server stores one authoritative position and time, and every client follows it. I chose React, ordinary HTTP and SQLite to keep the implementation understandable. I can show you how room permissions, reconnects and concurrent updates work.”

Describe your own contributions and the assistance you used accurately. The most useful preparation is being able to explain and change the code live.

## Questions to be ready for

**Why SSE rather than Socket.IO?** Server updates only need a one-way stream. Client actions are small POST requests. Using those familiar HTTP mechanisms avoids another runtime service while still allowing live interaction. SSE does not replace the application's state and permission logic.

**How does a late joiner know the current time?** It receives the saved position, playing flag and server timestamp, estimates elapsed time, and seeks its video to that position.

**What happens if two people press controls?** The database revision serializes commits. A stale state write retries. The latest valid committed playback command becomes the shared state.

**Can a guest change host-only controls through developer tools?** The server checks permissions; hiding or enabling a button does not grant authority.

**What happens if the host leaves?** An explicit leave transfers to an active member. For an unplanned disconnect, a heartbeat/action detects the host's 30-second absence and transfers to the oldest active participant. It is not an instant network-disconnect detector.

**Does it support Netflix or YouTube?** This version supports direct playable MP4/WebM sources, including bundled open trailers. DRM and iframe-platform integrations are outside the implemented scope.

**How is chat stored?** In the same room record as the lineup and poll, with a bounded history of 100 messages. State is shared with room participants. Membership secrets are never returned in public room state.

**What would you improve next?** Measure playback on real devices, introduce targeted event payloads instead of whole-room snapshots, add cleanup scheduling to the cloud database and replace polling for larger scale. Choose one improvement you can explain.

## Physical-device acceptance checklist — still to run

- [ ] Open the app on desktop and phone; inspect widths around 360, 768 and 1440 pixels, including dialogs, long room titles and chat messages.
- [ ] Use keyboard-only navigation: create/join, dialog focus, Escape to close, chat, and player shortcuts.
- [ ] Confirm each bundled clip loads, plays, pauses and seeks in the browsers used for the demo. Check audio after unmuting.
- [ ] Connect at least ten independent clients on the same network and record their device/browser versions.
- [ ] Measure control propagation for at least 30 play/pause/seek events on that LAN; calculate p95. The brief asks for ≤250 ms.
- [ ] Measure actual video positions using the browser consoles or frame/timer recording; after correction the brief asks for ≤500 ms drift. `currentTime` is not the same as physical display latency.
- [ ] Join midway through playback and confirm the new browser reaches the same position.
- [ ] Turn off a guest's network for 10–15 seconds, restore it, and confirm room/chat/queue state returns without duplicate participants.
- [ ] Disconnect the host for over 30 seconds while a guest remains active, and check transfer on a subsequent heartbeat/action.
- [ ] Test simultaneous controls with shared playback enabled and explain the last-committed-action policy.
- [ ] Lock, transfer, remove and end a test room. Recheck the removed participant's old session is denied.
- [ ] Try a broken video URL and inspect the retry/error state.
- [ ] Test reduced-motion preference and fullscreen. On local HTTP, manually copy the link if the clipboard API is blocked.

## Repeat the automated checks

```sh
npm run typecheck
npm test
npm run build:local
npm run test:realtime
```

The benchmark opens a temporary HTTP server on 127.0.0.1, creates ten real protocol clients, sends 30 playback events and records 300 deliveries. It also checks reconnect snapshots and video byte-range serving. The polling variant removes local push notifications to exercise the 125 ms observation path. It still uses local SQLite, not hosted D1.

To test an actual LAN, run the app normally and build a separate benchmark that points at the host's LAN address and runs clients on other devices. Do not relabel loopback numbers as LAN or internet results.

## Updated personal-library walkthrough

- Open Search in the navigation (or press `/`). Try `calm space`, `relaxing ocean`, `football`, `2026` and `sintal`.
- Hover a card, or press its Details button on touch/keyboard. Its preview begins muted; use the speaker control to unmute the Blender trailers. The original motion studies are silent.
- Bookmark a title; favourite another; inspect Watch later and Favourites. Preferences belong to the current browser.
- Choose Not interested and confirm it disappears from Discover/suggestions. Restore hidden stories using the library control.
- Choose Save offline, wait for the completed notification, then open Downloads and play the cached copy. This requires HTTPS or localhost and available browser storage. Reloaded room/chat features still need the server; the app is not an installed offline PWA.
- Confirm the one-time intro is skippable and absent for invite links, reduced-motion and data-saving settings. Pause the page background with its control.
- Check phone previews and dialogs for scrolling, close controls and focus visibility. Browser rendering, hover video playback and CacheStorage were not directly observed in this managed build environment.
