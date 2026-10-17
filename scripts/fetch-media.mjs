// The small source download keeps videos separate. Verify every downloaded byte.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://afterhours-watchparty-vishv.yogita18892009patel.chatgpt.site";
const manifest = JSON.parse(await readFile(resolve(root, "core/media-manifest.json"), "utf8"));
for (const { path, sha256 } of manifest) {
  if (!/^\/media\/neo-[a-z]+\.mp4$/.test(path)) throw new Error("Invalid media manifest path");
  const target = resolve(root, "public", path.slice(1));
  const hash = data => createHash("sha256").update(data).digest("hex");
  try { if (hash(await readFile(target)) === sha256) { console.log(`Already present: ${path}`); continue; } } catch { /* Download below. */ }
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Download failed for ${path}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (hash(bytes) !== sha256) throw new Error(`Checksum mismatch for ${path}; no file written`);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  console.log(`Restored ${path} (${(bytes.length / 1048576).toFixed(1)} MiB)`);
}
console.log("Media ready. Next: npm install, then npm run build:local.");
