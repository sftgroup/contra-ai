# Contra AI — 产品需求文档 v2.2

> **Version**: 2.2 | **Date**: 2026-06-27 | **Status**: 内部评审 | **Author**: Wayne + PM  
> **v2.1 → v2.2**：金库自动转账+手动提款、Ceres 邀请系统、Dashboard 增加邀请功能

---

## 变更摘要

### v2.1 → v2.2
| # | 变更 | v2.1 | v2.2 |
|---|------|------|------|
| 1 | 金库转账 | 手动 withdraw | 自动转 + manualWithdraw |
| 2 | 邀请系统 | URL参数 + 合约mapping | Ceres DID Registry |
| 3 | Dashboard | 资产+推荐链接 | 资产+邀请链接+邀请统计 |

### v2.0 → v2.1 回顾
| # | 变更 | v2.0 | v2.1 |
|---|------|------|------|
| 1 | 等级 | 三级 | 平等 |
| 2 | maxSupply | 固定 | 可增可减 |
| 3 | 资金 | 二层 | 三层 |

### v1.0 → v2.0 回顾
| # | 变更 | v1.0 | v2.0 |
|---|------|------|------|
| 1 | 品牌 | AI咨询全球 | Contra AI |
| 2 | NFT名 | 合伙人士兵 | 创始股东 NFT |

---

## 1. 产品概述

### 1.1 产品定位

**Contra AI** 是一个基于 Web3 + AI 的全球化咨询平台，核心理念 **"Code is Law"**。

**标语**：中国AI算力 · 服务全球 · 收益回流 · 普惠民生

### 1.2 Phase 1 目标

| 目标 | 说明 |
|---|------|
| **官网** | 品牌门户 |
| **NFT 铸造** | 4 链部署，500 枚创始股东 NFT（每条链独立配额） |
| **Dashboard** | NFT 资产、Ceres DID 绑定、邀请链接和统计 |
| **金库** | 资金自动归集到个人钱包 |

### 1.3 核心假设

1. 用户已具备 Web3 钱包
2. 用户持有目标链上的 USDC
3. Ceres DID Registry 已部署在目标链上
4. 所有股东地位平等，不区分等级

---

## 2. 用户画像与故事

### 核心用户

| 画像 | 核心诉求 |
|---|------|
| Web3 投资者 | 评估投资回报、安全铸造 NFT |
| 零撸用户 | 获取早期身份、通过邀请参与社区 |

### 关键用户故事

| ID | 故事 | 验收条件 |
|---|------|------|
| US-001 | 访客理解平台定位 | Hero 展示标语 + 数据 |
| US-006 | 选择持有 USDC 的链铸造 | 4 链可选，实时进度 |
| US-007 | 了解铸造费用和总量 | 10,000 USDC/枚、总 500 |
| US-008 | 铸造流程安全清晰 | 连接钱包→选择链→Approve→铸造 |
| US-011 | **股东绑定 Ceres DID 获取邀请链接** | Dashboard 引导绑定 + 生成链接 |
| US-012 | **股东查看已邀请人数** | Dashboard 展示邀请统计 |
| US-013 | **被邀请人通过链接铸造 NFT** | 前端解析 ref 参数 + 铸造后建立关系 |

---

## 3. 功能需求

### 3.1 官网 (P0)
已有 UI 原型（`ui-prototype/index.html`）

### 3.2 NFT 铸造 (P0)

#### 四链配额（可调）

| 链 | 初始配额 | 可调？ |
|---|:--:|:--:|
| Base | 200 | ✅ 可增可减 |
| BSC | 100 | ✅ 可增可减 |
| Ethereum | 100 | ✅ 可增可减 |
| Solana | 100 | ✅ 可增可减 |
| **总计** | **500** | |

maxSupply 可增可减，约束：不能低于已铸造数。

#### 铸造流程

连接钱包 → 选择链 → Approve USDC → 确认铸造 → NFT 铸造 + USDC转入金库 → 展示 NFT → Dashboard

#### 资金流向（三层自动）

用户 USDC → NFT合约 → 金库合约（收到即自动转出） → 个人钱包

金库合约 `autoForward = true` 时自动转发，`manualWithdraw` 作为紧急提款兜底。金库余额始终为 0。

#### 双保险总控

- 合约硬顶：`require(totalMinted < maxSupply)`
- 中继器：`globalTotal >= 500 → pause()`

### 3.3 Dashboard (P0)

