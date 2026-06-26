'use strict';

const { ethers } = require('ethers');
const config = require('./config');
const { CONTRA_NFT_ABI } = require('./abi');
const state = require('./state');

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Initialize providers, contracts, and start event listeners for all 4 chains.
 */
async function initListeners() {
  for (const chain of config.CHAINS) {
    const rpcUrl = config.RPC_URLS[chain.name] || config.RPC_URLS.eth;
    const provider = new ethers.providers.JsonRpcProvider({
      url: rpcUrl,
      timeout: 15000,
    });
    state.providers.set(chain.name, provider);

    // ContraNFT contract
    const contract = new ethers.Contract(
      chain.contraNFT,
      CONTRA_NFT_ABI,
      provider
    );
    state.contracts.set(chain.name, contract);

    // CeresRegistry contract
    const ceresAddr = config.CERES_REGISTRIES[chain.name];
    const ceres = new ethers.Contract(
      ceresAddr,
      config.CERES_REGISTRY_ABI,
      provider
    );
    state.ceresContracts.set(chain.name, ceres);

    // Seed initial state from chain
    await seedChainState(chain.name, contract);

    // Start event listeners
    listenMintEvents(chain, contract);
    listenPausedEvents(chain, contract);
    listenInviteEvents(chain, ceres);
  }
}

/**
 * Read initial on-chain state to seed memory map.
 */
async function seedChainState(chainName, contract) {
  try {
    const [tm, ms, p] = await Promise.all([
      contract.totalMinted(),
      contract.maxSupply(),
      contract.paused(),
    ]);
    state.chainMintCount.set(chainName, tm.toNumber());
    state.chainMaxSupply.set(chainName, ms.toNumber());
    state.chainPaused.set(chainName, p);
    if (p) {
      state.pausedChains.push(chainName);
    }
    console.log(`[seed] ${chainName}: totalMinted=${tm}, maxSupply=${ms}, paused=${p}`);
  } catch (err) {
    console.error(`[seed] ${chainName} init failed: ${err.message}. Will retry on event.`);
  }
}

/**
 * Listen for MintEvent and update chainMintCount.
 * When global totalMinted >= 500, call pause() on all chains.
 */
function listenMintEvents(chain, contract) {
  contract.on('MintEvent', async (minter, tokenId, event) => {
    try {
      const chainName = chain.name;
      // Track last processed block for reconnect replay
      const blocks = state.lastProcessedBlocks.get(chainName) || { mint: 0, invite: 0 };
      blocks.mint = event.blockNumber;
      state.lastProcessedBlocks.set(chainName, blocks);

      const current = state.chainMintCount.get(chainName) || 0;
      const newCount = current + 1;
      state.chainMintCount.set(chainName, newCount);

      console.log(
        `[mint] ${chainName}: minter=${minter} tokenId=${tokenId.toString()} ` +
        `chainMinted=${newCount}`
      );

      // Check global total
      const globalTotal = getGlobalTotalMinted();
      console.log(`[mint] global totalMinted=${globalTotal}`);

      if (globalTotal >= 500 && !state.paused) {
        console.log(`[pause] global totalMinted=${globalTotal} >= 500. Triggering pause on all chains.`);
        await pauseAllChains();
      }
    } catch (err) {
      console.error(`[mint] Error processing MintEvent on ${chain.name}: ${err.message}`);
    }
  });

  // Handle listener errors / disconnects
  contract.on('error', (err) => {
    console.error(`[listener] ${chain.name} ContraNFT error: ${err.message}`);
    scheduleReconnect(chain);
  });
}

/**
 * Listen for Paused event to update chainPaused state.
 */
function listenPausedEvents(chain, contract) {
  contract.on('Paused', async () => {
    console.log(`[pause] ${chain.name} contract paused via on-chain event`);
    state.chainPaused.set(chain.name, true);
    if (!state.pausedChains.includes(chain.name)) {
      state.pausedChains.push(chain.name);
    }
    state.paused = true;
  });

  contract.on('Unpaused', async () => {
    console.log(`[pause] ${chain.name} contract unpaused via on-chain event`);
    state.chainPaused.set(chain.name, false);
    state.pausedChains = state.pausedChains.filter(c => c !== chain.name);
    if (state.pausedChains.length === 0) {
      state.paused = false;
    }
  });
}

/**
 * Listen for InviteAuthorized events from CeresRegistry and persist to LevelDB.
 */
