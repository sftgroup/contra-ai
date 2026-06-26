# Contra AI — 产品需求文档 v2.4

> **Version**: 2.4 | **Date**: 2026-06-27 | **Status**: 内部评审  
> **v2.3 → v2.4**：Ceres 集成方案修正 — 只授权、不铸造 DID

---

## 变更摘要

### v2.3 → v2.4（方案修正）
| # | 变更 | v2.3 | v2.4 |
|---|------|------|------|
| 1 | Ceres 集成 | 读链上数据展示 | **写：记录邀请关系；读：展示统计** |
| 2 | 用户操作 | 去 Ceres 铸造 DID | **在 Contra AI 授权钱包即可** |
| 3 | 邀请链接 | 指向 Ceres 域名 | **contra.ai 域名** |
| 4 | Ceres 合约 | 无需改动 | **新增 invite(address) 方法** |

### 历史
- v1.0→v2.0：品牌 Contra AI、合约配额、中继器
- v2.0→v2.1：平等股东、maxSupply可增可减、三层资金
- v2.1→v2.2：金库自动转账+手动提款
- v2.2→v2.3：Ceres 纯读（已废弃）

---

## 1. 产品概述

**Contra AI** — Web3+AI全球化咨询平台。**"Code is Law"**

Phase 1：官网 + 4链500枚创始股东NFT + Dashboard（含Ceres邀请系统） + 金库自动归集

---

## 2. Ceres 邀请系统（重新设计）

### 核心体验

```
[A 已在 Dashboard]
    │ 看到邀请链接：contra.ai/invite?ref=A_ADDRESS
    │ 一键复制
    ▼
[B 打开 contra.ai/invite?ref=A_ADDRESS]
    │ 页面显示："0x1234... 邀请你加入 Contra AI"
    │ 连接钱包 → 点击"授权加入"
    │ 前端调 CeresRegistry.invite(ref)
    │ 完成！不需要任何 DID 铸造
    ▼
[Ceres Registry 链上]
    │ inviterOf[B_CERES_TOKEN_ID] = A_CERES_TOKEN_ID
    │ descendantCount[...] += 1
    │ A 的 Dashboard 看到邀请数 +1
```

### 和 Ceres 已有的 createProfile 的区别

| | createProfile（现有） | invite（新增） |
|------|------|------|
| 铸造 DID | ✅ | ❌ |
| 记录邀请关系 | ✅ | ✅ |
| 更新 descendantCount | ✅ | ✅ |
| 需要的参数 | name, bio, avatar, urls, inviterTokenId | inviter, invitee |
| 用户感知 | "我在创建 DID 身份" | "我在授权加入 Contra AI" |

---

## 3. 功能需求

### NFT 铸造 (P0) — 与 v2.2 一致

### 金库 (P0) — 与 v2.2 一致

### Dashboard (P0)

| 模块 | 内容 |
|---|------|
| NFT 资产 | Token ID、铸造链、时间 |
| 股东权益 | 平等股东说明 |
| **邀请链接** | `contra.ai/invite?ref=WALLET_ADDRESS` → 一键复制 |
| **邀请统计** | 通过 Ceres 查询已邀请人数 |

### 邀请落地页 (P0) — 新功能

URL: `contra.ai/invite?ref=0x...`

| 状态 | 展示 |
|------|------|
| 未连接钱包 | "Connect wallet to join Contra AI" |
| 已连接、未授权 | "0x1234... 邀请你加入 Contra AI" + 授权按钮 |
| 已连接、已授权 | "已加入！前往 Dashboard / 铸造 NFT" |

---

## 4. Ceres 合约变更

### 需要新增的方法

```solidity
// CeresRegistry.sol — 新增
// 只记录邀请关系，不铸造 DID

/// @notice 记录两个地址之间的邀请关系
/// @param inviter 邀请人 Ceres DID tokenId（必须已存在）
/// @param invitee 被邀请人 Ceres DID tokenId（必须已存在）
function invite(uint256 inviter, uint256 invitee) external {
    require(inviter != invitee, "Self-invite");
    require(inviterOf[invitee] == 0, "Already has inviter");
    require(ownerOf(inviter) != address(0), "Inviter not found");
    require(ownerOf(invitee) != address(0), "Invitee not found");

    inviterOf[invitee] = inviter;
    _directInvitees[inviter].push(invitee);
    _updateDescendantCounts(inviter, 1);
}
```

注意：这仍然需要被邀请人也已经有 Ceres DID（因为 Ceres 的邀请关系绑定在 DID tokenId 上）。

### 如果要完全不依赖 Ceres DID

方案 B：在 Contra AI 前端处理授权——用户授权后，后台自动调用 Ceres 的 `createProfile`（用最小 profile：name=地址缩写）来铸造一个 Ceres DID + 同时完成邀请绑定。用户全程不感知。

- 优点：不需要改 Ceres 合约
- 缺点：需要 pay gas 铸造 Ceres DID
- 用户操作：打开链接 → 连接钱包 → 点"授权" → MetaMask 弹两笔（一笔 approve、一笔铸造DID）→ 完成

---

## 5. 技术约束

| 层级 | 选型 |
|---|------|
| 前端 | React 18 + Vite + Tailwind |
| EVM 合约 | Solidity + OpenZeppelin + Hardhat |
| Solana | Rust + Anchor |
| 钱包 | Web3Modal v3 + Wagmi v2 |
| Ceres 集成 | SDK 的 useCreateProfile 或新增 invite 方法 |
| 部署 | 129.226.202.72 |

---

## 6. P0 任务拆分

| # | 任务 | 负责 | 工时 |
|---|------|------|:--:|
| 1 | 项目脚手架 | frontend-dev | 0.5 |
| 2 | EVM 合约 | contract-dev | 1 |
| 3 | 金库合约 | contract-dev | 0.5 |
| 4 | Solana 合约 | contract-dev | 1.5 |
| 5 | EVM 测试网部署 | contract-dev | 0.5 |
| 6 | Solana 测试网部署 | contract-dev | 0.5 |
| 7 | 中继器 | backend-dev | 1.5 |
| 8 | Navbar+Footer+Hero | frontend-dev | 1 |
| 9 | 白皮书页面 | frontend-dev | 1 |
| 10 | 钱包Hook | frontend-dev | 1.5 |
| 11 | 铸造页面 | frontend-dev | 2 |
| 12 | **Dashboard（邀请链接+统计）** | frontend-dev | 1 |
| 13 | **邀请落地页** | frontend-dev | 1 |
| 14 | **Ceres 合约 invite 方法** | contract-dev | 0.5 |
| 15 | 多语言 | frontend-dev | 1 |
| 16 | 联调 | frontend-dev | 1.5 |
| 17 | E2E测试 | tester | 2 |
| 18 | QA | qa | 0.5 |
| 19 | Security | security | 0.5 |
| **总计** | | | **~19.5 天** |

> 3人并行约 7-9天。

---

*本文档 v2.4。*
