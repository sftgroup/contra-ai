'use strict';

// Per-chain RPC URLs (overrideable via env)
// In production these should point to actual Base/BSC/Solana endpoints.
// For Sepolia testnet simulation, all 4 chains are deployed on Sepolia.
const RPC_URLS = {
  base: process.env.RPC_BASE || 'https://ethereum-sepolia.publicnode.com',
  bsc: process.env.RPC_BSC || 'https://ethereum-sepolia.publicnode.com',
  eth: process.env.RPC_ETH || 'https://ethereum-sepolia.publicnode.com',
  solana: process.env.RPC_SOLANA || 'https://ethereum-sepolia.publicnode.com',
};

const CHAINS = [
  {
    name: 'base',
    chainId: 8453,
    contraNFT: '0x8bDcA9545E354EE180bB85b24D938Ea08Cf49Be6',
    maxSupply: 200,
    blockExplorer: 'https://basescan.org',
  },
  {
    name: 'bsc',
    chainId: 97,
    contraNFT: '0x032143f87Fb5C701Bb99cD0cf6e44b8729a79F9b',
    maxSupply: 100,
    blockExplorer: 'https://testnet.bscscan.com',
  },
  {
    name: 'eth',
    chainId: 11155111,
    contraNFT: '0xF9c53617eda98465DF3C270e1C65b19ef1BfD036',
    maxSupply: 100,
    blockExplorer: 'https://sepolia.etherscan.io',
  },
  {
    name: 'solana',
    chainId: 11155111,
    contraNFT: '0x2f1c5d3Bc58180e497D178c0621544a7B4FD5b22',
    maxSupply: 100,
    blockExplorer: 'https://sepolia.etherscan.io',
  },
];

// CeresRegistry — same ABI shape, different address per chain
// For now all point to the same mock address (same RPC)
const CERES_REGISTRIES = {
  base: '0x3bC053B1e11214832cE70F23E5bA2fB6D7fE9a9C',
  bsc: '0x3bC053B1e11214832cE70F23E5bA2fB6D7fE9a9C',
  eth: '0x3bC053B1e11214832cE70F23E5bA2fB6D7fE9a9C',
  solana: '0x3bC053B1e11214832cE70F23E5bA2fB6D7fE9a9C',
};

// Minimal CeresRegistry ABI — just what the relay needs
const CERES_REGISTRY_ABI = [
  'event InviteAuthorized(address indexed inviter, address indexed invitee, address indexed chainRef)',
  'function inviteCount(address inviter) view returns (uint256)',
  'function getInviteAncestors(address invitee, uint256 maxDepth) view returns (address[] memory)',
  'function totalInvites(address chainRef) view returns (uint256)',
];

const PORT = process.env.PORT || 3000;

const LEVEL_DB_PATH = process.env.LEVEL_DB_PATH || '/home/ubuntu/contra-relay-data/invite-db';

module.exports = {
  RPC_URLS,
  CHAINS,
  CERES_REGISTRIES,
  CERES_REGISTRY_ABI,
  PORT,
  LEVEL_DB_PATH,
};
