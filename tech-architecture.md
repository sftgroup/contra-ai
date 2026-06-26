# Contra AI Phase 1 — 技术架构文档

> 版本: 0.1 | 日期: 2026-06-27 | 作者: Wayne  
> 交付范围: 官网 + NFT铸造 + Dashboard

---

## 1. 四链共享总量 500 方案

### 选定方案：自建中继器 + 各链独立合约

```
用户 → Web3Modal → 选择链 → 链上 Mint
                                   ↓
                              Emit: MintEvent(chainId, tokenId, minter)
                                   ↓
                          ┌─── 自建中继器 ───┐
                          │  监听所有链事件     │
                          │  totalMinted++    │
                          │  当 ≥500 → pause  │
                          └──────────────────┘
                                   ↓
                    Base.pause() / BSC.pause() / ETH.pause() / SOL.pause()
```

### 架构说明

| 组件 | 说明 |
|------|------|
| **合约** | 每条链独立部署 NFT 合约，内部无总量限制，但有一个 `paused` 开关 |
| **中继器** | Node.js 服务，部署在测试服务器，监听所有 4 链的 Mint 事件 |
| **总量控制** | 中继器维护 `totalMinted`，达 500 时依次调用各链 `pause()` |
| **前端查询** | 中继器提供 REST API `GET /api/stats` 给前端展示铸造进度 |

### 合约接口（每条链统一）

```solidity
interface ICONTRANFT {
    function mint() external payable;           // 用户铸造
    function pause() external onlyOwner;         // 中继器关停
    function unpause() external onlyOwner;       // 恢复（应急）
    function paused() external view returns (bool);
    function totalMinted() external view returns (uint256);  // 本链已铸造
    function mintPrice() external view returns (uint256);    // 10000 USDC
    function maxSupply() external view returns (uint256);    // 500（对外展示用）

    event MintEvent(address indexed minter, uint256 tokenId, uint256 chainId, uint256 timestamp);
}
```

### 中继器伪代码

```javascript
// relay.js — 部署在 129.226.202.72
const chains = {
  base:   { contract: '0x...', rpc: 'https://base-mainnet...' },
  bsc:    { contract: '0x...', rpc: 'https://bsc-dataseed...' },
  eth:    { contract: '0x...', rpc: 'https://eth-mainnet...' },
  solana: { contract: '0x...', rpc: 'https://solana-mainnet...' },
};

let totalMinted = 0;  // 从链上回溯恢复

for (const [chain, cfg] of Object.entries(chains)) {
  // 1. 历史事件回溯（启动时同步已有铸造数）
  const pastEvents = await contract.queryFilter('MintEvent', fromBlock);
  totalMinted += pastEvents.length;

  // 2. 实时监听
  contract.on('MintEvent', async (minter, tokenId, chainId) => {
    totalMinted++;
    console.log(`[${chain}] Mint #${totalMinted}/500`);

    if (totalMinted >= 500) {
      console.log('🛑 总量达到 500，执行全局暂停...');
      for (const [c, cfg2] of Object.entries(chains)) {
        await cfg2.contract.pause();
        console.log(`  ✅ ${c} 已暂停`);
      }
    }
  });
}

