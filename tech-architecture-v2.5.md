# Contra AI Phase 1 — 技术方案 v2.5

> Version: 2.5 | Date: 2026-06-27 | Author: Wayne  
> v2.4→v2.5：Ceres 地址级邀请 + 邀请费 + 中继器跨链聚合 + 链下多链邀请统计

---

## 1. 四链架构

### 合约配额（可调）

| 链 | maxSupply | 可调 |
|---|:--:|:--:|
| Base | 200 | ✅ |
| BSC | 100 | ✅ |
| Ethereum | 100 | ✅ |
| Solana | 100 | ✅ |

### 双保险总控

- **第一道**：合约硬顶 `require(totalMinted < maxSupply)`
- **第二道**：中继器 `globalTotal ≥ 500 → pause()`

---

## 2. 合约设计

### ContraNFT（7 方法）

```solidity
function mint() external;
function pause() / unpause() external onlyOwner;
function setMaxSupply(uint256) external onlyOwner;
function setTreasury(address) external onlyOwner;
function setBeneficiary(address) external onlyOwner;
```

### Treasury（自动转账 + 手动兜底）

```solidity
function deposit(uint256 amount) external {
    usdc.transferFrom(msg.sender, address(this), amount);
    if (autoForward) {
        usdc.transfer(beneficiary, amount);
    }
}
function manualWithdraw(uint256 amount) external onlyOwner {
    usdc.transfer(beneficiary, amount);
}
```

---

## 3. Ceres 地址级邀请（v2）

### 核心：纯地址级数据结构

完全独立于 Ceres DID，零依赖 tokenId：

```solidity
mapping(address => address) public inviter;         // invitee → inviter
mapping(address => address[]) private _invitees;     // inviter → 直接邀请列表
mapping(address => uint256) public inviteCount;      // inviter → 子孙总数
```

### authorizeInvite（payable，支持邀请费）

```solidity
function authorizeInvite(address _inviter) external payable {
    if (inviteFeeEnabled) {
        require(msg.value >= inviteFee, "Insufficient invite fee");
    }
    require(_inviter != msg.sender, "Self-invite");
    require(_inviter != address(0), "Invalid inviter");
    require(inviter[msg.sender] == address(0), "Already invited");

    inviter[msg.sender] = _inviter;
    _invitees[_inviter].push(msg.sender);
    _updateInviteCounts(_inviter, 1);

    emit InviteAuthorized(_inviter, msg.sender, block.timestamp);
}
```

| 特性 | 说明 |
|------|------|
| 单参数 | 只传 `_inviter`，caller 就是被邀请人 |
| payable | 支持邀请费 |
| inviteFee | Owner 可配，默认 0（向后兼容） |
| inviteFeeEnabled | Owner 可开关 |
| 零 DID 依赖 | 不查 `tokenOf`，不掉 `didContract` |

### 邀请费管理

```solidity
uint256 public inviteFee = 0;           // 默认不收
bool public inviteFeeEnabled = false;   // 默认关闭

function setInviteFee(uint256 _fee) external onlyOwner;
function toggleInviteFee(bool _enabled) external onlyOwner;
// withdrawFees() 统一提现（mintFee + inviteFee）
```

每条链独立设置：Base 0.0001 ETH / BSC 0.0005 BNB / ETH 0.002 ETH / Solana 0.001 SOL

### 查询视图

| 合约方法 | 返回 |
|------|------|
| `getInviter(address)` | address（谁邀请了这个地址） |
| `getInvitees(address)` | address[]（直接邀请列表） |
| `getInviteCount(address)` | uint256（子孙总数） |
| `isInvited(address)` | bool |
| `getInviteAncestors(address, depth)` | address[] |

### 计数链路

```solidity
function _updateInviteCounts(address _inviter, uint256 delta) internal {
    address current = _inviter;
    while (current != address(0)) {
        inviteCount[current] += delta;
        current = inviter[current];
    }
}
```

### 为什么保留 DID 层

| 层 | Key | 用途 |
|------|------|------|
| DID 层 | tokenId | `createProfile` / `inviterOf` / `descendantCount` — Ceres 自身 |
| 地址层 | address | `authorizeInvite` / `inviter` / `inviteCount` — 第三方 |

