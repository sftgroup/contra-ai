// CONTRA Dashboard v5 — Merge high-design + 4-identity tabs
// Run: node gen-dashboard.js

const fs = require('fs');
const path = require('path');

const IDENTITIES = [
  { id: 'partner', name: 'Partner', icon: '🥇', nft: 'Gold NFT', stake: '100K CONTRA',
    perks: ['10% Protocol Fee Split', '3× Vote Weight', 'Priority Agent Pool', 'Early Feature Access'],
    quota: { minted: 180, total: 1000 },
    mintedPanel: `<h4 class="font-bold text-gold mb-2">NFT #00180 (Gold)</h4>`,
    color: 'gold', classBg: 'bg-amber-500/10 border-amber-500/20' },
  { id: 'user', name: 'User', icon: '👤', nft: 'Bronze NFT', stake: '5K CONTRA',
    perks: ['3% Protocol Fee Split', '1× Vote Weight', 'Basic Agent Access', 'Community Voting'],
    quota: { minted: 6300, total: 10000 },
    mintedPanel: `<h4 class="font-bold text-brand mb-2">NFT #06300 (Bronze)</h4>`,
    color: 'brand', classBg: 'bg-brand/10 border-brand/20' },
  { id: 'expert', name: 'Expert', icon: '🧠', nft: 'Expert NFT', stake: '25K CONTRA + KYC',
    perks: ['Task Matchmaking', 'Reputation System', '5% Protocol Fee', '1.5× Vote Weight'],
    quota: { minted: 2100, total: 10000 },
    mintedPanel: `<h4 class="font-bold text-purple mb-2">NFT #02100 (Expert)</h4><div class="grid grid-cols-2 gap-3 mt-4 text-sm"><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Reputation</p><p class="text-lg font-mono font-bold text-purple">89/100</p></div><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Tasks Done</p><p class="text-lg font-mono font-bold text-white">47</p></div><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Active</p><p class="text-lg font-mono font-bold text-white">3</p></div><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Earned</p><p class="text-lg font-mono font-bold text-green">$28,450</p></div></div>`,
    color: 'purple', classBg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'kol', name: 'KOL', icon: '📢', nft: 'KOL NFT', stake: '50K CONTRA + Social Verify',
    perks: ['Referral Commission', 'Exclusive Promo Link', 'Community Incentives', '2× Vote Weight'],
    quota: { minted: 128, total: 500 },
    mintedPanel: `<h4 class="font-bold text-green mb-2">NFT #00128 (KOL)</h4><div class="grid grid-cols-2 gap-3 mt-4 text-sm"><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Referrals</p><p class="text-lg font-mono font-bold text-green">234</p></div><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Commission</p><p class="text-lg font-mono font-bold text-white">$15,680</p></div><div class="glass rounded-xl p-3"><p class="text-xs text-white/40">Influence</p><p class="text-lg font-mono font-bold text-purple">87/100</p></div></div>`,
    color: 'green', classBg: 'bg-green-500/10 border-green-500/20' }
];

function tabLabel(identity, active) {
  const activeCls = active ? 'tab-active border-b-2 border-' + identity.color + ' text-' + identity.color : 'tab-inactive';
  return `<button class="px-5 py-3 text-sm font-semibold transition-all ${activeCls}" onclick="switchTab('${identity.id}')">${identity.icon} ${identity.name}</button>`;
}