// 3. REST API 给前端
app.get('/api/stats', (req, res) => {
  res.json({ totalMinted, maxSupply: 500, remaining: 500 - totalMinted, lastUpdated: new Date() });
});
```

### 关键保障

| 风险 | 缓解措施 |
|------|---------|
| 中继器宕机 | 重启后自动从事件日志回溯补全计数 |
| 中继器重复计数 | 事件去重（基于 txHash + logIndex） |
| 500 满了中继器没反应 | 合约层设硬上限 `require(totalMinted < 500)`（可选） |
| 某链卖得慢 | 无需干预，自然流动 |
| 极少数超出 500 | Phase 1 可接受，后续手动退币 |

### 对比总结

| 方案 | 去中心化 | 复杂度 | Gas成本 | Phase1适配 |
|------|:--:|:--:|------|:--:|
| LayerZero 跨链消息 | ✅ 完全 | 高 | 每笔铸造都贵 | ❌ 过度 |
| **自建中继器** | ⚠️ 中继器中心化 | **中** | **极低** | **✅ 最佳** |
| 合约预设配额 | ✅ | 低 | 零 | ✅ 可用 |
| 中心化 API 计数器 | ❌ | 低 | 零 | ⚠️ 风险 |

---

## 2. 前端架构

### 技术选型

| 项 | 选型 | 理由 |
|----|------|------|
| **框架** | React 18 + Vite | 快速构建，已有原型 HTML 可复用 |
| **样式** | Tailwind CSS | 原型已用，统一 |
| **路由** | React Router v6 | SPA 路由（5个页面） |
| **钱包 EVM** | Web3Modal v3 + Wagmi v2 | Base/BSC/ETH |
| **钱包 Solana** | @solana/wallet-adapter | Solana 链 |
| **多语言** | react-i18next | 成熟稳定，JSON 文件管理 |
| **动效** | Framer Motion | UI原型已有动画定义 |
| **部署** | Nginx + Docker | 部署到测试服务器 |

### 为什么不选 Next.js？

Phase 1 是纯前端应用，没有 SSR 需求：
- 所有内容静态展示（官网）
- 钱包交互是客户端行为
- 多语言可以客户端加载
- Vite 构建更快，配置更简单

Phase 2+ 需要 SSR/SEO 时可升级 Next.js。

### 目录结构

```
contra-ai/frontend/
├── public/
│   └── locales/           # 多语言 JSON
│       ├── zh.json
│       └── en.json
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Footer.jsx
│   │   ├── WalletButton.jsx
│   │   ├── ChainSelector.jsx
│   │   ├── MintProgress.jsx
│   │   ├── HeroSection.jsx
│   │   ├── MilestoneSection.jsx
│   │   ├── StakeholderSection.jsx
│   │   └── DashboardPanel.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Mint.jsx
│   │   ├── Whitepaper.jsx
│   │   ├── Dashboard.jsx
│   │   └── Stakeholder.jsx
│   ├── hooks/
│   │   ├── useWallet.js       # 封装 Web3Modal + Solana
│   │   ├── useMint.js         # 铸造流程状态
│   │   └── useStats.js        # 轮询中继器 API
│   ├── contracts/
│   │   ├── ContraNFT.json     # ABI
│   │   └── addresses.json     # 4 链合约地址
│   ├── i18n.js
│   ├── App.jsx
│   └── main.jsx
├── tailwind.config.js
├── vite.config.js
└── package.json
```

### 多链钱包方案

```javascript
// hooks/useWallet.js
// EVM: Web3Modal + Wagmi
// Solana: @solana/wallet-adapter-react
// 统一接口：{ address, chainId, chainType, connect, disconnect, signMessage }
```

### 页面路由

```
/                 → Home (Hero + 里程碑 + 股东权益)
/mint             → 铸造页 (链选择 + 铸造流程)
/whitepaper       → 白皮书内嵌
/dashboard        → Dashboard (需钱包连接)
```

---

## 3. 后端需求（Phase 1 最小化）

### 需要后端的东西

| 功能 | 纯前端可行？ | 方案 |
|------|:--:|------|
| 铸造进度展示 | ⚠️ | **中继器 API** `/api/stats` |
| 推荐链接 `?ref=` | ✅ | URL 参数 + localStorage（无需后端） |
| Dashboard 数据 | ✅ | 链上 RPC 直查 + 中继器 API |
| 多语言 | ✅ | 前端 JSON 文件 |

### 推荐：中继器扩展为轻量 API

在自建中继器上加几个端点：

```
GET  /api/stats      → { totalMinted, chainStats, remaining }
GET  /api/status     → 中继器健康检查
```

**不需要数据库**，全部实时从链上或内存读。

---

## 4. 完整数据流

### 用户铸造流程

```
[用户连接钱包]
    │
    ├─ Web3Modal 弹窗 → 选 MetaMask/WalletConnect
    │    ↓
    │  获取 address, chainId
    │
    ▼
[选择铸造链] (Base/BSC/ETH/Solana)
    │
    ├─ 前端查中继器 API → 确认还有余额
    │    ↓
    │  展示: 价格 10,000 USDC, Gas 预估, 剩余 X/500
    │
    ▼
