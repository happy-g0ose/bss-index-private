/**
 * Trade log.
 *
 * Two ways in:
 *   1. /logtrade — someone explicitly records a trade
 *   2. auto-capture — the bot watches one channel and parses plain-text offers
 *      like "2x Star Cub for 1x Bee Cub"
 *
 * Every entry keeps the values at the time of logging so historical trades are
 * still meaningful after prices move.
 *
 * NOTE ON TRUST: this is crowd-sourced data. Anything logged here is a claim
 * by a user, not a verified exchange — never feed it back into the site's
 * prices automatically.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readJson, writeJson } from './store.js';
import { resolveItem, resolveRoll } from './items.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRADES_PATH = path.join(__dirname, '..', 'trades.json');

const MAX_ENTRIES = 5000;

let trades = readJson(TRADES_PATH, []);

function persist() {
  if (trades.length > MAX_ENTRIES) trades = trades.slice(-MAX_ENTRIES);
  writeJson(TRADES_PATH, trades);
}

export function allTrades() {
  return trades;
}

export function addTrade(entry) {
  trades.push(entry);
  persist();
  return entry;
}

/**
 * Evaluate a trade and describe it in plain language.
 * Values are compared as giving-side total vs getting-side total.
 */
export function verdictFor(givingTotal, gettingTotal) {
  if (!givingTotal || !gettingTotal) {
    return { label: 'UNKNOWN', diffPct: 0, tone: 0x71717a };
  }

  const diff = ((gettingTotal - givingTotal) / givingTotal) * 100;

  if (diff > 15) return { label: 'HUGE WIN', diffPct: diff, tone: 0xa855f7 };
  if (diff > 5) return { label: 'WIN', diffPct: diff, tone: 0x3b82f6 };
  if (diff >= -5) return { label: 'FAIR', diffPct: diff, tone: 0x10b981 };
  if (diff >= -15) return { label: 'LOSS', diffPct: diff, tone: 0xf59e0b };
  return { label: 'HUGE LOSS', diffPct: diff, tone: 0xef4444 };
}

/**
 * Turn "2x Star Cub, 1x Blue And Green Marble" into valued items.
 * A leading "Nx" multiplies the item value, which matters a lot — "3x Star Cub"
 * is 3x the price of "Star Cub" and it flips the verdict.
 * Returns null if nothing could be matched.
 */
export function parseItemList(text) {
  const found = [];

  for (const chunk of String(text).split(/[,;+\n]/)) {
    const raw = chunk.replace(/^\s*[-–—]\s*/, '').trim();
    if (!raw) continue;

    const countMatch = raw.match(/^(\d+)\s*x\s*(.+)$/i);
    const qty = countMatch ? Math.min(Number(countMatch[1]) || 1, 99) : 1;
    const cleaned = countMatch ? countMatch[2].trim() : raw;
    if (!cleaned) continue;

    const push = (label, value) => {
      const numeric = Number(value) || 0;
      found.push({ label, value: numeric * qty, qty, unit: numeric });
    };

    const item = resolveItem(cleaned);
    if (item) {
      push(item.englishName, item.value);
      continue;
    }

    // "Autumn Sunhat (Max)" → beequip + roll
    const rollMatch = cleaned.match(/^(.*?)\s*\((.+?)\)$/);
    if (rollMatch) {
      const base = resolveItem(rollMatch[1].trim());
      const roll = base ? resolveRoll(base, rollMatch[2].trim()) : null;
      if (roll) push(`${roll.item.englishName} (${roll.roll.rollName})`, roll.roll.value);
    }
  }

  return found.length ? found : null;
}

/**
 * Parse a raw chat line into a trade, or return null.
 * Handles the shapes people actually type in BSS trading channels.
 */
export function parseTradeLine(line) {
  const text = String(line).trim();
  if (!text || text.length > 400) return null;

  // "A for B" / "A за B" — the separator decides direction
  const forMatch = text.match(/^(.+?)\s+(?:for|за|->|→|на)\s+(.+)$/i);
  if (!forMatch) return null;

  const giving = parseItemList(forMatch[1]);
  const getting = parseItemList(forMatch[2]);
  if (!giving || !getting) return null;

  const givingTotal = giving.reduce((s, e) => s + (e.value || 0), 0);
  const gettingTotal = getting.reduce((s, e) => s + (e.value || 0), 0);
  if (!givingTotal || !gettingTotal) return null;

  return {
    giving: giving.map(({ label, value }) => ({ label, value })),
    getting: getting.map(({ label, value }) => ({ label, value })),
    givingTotal,
    gettingTotal,
  };
}

export function logParsedTrade(parsed, user) {
  const verdict = verdictFor(parsed.givingTotal, parsed.gettingTotal);

  const tidy = (list) =>
    list.map((e) => ({
      label: e.label,
      value: e.value,
      qty: e.qty || 1,
      unit: e.unit ?? e.value,
    }));

  return addTrade({
    at: Date.now(),
    user: user ? `${user.username} (${user.id})` : 'unknown',
    userId: user ? user.id : null,
    giving: tidy(parsed.giving),
    getting: tidy(parsed.getting),
    givingTotal: parsed.givingTotal,
    gettingTotal: parsed.gettingTotal,
    verdict: verdict.label,
    diffPct: Number(verdict.diffPct.toFixed(1)),
  });
}

/** Most-tracked items, for /trades top. */
export function topTradedItems(limit = 10) {
  const counts = new Map();

  const bump = (label) => counts.set(label, (counts.get(label) || 0) + 1);

  for (const trade of trades) {
    // Give side weighted twice — that is the side people ask prices about.
    for (const e of trade.giving) bump(e.label);
    for (const e of trade.getting) bump(e.label);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

/** Simple leaderboard of who logs the most trades. */
export function topTraders(limit = 10) {
  const counts = new Map();
  for (const trade of trades) {
    if (!trade.user || trade.user === 'unknown') continue;
    counts.set(trade.user, (counts.get(trade.user) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([user, count]) => ({ user, count }));
}

export function tradeStats() {
  if (!trades.length) return { total: 0, last24h: 0, last7d: 0 };

  const now = Date.now();
  const day = 86_400_000;

  return {
    total: trades.length,
    last24h: trades.filter((t) => now - t.at < day).length,
    last7d: trades.filter((t) => now - t.at < day * 7).length,
  };
}