function mintBlock(identity) {
  const pct = ((identity.quota.minted / identity.quota.total) * 100).toFixed(1);
  return `
    <div id="${identity.id}-unminted" class="fade-in">
      <div class="glass rounded-2xl p-6 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${identity.classBg}">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">${identity.icon}</div>
          <div>
            <h3 class="text-lg font-bold text-white">${identity.nft}</h3>
            <p class="text-xs text-white/50 font-mono mt-0.5">Required Stake: <span class="text-${identity.color} font-semibold">${identity.stake}</span></p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-xs text-white/40">Stake Amount</p>
          <p class="text-2xl font-mono font-bold text-${identity.color}">${identity.stake.split(' ')[0]}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        ${identity.perks.map(p => `<div class="glass rounded-xl p-3 flex items-center gap-2 text-sm">
          <span class="text-green">✓</span><span class="text-white/80">${p}</span>
        </div>`).join('')}
      </div>
      <div class="glass rounded-xl p-4 mb-4">
        <div class="flex justify-between text-xs font-mono mb-2"><span class="text-white/50">Quota</span><span class="text-${identity.color}">${identity.quota.minted.toLocaleString()} / ${identity.quota.total.toLocaleString()}</span></div>
        <div class="h-2 rounded-full bg-white/10 overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-${identity.color === 'gold' ? '#f59e0b' : identity.color === 'brand' ? '#00e5ff' : identity.color === 'purple' ? '#7c3aed' : '#00ff88'} to-${identity.color === 'gold' ? '#fbbf24' : identity.color === 'brand' ? '#00f0ff' : identity.color === 'purple' ? '#a78bfa' : '#00cc6a'}" style="width:${pct}%"></div>
        </div>
        <p class="text-right text-xs text-white/40 font-mono mt-1">${pct}% filled</p>
      </div>
      <button class="btn-mint w-full rounded-xl py-4 text-base" onclick="mintIdentity('${identity.id}')">Mint ${identity.nft}</button>
    </div>
    <div id="${identity.id}-minted" class="fade-in hidden">
      <div class="glass rounded-2xl p-6 mb-4 border border-${identity.color}/30 text-center">
        <div class="text-5xl mb-3">🎖️</div>
        ${identity.mintedPanel}
      </div>
      <p class="text-center text-white/30 text-xs mt-2">✅ Minted on-chain</p>
    </div>`;
}

function generateRingChart() {
  const earned = 12450, pending = 2180, total = earned + pending;
  const pct = earned / total;
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference * (1 - pct);
  return `
  <div class="glass rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
    <div class="relative w-48 h-48 shrink-0">
      <svg viewBox="0 0 160 160" class="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00e5ff"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </linearGradient>
          <filter id="ringGlow"><feGaussianBlur stdDeviation="2.5"/></filter>
        </defs>
        <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="14"/>
        <circle cx="80" cy="80" r="70" fill="none" stroke="url(#ringGrad)" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${dashOffset.toFixed(1)}" filter="url(#ringGlow)"
          style="transition: stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)"/>
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-4xl font-mono font-bold text-white">${(pct*100).toFixed(1)}%</span>
        <span class="text-xs text-white/40 font-mono mt-1">Claimed</span>
        <span class="text-xs text-brand font-mono mt-0.5">APR 12.8%</span>
      </div>
    </div>
    <div class="flex-1 grid grid-cols-2 gap-3">
      <div class="glass rounded-xl p-4">
        <p class="text-xs text-white/40 mb-1">Total Earned</p>
        <p class="text-2xl font-mono font-bold text-white">$${(earned/1000).toFixed(2)}K</p>
        <p class="text-xs text-green mt-1">↑8.2% this month</p>
      </div>
      <div class="glass rounded-xl p-4">
        <p class="text-xs text-white/40 mb-1">Pending Claim</p>
        <p class="text-2xl font-mono font-bold text-purple">$${(pending/1000).toFixed(2)}K</p>
        <p class="text-xs text-white/40 mt-1">Next in 6d 14h</p>
      </div>
      <div class="glass rounded-xl p-4">
        <p class="text-xs text-white/40 mb-1">Monthly Avg</p>
        <p class="text-2xl font-mono font-bold text-white">$3,240</p>
        <p class="text-xs text-white/40 mt-1">30-day trailing</p>
      </div>
      <div class="glass rounded-xl p-4">
        <p class="text-xs text-white/40 mb-1">Reward Pool</p>
        <p class="text-2xl font-mono font-bold text-brand">20%</p>
        <p class="text-xs text-white/40 mt-1">Protocol fees</p>
      </div>
    </div>
  </div>`;
}