两套独立运作，互不干扰。

---

## 4. 中继器（完整设计）

### 中继器作用

一个 Node.js 进程，做三件事：

| # | 功能 | 写合约？ | 写 DB？ |
|---|------|:--:|:--:|
| 1 | 监听 4 条链 `MintEvent` → 全局计数 ≥500 → `pause()` | ✅ | 内存 |
| 2 | 监听 4 条链 `InviteAuthorized` → 汇总入 DB | ❌ | ✅ |
| 3 | 暴露 REST API：`/api/stats` `/api/invites` `/api/status` | — | — |

### 架构图

```
                    ┌─────────────────────────┐
                    │      中继器 (Node.js)     │
                    │  PM2 常驻，单进程          │
                    │                          │
  Base ──ws──────→  │ ┌─────────────────────┐  │
  BSC  ──ws──────→  │ │  事件监听器 (4个ws)   │  │
  ETH  ──ws──────→  │ │  MintEvent           │  │
  Solana─ws──────→  │ │  InviteAuthorized    │  │
                    │ └────────┬────────────┘  │
                    │          ↓               │
                    │ ┌──────────────────────┐ │   ──→ GET /api/stats
                    │ │   状态 + DB           │ │   ──→ GET /api/invites?addr=0x...
                    │ │  mintCount (内存)     │ │   ──→ GET /api/status
                    │ │  inviteLogs (LevelDB) │ │
                    │ └────────┬─────────────┘ │
                    │          ↓               │
                    │ ┌──────────────────────┐ │
                    │ │  检查器 (每5秒)       │ │
                    │ │  globalTotal ≥ 500?   │ │
                    │ │  → pause() 交易       │ │
                    │ └──────────────────────┘ │
                    └─────────────────────────┘
```

### 组件 1：事件监听器

```javascript
// 每条链一个 ws 连接
const chains = {
  base: {
    rpc: 'wss://base-mainnet.g.alchemy.com/v2/...',
    contract: '0x...',  // ContraNFT 地址
    ceresRegistry: '0x...', // CeresRegistry 地址
  },
  bsc: { ... },
  eth: { ... },
  solana: { ... },  // Solana 用 @solana/web3.js connection.onLogs
};

// 监听 ContraNFT.MintEvent (bytes32 indexed, uint256)
for (const [name, chain] of Object.entries(chains)) {
  const c = new ethers.Contract(chain.contract, CONTRA_ABI, wsProvider);
  c.on('MintEvent', (minter, tokenId, event) => {
    if (seenMints.has(event.log.transactionHash)) return;
    seenMints.add(event.log.transactionHash);
    chainMintCount[name]++;
    checkGlobalCap();
  });

  // 监听 CeresRegistry.InviteAuthorized (address indexed, address indexed, uint256)
  const reg = new ethers.Contract(chain.ceresRegistry, CERES_REGISTRY_ABI, wsProvider);
  reg.on('InviteAuthorized', (inviter, invitee, timestamp, event) => {
    if (seenInvites.has(event.log.transactionHash)) return;
    seenInvites.add(event.log.transactionHash);
    // 写入 DB
    inviteDB.put(`${inviter}:${invitee}:${event.log.transactionHash}`, JSON.stringify({
      chain: name,
      inviter,
      invitee,
      timestamp: Number(timestamp),
      blockNumber: event.log.blockNumber,
    }));
  });
}
```

### 组件 2：状态 + DB

| 存储 | 类型 | 内容 |
|------|------|------|
| `chainMintCount` | 内存 Map | `{base: 50, bsc: 30, eth: 45, solana: 20}` |
| `seenMints` | 内存 Set | txHash 去重 |
| `seenInvites` | 内存 Set | txHash 去重 |
| `inviteDB` | LevelDB | `{chain, inviter, invitee, timestamp, blockNumber}` |

### 组件 3：检查器（每 5 秒）

```javascript
function checkGlobalCap() {
  const total = Object.values(chainMintCount).reduce((a, b) => a + b, 0);
  if (total >= 500) {
    // 逐条链检查 paused 状态，未暂停的调 pause()
    for (const [name, chain] of Object.entries(chains)) {
      const c = new ethers.Contract(chain.contract, CONTRA_ABI, signer);
      if (!(await c.paused())) {
        await c.pause();
        console.log(`[relay] paused ${name}`);
      }
    }
  }
}
```

