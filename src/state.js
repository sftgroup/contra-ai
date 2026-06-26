'use strict';

const { CHAINS } = require('./config');

/**
 * In-memory chain state
 *
 * chainMintCount: Map<chainName, number>  — current totalMinted per chain
 * paused: boolean                         — global paused (any chain reached 500)
 * pausedChains: string[]                  — which chains have been paused
 * chainReaders: Map<chainName, {totalMinted, maxSupply, paused}>  — cached reads
 * inviteDB: LevelDB instance              — invite event log
 */
const state = {
  chainMintCount: new Map(),   // chainName → number
  chainMaxSupply: new Map(),   // chainName → number (from config default)
  chainPaused: new Map(),      // chainName → boolean (individual chain paused)
  paused: false,               // global paused flag
  pausedChains: [],            // chains that triggered pause()
  inviteDB: null,              // set during init
  startTime: Date.now(),
  providers: new Map(),        // chainName → ethers.providers.JsonRpcProvider
  contracts: new Map(),        // chainName → ethers.Contract (ContraNFT)
  ceresContracts: new Map(),   // chainName → ethers.Contract (CeresRegistry)
  lastProcessedBlocks: new Map(),   // chainName → {mint: number, invite: number} — for replay on reconnect
};

// Initialize from config
for (const chain of CHAINS) {
  state.chainMintCount.set(chain.name, 0);
  state.chainMaxSupply.set(chain.name, chain.maxSupply);
  state.chainPaused.set(chain.name, false);
}

module.exports = state;
