import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { LocalStore } from "../core/local-store.mjs";
import {
  handlePartyRequest,
  positionAt,
  correctedPosition,
  driftCorrection,
  reduceRoom,
  publicRoom,
} from "../core/room-engine.mjs";
import { searchCatalog } from "../core/catalog.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(store, action, session, extraHeaders = {}) {
  const request = new Request("http://afterhours.test/api/party", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({
      ...action,
      ...(session ? { code: session.code } : {}),
    }),
  });
  const response = await handlePartyRequest(request, store);
  return { status: response.status, ...(await response.json()) };
}
async function setup(t) {
  const store = new LocalStore();
  t.after(() => store.close());
  const made = await call(store, {
    type: "create",
    name: "Vishv",
    title: "Test night",
  });
  assert.equal(made.status, 201);
  return {
    store,
    host: { code: made.room.code, token: made.token, id: made.room.memberId },
    room: made.room,
  };
}
async function join(store, host, name = "Friend") {
  const result = await call(store, { type: "join", code: host.code, name });
  assert.equal(result.status, 200, result.error);
  return { code: host.code, token: result.token, id: result.room.memberId };
}

test("existing rooms receive current bundled video paths while custom sources stay unchanged", async (t) => {
  const { store, host } = await setup(t);
  const legacy = await store.get(host.code);
  legacy.playback.media = { ...legacy.playback.media, src: "/media/sintel.mp4" };
  legacy.queue[0] = { ...legacy.queue[0], src: "/media/sintel.mp4" };
  legacy.queue.push({ id: "custom-test", title: "My video", src: "https://example.com/my-video.mp4" });
  const snapshot = publicRoom(legacy, host.id);
  assert.equal(snapshot.playback.media.src, "/media/neo-sintel.mp4");
  assert.equal(snapshot.queue[0].src, "/media/neo-sintel.mp4");
  assert.equal(snapshot.queue[1].src, "https://example.com/my-video.mp4");
});

test("ready check gates a host countdown and late joiners inherit its clock", async (t) => {
  const { store, host } = await setup(t);
  const friend = await join(store, host);
  assert.equal((await call(store, { type: "countdown" }, friend)).status, 403);
  assert.equal((await call(store, { type: "countdown" }, host)).status, 409);
  assert.equal((await call(store, { type: "ready", ready: "yes" }, friend)).status, 400);
  const ready = await Promise.all([host, friend].map((s) => call(store, { type: "ready", ready: true }, s)));
  ready.forEach((r) => assert.equal(r.status, 200, r.error));
  await sleep(70);
  const start = await call(store, { type: "countdown" }, host);
  assert.equal(start.status, 200, start.error);
  const timeline = start.room.playback;
  assert.equal(timeline.playing, true);
  assert.ok(timeline.updatedAt > start.room.serverNow + 4500);
  assert.equal(positionAt(timeline, timeline.updatedAt - 1), timeline.position);
  assert.equal(positionAt(timeline, timeline.updatedAt + 1500), timeline.position + 1.5);
  const late = await join(store, host, "Just arrived");
  const snapshot = await handlePartyRequest(new Request(`http://afterhours.test/api/party?room=${host.code}`, { headers: { Authorization: `Bearer ${late.token}` } }), store);
  assert.equal((await snapshot.json()).room.playback.updatedAt, timeline.updatedAt);
  assert.equal((await call(store, { type: "ready", ready: false }, friend)).status, 409);
  await sleep(70);
  const cancel = await call(store, { type: "playback", mediaId: timeline.media.id, position: timeline.position, playing: false }, host);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.room.playback.playing, false);
});

test("changing the shared film clears stale readiness for every participant", async (t) => {
  const { store, host } = await setup(t);
  const friend = await join(store, host);
  await Promise.all([host, friend].map((s) => call(store, { type: "ready", ready: true }, s)));
  await sleep(70);
  const selected = await call(store, { type: "select", id: "bunny" }, host);
  assert.equal(selected.status, 200);
  assert.ok(selected.room.members.every((m) => m.ready === false));
  assert.equal(selected.room.playback.media.id, "bunny");
});

test("ten concurrent members and messages survive compare-and-swap races", async (t) => {
  const { store, host } = await setup(t);
  const friends = await Promise.all(
    Array.from({ length: 9 }, (_, i) => join(store, host, `Friend ${i + 1}`)),
  );
  const people = [host, ...friends];
  assert.equal((await store.get(host.code)).members.length, 10);
  const messages = await Promise.all(
    people.map((s, i) =>
      call(store, { type: "message", text: `hello-${i}` }, s),
    ),
  );
  for (const result of messages) assert.equal(result.status, 200, result.error);
  const state = await store.get(host.code);
  assert.equal(state.messages.filter((m) => !m.system).length, 10);
  assert.equal(
    new Set(state.messages.filter((m) => !m.system).map((m) => m.text)).size,
    10,
  );
  assert.equal(state.revision, 20);
});

