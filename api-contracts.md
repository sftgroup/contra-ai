# Contra AI Phase 1 — API 接口定义

> Date: 2026-06-27 | Phase 1: 官网 + 4链铸造 + Dashboard

---

## 数据来源

| 数据 | 来源 | 说明 |
|------|------|------|
| 链上状态 | 合约 read 调用 | multicall 批量化 |
| 跨链聚合 | 中继器 REST API | 4 链汇总 |
| 静态内容 | 前端本地 | 白皮书、FAQ 等 |

---

## 1. 官网 (Homepage) 接口

### GET /api/stats

> 中继器提供。官网 Hero 区展示全局铸造进度。

```
GET https://relay.contra.ai/api/stats
```

**Response**
```json
{
  "totalMinted": 127,
  "totalSupply": 500,
  "byChain": {
    "base": 50,
    "bsc": 30,
    "eth": 45,
    "solana": 2
  },
  "maxSupplyByChain": {
    "base": 200,
    "bsc": 100,
    "eth": 100,
    "solana": 100
  },
  "paused": false,
  "pausedChains": []
}
```

**降级**: 中继器不可用时，前端用 `useReadContract` multicall 直读 4 链合约（静态 RPC 列表）。

---

## 2. 铸造页面 (Mint) 接口

铸造页面需要的数据全部来自链上合约，不需要 API。

### 每链合约 read 调用

| 调用 | 合约 | 方法 | 返回 |
|------|------|------|------|
| 总进度 | ContraNFT | `totalMinted()` | `uint256` |
| 总量上限 | ContraNFT | `maxSupply()` | `uint256` |
| 是否暂停 | ContraNFT | `paused()` | `bool` |
| 铸造价格 | ContraNFT | `MINT_PRICE()` | `uint256` (10000 USDC = 10000e6) |
| USDC 地址 | ContraNFT | `usdc()` | `address` |

### 铸造交易

```
调用 ContraNFT.mint()
前置条件: 用户 approve USDC(MINT_PRICE) → ContraNFT 地址
```

---

## 3. Dashboard 接口

Dashboard 数据来源：中继器 API（跨链聚合） + 合约读（单链详情）。

### GET /api/account/{address}

> 中继器提供。Dashboard 首页数据——NFT 列表 + 邀请统计。

```
GET https://relay.contra.ai/api/account/0x...
```

**Response**
```json
{
  "address": "0xabcdef...",

  "nfts": [
    {
      "tokenId": 42,
      "chain": "base",
      "chainId": 8453,
      "contractAddress": "0x...",
      "blockExplorerLink": "https://basescan.org/nft/0x.../42",
      "imageUrl": "https://contra.ai/nft/42.png",
      "mintedAt": 1719500000
    },
    {
      "tokenId": 7,
      "chain": "eth",
      "chainId": 1,
      "contractAddress": "0x...",
      "blockExplorerLink": "https://etherscan.io/nft/0x.../7",
      "imageUrl": "https://contra.ai/nft/7.png",
      "mintedAt": 1719510000
    }
  ],

  "totalNfts": 2,
  "byChain": { "base": 1, "eth": 1 },

  "inviteStats": {
    "total": 127,
    "byChain": { "base": 50, "bsc": 30, "eth": 45, "solana": 2 },
    "directInvitees": 45,
    "inviteLink": "https://contra.ai/invite?ref=0xabcdef..."
  },

  "isShareholder": true
}
```

**降级**: API 不可用时，NFT 列表从链上查（`ownerOf` 遍历 + `balanceOf`），邀请统计只读当前链的 CeresRegistry `inviteCount[address]`。

---

### GET /api/account/{address}/nfts

> 中继器提供。仅 NFT 列表（分页）。

```
GET https://relay.contra.ai/api/account/0x.../nfts?page=1&limit=20
```

