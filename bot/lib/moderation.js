/**
 * Automatic moderation.
 *
 * SAFETY MODEL — read before enabling enforcement:
 * Automatic moderation bans real users on false positives. A blocked word that
 * happens to be a player's name, a sticker name or a link to a trading guide
 * can nuke an innocent trader and cost you the community.
 *
 * Therefore this module ships in DRY-RUN by default: rules match, every hit is
 * recorded and reported to a mod channel, but nothing is deleted and nobody is
 * punished until someone explicitly runs /mod enforce.
 *
 * Stages:
 *   off      — nothing is even evaluated
 *   watch    — (default) evaluate + log + notify, take no action
 *   enforce  — delete the message and escalate
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readJson, writeJson } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'mod_config.json');
const LOG_PATH = path.join(__dirname, '..', 'mod_log.json');

const MAX_LOG = 2000;

const defaults = {
  mode: 'watch',            // 'off' | 'watch' | 'enforce'
  logChannelId: null,       // where hits get reported
  warnChannelId: null,      // where the warned user gets the message
  // Roles that are never touched, whatever the rules say.
  exemptRoleIds: [],
  exemptUserIds: [],
  maxMentions: 4,
  maxInvites: 2,
  rules: {
    discordInvites: true,   // discord.gg / discordapp.com invites
    phishing: true,         // obvious "your account was stolen" lures
    capsSpam: false,        // SHOUTING walls - off, too many false hits
    mentionSpam: true,      // @everyone / mass pings
  },
  blocklist: [],            // user-editable words/phrases
};

let config = { ...defaults, ...readJson(CONFIG_PATH, {}) };
let log = readJson(LOG_PATH, []);

function persistConfig() {
  writeJson(CONFIG_PATH, config);
}

function persistLog() {
  if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
  writeJson(LOG_PATH, log);
}

export function getConfig() {
  return config;
}

export function updateConfig(patch) {
  config = {
    ...config,
    ...patch,
    rules: { ...config.rules, ...(patch.rules || {}) },
    exemptRoleIds: patch.exemptRoleIds ?? config.exemptRoleIds,
    exemptUserIds: patch.exemptUserIds ?? config.exemptUserIds,
    blocklist: patch.blocklist ?? config.blocklist,
  };
  persistConfig();
  return config;
}

export function addBlocklistWord(word) {
  const clean = String(word || '').trim().toLowerCase();
  if (!clean || config.blocklist.includes(clean)) return false;
  config.blocklist = [...config.blocklist, clean];
  persistConfig();
  return true;
}

export function removeBlocklistWord(word) {
  const clean = String(word || '').trim().toLowerCase();
  const next = config.blocklist.filter((w) => w !== clean);
  if (next.length === config.blocklist.length) return false;
  config.blocklist = next;
  persistConfig();
  return true;
}

export function isExempt(member) {
  if (!member) return false;
  if (config.exemptUserIds.includes(member.id)) return true;
  if (!member.roles?.cache) return false;
  for (const roleId of config.exemptRoleIds) {
    if (member.roles.cache.has(roleId)) return true;
  }
  return false;
}

const PHISHING_PATTERNS = [
  /free\s*nitro/i,
  /claim\s+your\s+(n\s*itro|reward|prize)/i,
  /your\s+account\s+(was|has\s+been)\s+(stolen|hacked|compromised)/i,
  /steam\s*community.*free/i,
  /discord\s*nitro.*free/i,
  // Russian variants — the server is Russian-speaking, so English-only
  // patterns miss every local scam attempt.
  /нитр[оа]\s*(бесплатно|бесплатн)/iu,
  /(забери|получи|заберите)\s+(свой\s+)?нитр/iu,
  // \w does not match Cyrillic in JS, so use an explicit letter class here.
  /бесплатн\p{L}*\s+(стикеры?|предметы?|скины?|алмазы?|робуксы?)/iu,
  // Stems, not full words: угнал / угнали stem from "угн", украли from "укра".
  // The possessive is optional so a bare "акк угнал" still trips the rule.
  /(?:твой\s+|ваш\s+|мой\s+)?(?:аккаунт|акк)\s+\p{L}*(взлом|угн|укра|скомпрометирован|сбрут)/iu,
  /steam\s*сообществ.*бесплатно/iu,
];

/**
 * Evaluate one message. Returns { hits } — an empty array means clean.
 * Never mutates anything; the caller decides what to do with the hits.
 */
export function inspectMessage({ content, member }) {
  if (config.mode === 'off') return { hits: [] };
  if (isExempt(member)) return { hits: [] };

  const text = String(content || '');
  if (!text.trim()) return { hits: [] };

  const hits = [];
  const rules = config.rules;

  if (rules.discordInvites) {
    const invites = text.match(/discord(?:app)?\.(?:gg|com\/invite|me)\/[\w-]+/gi) || [];
    if (invites.length > 0) hits.push({ rule: 'discordInvites', detail: invites.join(', ') });
  }

  if (rules.phishing) {
    for (const re of PHISHING_PATTERNS) {
      if (re.test(text)) {
        hits.push({ rule: 'phishing', detail: re.source });
        break;
      }
    }
  }

  if (rules.mentionSpam) {
    const roleMentions = (text.match(/@&/g) || []).length;
    const everyone = /@(everyone|here)/i.test(text);
    const totalMentions = (text.match(/<@!?\d+>/g) || []).length;
    if (everyone || roleMentions >= 2 || totalMentions > config.maxMentions) {
      hits.push({ rule: 'mentionSpam', detail: `${totalMentions} mentions, ${everyone ? '@everyone' : 'no @everyone'}` });
    }
  }

  if (rules.capsSpam) {
    const letters = text.replace(/[^a-zA-Zа-яА-Я]/g, '');
    if (letters.length >= 24 && letters === letters.toUpperCase()) {
      hits.push({ rule: 'capsSpam', detail: `${letters.length} capital letters` });
    }
  }

  for (const word of config.blocklist) {
    if (word && text.toLowerCase().includes(word)) {
      hits.push({ rule: 'blocklist', detail: word });
    }
  }

  return { hits };
}

export function recordHit(entry) {
  log.push({ at: Date.now(), ...entry });
  persistLog();
}

export function recentLog(limit = 20) {
  return log.slice(-limit).reverse();
}

export function logStats() {
  const byRule = {};
  for (const entry of log) {
    byRule[entry.rule] = (byRule[entry.rule] || 0) + 1;
  }
  return { total: log.length, byRule };
}