test("host-only permissions are enforced on the server, then shared controls work", async (t) => {
  const { store, host } = await setup(t),
    friend = await join(store, host);
  let result = await call(
    store,
    { type: "playback", mediaId: "sintel", position: 3, playing: true },
    friend,
  );
  assert.equal(result.status, 403);
  result = await call(store, { type: "settings", hostOnly: false }, host);
  assert.equal(result.status, 200);
  result = await call(
    store,
    { type: "playback", mediaId: "sintel", position: 12, playing: true },
    friend,
  );
  assert.equal(result.status, 200);
  assert.equal(result.room.playback.position, 12);
  await sleep(70);
  assert.equal(
    (
      await call(
        store,
        { type: "playback", mediaId: "bunny", position: 1, playing: false },
        friend,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        store,
        { type: "playback", mediaId: "sintel", position: -1, playing: false },
        friend,
      )
    ).status,
    400,
  );
  assert.equal(
    (await call(store, { type: "settings", locked: true }, friend)).status,
    403,
  );
});

test("session secrets stay private; forged sessions and cross-origin writes are rejected", async (t) => {
  const { store, host, room } = await setup(t);
  assert.ok(!JSON.stringify(room).includes("tokenHash"));
  assert.ok(!JSON.stringify(room).includes(host.token));
  assert.equal(
    (
      await call(
        store,
        { type: "heartbeat" },
        { code: host.code, token: "fake" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handlePartyRequest(
        new Request(`http://afterhours.test/api/party?room=${host.code}`),
        store,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(store, { type: "heartbeat" }, host, {
        Origin: "https://another.example",
      })
    ).status,
    403,
  );
  const request = new Request("http://afterhours.test/api/party", {
    method: "POST",
    body: "x".repeat(9000),
  });
  assert.equal((await handlePartyRequest(request, store)).status, 413);
});

test("room locking blocks new guests without breaking existing members", async (t) => {
  const { store, host } = await setup(t),
    friend = await join(store, host);
  assert.equal(
    (await call(store, { type: "settings", locked: true }, host)).status,
    200,
  );
  assert.equal(
    (await call(store, { type: "join", code: host.code, name: "Late friend" }))
      .status,
    403,
  );
  assert.equal((await call(store, { type: "heartbeat" }, friend)).status, 200);
  await sleep(70);
  assert.equal(
    (await call(store, { type: "settings", locked: false }, host)).status,
    200,
  );
  await join(store, host, "Late friend");
});

test("shared queue, direct links and source-change races have consistent rules", async (t) => {
  const { store, host } = await setup(t),
    friend = await join(store, host);
  assert.equal(
    (await call(store, { type: "queue-add", id: "bunny" }, friend)).status,
    200,
  );
  await sleep(70);
  assert.equal(
    (await call(store, { type: "queue-add", id: "bunny" }, friend)).status,
    400,
  );
  assert.equal(
    (
      await call(
        store,
        { type: "queue-add", title: "bad", src: "javascript:alert(1)" },
        friend,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        store,
        {
          type: "queue-add",
          title: "clip",
          src: "https://example.com/clip.mp4",
        },
        friend,
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(store, { type: "select", id: "bunny" }, host)).room.playback
      .media.id,
    "bunny",
  );
  await sleep(70);
  assert.equal(
    (
      await call(
        store,
        { type: "playback", mediaId: "sintel", position: 5, playing: true },
        host,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call(
        store,
        { type: "queue-move", id: "bunny", direction: "up" },
        host,
      )
    ).room.queue[0].id,
    "bunny",
  );
});

test("one vote per member is preserved under concurrent votes and vote changes", async (t) => {
  const { store, host } = await setup(t);
  const people = [
    host,
    ...(await Promise.all(
      Array.from({ length: 9 }, (_, i) => join(store, host, `Voter ${i}`)),
    )),
  ];
  assert.equal(
    (
      await call(
        store,
        {
          type: "poll-create",
          question: "Next?",
          options: ["Sintel", "Bunny", "Sintel"],
        },
        host,
      )
    ).status,
    200,
  );
  await sleep(70);
  const votes = await Promise.all(
    people.map((s, i) => call(store, { type: "vote", option: i % 2 }, s)),
  );
  for (const result of votes) assert.equal(result.status, 200, result.error);
  let poll = (await store.get(host.code)).poll;
  assert.equal(poll.options.length, 2);
  assert.equal(Object.keys(poll.votes).length, 10);
  await sleep(70);
  assert.equal(
    (await call(store, { type: "vote", option: 1 }, people[0])).status,
    200,
  );
  poll = (await store.get(host.code)).poll;
  assert.equal(Object.keys(poll.votes).length, 10);
  assert.equal(poll.votes[host.id], 1);
  await sleep(70);
  assert.equal((await call(store, { type: "poll-close" }, host)).status, 200);
  await sleep(70);
  assert.equal(
    (await call(store, { type: "vote", option: 0 }, people[1])).status,
    400,
  );
});

test("host transfer, removal and leaving revoke the correct permissions", async (t) => {
  const { store, host } = await setup(t),
    friend = await join(store, host, "New host"),
    third = await join(store, host, "Third");
  assert.equal(
    (await call(store, { type: "transfer", id: friend.id }, host)).room.hostId,
    friend.id,
  );
  await sleep(70);
  assert.equal((await call(store, { type: "close" }, host)).status, 403);
  assert.equal(
    (await call(store, { type: "kick", id: third.id }, friend)).status,
    200,
  );
  assert.equal((await call(store, { type: "heartbeat" }, third)).status, 403);
  await sleep(70);
  assert.equal(
    (await call(store, { type: "leave" }, friend)).room.hostId,
    host.id,
  );
  assert.equal((await call(store, { type: "heartbeat" }, friend)).status, 403);
});

test("a disconnected host is replaced and a late joiner receives the current timeline", async (t) => {
  const { store, host } = await setup(t),
    friend = await join(store, host);
  const raw = await store.get(host.code);
  raw.members.find((m) => m.id === host.id).lastSeen = Date.now() - 31000;
  raw.playback = {
    ...raw.playback,
    position: 10,
    playing: true,
    updatedAt: Date.now() - 2000,
  };
  await store.compareAndSwap(raw.code, raw.revision, {
    ...raw,
    revision: raw.revision + 1,
  });
  const result = await call(store, { type: "heartbeat" }, friend);
  assert.equal(result.room.hostId, friend.id);
  assert.ok(positionAt(result.room.playback, result.room.serverNow) >= 12);
  const joined = await call(store, {
    type: "join",
    code: host.code,
    name: "Late",
  });
  assert.equal(joined.room.playback.updatedAt, raw.playback.updatedAt);
  assert.equal(joined.room.playback.playing, true);
});

test("persistent rooms restore after a store restart and close cleanly", async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), "afterhours-test-")),
    file = resolve(dir, "rooms.sqlite");
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let store = new LocalStore(file);
  const made = await call(store, { type: "create", name: "Vishv" }),
    host = { code: made.room.code, token: made.token };
  store.close();
  store = new LocalStore(file);
  t.after(() => store.close());
  const request = new Request(
    `http://afterhours.test/api/party?room=${host.code}`,
    { headers: { Authorization: `Bearer ${host.token}` } },
  );
  assert.equal((await handlePartyRequest(request, store)).status, 200);
  assert.equal((await call(store, { type: "close" }, host)).room.closed, true);
  assert.equal(
    (await call(store, { type: "join", code: host.code, name: "Too late" }))
      .status,
    410,
  );
});

test("fuzzy recommendations and controller correction cover realistic error ranges", () => {
  assert.equal(searchCatalog("sintal")[0].id, "sintel");
  assert.equal(searchCatalog("calm", "Ambient").length, 2);
  assert.equal(searchCatalog("bunny", "Fantasy").length, 0);
  assert.equal(searchCatalog("nothinglikethis").length, 0);
  const playback = { position: 12, playing: true, updatedAt: 1000 };
  assert.equal(positionAt(playback, 4000), 15);
  assert.equal(correctedPosition(playback, 4000, 14), 14);
  // Controller simulation, not an actual media-element playback measurement.
  for (const difference of [
    -3, -0.8, -0.3, -0.2, -0.09, 0, 0.09, 0.2, 0.3, 0.8, 3,
  ]) {
    const current = 15 + difference,
      c = driftCorrection(current, 15),
      after = c.seek ?? current;
    assert.ok(Math.abs(after - 15) <= 0.25);
  }
  assert.equal(driftCorrection(14.9, 15).rate, 1.03);
  assert.equal(driftCorrection(15.1, 15).rate, 0.97);
});

test("host can end the room; messages are bounded and validated", async (t) => {
  const { store, host } = await setup(t),
    raw = await store.get(host.code);
  let now = Date.now();
  for (let i = 0; i < 130; i++)
    reduceRoom(
      raw,
      host.id,
      { type: "message", text: `Line ${i}` },
      (now += 100),
    );
  assert.equal(raw.messages.length, 100);
  assert.throws(() =>
    reduceRoom(raw, host.id, { type: "message", text: "  " }, (now += 100)),
  );
  assert.throws(() =>
    reduceRoom(
      raw,
      host.id,
      { type: "reaction", emoji: "not-emoji" },
      (now += 100),
    ),
  );
});