**Response**
```json
{
  "address": "0xabcdef...",
  "nfts": [ ... ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### GET /api/account/{address}/invites

> 中继器提供。邀请详情（分页），包含直接邀请列表。

```
GET https://relay.contra.ai/api/account/0x.../invites?page=1&limit=20
```

**Response**
```json
{
  "address": "0xabcdef...",
  "inviteStats": {
    "total": 127,
    "byChain": { "base": 50, "bsc": 30, "eth": 45, "solana": 2 },
    "inviteLink": "https://contra.ai/invite?ref=0xabcdef..."
  },
  "invitees": [
    {
      "address": "0x...",
      "chain": "base",
      "authorizedAt": 1719500000,
      "hasMinted": true,
      "mintedTokenId": 42,
      "mintedChain": "base"
    },
    {
      "address": "0x...",
      "chain": "bsc",
      "authorizedAt": 1719510000,
      "hasMinted": false
    }
  ],
  "total": 127,
  "page": 1,
  "limit": 20
}
```

---

### GET /api/invite/{address}/ancestors

> 中继器提供。邀请链路——"谁邀请了你，谁又邀请了他"（最多 10 层）。

```
GET https://relay.contra.ai/api/invite/0xBCD.../ancestors
```

**Response**
```json
{
  "address": "0xBCD...",
  "ancestors": [
    { "address": "0xABC...", "depth": 1, "chain": "base" },
    { "address": "0x002...", "depth": 2, "chain": "base" },
    { "address": "0x001...", "depth": 3, "chain": "base" }
  ]
}
```

**降级**: API 不可用时调 CeresRegistry `getInviteAncestors(address, 10)`。

---

## 4. 邀请落地页 接口

邀请落地页只需要链上合约读 + 一笔交易，不需要 API。

### 合约读

| 调用 | 合约 | 方法 | 返回 |
|------|------|------|------|
| 是否已被邀请 | CeresRegistry | `isInvited(address)` | `bool` |
| 邀请费金额 | CeresRegistry | `inviteFee()` | `uint256` |
| 邀请费开关 | CeresRegistry | `inviteFeeEnabled()` | `bool` |

### 授权交易

```
调用 CeresRegistry.authorizeInvite(refAddress) { value: inviteFee }
```

---

## 5. 接口总结

| API | 提供方 | 用途 | 页面 |
|------|------|------|------|
| `GET /api/stats` | 中继器 | 全局铸造进度 | 官网 Hero |
| `GET /api/account/{addr}` | 中继器 | NFT + 邀请概览 | Dashboard |
| `GET /api/account/{addr}/nfts` | 中继器 | NFT 分页列表 | Dashboard |
| `GET /api/account/{addr}/invites` | 中继器 | 邀请详情分页 | Dashboard |
| `GET /api/invite/{addr}/ancestors` | 中继器 | 邀请链路 | Dashboard |
| 合约 read (multicall) | 链上 | 铸造状态、邀请状态 | Mint / Invite 页 |
| 合约 write | 链上 | mint / authorizeInvite | Mint / Invite 页 |

---

## 6. 降级总表

| 场景 | API 行为 | 前端降级 |
|------|------|------|
| 中继器宕机 | 所有 `/api/*` 不可用 | 官网: 合约直读；Dashboard: 合约直读（单链） |
| 某链 RPC 断开 | `byChain[chain]` 为 `null` | 前端跳过该链，显示"—" |
| 合约暂停 | API 正常返回 | 前端禁用铸造按钮 + 显示"已售罄" |

---

## 7. 前端数据流

```
┌──────────────────────────────────────────────┐
│                   前端                        │
│                                               │
│  首页 ──GET──→ /api/stats ──→ 中继器          │
│        降级: multicall 4 链                   │
│                                               │
│  铸造页 ──multicall──→ 链上合约               │
│                                               │
│  Dashboard ──GET──→ /api/account/{addr}       │
│            ──GET──→ /api/account/{addr}/invites│
│            降级: 合约直读                      │
│                                               │
│  邀请页 ──read──→ CeresRegistry               │
│          ──write─→ authorizeInvite()          │
└──────────────────────────────────────────────┘
```

---

*本接口 v1。随开发推进补全。*