### 组件 4：REST API

```
GET /api/stats
→ {
    "totalMinted": 127,
    "byChain": { "base": 50, "bsc": 30, "eth": 45, "solana": 2 },
    "totalSupply": 200,  // 四条链 maxSupply 之和
  }

GET /api/invites?addr=0x...
→ {
    "total": 127,
    "byChain": { "base": 50, "bsc": 30, "eth": 45, "solana": 2 },
    "invitees": [...],  // 分页
    "link": "https://contra.ai/invite?ref=0x..."
  }

GET /api/status
→ { "relay": "running", "chains": { "base": "ok", ... }, "uptime": 3600 }
```

### 多链邀请聚合流程

```
[A 在 Base 上邀请 B]
    B 在 Base 调 authorizeInvite(A)
    → Base CeresRegistry emit InviteAuthorized(A, B)
    → 中继器 ws 收到 → 写 DB

[A 在 Base 上邀请 C，C 在 BSC 上授权]
    C 在 BSC 调 authorizeInvite(A)
    → BSC CeresRegistry emit InviteAuthorized(A, C)
    → 中继器 ws 收到 → 写 DB

[Dashboard 查询 A 的邀请统计]
    前端 GET /api/invites?addr=A
    → 中继器查 DB → {total: 2, byChain: {base: 1, bsc: 1}}
```

### 降级策略

| 场景 | 行为 |
|------|------|
| 中继器宕机 | 合约功能不受影响。邀请聚合不可用 → 单链前端降级读链上 |
| 某链 RPC 断开 | 该链邀请事件遗漏 → 重启后 scan from last block 补录 |
| LevelDB 损坏 | 扫描事件日志全量重建 |
| pause() 交易失败 | 下次检查周期重试 |

### 部署

```bash
# PM2 常驻
pm2 start relay.js --name contra-relay --restart-delay 5000

# 环境变量
RPC_BASE_WSS=...
RPC_BSC_WSS=...
RPC_ETH_WSS=...
RPC_SOLANA_WSS=...
PRIVATE_KEY=...
```

---

## 5. 用户流程

### 邀请

```
[A — Dashboard]
   链接: contra.ai/invite?ref=A_ADDRESS
   统计: GET /api/invites?addr=A → {total, byChain, invitees}
     ↓
[B — 打开 contra.ai/invite?ref=A]
   连接钱包 → 检测当前链
   "A 邀请你加入 Contra AI"
   点"授权加入"（如开启 inviteFee，需付小额费用）
     ↓
[链上] authorizeInvite(A)
    emit InviteAuthorized(A, B)
    inviteCount[A] += 1
     ↓
[中继器] 监听到事件 → 写入 DB
     ↓
[完成] B 看到"已加入！→ 铸造 NFT"
```

### 铸造

连接钱包 → 选择链 → Approve USDC → 确认铸造 → USDC→NFT合约→金库→自动转钱包 → 拿到 NFT

---

## 6. 前端架构

| 页面 | 路由 | 说明 |
|------|------|------|
| 官网 | `/` | Hero + 白皮书 |
| 铸造 | `/mint` | 4链选择 + 铸造流程 |
| Dashboard | `/dashboard` | NFT资产 + 邀请统计 + 链接 |
| 邀请落地页 | `/invite?ref=ADDR` | 授权加入 |
| 多语言 | i18n | zh-CN / en |

### Dashboard 多链邀请

