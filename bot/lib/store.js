/**
 * Tiny JSON persistence layer.
 *
 * The bot previously wrote user_stats.json on every single command via an
 * ad-hoc saveUserStats(). With trades and moderation logs on top that becomes a
 * lot of synchronous disk writes, so everything goes through here instead.
 *
 * Writes are debounced and atomic (temp file + rename) so a crash mid-write
 * cannot leave a truncated JSON file that breaks the bot on next boot.
 */
import fs from 'fs';
import path from 'path';

const pending = new Map();
const timers = new Map();

/** Read a JSON file, returning `fallback` when it is missing or corrupt. */
export function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return parsed ?? fallback;
  } catch (err) {
    console.error(`[store] ${path.basename(file)} is unreadable, starting fresh:`, err.message);
    return fallback;
  }
}

/** Queue a debounced atomic write. Repeated calls inside `waitMs` collapse. */
export function writeJson(file, data, waitMs = 1500) {
  pending.set(file, data);
  if (timers.has(file)) return;

  timers.set(
    file,
    setTimeout(() => {
      timers.delete(file);
      const payload = pending.get(file);
      pending.delete(file);
      if (payload === undefined) return;

      try {
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
        fs.renameSync(tmp, file); // atomic on the same filesystem
      } catch (err) {
        console.error(`[store] failed to write ${path.basename(file)}:`, err.message);
      }
    }, waitMs)
  );
}

/** Force any queued writes to disk immediately (used on shutdown). */
export function flushAll() {
  for (const [, timer] of timers) clearTimeout(timer);
  timers.clear();

  for (const [file, payload] of pending) {
    try {
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf-8');
      fs.renameSync(tmp, file);
    } catch (err) {
      console.error(`[store] failed to flush ${path.basename(file)}:`, err.message);
    }
  }
  pending.clear();
}
