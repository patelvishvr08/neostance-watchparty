import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { LocalStore } from "../core/local-store.mjs";
import { catalog } from "../core/catalog.mjs";
import { createLocalServer } from "../scripts/local-server.mjs";

test("standalone server accepts HTTPS proxy origins and serves health, UI and seekable media", async (t) => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  const store = new LocalStore();
  const { server } = createLocalServer({ store });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    store.close();
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  assert.match(await (await fetch(base)).text(), /<html/);
  const identity = await fetch(`${base}/api/identity`, { headers: { "oai-authenticated-user-id": "spoofed", "oai-authenticated-user-email": "spoofed@example.com" } });
  assert.match(identity.headers.get("cache-control"), /no-store/);
  assert.deepEqual(await identity.json(), { available: false, user: null });
  assert.match((await fetch(`${base}/still/Still_UIUX_Case_Study.pdf`, { method: "HEAD" })).headers.get("content-type"), /application\/pdf/);
  for (const film of catalog) {
    const source = await fetch(`${base}${film.src}`, { headers: { Range: "bytes=10-109" } });
    assert.equal(source.status, 206, film.id);
    assert.match(source.headers.get('content-type'), /video\/mp4/);
    assert.equal((await source.arrayBuffer()).byteLength, 100, film.id);
  }
  const make = await fetch(`${base}/api/party`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: base.replace("http:", "https:"), "x-forwarded-proto": "https" },
    body: JSON.stringify({ type: "create", name: "Proxy demo" }),
  });
  assert.equal(make.status, 201, await make.text());
  const blocked = await fetch(`${base}/api/party`, {
    method: "POST",
    headers: { "content-type": "application/json", Origin: "https://unrelated.example", "x-forwarded-proto": "https" },
    body: JSON.stringify({ type: "create", name: "Other origin" }),
  });
  assert.equal(blocked.status, 403);
});
