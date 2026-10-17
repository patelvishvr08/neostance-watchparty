# Recruitment brief coverage

| Requirement | Implementation | Evidence / remaining check |
|---|---|---|
| Create/join by code or link | Six-character room codes; query-string invitations | API tests; test links on your devices |
| Shared play, pause, seek | Server-authoritative timestamped timeline | Permission and timeline tests; device playback check remains |
| Discovery/categories/filters/fuzzy search | Curated four-item catalogue, category filtering, typo-tolerant search and saved picks | Search unit test; add direct video URLs for more media |
| Emoji reactions and live chat | Shared bounded room state; floating reactions; timestamped messages | Ten-member messages test; browser animation check remains |
| Shared playlists | Add/remove/reorder/select; host-controlled selection by default | Queue and source-race tests |
| Group polls | Shared question, options and one active vote per member | Concurrent vote and vote-change tests |
| Host transfer | Explicit transfer, permissions revoked immediately; absence failover | Transfer, removal and absence tests |
| Drift detection/correction | 500 ms controller cycle; seek above 250 ms; small rate corrections | Controller tests; ≤500 ms actual video drift needs real devices |
| Late joins/reconnections/concurrent actions | Snapshot on join/reconnect; watchdog; compare-and-swap retries | State/reconnect/concurrency tests |
| At least 10 simultaneous users | 50-member limit; ten actual protocol clients tested | 300/300 deliveries per benchmark mode; ten physical devices still to test |
| p95 propagation ≤250 ms on LAN | Immediate local SSE push; shared cloud adapter uses 125 ms observation | Loopback numbers recorded, not relabelled as LAN results |
| Measurements/failure handling | Benchmark JSON; permission, stale media, removed member and closed-room handling | See VERIFICATION and DEMO_AND_TESTING |
| Creative feature | Shared ready check and server-timed five-second start | Countdown gate, late-join and readiness-reset integration tests |

All core features are implemented. Meeting a physical-device timing threshold is a measurement question, not a claim inferred from having the code.

## Interface revision 1.2

- Larger Manrope typography; rounded controls, dialogs and layered collection panels.
- Global ranked search with multi-word queries, mood aliases, typo tolerance and category/year matching.
- Hover/touch/keyboard detail cards with muted clip preview, audio toggle and library actions.
- Watch later, favourites, hidden-title restoration and transparent genre/tag recommendations.
- Browser CacheStorage downloads and blob-based local clip playback. This is not background PWA installation or permanent filesystem storage.
- Original sports motion study, skippable one-time cinematic opening and scroll reveals. Existing room playback and permission behavior is preserved.
