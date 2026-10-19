/**
 * Role management driven by activity.
 *
 * The old implementation counted *every* command invocation into user_stats.json
 * and rewrote the whole file synchronously on each one — including for bots and
 * spammers, so a bot could farm the top role. Here progress is driven by
 * meaningful actions only (checking a price, logging a trade) and the write is
 * debounced via lib/store.js.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readJson, writeJson } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS_PATH = path.join(__dirname, '..', 'activity.json');

/** Progress ladder. Each tier needs `need` qualifying actions. */
export const TIERS = [
  { key: 'starter', role: '🐝 Трейдер', color: '#f59e0b', need: 0 },
  { key: 'experienced', role: '🍯 Опытный Трейдер', color: '#eab308', need: 50 },
  { key: 'legendary', role: '👑 Легендарный Трейдер', color: '#a855f7', need: 150 },
];

let activity = readJson(STATS_PATH, {});

function persist() {
  writeJson(STATS_PATH, activity);
}

/** Record a qualifying action and return the user's new count. */
export function bump(userId, weight = 1) {
  if (!userId) return 0;
  const prev = activity[userId] || { count: 0 };
  prev.count += weight;
  prev.at = Date.now();
  activity[userId] = prev;
  persist();
  return prev.count;
}

export function countFor(userId) {
  return activity[userId]?.count || 0;
}

/** Highest tier the user has unlocked (or null when they have no progress). */
export function tierFor(userId) {
  const count = countFor(userId);
  let current = null;
  for (const tier of TIERS) {
    if (count >= tier.need) current = tier;
  }
  return current;
}

export function leaderboard(limit = 10) {
  return Object.entries(activity)
    .map(([userId, v]) => ({ userId, count: v.count || 0, at: v.at || 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Create the tier roles if missing.
 * Returns a map of role key -> Role so callers can assign without re-fetching.
 */
export async function ensureTierRoles(guild) {
  const out = {};
  for (const tier of TIERS) {
    let role = guild.roles.cache.find((r) => r.name === tier.role);
    if (!role) {
      try {
        role = await guild.roles.create({
          name: tier.role,
          color: tier.color,
          reason: 'BSS Index activity tier',
        });
        console.log(`[Roles] created ${tier.role}`);
      } catch (err) {
        console.error(`[Roles] failed to create ${tier.role}:`, err.message);
      }
    }
    out[tier.key] = role || null;
  }
  return out;
}

/**
 * Sync a member's tier roles: adds the highest earned one, removes stale ones.
 * The starter role is granted on join instead, so it is left alone here.
 */
export async function syncTierRoles(member) {
  if (!member?.guild) return null;

  const roles = await ensureTierRoles(member.guild);
  const earned = tierFor(member.id);
  if (!earned) return null;

  const target = roles[earned.key];
  if (!target) return null;

  const ladderRoles = TIERS.filter((t) => t.key !== 'starter').map((t) => roles[t.key]).filter(Boolean);
  const shouldHave = member.roles.cache.has(target.id);

  if (!shouldHave) {
    // Remove any other ladder role first so people only hold one.
    for (const role of ladderRoles) {
      if (role.id !== target.id && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(() => null);
      }
    }
    await member.roles.add(target).catch(() => null);
    console.log(`[Roles] ${member.user.tag} -> ${target.name}`);
  }

  return target;
}

/** Grants the starter role on join. */
export async function grantStarterRole(member) {
  if (!member?.guild) return;
  const roles = await ensureTierRoles(member.guild);
  const starter = roles.starter;
  if (starter && !member.roles.cache.has(starter.id)) {
    await member.roles.add(starter).catch(() => null);
  }
}
