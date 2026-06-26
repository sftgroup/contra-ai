# Contra AI — 产品需求文档 v2.0

> **Version**: 2.0 | **Date**: 2026-06-27 | **Status**: 内部评审 | **Author**: Wayne + PM  
> **对比 v1.0**：根据技术方案评审进行了品牌命名、业务模型和合约架构的调整

---

## 变更摘要 (v1.0 → v2.0)

| # | 变更项 | v1.0 | v2.0 | 原因 |
|---|--------|------|------|------|
| 1 | 品牌名 | AI咨询全球 | **Contra AI** | 全球化品牌，简洁有力 |
| 2 | 铸造身份名 | 合伙人士兵 | **创始股东 NFT (Founding Shareholder NFT)** | 更准确的权益定位 |
| 3 | 四链总量方案 | 未定义 | **合约配额：Base 200 / BSC 100 / ETH 100 / Solana 100** | 零超卖风险 |
| 4 | 总开关 | 未定义 | **自建中继器监听事件，达500后暂停各链** | 双保险关停 |
| 5 | 收款流向 | 未定义 | **用户USDC → 直接转入recipient地址（可修改）** | 极简安全 |
| 6 | NFT 合约复杂度 | 预留分红接口 | **纯 ERC-721，零耦合** | 未来收益合约独立部署 |
| 7 | 推荐系统 | 通过Ceramic | **URL参数 + 合约内记录映射（Phase 2 对接 Ceres）** | 渐进式集成 |

---

## 1. 产品概述

### 1.1 产品定位

**Contra AI** 是一个基于 Web3 + AI 的全球化咨询平台，核心理念 **"Code is Law"**，通过智能合约与 AI 实现咨询行业的完全去中心化。

**标语**：中国AI算力 · 服务全球 · 收益回流 · 普惠民生

### 1.2 Phase 1 目标

| 目标 | 说明 |
|---|---|
| **官网** | 品牌门户，基于已有 UI 原型实现 |
| **NFT 铸造** | 4 链部署，500 枚创始股东 NFT（每条链独立配额） |
| **Dashboard** | 钱包登录后展示 NFT 资产、等级、推荐链接 |

### 1.3 核心假设

1. 用户已具备 Web3 钱包（MetaMask / Phantom 等）
2. 用户持有目标链上的 USDC 用于铸造
3. 智能合约尚未部署（本次开发包含合约开发）
4. Phase 1 仅开放「创始股东」NFT 铸造
5. 推荐系统 Phase 1 用 URL 参数 + 合约映射，Phase 2 对接 Ceres DID

---

## 2. 用户画像与故事

### 2.1 核心用户

| 画像 | 核心诉求 |
|---|---|
| **Web3 投资者** | 评估投资回报、安全铸造 NFT |
| **零撸用户** | 获取早期身份、参与社区 |
| **技术爱好者** | 关注技术架构、GitHub 开源 |

### 2.2 关键用户故事

| ID | 故事 | 验收条件 |
|---|---|---|
| US-001 | 访客打开官网理解平台定位 | Hero 区域展示标语 + 核心数据 |
| US-006 | 投资者选择持有 USDC 的链铸造 | 4 链可选，实时显示铸造进度 |
| US-007 | 投资者清楚了解铸造费用和总量 | 10,000 USDC/枚、总 500 明确展示 |
| US-008 | 铸造流程安全步骤清晰 | 连接钱包 → 选择链 → Approve USDC → 铸造成功 |
| US-010 | 合伙人查看 NFT 资产和等级 | Dashboard 展示 Token ID、铸造链、等级、权益说明 |

---

## 3. 功能需求

### 3.1 官网 (P0)
— 与 v1.0 一致，已有 UI 原型（`ui-prototype/index.html`）

### 3.2 NFT 铸造 (P0)

#### 3.2.1 四链配额

| 链 | 配额 | 合约地址 | 状态 |
|---|---|---|---|
| Base | 200 | 待部署 | ⏳ |
| BSC | 100 | 待部署 | ⏳ |
| Ethereum | 100 | 待部署 | ⏳ |
| Solana | 100 | 待部署 | ⏳ |
| **总计** | **500** | | |

#### 3.2.2 铸造流程

```
[连接钱包] → [选择链] → [Approve USDC] → [确认铸造 → 合约.mint()]
                                              ↓
                                    资金直接转到 recipient
                                    NFT 立即铸造
                                              ↓
                                    铸造成功 → 展示 NFT 信息
                                    → 进入 Dashboard
```

#### 3.2.3 资金流向

- 用户 Approve USDC 给 NFT 合约
- 铸造时合约内 `usdc.transferFrom(用户 → recipient, 10000)`
- 合约不持有资金，直接转到 recipient（可修改地址）
- **不需要金库合约**（Phase 2 如需多签管理可通过升级 recipient 实现）

#### 3.2.4 双保险总控

```
合约层：require(totalMinted < MAX_SUPPLY)  ← 硬顶，永不超卖
中继器：监听 MintEvent → totalMinted >= 500 → pause()
```

中继器作用是**提前关停**避免用户在第 501 次交易上白费 gas。

- 中继器宕机：合约硬顶兜底，超卖不可能
- 中继器重启：从事件日志回溯补全计数
- 中继器误关：Owner 手动 unpause

### 3.3 Dashboard (P0)