[确认铸造]
    │
    ├─ EVM: contract.mint({ value: 10000 USDC })
    │  Solana: program.mint() + USDC token transfer
    │    ↓
    │  等链上确认 (1-3 个区块)
    │    ↓
    │  MintEvent 触发
    │    ↓
    ├─ 中继器监听到 → totalMinted++
    │    ↓
    │  如果 totalMinted >= 500 → 依次 pause 各链
    │
    ▼
[铸造成功]
    ├─ 展示: Token ID, 铸造链, 时间, NFT 等级
    └─ 「进入 Dashboard」按钮
```

### Dashboard 数据流

```
[用户连接钱包 → 进入 Dashboard]
    │
    ├─ EVM: contract.tokenOfOwnerByIndex(address, 0) → tokenId
    │  Solana: 查用户 Token 账户
    │    ↓
    │  如果有 tokenId:
    │    ├─ contract.getTokenLevel(tokenId) → 黄金/白银/青铜
    │    ├─ contract.tokenURI(tokenId) → NFT 元数据(图片等)
    │    └─ 展示权益（静态内容 + 等级计算）
    │
    └─ 如果没有 tokenId:
         └─ 展示「尚未铸造，前往铸造页」
```

### 官网数据流

```
[用户访问 /]
    │
    ├─ 静态内容: Hero, 白皮书摘要, 里程碑, 股东权益
    ├─ 动态数据: 铸造进度 → 轮询中继器 /api/stats (每30秒)
    └─ 多语言: 按浏览器语言/手动切换加载 JSON
```

---

## 5. 部署方案

### 部署目标

| 服务 | 位置 | 说明 |
|------|------|------|
| **前端** | 测试服务器 129.226.202.72 | Nginx + Docker |
| **中继器** | 测试服务器 129.226.202.72 | Node.js + PM2 |
| **合约** | 4条链已部署 | 地址待提供 |

### Docker Compose

```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:80"]
    volumes: ["./frontend/dist:/usr/share/nginx/html"]

  relay:
    build: ./relay
    ports: ["3001:3001"]
    environment:
      - PRIVATE_KEY=${RELAY_PRIVATE_KEY}
      - BASE_RPC=${BASE_RPC_URL}
      # ...
    restart: always
```

---

## 6. P0 任务拆分

| # | 任务 | 负责人 | 预估工时 | 依赖 |
|---|------|--------|:--:|---|
| 1 | 项目脚手架（Vite + React + Tailwind + Router） | frontend-dev | 0.5天 | — |
| 2 | Navbar + Footer 组件 | frontend-dev | 0.5天 | 1 |
| 3 | Hero 区域 | frontend-dev | 0.5天 | 1 |
| 4 | 白皮书页面（Markdown 渲染） | frontend-dev | 0.5天 | 1 |
| 5 | 里程碑时间线 | frontend-dev | 0.5天 | 1 |
| 6 | 股东权益展示 | frontend-dev | 0.5天 | 1 |
| 7 | Web3Modal 集成 + 多链钱包 Hook | frontend-dev | 1天 | 1 |
| 8 | 铸造页面（链选择 + 流程 UI） | frontend-dev | 1天 | 7 |
| 9 | Dashboard 合伙人面板 | frontend-dev | 1天 | 7 |
| 10 | 推荐链接生成与复制 | frontend-dev | 0.5天 | 9 |
| 11 | 多语言框架 + 中英翻译 | frontend-dev | 1天 | 1 |
| 12 | 中继器开发 + API | backend-dev | 1天 | — |
| **总计** | | | **~8 人天** | |

> 前端可并行做 1-11，后端做 12，实际时间约 3-4 天

---

## 7. 待确认事项

| # | 事项 | 状态 |
|---|------|:--:|
| 1 | **4 条链合约地址 + ABI** | ⏳ 待提供 |
| 2 | 合约是否有 `pause/unpause` 方法？ | ⏳ 待确认 |
| 3 | RPC 节点 API Key (Infura/Alchemy) | ⏳ 待提供 |
| 4 | Solana RPC 端点 | ⏳ 待提供 |
| 5 | 中继器私钥（一个有 Gas 的 EOA） | ⏳ 待提供 |
| 6 | 域名配置（指向哪个 IP） | ⏳ 待提供 |
| 7 | 多语言翻译内容（只做中英/P0） | ✅ 中英先做 |
| 8 | 铸造价格确认 → 10,000 USDC | ✅ 确认 |

---

*本文档供技术评审，确认后进入开发阶段。*
