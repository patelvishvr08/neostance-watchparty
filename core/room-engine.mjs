import { catalog } from "./catalog.mjs";

export class PartyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new PartyError(message, status);
};
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(6)),
    (n) => alphabet[n % alphabet.length],
  ).join("");
const secret = () => `${crypto.randomUUID()}${crypto.randomUUID()}`;
const hash = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const clean = (value, max = 80) =>
  typeof value === "string"
    ? value
        .trim()
        .replace(/[\u0000-\u001f]/g, "")
        .slice(0, max)
    : "";
const finite = (value, min = 0, max = 86400) => {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail("That playback value is not valid.");
  return value;
};
export const positionAt = (playback, now) =>
  Math.max(
    0,
    playback.position +
      (playback.playing ? Math.max(0, now - playback.updatedAt) / 1000 : 0),
  );
export const correctedPosition = (playback, serverNow, duration = Infinity) =>
  Math.min(positionAt(playback, serverNow), duration || Infinity);
export function driftCorrection(current, expected) {
  const drift = expected - current;
  return Math.abs(drift) > 0.25
    ? { seek: expected, rate: 1, drift }
    : {
        seek: null,
        rate: Math.abs(drift) > 0.08 ? (drift > 0 ? 1.03 : 0.97) : 1,
        drift,
      };
}
function makeMember(name, tokenHash, now) {
  return {
    id: crypto.randomUUID(),
    name: clean(name, 28) || "Movie friend",
    tokenHash,
    joinedAt: now,
    lastSeen: now,
    ready: false,
  };
}
function activeMembers(room, now) {
  return room.members.filter((m) => now - m.lastSeen < 30000);
}
function system(room, text, now) {
  room.messages.push({ id: crypto.randomUUID(), text, system: true, at: now });
  room.messages = room.messages.slice(-100);
}
function maintainHost(room, now) {
  const active = activeMembers(room, now);
  if (!active.some((m) => m.id === room.hostId) && active.length) {
    room.hostId = active[0].id;
    system(room, `${active[0].name} is now the host.`, now);
  }
}
export function publicRoom(room, memberId, now = Date.now()) {
  // Existing rooms keep working after bundled media is re-encoded or relocated.
  const currentMedia = (film) => catalog.find((entry) => entry.id === film.id) || film;
  return {
    code: room.code,
    title: room.title,
    hostId: room.hostId,
    memberId,
    createdAt: room.createdAt,
    revision: room.revision,
    closed: room.closed,
    settings: room.settings,
    playback: { ...room.playback, media: currentMedia(room.playback.media) },
    queue: room.queue.map(currentMedia),
    messages: room.messages,
    reactions: room.reactions.filter((r) => now - r.at < 7000),
    poll: room.poll,
    members: room.members.map(({ tokenHash, ...member }) => ({
      ...member,
      online: now - member.lastSeen < 30000,
    })),
    serverNow: now,
  };
}

