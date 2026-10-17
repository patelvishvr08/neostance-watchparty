// Ten actual HTTP/SSE clients. This measures event delivery, NOT video rendering.
import assert from "node:assert/strict";
import { once } from "node:events";
import { performance } from "node:perf_hooks";
import { writeFileSync, mkdirSync } from "node:fs";
import { LocalStore } from "../core/local-store.mjs";
import { createLocalServer } from "../scripts/local-server.mjs";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];

for (const mode of ["local-push", "polling-adapter"]) {
  const store = new LocalStore();
  const adapter =
    mode === "local-push"
      ? store
      : {
          get: store.get.bind(store),
          create: store.create.bind(store),
          compareAndSwap: store.compareAndSwap.bind(store),
        };
  const { server } = createLocalServer({
    store: adapter,
    pollMs: mode === "local-push" ? 1000 : 125,
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const controllers = [],
    streams = [],
    begins = new Map(),
    seen = new Set(),
    latencies = [];
  let firstEvents = 0;
  async function post(action, session) {
    const response = await fetch(`${base}/api/party`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: JSON.stringify({
        ...action,
        ...(session ? { code: session.code } : {}),
      }),
    });
    const body = await response.json();
    assert.ok(response.ok, body.error);
    return body;
  }
  try {
    const made = await post({ type: "create", name: "Vishv" }),
      host = { code: made.room.code, token: made.token };
    const friends = await Promise.all(
      Array.from({ length: 9 }, async (_, i) => {
        const result = await post({
          type: "join",
          code: host.code,
          name: `Client ${i + 2}`,
        });
        return { code: host.code, token: result.token };
      }),
    );
    const sessions = [host, ...friends];
    for (const [index, session] of sessions.entries()) {
      const controller = new AbortController();
      controllers.push(controller);
      const response = await fetch(
        `${base}/api/party?room=${session.code}&stream=1`,
        {
          headers: { Authorization: `Bearer ${session.token}` },
          signal: controller.signal,
        },
      );
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /text\/event-stream/);
      const run = (async () => {
        const reader = response.body.getReader(),
          decoder = new TextDecoder();
        let buffer = "",
          first = true;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const packets = buffer.split("\n\n");
            buffer = packets.pop() || "";
            for (const packet of packets) {
              if (!packet.startsWith("event: room")) continue;
              const room = JSON.parse(
                packet
                  .split("\n")
                  .find((l) => l.startsWith("data: "))
                  .slice(6),
              );
              if (first) {
                first = false;
                firstEvents++;
              }
              const sequence = room.playback.position,
                key = `${index}:${sequence}`;
              if (begins.has(sequence) && !seen.has(key)) {
                seen.add(key);
                latencies.push(performance.now() - begins.get(sequence));
              }
            }
          }
        } catch (error) {
          if (error.name !== "AbortError") throw error;
        }
      })();
      streams.push(run);
    }
    for (let i = 0; i < 100 && firstEvents < 10; i++) await sleep(10);
    assert.equal(
      firstEvents,
      10,
      "All ten clients must receive initial state.",
    );
    const events = 30;
    for (let sequence = 1; sequence <= events; sequence++) {
      begins.set(sequence, performance.now());
      await post(
        {
          type: "playback",
          mediaId: "sintel",
          position: sequence,
          playing: sequence % 2 === 1,
        },
        host,
      );
      await sleep(190);
    }
    for (let i = 0; i < 100 && latencies.length < events * 10; i++)
      await sleep(20);
    assert.equal(
      latencies.length,
      events * 10,
      "Every playback update must reach every client.",
    );
    latencies.sort((a, b) => a - b);
    const round = (x) => Math.round(x * 100) / 100;
    const result = {
      mode,
      clients: 10,
      events,
      deliveries: latencies.length,
      p50_ms: round(latencies[Math.ceil(latencies.length * 0.5) - 1]),
      p95_ms: round(latencies[Math.ceil(latencies.length * 0.95) - 1]),
      max_ms: round(latencies.at(-1)),
      environment:
        "Single Node.js process; SQLite; HTTP over 127.0.0.1 loopback; no artificial network delay; no browser playback",
      poll_ms: mode === "polling-adapter" ? 125 : null,
    };
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
    assert.ok(
      result.p95_ms <= 250,
      "Loopback p95 must be within the brief’s 250 ms target.",
    );
    // A disconnected client can reconnect and receives the final authoritative state.
    const fresh = await fetch(`${base}/api/party?room=${host.code}`, {
      headers: { Authorization: `Bearer ${friends[0].token}` },
    });
    assert.equal((await fresh.json()).room.playback.position, events);
    // Byte-range serving is important for actual seeking in an HTML5 video.
    const media = await fetch(`${base}/media/neo-sintel.mp4`, {
      headers: { Range: "bytes=0-99" },
    });
    assert.equal(media.status, 206);
    assert.equal((await media.arrayBuffer()).byteLength, 100);
  } finally {
    controllers.forEach((c) => c.abort());
    await Promise.allSettled(streams);
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    await sleep(20);
    store.close();
  }
}
mkdirSync(new URL("../docs/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../docs/benchmark-results.json", import.meta.url),
  JSON.stringify(
    {
      testedAt: new Date().toISOString(),
      node: process.version,
      results,
      limitations: [
        "These are ten protocol clients on loopback, not ten physical devices on a LAN.",
        "The polling adapter uses local SQLite; it does not measure Cloudflare D1 or internet latency.",
        "Video decoding, autoplay permissions and actual corrected playback drift require a browser/device test.",
      ],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS — ten-client delivery, reconnect snapshot and video byte ranges.",
);
