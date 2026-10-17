import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class LocalStore {
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, revision INTEGER NOT NULL, state TEXT NOT NULL, created_at INTEGER NOT NULL);",
    );
    this.listeners = new Map();
    this.db
      .prepare("DELETE FROM rooms WHERE created_at < ?")
      .run(Date.now() - 7 * 86400000);
  }
  async get(code) {
    const row = this.db
      .prepare("SELECT state FROM rooms WHERE code = ?")
      .get(code);
    return row ? JSON.parse(row.state) : null;
  }
  async create(room) {
    const result = this.db
      .prepare(
        "INSERT OR IGNORE INTO rooms (code, revision, state, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(room.code, room.revision, JSON.stringify(room), room.createdAt);
    return result.changes === 1;
  }
  async compareAndSwap(code, revision, room) {
    const result = this.db
      .prepare(
        "UPDATE rooms SET state = ?, revision = ? WHERE code = ? AND revision = ?",
      )
      .run(JSON.stringify(room), room.revision, code, revision);
    if (result.changes !== 1) return false;
    for (const listener of this.listeners.get(code) || [])
      queueMicrotask(listener);
    return true;
  }
  subscribe(code, callback) {
    if (!this.listeners.has(code)) this.listeners.set(code, new Set());
    const set = this.listeners.get(code);
    set.add(callback);
    return () => {
      set.delete(callback);
      if (!set.size) this.listeners.delete(code);
    };
  }
  close() {
    this.db.close();
  }
}