// The only place that changes room state. All clients go through this reducer.
// Storage adapters apply it with compare-and-swap, so concurrent actions retry.
export function reduceRoom(room, memberId, action, now = Date.now()) {
  const member = room.members.find((m) => m.id === memberId);
  if (!member) fail("Your seat is no longer in this room. Join again.", 403);
  if (room.closed) fail("This room has ended. Start a new night.", 410);
  member.lastSeen = now;
  maintainHost(room, now);
  const host = () => {
    if (room.hostId !== memberId) fail("Only the host can do that.", 403);
  };
  const control = () => {
    if (room.settings.hostOnly) host();
  };
  if (action.type !== "heartbeat" && now - (member.lastAction || 0) < 60)
    fail("One moment — try that again.", 429);
  if (action.type !== "heartbeat") member.lastAction = now;
  switch (action.type) {
    case "heartbeat":
      break;
    case "ready":
      if (room.playback.playing)
        fail("Pause the room before changing your ready status.", 409);
      if (typeof action.ready !== "boolean") fail("Choose your ready status.");
      member.ready = action.ready;
      break;
    case "countdown": {
      host();
      if (room.playback.playing) fail("The room is already starting or playing.", 409);
      if (activeMembers(room, now).some((m) => !m.ready))
        fail("Wait for everyone online to mark themselves ready.", 409);
      room.playback = {
        ...room.playback,
        position: positionAt(room.playback, now),
        playing: true,
        updatedAt: now + 5000,
        changedBy: memberId,
      };
      system(room, "Lights down. Your shared screen starts in five seconds.", now);
      break;
    }
    case "playback": {
      control();
      if (action.mediaId !== room.playback.media.id)
        fail("The video changed. Your room is catching up.", 409);
      const position = finite(action.position);
      if (typeof action.playing !== "boolean")
        fail("Choose play or pause for the room.");
      room.playback = {
        ...room.playback,
        position,
        playing: !!action.playing,
        updatedAt: now,
        changedBy: memberId,
      };
      break;
    }
    case "select": {
      control();
      const film =
        room.queue.find((f) => f.id === action.id) ||
        catalog.find((f) => f.id === action.id);
      if (!film) fail("Choose a video from Discover or your queue.");
      room.playback = {
        media: film,
        position: 0,
        playing: false,
        updatedAt: now,
        changedBy: memberId,
      };
      room.members.forEach((m) => { m.ready = false; });
      system(room, `${member.name} put on ${film.title}.`, now);
      break;
    }
    case "message": {
      const text = clean(action.text, 500);
      if (!text) fail("Write a message first.");
      room.messages.push({
        id: crypto.randomUUID(),
        memberId,
        name: member.name,
        text,
        at: now,
        position: positionAt(room.playback, now),
      });
      room.messages = room.messages.slice(-100);
      break;
    }
    case "reaction": {
      if (!["❤️", "😂", "🔥", "👏", "🤯", "🍿"].includes(action.emoji))
        fail("Choose a reaction from the reaction bar.");
      room.reactions = [
        ...room.reactions.filter((r) => now - r.at < 7000),
        {
          id: crypto.randomUUID(),
          memberId,
          name: member.name,
          emoji: action.emoji,
          at: now,
        },
      ].slice(-30);
      break;
    }
    case "queue-add": {
      const existing = catalog.find((f) => f.id === action.id);
      let film = existing;
      if (!film) {
        const title = clean(action.title, 80);
        let url;
        try {
          url = new URL(action.src);
        } catch {
          fail("Paste a complete HTTPS MP4 or WebM URL.");
        }
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.href.length > 1500
        )
          fail("Use an HTTPS link without embedded credentials.");
        if (!title) fail("Give your video a title.");
        film = {
          id: crypto.randomUUID(),
          title,
          src: url.href,
          category: "Your video",
          poster: "",
          color: "#bb875b",
          description:
            "Added by your room. The video plays directly from its source.",
          credit:
            "Shared by a participant. Use content you have permission to share.",
          duration: "Video",
          year: new Date(now).getFullYear(),
          tags: [],
        };
      }
      if (room.queue.some((f) => f.id === film.id || f.src === film.src))
        fail("That video is already in your queue.");
      if (room.queue.length >= 30)
        fail("Your queue is full. Remove a video first.");
      room.queue.push({ ...film, addedBy: member.name });
      break;
    }
    case "queue-remove":
      control();
      room.queue = room.queue.filter((f) => f.id !== action.id);
      break;
    case "queue-move": {
      control();
      const index = room.queue.findIndex((f) => f.id === action.id);
      const target = Math.min(
        room.queue.length - 1,
        Math.max(0, index + (action.direction === "up" ? -1 : 1)),
      );
      if (index >= 0)
        [room.queue[index], room.queue[target]] = [
          room.queue[target],
          room.queue[index],
        ];
      break;
    }
    case "poll-create": {
      host();
      const question = clean(action.question, 100);
      const options = Array.isArray(action.options)
        ? [
            ...new Set(action.options.map((o) => clean(o, 60)).filter(Boolean)),
          ].slice(0, 4)
        : [];
      if (!question || options.length < 2)
        fail("Add a question and at least two different options.");
      room.poll = {
        id: crypto.randomUUID(),
        question,
        options,
        votes: {},
        closed: false,
        at: now,
      };
      system(room, `${member.name} started a poll. Have your say.`, now);
      break;
    }
    case "vote": {
      if (!room.poll || room.poll.closed) fail("There is no open poll.");
      if (
        !Number.isInteger(action.option) ||
        action.option < 0 ||
        action.option >= room.poll.options.length
      )
        fail("Choose one of the poll options.");
      room.poll.votes[memberId] = action.option;
      break;
    }
    case "poll-close":
      host();
      if (room.poll) room.poll.closed = true;
      break;
    case "settings": {
      host();
      if (typeof action.hostOnly === "boolean")
        room.settings.hostOnly = action.hostOnly;
      if (typeof action.locked === "boolean")
        room.settings.locked = action.locked;
      if (clean(action.title, 60)) room.title = clean(action.title, 60);
      break;
    }
    case "rename":
      member.name = clean(action.name, 28) || member.name;
      break;
    case "transfer": {
      host();
      const target = activeMembers(room, now).find((m) => m.id === action.id);
      if (!target) fail("That friend needs to reconnect before becoming host.");
      room.hostId = target.id;
      system(room, `${target.name} is now the host.`, now);
      break;
    }
    case "kick": {
      host();
      if (action.id === memberId) fail("Use Leave room to leave your seat.");
      room.members = room.members.filter((m) => m.id !== action.id);
      if (room.poll) delete room.poll.votes[action.id];
      break;
    }
    case "leave": {
      room.members = room.members.filter((m) => m.id !== memberId);
      maintainHost(room, now);
      system(room, `${member.name} left the room.`, now);
      break;
    }
    case "close":
      host();
      room.closed = true;
      system(room, "The host ended this night. See you at the next one.", now);
      break;
    default:
      fail("That action is not supported.");
  }
  room.updatedAt = now;
  return room;
}

