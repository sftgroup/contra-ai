'use strict';

const express = require('express');
const config = require('./config');
const state = require('./state');
const listener = require('./listener');
const inviteStore = require('./inviteStore');

const router = express.Router();

// ──────────────────────────────────────────────
// GET /api/stats — global minting progress
// ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const byChain = {};
    const maxSupplyByChain = {};
    const pausedChains = [];

    for (const chain of config.CHAINS) {
      const name = chain.name;
      const minted = state.chainMintCount.get(name);
      byChain[name] = minted !== undefined ? minted : null;
      maxSupplyByChain[name] = state.chainMaxSupply.get(name) || chain.maxSupply;
      if (state.chainPaused.get(name)) {
        pausedChains.push(name);
      }
    }

    // Attempt fresh reads from chain as fallback for null values
    for (const chain of config.CHAINS) {
      if (byChain[chain.name] === null) {
        try {
          const contract = state.contracts.get(chain.name);
          if (contract) {
            const [tm, ms, p] = await Promise.all([
              contract.totalMinted(),
              contract.maxSupply(),
              contract.paused(),
            ]);
            byChain[chain.name] = tm.toNumber();
            maxSupplyByChain[chain.name] = ms.toNumber();
            state.chainMintCount.set(chain.name, tm.toNumber());
            state.chainMaxSupply.set(chain.name, ms.toNumber());
            state.chainPaused.set(chain.name, p);
            if (p && !pausedChains.includes(chain.name)) {
              pausedChains.push(chain.name);
            }
          }
        } catch (readErr) {
          console.error(`[api] Failed to read ${chain.name} chain: ${readErr.message}`);
          // Keep null
        }
      }
    }

    let totalMinted = 0;
    for (const val of Object.values(byChain)) {
      if (val !== null) totalMinted += val;
    }

    res.json({
      totalMinted,
      totalSupply: 500,
      byChain,
      maxSupplyByChain,
      paused: state.paused || pausedChains.length > 0,
      pausedChains,
    });
  } catch (err) {
    console.error(`[api] /stats error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// GET /api/account/:address — dashboard overview
// ──────────────────────────────────────────────
router.get('/account/:address', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    if (!ethersUtils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const [nfts, byChain, inviteStatsResult] = await Promise.all([
      getNFTsForAddress(address),
      getNFTsByChain(address),
      getInviteStatsForAddress(address),
    ]);

    res.json({
      address,
      nfts,
      totalNfts: nfts.length,
      byChain,
      inviteStats: inviteStatsResult,
      isShareholder: nfts.length > 0,
    });
  } catch (err) {
    console.error(`[api] /account/${req.params.address} error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// GET /api/account/:address/nfts — NFT list (paginated)
// ──────────────────────────────────────────────
router.get('/account/:address/nfts', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    if (!ethersUtils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const allNFTs = await getNFTsForAddress(address);
    const total = allNFTs.length;
    const nfts = inviteStore.paginate(allNFTs, page, limit);

    res.json({ address, nfts, total, page, limit });
  } catch (err) {
    console.error(`[api] /account/${req.params.address}/nfts error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// GET /api/account/:address/invites — invite list (paginated)
// ──────────────────────────────────────────────
router.get('/account/:address/invites', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    if (!ethersUtils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const stats = await getInviteStatsForAddress(address);
    const invitees = await inviteStore.getInvitees(address);
    const paginated = inviteStore.paginate(invitees, page, limit);

    res.json({
      address,
      inviteStats: stats,
      invitees: paginated,
      total: invitees.length,
      page,
      limit,
    });
  } catch (err) {
    console.error(`[api] /account/${req.params.address}/invites error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// GET /api/invite/:address/ancestors — invite chain
// ──────────────────────────────────────────────
router.get('/invite/:address/ancestors', async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    if (!ethersUtils.isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const ancestors = await inviteStore.getAncestors(address, 10);

    res.json({ address, ancestors });
  } catch (err) {
    console.error(`[api] /invite/${req.params.address}/ancestors error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────
// GET /api/status — relay health
// ──────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const chainStatus = {};
  for (const chain of config.CHAINS) {
    chainStatus[chain.name] = {
      connected: state.providers.has(chain.name),
      contract: state.contracts.has(chain.name),
      totalMinted: state.chainMintCount.get(chain.name) || 0,
      paused: state.chainPaused.get(chain.name) || false,
    };
  }

  res.json({
    relay: {
      status: 'running',
      uptime: Math.floor((Date.now() - state.startTime) / 1000),
      version: '1.0.0',
    },
    chains: chainStatus,
    uptime: Math.floor((Date.now() - state.startTime) / 1000),
  });
});

// ──────────────────────────────────────────────
// Helper: get all NFTs for an address across all chains
// ──────────────────────────────────────────────
async function getNFTsForAddress(address) {
  const nfts = [];

  for (const chain of config.CHAINS) {
    try {
      const contract = state.contracts.get(chain.name);
      if (!contract) continue;

      const balance = await contract.balanceOf(address);
      const count = balance.toNumber();
      if (count === 0) continue;

      // We need to find which token IDs the user owns.
      // Since we listen to MintEvent, we can try ownerOf for each minted token.
      const totalMinted = state.chainMintCount.get(chain.name) || 0;

      // For efficiency, check tokens in batches
      for (let tid = 1; tid <= totalMinted; tid++) {
        try {
          const owner = await contract.ownerOf(tid);
          if (owner.toLowerCase() === address) {
            nfts.push({
              tokenId: tid,
              chain: chain.name,
              chainId: chain.chainId,
              contractAddress: chain.contraNFT,
              blockExplorerLink: `${chain.blockExplorer}/nft/${chain.contraNFT}/${tid}`,
              imageUrl: `https://contra.ai/nft/${tid}.png`,
              mintedAt: Math.floor(Date.now() / 1000), // approximate; real data from event
            });

            if (nfts.length >= count) break;
          }
        } catch {
          // Token may not exist
        }
      }
    } catch (err) {
      console.error(`[api] Error fetching NFTs for ${address} on ${chain.name}: ${err.message}`);
    }
  }

  return nfts;
}

// ──────────────────────────────────────────────
// Helper: get NFT counts by chain
// ──────────────────────────────────────────────
async function getNFTsByChain(address) {
  const byChain = {};

  for (const chain of config.CHAINS) {
    try {
      const contract = state.contracts.get(chain.name);
      if (!contract) {
        byChain[chain.name] = 0;
        continue;
      }
      const balance = await contract.balanceOf(address);
      byChain[chain.name] = balance.toNumber();
    } catch {
      byChain[chain.name] = 0;
    }
  }

  return byChain;
}

// ──────────────────────────────────────────────
// Helper: get invite stats for an address
// ──────────────────────────────────────────────
async function getInviteStatsForAddress(address) {
  try {
    const stats = await inviteStore.getInviteStats(address);
    return stats;
  } catch (err) {
    console.error(`[api] Error fetching invite stats for ${address}: ${err.message}`);
    return {
      total: 0,
      byChain: {},
      directInvitees: 0,
      inviteLink: `https://contra.ai/invite?ref=${address}`,
    };
  }
}

// ──────────────────────────────────────────────
// Validation helper
// ──────────────────────────────────────────────
const { ethers } = require('ethers');
const ethersUtils = ethers.utils;

module.exports = router;