function generateProposals() {
  const proposals = [
    { id: 'CIP-12', title: 'Adjust Protocol Fee Split', desc: 'Rebalance fee distribution from 10/5/3 to 12/4/4 for Partners/Experts/Users.', status: 'Active', timeLeft: '3 days', votesFor: 1842, votesAgainst: 356, voted: null },
    { id: 'CIP-11', title: 'Onboard Solana Agents', desc: 'Enable CONTRA agent registration and task matching on Solana network.', status: 'Active', timeLeft: '5 days', votesFor: 2104, votesAgainst: 112, voted: null },
    { id: 'CIP-10', title: 'Increase Node Rewards', desc: 'Raise node operator reward allocation from 20% to 25% of protocol fees.', status: 'Ended', timeLeft: '\u2014', votesFor: 894, votesAgainst: 2341, voted: 'Against' },
    { id: 'CIP-9', title: 'Regional DAO Governance', desc: 'Establish regional sub-DAOs for APAC, EMEA, and Americas.', status: 'Ended', timeLeft: '\u2014', votesFor: 3102, votesAgainst: 87, voted: 'For' },
  ];
  return proposals.map((p, i) => {
    const isActive = p.status === 'Active';
    const barPct = p.votesFor / (p.votesFor + p.votesAgainst) * 100;
    var html = '<div class="glass rounded-2xl p-5 flex flex-col gap-3" id="prop-' + i + '">';
    html += '<div class="flex items-center justify-between">';
        <span class="text-xs font-mono text-white/40">\${p.id}</span>
        <span class="text-xs px-2 py-0.5 rounded-full font-mono \${isActive?'bg-green/20 text-green':'bg-white/5 text-white/30'}">\${p.status}</span>
      </div>
      <h4 class="text-sm font-semibold text-white">\${p.title}</h4>
      <p class="text-xs text-white/40 leading-relaxed">\${p.desc}</p>
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="text-white/40">Weight: <span class="text-brand">3\u00d7</span></span>
        <span class="text-white/40">\${p.timeLeft}</span>
        <span class="text-white/40">\${p.votesFor.toLocaleString()}F / \${p.votesAgainst.toLocaleString()}A</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <div class="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div class="h-full rounded-full bg-green transition-all" style="width:\${barPct.toFixed(0)}%"></div>
        </div>
        <span class="text-xs font-mono text-white/30">\${barPct.toFixed(0)}%</span>
        \${isActive
          ? (p.voted ? \`<span class="text-xs font-mono text-white/30 ml-2">\u2713 Voted \${p.voted}</span>\` : \`<button class="ml-2 px-4 py-1.5 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition" onclick="openVote('\${p.id}','\${p.title.replace(/'/g,"\\'")}',\${i})">Vote</button>\`)
          : \`<span class="text-xs font-mono text-white/20 ml-2">Closed</span>\`}
      </div>
    </div>\`;
  }).join('');
}

const HTML = \`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CONTRA | Dashboard</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>tailwind.config={theme:{extend:{fontFamily:{sans:['Space Grotesk','sans-serif'],mono:['JetBrains Mono','monospace']},colors:{brand:'#00e5ff',green:'#00ff88',purple:'#7c3aed',gold:'#f59e0b'}}}}<\/script>
<style>
*{scrollbar-width:thin;scrollbar-color:#30363d transparent}
.glass{background:rgba(255,255,255,0.03);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border:1px solid rgba(255,255,255,0.06)}
.glass:hover{border-color:rgba(0,229,255,0.2);box-shadow:0 0 30px rgba(0,229,255,0.04)}
.glow-brand{box-shadow:0 0 40px rgba(0,229,255,0.06)}
.glow-green{box-shadow:0 0 40px rgba(0,255,136,0.06)}
.glow-purple{box-shadow:0 0 40px rgba(124,58,237,0.06)}
.glow-gold{box-shadow:0 0 40px rgba(245,158,11,0.06)}
.tab-active{border-bottom:2px solid #00e5ff;color:#00e5ff}
.tab-inactive{color:#8b949e;border-bottom:2px solid transparent}
.tab-inactive:hover{color:#c9d1d9}
.btn-mint{background:linear-gradient(135deg,#00e5ff,#7c3aed);color:#0a0a0f;font-weight:700;letter-spacing:0.02em;transition:all .3s;cursor:pointer}
.btn-mint:hover{transform:translateY(-1px);box-shadow:0 8px 32px rgba(0,229,255,0.25)}
.mint-radio{width:20px;height:20px;border:2px solid rgba(255,255,255,0.15);border-radius:50%;cursor:pointer;flex-shrink:0;transition:all .3s}
.mint-radio.checked{border-color:#00e5ff;background:#00e5ff}
.mint-radio.checked::after{content:'';position:absolute;inset:3px;border-radius:50%;background:#0a0a0f}
.fade-in{animation:fadeIn .5s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse-glow{0%,100%{opacity:.4}50%{opacity:.8}}
.anim-pulse{animation:pulse-glow 2s infinite}
</style>
</head>
<body class="bg-gradient-to-br from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f] min-h-screen text-white font-sans antialiased">

<nav class="glass sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
  <div class="flex items-center gap-3">
    <svg class="w-8 h-8" viewBox="0 0 32 32"><defs><linearGradient id="lg"><stop offset="0%" stop-color="#00e5ff"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><circle cx="16" cy="16" r="14" fill="none" stroke="url(#lg)" stroke-width="2.5"/><circle cx="16" cy="16" r="6" fill="url(#lg)"/></svg>
    <span class="text-xl font-bold tracking-tight">CONTRA</span>
    <span class="text-xs text-white/40 bg-white/[0.04] px-2 py-0.5 rounded-full font-mono">Dashboard</span>
  </div>
  <div class="flex items-center gap-4 text-sm">
    <div class="flex items-center gap-2 glass rounded-full px-4 py-1.5">
      <span class="w-2 h-2 rounded-full bg-green animate-pulse"></span>
      <span class="font-mono text-green">0x1234...5678</span>
    </div>
    <div class="flex items-center gap-1"><span class="text-white/40">Balance</span><span class="font-mono font-semibold">125,000</span><span class="text-white/40 text-xs">CONTRA</span></div>
    <select class="glass rounded-lg px-3 py-1.5 bg-transparent cursor-pointer outline-none text-xs"><option>Ethereum</option><option>Base</option><option>BSC</option><option>Solana</option></select>
  </div>
</nav>

<div class="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="glass rounded-2xl p-5 glow-green"><p class="text-xs text-white/40 tracking-widest uppercase">Total Value</p><p class="text-2xl font-mono font-bold mt-1">$2,847,392</p><p class="text-xs text-green mt-1 font-mono">↑12.3%</p></div>
    <div class="glass rounded-2xl p-5 glow-gold"><p class="text-xs text-white/40 tracking-widest uppercase">Staked</p><p class="text-2xl font-mono font-bold mt-1">100,000</p><p class="text-xs text-gold mt-1 font-mono">Gold Tier</p></div>
    <div class="glass rounded-2xl p-5 glow-brand"><p class="text-xs text-white/40 tracking-widest uppercase">NFT</p><p class="text-2xl font-mono font-bold mt-1">#0421</p><p class="text-xs text-brand mt-1 font-mono">Gold Badge</p></div>
    <div class="glass rounded-2xl p-5 glow-purple"><p class="text-xs text-white/40 tracking-widest uppercase">Earned</p><p class="text-2xl font-mono font-bold mt-1">$12,450<span class="text-lg text-white/40">.80</span></p><p class="text-xs text-purple mt-1 font-mono">Lifetime</p></div>
  </div>

  <!-- Revenue Ring -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div class="md:col-span-2">${generateRingChart()}</div>
    <div class="glass rounded-2xl p-6 flex flex-col justify-between space-y-4">
      <div><p class="text-xs text-white/40 tracking-widest uppercase">Current APR</p><p class="text-3xl font-mono font-bold text-green mt-1">12.8%</p></div>
      <div><p class="text-xs text-white/40 tracking-widest uppercase">Monthly</p><p class="text-xl font-mono font-bold text-white mt-1">$3,240.00</p></div>
      <div><p class="text-xs text-white/40 tracking-widest uppercase">Total Earned</p><p class="text-xl font-mono font-bold text-white mt-1">$12,450.80</p></div>
      <div><p class="text-xs text-white/40 tracking-widest uppercase">Pending</p><p class="text-xl font-mono font-bold text-purple mt-1">$2,180.00</p></div>
    </div>
  </div>

  <!-- NFT Tabs -->
  <div class="glass rounded-2xl p-6">
    <div class="flex justify-center gap-1 mb-6 border-b border-white/10 pb-0" id="tab-bar">
      ${IDENTITIES.map((id, i) => tabLabel(id, i === 0)).join('')}
    </div>
    <div id="tab-content">
      ${mintBlock(IDENTITIES[0])}
    </div>
  </div>

  <!-- Governance Voting -->
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-sm font-semibold text-white/70">Governance Proposals</h3>
    <span class="text-xs font-mono text-white/30">Voting Power: 3× (Gold Tier)</span>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" id="proposals-container">
    ${generateProposals()}
  </div>

  <!-- Vote Modal (hidden by default) -->
  <div id="vote-modal" class="fixed inset-0 z-50 flex items-center justify-center hidden">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeVote()"></div>
    <div class="relative glass rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10">
      <h3 id="vote-title" class="text-lg font-bold text-white mb-2"></h3>
      <p id="vote-desc" class="text-sm text-white/50 mb-6"></p>
      <div class="space-y-3 mb-6">
        <label class="flex items-center gap-3 glass rounded-xl p-4 cursor-pointer hover:border-brand/30 transition" id="opt-for">
          <input type="radio" name="vote" value="For" class="accent-green w-4 h-4">
          <div><span class="text-sm font-semibold text-green">For ✓</span><p class="text-xs text-white/40">Support this proposal</p></div>
        </label>
        <label class="flex items-center gap-3 glass rounded-xl p-4 cursor-pointer hover:border-red-400/30 transition" id="opt-against">
          <input type="radio" name="vote" value="Against" class="accent-red-400 w-4 h-4">
          <div><span class="text-sm font-semibold text-red-400">Against ✗</span><p class="text-xs text-white/40">Oppose this proposal</p></div>
        </label>
        <label class="flex items-center gap-3 glass rounded-xl p-4 cursor-pointer hover:border-white/20 transition" id="opt-abstain">
          <input type="radio" name="vote" value="Abstain" class="accent-white/30 w-4 h-4">
          <div><span class="text-sm font-semibold text-white/50">Abstain —</span><p class="text-xs text-white/40">No position</p></div>
        </label>
      </div>
      <button class="btn-mint w-full rounded-xl py-3" onclick="submitVote()">Confirm Vote</button>
      <p id="vote-error" class="text-xs text-red-400 mt-2 text-center hidden">Please select a voting option</p>
    </div>
  </div>

  <!-- Activity -->
  <div class="glass rounded-2xl p-6">
    <h3 class="text-sm font-semibold text-white/70 mb-4">Recent Activity</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead><tr class="text-xs text-white/40 border-b border-white/10">
          <th class="pb-3 font-medium">Time</th><th class="pb-3 font-medium">Type</th><th class="pb-3 font-medium">Amount</th><th class="pb-3 font-medium">Tx Hash</th><th class="pb-3 font-medium">Status</th>
        </tr></thead>
        <tbody class="font-mono">
          <tr class="border-b border-white/5"><td class="py-3 text-white/50 text-xs">2m ago</td><td class="py-3"><span class="text-brand text-xs">Stake</span></td><td class="py-3 text-xs">+25,000 CONTRA</td><td class="py-3 text-white/30 text-xs">0x3f2a...8b91</td><td class="py-3"><span class="text-xs px-2 py-0.5 rounded-full bg-green/20 text-green">Confirmed</span></td></tr>
          <tr class="border-b border-white/5"><td class="py-3 text-white/50 text-xs">15m ago</td><td class="py-3"><span class="text-purple text-xs">Vote</span></td><td class="py-3 text-xs">CIP-12</td><td class="py-3 text-white/30 text-xs">0xa7c2...4d3e</td><td class="py-3"><span class="text-xs px-2 py-0.5 rounded-full bg-green/20 text-green">Confirmed</span></td></tr>
          <tr class="border-b border-white/5"><td class="py-3 text-white/50 text-xs">1h ago</td><td class="py-3"><span class="text-green text-xs">Claim</span></td><td class="py-3 text-xs">+$3,240 USDC</td><td class="py-3 text-white/30 text-xs">0x9e1f...7a62</td><td class="py-3"><span class="text-xs px-2 py-0.5 rounded-full bg-green/20 text-green">Confirmed</span></td></tr>
          <tr class="border-b border-white/5"><td class="py-3 text-white/50 text-xs">3h ago</td><td class="py-3"><span class="text-gold text-xs">Mint</span></td><td class="py-3 text-xs">NFT #0421</td><td class="py-3 text-white/30 text-xs">0x5d8b...c1f2</td><td class="py-3"><span class="text-xs px-2 py-0.5 rounded-full bg-green/20 text-green">Confirmed</span></td></tr>
          <tr><td class="py-3 text-white/50 text-xs">6h ago</td><td class="py-3"><span class="text-brand text-xs">Stake</span></td><td class="py-3 text-xs">+100,000 CONTRA</td><td class="py-3 text-white/30 text-xs">0x2c4a...9e7d</td><td class="py-3"><span class="text-xs px-2 py-0.5 rounded-full bg-green/20 text-green">Confirmed</span></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</div>

<script>
const identities = ${JSON.stringify(IDENTITIES.map(i => ({id:i.id,name:i.name,icon:i.icon,nft:i.nft,stake:i.stake,perks:i.perks,quota:i.quota,mintedPanel:i.mintedPanel,color:i.color,classBg:i.classBg})))};

let mintedState = {};
let activeTab = 'partner';

function switchTab(id) {
  activeTab = id;
  document.querySelectorAll('#tab-bar button').forEach((btn,i) => {
    const identity = identities[i];
    const isActive = identity.id === id;
    btn.className = 'px-5 py-3 text-sm font-semibold transition-all ' + (isActive ? 'tab-active border-b-2 border-'+identity.color+' text-'+identity.color : 'tab-inactive');
  });
  renderTab(id);
}

function mintIdentity(id) {
  mintedState[id] = true;
  renderTab(id);
}

function renderTab(id) {
  const identity = identities.find(i => i.id === id);
  const pct = ((identity.quota.minted / identity.quota.total)*100).toFixed(1);
  const isMinted = mintedState[id];
  
  const unmintedHTML = '<div id="'+id+'-unminted" class="fade-in '+(isMinted?'hidden':'')+'">'+
    '<div class="glass rounded-2xl p-6 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 '+identity.classBg+'">'+
      '<div class="flex items-center gap-4">'+
        '<div class="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl">'+identity.icon+'</div>'+
        '<div><h3 class="text-lg font-bold text-white">'+identity.nft+'</h3>'+
        '<p class="text-xs text-white/50 font-mono mt-0.5">Required Stake: <span class="text-'+identity.color+' font-semibold">'+identity.stake+'</span></p></div>'+
      '</div>'+
      '<div class="text-right"><p class="text-xs text-white/40">Stake Amount</p>'+
      '<p class="text-2xl font-mono font-bold text-'+identity.color+'">'+identity.stake.split(' ')[0]+'</p></div>'+
    '</div>'+
    '<div class="grid grid-cols-2 gap-3 mb-4">'+
      identity.perks.map(p => '<div class="glass rounded-xl p-3 flex items-center gap-2 text-sm"><span class="text-green">✓</span><span class="text-white/80">'+p+'</span></div>').join('')+
    '</div>'+
    '<div class="glass rounded-xl p-4 mb-4">'+
      '<div class="flex justify-between text-xs font-mono mb-2"><span class="text-white/50">Quota</span><span class="text-'+identity.color+'">'+identity.quota.minted.toLocaleString()+' / '+identity.quota.total.toLocaleString()+'</span></div>'+
      '<div class="h-2 rounded-full bg-white/10 overflow-hidden"><div class="h-full rounded-full bg-'+identity.color+'" style="width:'+pct+'%"></div></div>'+
      '<p class="text-right text-xs text-white/40 font-mono mt-1">'+pct+'% filled</p>'+
    '</div>'+
    '<button class="btn-mint w-full rounded-xl py-4 text-base" onclick="mintIdentity(\''+id+'\')">Mint '+identity.nft+'</button>'+
  '</div>';
  
  const mintedHTML = '<div id="'+id+'-minted" class="fade-in '+(isMinted?'':'hidden')+'">'+
    '<div class="glass rounded-2xl p-6 mb-4 border border-'+identity.color+'/30 text-center">'+
      '<div class="text-5xl mb-3">🎖️</div>'+
      identity.mintedPanel+
    '</div>'+
    '<p class="text-center text-white/30 text-xs mt-2">✅ Minted on-chain</p>'+
  '</div>';
  
  document.getElementById('tab-content').innerHTML = unmintedHTML + mintedHTML;
}

// Voting state
let currentVoteProposalId = null;
let currentVoteIndex = null;

function openVote(id, title, index) {
  currentVoteProposalId = id;
  currentVoteIndex = index;
  document.getElementById('vote-title').textContent = id + ': ' + title;
  document.getElementById('vote-desc').textContent = 'Cast your vote with 3\u00d7 voting weight (Gold Tier)';
  document.querySelectorAll('input[name="vote"]').forEach(r => r.checked = false);
  document.getElementById('vote-error').classList.add('hidden');
  document.getElementById('vote-modal').classList.remove('hidden');
}

function closeVote() {
  document.getElementById('vote-modal').classList.add('hidden');
  currentVoteProposalId = null;
}

function submitVote() {
  const selected = document.querySelector('input[name="vote"]:checked');
  if (!selected) {
    document.getElementById('vote-error').classList.remove('hidden');
    return;
  }
  const choice = selected.value;
  // Update the proposal card
  const propEl = document.getElementById('prop-' + currentVoteIndex);
  if (propEl) {
    const btnRow = propEl.querySelector('button');
    if (btnRow) {
      btnRow.outerHTML = '<span class="text-xs font-mono text-white/40 ml-2">\u2713 Voted ' + choice + '</span>';
    }
  }
  closeVote();
}

switchTab('partner');
</script>
</body>
</html>`;

const outPath = path.join(__dirname, 'ui-prototype', 'dashboard.html');
fs.writeFileSync(outPath, HTML, 'utf8');
console.log('Dashboard written:', outPath, '(' + HTML.length + ' bytes)');