| 模块 | 内容 |
|---|------|
| **NFT 资产** | Token ID、铸造链、铸造时间 |
| **股东权益** | 统一权益说明（平等股东） |
| **Ceres DID** | 绑定状态、引导绑定 |
| **邀请链接** | `contra.ai?ref=<CERES_TOKEN_ID>` → 一键复制 |
| **邀请统计** | 已邀请人数 |

### 3.4 Ceres 邀请系统 (P0)

#### 流程

1. 用户在 Dashboard 绑定 Ceres DID（如未绑定则引导）
2. 系统生成邀请链接：`contra.ai?ref=CERES_TOKEN_ID`
3. 被邀请人点击链接 → 铸造 NFT → 前端调用 CeresRegistry 建立邀请关系
4. Ceres 链上记录推荐关系

#### 边界处理

| 场景 | 处理 |
|------|------|
| 推荐人未绑定 Ceres DID | 不生成邀请链接，引导绑定 |
| 被邀请人无 Ceres DID | 铸造后引导创建 |
| Ceres 某链未部署 | 该链暂时不支持邀请 |

---

## 4. 技术约束

### 技术栈

| 层级 | 选型 |
|---|------|
| 前端 | React 18 + Vite + Tailwind CSS |
| EVM 合约 | Solidity + OpenZeppelin ERC-721 + Hardhat |
| Solana | Rust + Anchor |
| EVM 钱包 | Web3Modal v3 + Wagmi v2 |
| Solana 钱包 | @solana/wallet-adapter |
| 多语言 | react-i18next |
| 中继器 | Node.js + ethers.js v6 + @solana/web3.js |
| 邀请系统 | **Ceres DID Registry**（已有基础设施） |
| 部署 | 129.226.202.72 (Nginx + PM2) |

### Phase 1 不包含

数据库、用户系统、AI功能、治理/投票、收益分红（Phase 2）

---

## 5. P0 任务拆分

| # | 任务 | 负责 | 工时 |
|---|------|------|:--:|
| 1 | 项目脚手架 | frontend-dev | 0.5天 |
| 2 | EVM 合约（ContraNFT） | contract-dev | 1天 |
| 3 | 金库合约（Treasury） | contract-dev | 0.5天 |
| 4 | Solana 合约 | contract-dev | 1.5天 |
| 5 | EVM 测试网部署 | contract-dev | 0.5天 |
| 6 | Solana 测试网部署 | contract-dev | 0.5天 |
| 7 | 中继器开发 | backend-dev | 1.5天 |
| 8 | Navbar+Footer+Hero | frontend-dev | 1天 |
| 9 | 白皮书页面 | frontend-dev | 1天 |
| 10 | Web3Modal+钱包Hook | frontend-dev | 1.5天 |
| 11 | 铸造页面 | frontend-dev | 2天 |
| 12 | Dashboard（含Ceres邀请） | frontend-dev | 2天 |
| 13 | Ceres DID 集成（绑定+邀请+统计） | frontend-dev | 1.5天 |
| 14 | 多语言框架 | frontend-dev | 1天 |
| 15 | 端到端联调 | frontend-dev | 1.5天 |
| 16 | E2E测试 | tester | 2天 |
| 17 | QA审查 | qa | 0.5天 |
| 18 | Security审查 | security | 0.5天 |
| **总计** | | | **~20 人天** |

> 3 人并行，约 7-9 天。新增 Dashboard Ceres 集成（1.5天）。

---

## 6. 验收标准

### 官网
- [ ] Hero 区域展示标语和核心数据
- [ ] 白皮书页面完整渲染
- [ ] 钱包连接按钮可用、移动端适配

### NFT 铸造
- [ ] 4 链合约部署，配额正确
- [ ] USDC → NFT合约 → 金库 → 钱包 三层自动完整
- [ ] 铸造流程完整
- [ ] 中继器 API 正常

### 金库
- [ ] 收到 USDC 自动转 beneficiary
- [ ] autoForward 可关闭/开启
- [ ] manualWithdraw 紧急提款可用

### Dashboard
- [ ] NFT 资产展示正确
- [ ] Ceres DID 绑定流程完整
- [ ] 邀请链接生成和复制
- [ ] 邀请统计显示正确

### Ceres 邀请
- [ ] ref 参数解析正确
- [ ] 铸造后正确调用 CeresRegistry
- [ ] 未绑定 Ceres DID 时引导提示

---

*本文档 v2.2。*
