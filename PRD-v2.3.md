# Contra AI — 产品需求文档 v2.3

> **Version**: 2.3 | **Date**: 2026-06-27 | **Status**: 内部评审  
> **v2.2 → v2.3**：Ceres 集成精简（只读邀请数据+邀请链接，不铸造 DID）

---

## 变更摘要

### v2.2 → v2.3
| # | 变更 | v2.2 | v2.3 |
|---|------|------|------|
| 1 | Ceres 集成 | 需 CeresProvider + 合约交互 | **纯读数据 + 邀请链接** |
| 2 | DID 铸造 | Contra AI 调用 CeresRegistry | **用户自己去 Ceres 铸造** |
| 3 | Dashboard 工时 | 1.5 天 | **0.5 天** |

### 历史变更
- v1.0 → v2.0：品牌 Contra AI、合约配额、中继器、纯 ERC-721
- v2.0 → v2.1：平等股东、maxSupply 可增可减、三层资金路径
- v2.1 → v2.2：金库自动转账+手动提款

---

## 1. 产品概述

### 1.1 产品定位

**Contra AI** — Web3 + AI 全球化咨询平台。**"Code is Law"**

**标语**：中国AI算力 · 服务全球 · 收益回流 · 普惠民生

### 1.2 Phase 1 目标

| 目标 | 说明 |
|---|------|
| 官网 | 品牌门户 |
| NFT铸造 | 4链500枚创始股东NFT（每条链独立配额） |
| Dashboard | NFT资产、**Ceres邀请链接和统计** |
| 金库 | 资金自动归集到个人钱包 |

### 1.3 核心假设

1. 用户已具备 Web3 钱包
2. 用户持有目标链 USDC
3. **Ceres 已在目标链部署**（当前 Sepolia 测试网）
4. 所有股东地位平等

---

## 2. 功能需求

### NFT 铸造 (P0) — 与 v2.2 一致

四链配额（可增可减）：Base 200 / BSC 100 / ETH 100 / Solana 100

### 金库自动转账 (P0) — 与 v2.2 一致

收到即自动转 beneficiary，autoForward 可关闭，manualWithdraw 兜底。

### Dashboard (P0)

| 模块 | 内容 |
|---|------|
| NFT 资产 | Token ID、铸造链、铸造时间 |
| 股东权益 | 平等股东权益说明 |
| **Ceres DID** | 地址查询 → 找到 tokenId → 展示 |
| **邀请链接** | `https://0xainet.top/ceres/invite?ref=<TOKEN_ID>` |
| **邀请统计** | `descendantCount[tokenId]` 直读合约 |

### Ceres 邀请系统 (P0) — v2.3 极简版

**Contra AI 只做三件事：**

1. 查地址对应 Ceres DID tokenId → `tokenOf(address)`
2. 读邀请数据展示 → `descendantCount[tokenId]` + `getDirectInvitees(tokenId)`
3. 生成邀请链接 → 指向 Ceres 邀请页

**Contra AI 不做的事：**
- ❌ 不调用 `createProfile` 铸造 Ceres DID
- ❌ 不需要 `<CeresProvider>`（只用 viem pure functions）
- ❌ 不需要 Ceres 在自己的合约里写任何逻辑

#### 流程

```
[用户打开 Dashboard]
    │ 1. 连接到用户钱包
    │ 2. viem call → CeresRegistry.tokenOf(userAddress)
    │ 3. 找到 tokenId → 展示
    │ 4. viem call → CeresRegistry.descendantCount(tokenId)
    │ 5. 展示邀请统计
    │ 6. 生成链接 → https://0xainet.top/ceres/invite?ref=TOKEN_ID
    ▼
[被邀请人点击链接]
    │ Ceres 前端处理 DID 铸造 + 邀请关系绑定
    │ Contra AI 完全不涉及
```

#### 技术实现

```typescript
// Dashboard 读取 Ceres 数据（无需 @ceres/sdk，直接用 viem）
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const CERES_REGISTRY = '0x9043489CFFe56C1C5b5E1b8Fb1E4bc384B575116';
const REGISTRY_ABI = [...] // 只需 tokenOf, descendantCount, getDirectInvitees

const client = createPublicClient({ chain: sepolia, transport: http() });

// 查地址的 Ceres DID tokenId
const tokenId = await client.readContract({
  address: CERES_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: 'tokenOf',
  args: [userAddress],
});

// 查邀请人数
const count = await client.readContract({
  address: CERES_REGISTRY,
  abi: REGISTRY_ABI,
  functionName: 'descendantCount',
  args: [tokenId],
});
```

#### 边界处理

| 场景 | 处理 |
|------|------|
| 用户没有 Ceres DID | Dashboard 提示"先去 Ceres 创建 DID" |
| Ceres 某链未部署 | 该链 Dashboard 不展示邀请模块 |
| tokenOf 返回 0 | 说明该地址无 DID → 引导创建 |

---

## 3. 技术栈

| 层级 | 选型 |
|---|------|
| 前端 | React 18 + Vite + Tailwind CSS |
| EVM 合约 | Solidity + OpenZeppelin + Hardhat |
| Solana | Rust + Anchor |
| EVM钱包 | Web3Modal v3 + Wagmi v2 |
| Solana钱包 | @solana/wallet-adapter |
| Ceres 集成 | **viem readContract（纯读，无需 SDK）** |
| 部署 | 129.226.202.72 |

---

## 4. P0 任务拆分

| # | 任务 | 负责 | 工时 |
|---|------|------|:--:|
| 1 | 项目脚手架 | frontend-dev | 0.5 |
| 2 | EVM 合约（ContraNFT） | contract-dev | 1 |
| 3 | 金库合约（自动+手动） | contract-dev | 0.5 |
| 4 | Solana 合约 | contract-dev | 1.5 |
| 5 | EVM 测试网部署 | contract-dev | 0.5 |
| 6 | Solana 测试网部署 | contract-dev | 0.5 |
| 7 | 中继器 | backend-dev | 1.5 |
| 8 | Navbar+Footer+Hero | frontend-dev | 1 |
| 9 | 白皮书页面 | frontend-dev | 1 |
| 10 | 钱包Hook | frontend-dev | 1.5 |
| 11 | 铸造页面 | frontend-dev | 2 |
| 12 | **Dashboard（含Ceres只读集成）** | frontend-dev | **1.5** |
| 13 | 多语言 | frontend-dev | 1 |
| 14 | 联调 | frontend-dev | 1.5 |
| 15 | E2E测试 | tester | 2 |
| 16 | QA | qa | 0.5 |
| 17 | Security | security | 0.5 |
| **总计** | | | **~18.5 人天** |

> 3人并行，约 6-8天。比 v2.2 少 1.5 天。

---

## 5. 验收标准

**官网**: Hero展示标语、白皮书完整、钱包连接、移动端适配

**NFT铸造**: 4链部署正确、三层自动完整、铸造流程完整

**金库**: 收到即自动转、可开关、manualWithdraw可用

**Dashboard**: NFT资产正确、邀请链接+统计可用

**Ceres 集成**: `tokenOf` 查询正确、`descendantCount` 正确、无 DID 时引导提示

---

*本文档 v2.3。*