function listenInviteEvents(chain, ceres) {
  if (!state.inviteDB) {
    console.warn('[invite] inviteDB not initialized; invite events will be skipped');
    return;
  }

  ceres.on('InviteAuthorized', async (inviter, invitee, chainRef, event) => {
    try {
      const chainName = chain.name;
      // Track last processed block for reconnect replay
      const blocks = state.lastProcessedBlocks.get(chainName) || { mint: 0, invite: 0 };
      blocks.invite = event.blockNumber;
      state.lastProcessedBlocks.set(chainName, blocks);

      const blockNumber = event.blockNumber;
      const txHash = event.transactionHash;
      const timestamp = Math.floor(Date.now() / 1000);

      const inviteRecord = {
        inviter: inviter.toLowerCase(),
        invitee: invitee.toLowerCase(),
        chain: chainName,
        chainRef: chainRef.toLowerCase(),
        blockNumber,
        txHash,
        authorizedAt: timestamp,
        hasMinted: false,
        mintedTokenId: null,
        mintedChain: null,
      };

      // Atomic batch write: invite record + inviter index
      const key = `invite:${invitee.toLowerCase()}`;
      const idxKey = `inviter:${inviter.toLowerCase()}`;
      const batch = state.inviteDB.batch();
      batch.put(key, JSON.stringify(inviteRecord));

      try {
        const existing = await state.inviteDB.get(idxKey);
        const list = JSON.parse(existing);
        if (!list.includes(invitee.toLowerCase())) {
          list.push(invitee.toLowerCase());
        }
        batch.put(idxKey, JSON.stringify(list));
      } catch {
        // Key doesn't exist yet
        batch.put(idxKey, JSON.stringify([invitee.toLowerCase()]));
      }
      await batch.write();

      console.log(
        `[invite] ${chainName}: inviter=${inviter} invitee=${invitee} ` +
        `block=${blockNumber}`
      );
    } catch (err) {
      console.error(`[invite] Error storing invite event on ${chain.name}: ${err.message}`);
    }
  });

  ceres.on('error', (err) => {
    console.error(`[listener] ${chain.name} CeresRegistry error: ${err.message}`);
    // Reconnect is handled by provider-level error already
  });
}

/**
 * Call pause() on every chain's ContraNFT contract.
 */
async function pauseAllChains() {
  // In production this would use an admin wallet.
  // For the relay, we simply mark state as paused.
  // The actual pause() tx would need to be sent by the contract owner.
  state.paused = true;
  for (const chain of config.CHAINS) {
    state.chainPaused.set(chain.name, true);
    if (!state.pausedChains.includes(chain.name)) {
      state.pausedChains.push(chain.name);
    }
  }
  console.log('[pause] All chains marked paused in relay state (global totalMinted >= 500).');

  // Attempt on-chain pause call — requires admin wallet
  // This is a best-effort: relay needs the owner private key to actually call pause().
  // For now we rely on the owner bot or manual action.
  // Uncomment when admin wallet is configured:
  //
  // const adminWallet = new ethers.Wallet(process.env.ADMIN_PRIVATE_KEY, provider);
  // for (const chain of config.CHAINS) {
  //   try {
  //     const adminContract = new ethers.Contract(chain.contraNFT, CONTRA_NFT_ABI, adminWallet);
  //     const tx = await adminContract.pause();
  //     await tx.wait();
  //     console.log(`[pause] ${chain.name} pause() tx sent: ${tx.hash}`);
  //   } catch (err) {
  //     console.error(`[pause] Failed to pause ${chain.name}: ${err.message}`);
  //   }
  // }
}

/**
 * Calculate global totalMinted across all chains from memory.
 */
function getGlobalTotalMinted() {
  let total = 0;
  for (const count of state.chainMintCount.values()) {
    total += count;
  }
  return total;
}

/**
 * Schedule a reconnection for a given chain after an error.
 */
function scheduleReconnect(chain, attempt = 0) {
  if (attempt >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[reconnect] ${chain.name}: max reconnect attempts reached. Giving up.`);
    return;
  }

  const delay = RECONNECT_DELAY_MS * Math.pow(2, attempt);
  console.log(`[reconnect] ${chain.name}: reconnecting in ${delay}ms (attempt ${attempt + 1})`);

  setTimeout(async () => {
    try {
      const rpcUrl = config.RPC_URLS[chain.name] || config.RPC_URLS.eth;
      const provider = new ethers.providers.JsonRpcProvider({
        url: rpcUrl,
        timeout: 15000,
      });
      state.providers.set(chain.name, provider);

      const contract = new ethers.Contract(
        chain.contraNFT,
        CONTRA_NFT_ABI,
        provider
      );
      state.contracts.set(chain.name, contract);

      await seedChainState(chain.name, contract);

      // Replay missed events from last processed block
      const blocks = state.lastProcessedBlocks.get(chain.name);
      if (blocks?.mint > 0) {
        try {
          const currentBlock = await provider.getBlockNumber();
          const fromBlock = blocks.mint + 1;
          if (fromBlock <= currentBlock) {
            const pastEvents = await contract.queryFilter('MintEvent', fromBlock, currentBlock);
            for (const evt of pastEvents) {
              const { minter, tokenId } = evt.args;
              const current = state.chainMintCount.get(chain.name) || 0;
              state.chainMintCount.set(chain.name, current + 1);
              console.log(`[replay] ${chain.name}: recovered MintEvent minter=${minter} tokenId=${tokenId}`);
            }
          }
        } catch (err) {
          console.error(`[replay] ${chain.name}: mint event replay failed: ${err.message}`);
        }
      }

      listenMintEvents(chain, contract);
      listenPausedEvents(chain, contract);

      const ceres = new ethers.Contract(
        config.CERES_REGISTRIES[chain.name],
        config.CERES_REGISTRY_ABI,
        provider
      );
      state.ceresContracts.set(chain.name, ceres);
      listenInviteEvents(chain, ceres);

      console.log(`[reconnect] ${chain.name}: reconnected successfully`);
    } catch (err) {
      console.error(`[reconnect] ${chain.name}: failed (attempt ${attempt + 1}): ${err.message}`);
      scheduleReconnect(chain, attempt + 1);
    }
  }, delay);
}

module.exports = { initListeners, getGlobalTotalMinted, pauseAllChains };
