'use strict';

const { Level } = require('level');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const state = require('./state');

let db = null;

/**
 * Initialize or rebuild the LevelDB invite store.
 */
async function initInviteDB() {
  const dbPath = config.LEVEL_DB_PATH;
  const dir = path.dirname(dbPath);

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Level(dbPath, { valueEncoding: 'utf8' });

    // Verify DB is good with a test read
    try {
      await db.get('__test__');
    } catch {
      // Key doesn't exist — that's fine, it means DB is fresh
      await db.put('__test__', 'ok').catch(() => {});
    }

    console.log(`[inviteDB] LevelDB initialized at ${dbPath}`);
  } catch (err) {
    console.error(`[inviteDB] LevelDB init failed: ${err.message}. Rebuilding...`);
    // Rebuild: remove and recreate
    try {
      if (fs.existsSync(dbPath)) {
        fs.rmSync(dbPath, { recursive: true, force: true });
      }
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      db = new Level(dbPath, { valueEncoding: 'utf8' });
      console.log(`[inviteDB] LevelDB rebuilt at ${dbPath}`);
    } catch (rebuildErr) {
      console.error(`[inviteDB] Fatal: cannot rebuild LevelDB: ${rebuildErr.message}`);
      throw rebuildErr;
    }
  }

  state.inviteDB = db;
  return db;
}

/**
 * Get invite record for a specific invitee address.
 * @param {string} address - invitee address (lowercased)
 * @returns {Promise<Object|null>}
 */
async function getInvite(address) {
  if (!db) return null;
  const key = `invite:${address.toLowerCase()}`;
  try {
    const raw = await db.get(key);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Get all invitees invited by a specific inviter.
 * @param {string} address - inviter address (lowercased)
 * @returns {Promise<Array>}
 */
async function getInvitees(address) {
  if (!db) return [];
  const idxKey = `inviter:${address.toLowerCase()}`;
  try {
    const raw = await db.get(idxKey);
    const addresses = JSON.parse(raw);
    // Fetch full records
    const records = await Promise.all(
      addresses.map(async (addr) => {
        const record = await getInvite(addr);
        return record || { invitee: addr };
      })
    );
    return records;
  } catch {
    return [];
  }
}

/**
 * Get invite ancestors (invite chain) for an address.
 * Walks invitee → inviter chain, up to maxDepth.
 * @param {string} address - starting address
 * @param {number} maxDepth - default 10
 * @returns {Promise<Array<{address, depth, chain}>>}
 */
async function getAncestors(address, maxDepth = 10) {
  const ancestors = [];
  let current = address.toLowerCase();
  let depth = 1;

  while (depth <= maxDepth) {
    const invite = await getInvite(current);
    if (!invite) break;

    ancestors.push({
      address: invite.inviter,
      depth,
      chain: invite.chain,
    });

    current = invite.inviter;
    depth++;
  }

  return ancestors;
}

/**
 * Update an invite record (e.g., mark hasMinted = true).
 * @param {string} invitee - invitee address (lowercased)
 * @param {Object} updates - partial fields to merge
 */
async function updateInvite(invitee, updates) {
  if (!db) return;
  const key = `invite:${invitee.toLowerCase()}`;
  try {
    const raw = await db.get(key);
    const record = JSON.parse(raw);
    Object.assign(record, updates);
    await db.put(key, JSON.stringify(record));
  } catch {
    // Record doesn't exist
  }
}

/**
 * Get invite stats for an address.
 * Counts from DB + falls back to chain read.
 */
async function getInviteStats(address) {
  if (!db) return { total: 0, byChain: {}, directInvitees: 0 };

  const invitees = await getInvitees(address);
  const byChain = {};

  for (const inv of invitees) {
    const ch = inv.chain || 'unknown';
    byChain[ch] = (byChain[ch] || 0) + 1;
  }

  return {
    total: invitees.length,
    byChain,
    directInvitees: invitees.length,
    inviteLink: `https://contra.ai/invite?ref=${address}`,
  };
}

/**
 * Paginate an array.
 */
function paginate(arr, page = 1, limit = 20) {
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
}

module.exports = {
  initInviteDB,
  getInvite,
  getInvitees: getInvitees,  // expose the raw function (already named)
  getAncestors,
  updateInvite,
  getInviteStats,
  paginate,
};