export async function mutate(store, roomCode, reducer) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const room = await store.get(roomCode);
    if (!room || Date.now() - room.createdAt > 7 * 86400000)
      fail("That room was not found or has expired.", 404);
    const previousRevision = room.revision;
    reducer(room);
    room.revision = previousRevision + 1;
    if (await store.compareAndSwap(room.code, previousRevision, room))
      return room;
    await new Promise((resolve) => setTimeout(resolve, 5 + Math.random() * 15));
  }
  fail("The room is busy. Please try once more.", 409);
}

const response = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function handlePartyRequest(request, store, options = {}) {
  try {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204 });
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin)
        fail("Open this room on its own website.", 403);
      const text = await request.text();
      if (text.length > 8192) fail("That request is too large.", 413);
      let action;
      try {
        action = JSON.parse(text);
      } catch {
        fail("The request could not be read.");
      }
      if (!action || typeof action !== "object") fail("Choose an action.");
      if (action.type === "create") {
        const token = secret(),
          now = Date.now(),
          member = makeMember(action.name, await hash(token), now);
        const media =
          catalog.find((f) => f.id === action.mediaId) || catalog[0];
        for (let attempt = 0; attempt < 6; attempt++) {
          const room = {
            code: code(),
            title: clean(action.title, 60) || `${member.name}’s movie night`,
            hostId: member.id,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            closed: false,
            settings: { hostOnly: true, locked: false },
            members: [member],
            playback: {
              media,
              position: 0,
              playing: false,
              updatedAt: now,
              changedBy: member.id,
            },
            queue: [media],
            messages: [],
            reactions: [],
            poll: null,
          };
          system(
            room,
            "Your room, your people. Invite a friend to get the night started.",
            now,
          );
          if (await store.create(room))
            return response({ room: publicRoom(room, member.id), token }, 201);
        }
        fail("We could not reserve a room code. Please try again.", 503);
      }
      const roomCode = clean(
        action.code || url.searchParams.get("room"),
        6,
      ).toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(roomCode))
        fail("Enter the six-character room code.");
      if (action.type === "join") {
        const token = secret(),
          now = Date.now(),
          member = makeMember(action.name, await hash(token), now);
        const room = await mutate(store, roomCode, (room) => {
          if (room.closed) fail("This movie night has ended.", 410);
          if (room.settings.locked)
            fail("This room is locked. Ask the host to unlock it.", 403);
          // Keep active members and recent sessions, but never accumulate forever.
          room.members = room.members.filter(
            (m) => now - m.lastSeen < 24 * 3600000,
          );
          if (room.members.length >= 50)
            fail("This room has reached its 50-seat limit.", 409);
          room.members.push(member);
          maintainHost(room, now);
          system(room, `${member.name} joined the room.`, now);
        });
        return response({ room: publicRoom(room, member.id), token });
      }
      const tokenHash = await hash(
        request.headers.get("authorization")?.replace(/^Bearer /, "") || "",
      );
      let memberId;
      const room = await mutate(store, roomCode, (room) => {
        const member = room.members.find((m) => m.tokenHash === tokenHash);
        if (!member)
          fail("Your session has expired. Join the room again.", 403);
        memberId = member.id;
        reduceRoom(room, memberId, action);
      });
      return response({ room: publicRoom(room, memberId) });
    }
    if (request.method !== "GET") fail("That method is not supported.", 405);
    const roomCode = clean(url.searchParams.get("room"), 6).toUpperCase();
    const tokenHash = await hash(
      request.headers.get("authorization")?.replace(/^Bearer /, "") || "",
    );
    const read = async () => {
      const room = await store.get(roomCode);
      if (!room || Date.now() - room.createdAt > 7 * 86400000)
        fail("That room was not found or has expired.", 404);
      const member = room.members.find((m) => m.tokenHash === tokenHash);
      if (!member)
        fail("Your session has expired or the host removed your seat.", 403);
      return publicRoom(room, member.id);
    };
    const first = await read();
    if (url.searchParams.get("stream") !== "1")
      return response({ room: first });
    const encoder = new TextEncoder();
    let cancelled = false,
      unsubscribe;
    const stream = new ReadableStream({
      start(controller) {
        let revision = -1,
          wake;
        if (store.subscribe)
          unsubscribe = store.subscribe(roomCode, () => wake?.());
        const send = (room) => {
          if (cancelled) return;
          controller.enqueue(
            encoder.encode(`event: room\ndata: ${JSON.stringify(room)}\n\n`),
          );
          revision = room.revision;
        };
        send(first);
        const began = Date.now();
        (async () => {
          try {
            while (!cancelled && Date.now() - began < 55000) {
              await new Promise((resolve) => {
                const timer = setTimeout(resolve, options.pollMs || 125);
                wake = () => {
                  clearTimeout(timer);
                  resolve();
                };
              });
              if (cancelled) break;
              const room = await read();
              if (room.revision !== revision) send(room);
            }
          } catch (error) {
            if (!cancelled)
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : "Please reconnect.", status: error instanceof PartyError ? error.status : 503 })}\n\n`,
                ),
              );
          } finally {
            unsubscribe?.();
            if (!cancelled) {
              cancelled = true;
              controller.close();
            }
          }
        })();
      },
      cancel() {
        cancelled = true;
        unsubscribe?.();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof PartyError)
      return response({ error: error.message }, error.status);
    console.error(
      "Room service:",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return response(
      {
        error:
          "The room service is taking a break. Please reconnect in a moment.",
      },
      503,
    );
  }
}