```tsx
function Dashboard() {
  const { address } = useAccount();

  // 优先读中继器 API（跨链汇总）
  const { data } = useQuery({
    queryKey: ['invites', address],
    queryFn: () => fetch(`/api/invites?addr=${address}`).then(r => r.json()),
  });

  // 降级：单链合约读
  const { data: chainCount } = useInviteCount(address);

  const inviteCount = data?.total ?? Number(chainCount ?? 0);

  return (
    <div>
      <InviteLink url={`https://contra.ai/invite?ref=${address}`} count={inviteCount} />
      <NFTCard />
    </div>
  );
}
```

### 邀请落地页

```tsx
function InvitePage() {
  const [params] = useSearchParams();
  const ref = params.get('ref') as `0x${string}`;
  const { address } = useAccount();
  const { chain } = useNetwork();

  // 检查当前链是否支持
  const chainSupported = SUPPORTED_CHAINS.includes(chain?.id);

  // 查询邀请费率
  const { data: fee } = useInviteFee();
  const { data: feeEnabled } = useInviteFeeEnabled();
  const { authorizeInvite, isPending } = useAuthorizeInvite();

  const handleJoin = async () => {
    await authorizeInvite(ref, feeEnabled ? (fee as bigint) : undefined);
  };

  return (
    <div>
      <h1>{shortenAddr(ref)} 邀请你加入 Contra AI</h1>
      {!chainSupported && <SwitchChainHint />}
      {feeEnabled && <FeeNotice fee={fee} />}
      <button onClick={handleJoin}>授权加入</button>
    </div>
  );
}
```

---

## 7. 合约影响

| 合约 | 变更 |
|------|:--:|
| ContraNFT | 不变 |
| Treasury | 不变 |
| CeresRegistry | **+authorizeInvite + inviteFee + 管理方法 + 事件** |
| CeresDID | 不变 |

---

## 8. 安全性

| 风险 | 缓解 |
|------|------|
| 伪造 ref | authorizeInvite 不依赖任何 VIP 地址，随意 |
| 重复授权 | `inviter[invitee] == address(0)` 拒绝 |
| 中继器私钥泄露 | 仅能调 pause/unpause/setMaxSupply/setTreasury/setBeneficiary |
| 中继器宕机 | 合约硬顶兜底，邀请统计降级到链上单读 |

---

## 9. 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解 |
|---|------|:--:|:--:|------|
| 1 | 合约bug | 低 | 🔴 | 极简+审计+测试网 |
| 2 | Owner私钥泄露 | 低 | 🔴 | 多签 |
| 3 | 中继器宕机 | 低 | 🟡 | 合约硬顶兜底 |
| 4 | Ceres不可用 | 低 | 🟡 | 邀请降级 |
| 5 | 自动转账失败 | 低 | 🟡 | manualWithdraw |

---

## 10. 版本全览

| 维度 | v2.1 | v2.2 | v2.3 | v2.4 | v2.5 |
|------|------|------|------|------|------|
| 等级 | 平等 | 平等 | — | — | — |
| 资金 | 三层手动 | 三层自动 | — | — | — |
| Ceres | mapping | SDK | 纯读 | createProfile | **地址级+邀请费** |
| 中继器 | pause | — | — | — | **pause+邀请聚合+API** |
| 跨链邀请 | — | — | — | — | **链下聚合** |

## 11. P0 任务拆分

| # | 任务 | 负责 | 工时 |
|---|------|------|:--:|
| 1 | 项目脚手架 | frontend-dev | 0.5 |
| 2 | EVM ContraNFT 合约 | contract-dev | 1 |
| 3 | 金库合约 | contract-dev | 0.5 |
| 4 | Solana 合约 | contract-dev | 1.5 |
| 5 | EVM 测试网部署 | contract-dev | 0.5 |
| 6 | Solana 测试网部署 | contract-dev | 0.5 |
| 7 | **中继器（3合1：pause+邀请+API）** | backend-dev | 2 |
| 8 | Navbar+Footer+Hero | frontend-dev | 1 |
| 9 | 白皮书页面 | frontend-dev | 1 |
| 10 | 钱包Hook | frontend-dev | 1.5 |
| 11 | 铸造页面 | frontend-dev | 2 |
| 12 | Dashboard（邀请+多链） | frontend-dev | 1.5 |
| 13 | 邀请落地页 | frontend-dev | 1 |
| 14 | Ceres v2 合约部署 | contract-dev | 0.5 |
| 15 | 多语言 | frontend-dev | 1 |
| 16 | 联调 | frontend-dev | 1.5 |
| 17 | E2E | tester | 2 |
| 18 | QA | qa | 0.5 |
| 19 | Security | security | 0.5 |
| **总计** | | | **~20.5 天** |

> 3 人并行约 7-9 天。

---

*本方案 v2.5。Ceres v2 已 commit (edb7847)，patch 保存在 workspace/contra-ai/。*
