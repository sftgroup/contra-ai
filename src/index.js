#!/usr/bin/env node
'use strict';

const express = require('express');
const cors = require('cors');
const config = require('./config');
const state = require('./state');
const listener = require('./listener');
const inviteStore = require('./inviteStore');
const apiRouter = require('./api');

const app = express();

// ───── Middleware ─────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://contra.ai',
  methods: ['GET'],
  allowedHeaders: ['Content-Type'],
}));

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 60000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[http] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ───── Routes ─────
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.floor((Date.now() - state.startTime) / 1000) });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[http] Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

// ───── Startup ─────
async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Contra AI Relay Service v1.0.0');
  console.log('═══════════════════════════════════════════');
  console.log(`  RPCs:     base=${config.RPC_URLS.base.split('//')[1].split('.')[0]} bsc=${config.RPC_URLS.bsc.split('//')[1].split('.')[0]} eth=${config.RPC_URLS.eth.split('//')[1].split('.')[0]} solana=${config.RPC_URLS.solana.split('//')[1].split('.')[0]}`);
  console.log(`  Chains:   ${config.CHAINS.map(c => c.name).join(', ')}`);
  console.log(`  Port:     ${config.PORT}`);
  console.log(`  LevelDB:  ${config.LEVEL_DB_PATH}`);
  console.log('───────────────────────────────────────────');

  // 1. Initialize LevelDB
  try {
    await inviteStore.initInviteDB();
    console.log('[init] LevelDB ready');
  } catch (err) {
    console.error(`[init] Fatal: LevelDB init failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Start event listeners
  try {
    await listener.initListeners();
    console.log('[init] Event listeners started on 4 chains');
  } catch (err) {
    console.error(`[init] Listener init failed: ${err.message}`);
    console.error('[init] Continuing without listeners — API will use memory state');
  }

  // 3. Start Express server
  app.listen(config.PORT, () => {
    console.log(`[init] REST API listening on port ${config.PORT}`);
    console.log('───────────────────────────────────────────');
    console.log('  Endpoints:');
    console.log(`    GET /api/stats`);
    console.log(`    GET /api/account/{address}`);
    console.log(`    GET /api/account/{address}/nfts?page=1&limit=20`);
    console.log(`    GET /api/account/{address}/invites?page=1&limit=20`);
    console.log(`    GET /api/invite/{address}/ancestors`);
    console.log(`    GET /api/status`);
    console.log(`    GET /health`);
    console.log('═══════════════════════════════════════════');
  });
}

main().catch((err) => {
  console.error(`[init] Fatal startup error: ${err.message}`);
  process.exit(1);
});

// ───── Graceful Shutdown ─────
process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM received. Shutting down gracefully...');
  if (state.inviteDB) {
    await state.inviteDB.close().catch(() => {});
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[shutdown] SIGINT received. Shutting down...');
  if (state.inviteDB) {
    await state.inviteDB.close().catch(() => {});
  }
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error(`[fatal] Uncaught exception: ${err.message}`);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[fatal] Unhandled rejection at:`, promise, 'reason:', reason);
});