| 模块 | 内容 |
|---|---|
| **NFT 资产** | Token ID、铸造链、合约地址、铸造时间 |
| **股东等级** | 基于 tokenId 范围（1-100 Gold / 101-300 Silver / 301-500 Bronze） |
| **权益说明** | 分红比例说明（静态文案） |
| **推荐链接** | 唯一推荐码（钱包地址前8位），一键复制 |

### 3.4 推荐系统 (P0)

- URL 参数：`?ref=0XADDRESS`（推荐人钱包地址，前端解析）
- 合约记录：`mapping(address → address) inviter`（铸造时写入）
- Phase 2 升级：对接 Ceres DID Registry 进行链上身份绑定

---

## 4. 技术约束与架构边界

### 4.1 技术栈

| 层级 | 选型 |
|------|------|
| **前端** | React 18 + Vite + Tailwind CSS |
| **EVM 合约** | Solidity + OpenZeppelin ERC-721 + Hardhat |
| **Solana 合约** | Rust + Anchor |
| **钱包** | EVM: Web3Modal v3 + Wagmi v2 | Solana: @solana/wallet-adapter |
| **多语言** | react-i18next |
| **中继器** | Node.js + ethers.js v6 + @solana/web3.js |
| **部署** | 测试服务器 129.226.202.72 (Nginx + PM2) |

### 4.2 合约接口（极简版）

```solidity
contract ContraNFT is ERC721, Ownable {
    // 常量
    uint256 public constant MAX_SUPPLY;    // 链配额
    uint256 public constant MINT_PRICE;    // 10000 USDC

    // 状态
    uint256 public totalMinted;
    bool public paused;
    address public recipient;              // 收款地址（可改）

    // 方法
    function mint() external;
    function pause() external onlyOwner;
    function unpause() external onlyOwner;
    function setRecipient(address) external onlyOwner;

    // 事件
    event MintEvent(address minter, uint256 tokenId);
}
```

**不包含分红接口、权重查询等预留方法**。未来收益合约独立部署，自行读取标准 ERC-721 的 `ownerOf()`。

### 4.3 Phase 1 不包含

- 数据库（纯链上 + 中继器内存状态）
- 用户系统（仅钱包地址）
- AI 功能
- 治理/投票
- 收益分红（Phase 2 独立合约）
- Ceres DID 集成（Phase 2）

---

## 5. P0 任务拆分

| # | 任务 | 负责 | 工时 | 可并行 |
|---|------|------|:--:|:--:|
| 1 | 项目脚手架（Vite + React + Router + Tailwind） | frontend-dev | 0.5天 | — |
| 2 | EVM 合约开发（3 条链同一套代码，不同配额） | contract-dev | 1天 | 1 |
| 3 | Solana 合约开发（Rust + Anchor） | contract-dev | 1.5天 | 1,2 |
| 4 | EVM 合约测试网部署 + 验证（3 链） | contract-dev | 0.5天 | — |
| 5 | Solana 合约测试网部署 + 验证 | contract-dev | 0.5天 | 4 |
| 6 | 中继器开发（EVM 3 链监听 + Solana 监听） | backend-dev | 1.5天 | 1-5 |
| 7 | Navbar + Footer + Hero 区域 | frontend-dev | 1天 | 1 |
| 8 | 白皮书页面 + 里程碑时间线 | frontend-dev | 1天 | 7 |
| 9 | Web3Modal + 多链钱包 Hook | frontend-dev | 1.5天 | 1 |
| 10 | 铸造页面（链选择 + USDC Approve + 铸造流程） | frontend-dev | 2天 | 9 |
| 11 | Dashboard 面板（资产 + 等级 + 推荐链接） | frontend-dev | 1.5天 | 9 |
| 12 | 多语言框架 + 中英翻译 | frontend-dev | 1天 | 7 |
| 13 | 连接合约 + 中继器 API + 端到端联调 | frontend-dev | 1.5天 | — |
| 14 | **测试**（E2E + 4 链测试网完整流程） | tester | 2天 | — |
| 15 | **QA 审查**（L1 + L2） | qa | 0.5天 | — |
| 16 | **Security 审查**（L3 + L4） | security | 0.5天 | — |
| **总计** | | | **~17 人天** | |

> 3 人并行（frontend + contract + backend），约 **6-8 天**可完成开发并通过审查。
> 注：含合约测试网部署和完整 E2E 测试，不含主网部署和合约审计。

---

## 6. 验收标准

### 官网
- [ ] Hero 区域展示标语和核心数据
- [ ] 白皮书页面完整渲染
- [ ] 钱包连接按钮可用
- [ ] 移动端适配

### NFT 铸造
- [ ] 4 链合约各自部署，配额限制正确
- [ ] USDC Approve + 铸造流程完整
- [ ] 铸造成功展示 NFT 信息
- [ ] 中继器监控铸造进度，API 正常
- [ ] 合约硬顶保障不超卖

### Dashboard
- [ ] 连接钱包后显示 NFT 资产
- [ ] 等级正确计算
- [ ] 推荐链接生成和复制

### 中继器
- [ ] 启动时从事件日志回溯正确计数
- [ ] 实时监听 4 链事件
- [ ] 达到配额后成功调用 pause()

---

*本文档为 v2.0 产品需求规格，替代 v1.0 PRD.md。*
