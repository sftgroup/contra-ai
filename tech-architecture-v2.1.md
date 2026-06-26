# Contra AI Phase 1 — 技术方案完整论证 v2.1

> Version: 2.1 | Date: 2026-06-27 | Author: Wayne  
> v2.0 → v2.1：取消股东等级、maxSupply 可增可减、恢复三层资金路径

---

## 目录

1. 四链架构论证
2. 合约设计论证
3. 中继器方案论证
4. 三层资金路径论证
5. NFT 身份论证
6. 前端架构论证
7. 安全性论证
8. 风险矩阵

---

## 1. 四链架构论证

### 决策：合约配额 + 可调硬顶（Base 200 / BSC 100 / ETH 100 / Solana 100）

### 问题陈述

Phase 1 需要在 4 条异构链（3 EVM + 1 Solana）之间共享总量 500 枚 NFT。每条链的 maxSupply 由合约构造时设置，但 **Owner 可在运行中动态调整（可增可减）**。

### 方案对比

| # | 方案 | 原理 | 超卖风险 | 复杂度 | 灵活性 | 运维成本 |
|---|------|------|:--:|:--:|:--:|------|
| A | 纯中继器控制 | 事件监听 + pause | 🟡 中 | 中 | ✅ | 中 |
| B | LayerZero | 跨链协议同步 | 🟢 低 | 高 | ✅ | 高 |
| C | 固定配额 | 写死 maxSupply 常量 | 🟢 零 | 低 | ❌ | 零 |
| D | **可调配额** | **maxSupply 变量，可增可减** | 🟢 **零** | **低** | ✅ | **零** |

### 为什么选 D

**兼顾零超卖和配额灵活性。**

| 优势 | 说明 |
|------|------|
| 零超卖 | `require(totalMinted < maxSupply)` 数学保证 |
| 可调整 | 某链需求大可以增加该链 maxSupply，减少其他链 |
| 无需中继器 | 合约层独立工作，中继器只是增强 |
| 运营灵活 | 初始配额只是建议，实际可动态调整 |

### setMaxSupply 的安全设计

```solidity
function setMaxSupply(uint256 _newMax) external onlyOwner {
    require(_newMax >= totalMinted, "Below already minted");
    maxSupply = _newMax;
}
```

**唯一约束**：不能低于已铸造数（`_newMax >= totalMinted`）。

**为什么可以增加**：4 条链各自独立，调整单条链的 maxSupply 不影响其他链。如果 Base 卖得快、BSC 卖得慢，可以把 BSC 的配额调低、Base 的配额调高。全局 500 的总控由中继器 + 运营保证，合约层不做跨链校验（因为每条链的合约互相不知道其他链的存在）。

### 双保险总控

```
合约硬顶 ───────────────────→ [第一道防线]
  require(totalMinted < maxSupply)  数学保证，永不超卖
  maxSupply 可由 Owner 动态调整    灵活分配

中继器 ─────────────────────→ [第二道防线]
  监听四链事件                    提前关停
  globalTotal >= 500 → pause()    优化体验
```

### 补充：为什么还要中继器？

中继器作用不是防超卖（合约已保证），而是**运营体验**：

- 4 条链独立 maxSupply，但全局总量 500 需要协调
- 中继器达到全局 500 后统一暂停，避免用户在不同已满链上尝试

中继器宕机不影响核心安全——合约硬顶始终有效。

---

## 2. 合约设计论证

### 决策：纯 ERC-721，平等股东

### 为什么取消等级

| v2.0（三级：Gold/Silver/Bronze） | v2.1（平等） | 变化原因 |
|------|------|------|
| 按 tokenId 范围分等级 | 所有 token 平等 | 简化股权结构，公平治理 |
| 需等级映射逻辑 | 无需映射 | NFT 合约只负责身份，不分等级 |
| 未来如需分级 | 收益合约自己实现 | 更灵活 |

### 为什么不在合约里预留分红接口

NFT 合约只做一件事：铸造、转移、归属。未来收益合约只需 `ownerOf()`（ERC-721 标准方法）就能验证股东身份并分配收益。**等级、权重、分红规则全部在未来合约中独立定义。**

### 合约接口

```solidity
contract ContraNFT is ERC721, Ownable {
    // === 可调配额 ===
    uint256 public maxSupply;           // 链配额（可增可减）
    uint256 public constant MINT_PRICE; // 10000 USDC

    // === 状态 ===
    uint256 public totalMinted;
    bool public paused;
    IERC20 public immutable usdc;

    // === 三层资金路径 ===
    address public treasury;            // 金库合约（可改）
    address public beneficiary;         // 个人钱包（可改）

    // === 用户方法 ===
    function mint() external;

    // === Owner 管理 ===
    function pause() external onlyOwner;
    function unpause() external onlyOwner;
    function setMaxSupply(uint256) external onlyOwner;
    function setTreasury(address) external onlyOwner;
    function setBeneficiary(address) external onlyOwner;

    // === 事件 ===
    event MintEvent(address minter, uint256 tokenId);
}
```

**7 个自定义方法，逻辑清晰，审计范围明确。**

### setMaxSupply 安全约束

```solidity
function setMaxSupply(uint256 _newMax) external onlyOwner {
    require(_newMax >= totalMinted, "Below already minted");
    maxSupply = _newMax;
}
```

**唯一约束**：不能低于已铸造数。**可以增加也可以减少**，因为 4 条链各自独立，调整单条链不影响其他链。

### 合约复杂度对比

| | PM 原方案 | v2.0 | v2.1 |
|------|:--:|:--:|:--:|
| 自定义方法数 | 7-8 个 | 4 个 | **7 个** |
| 派生合约 | UUPS Proxy | 纯 ERC-721 | 纯 ERC-721 |
| 审计难度 | 中高 | 极低 | **低** |
| 升级机制 | UUPS | 不需要 | 不需要 |
| 等级系统 | 有 | 有 | **无（平等）** |
| 资金路径 | 未详 | 二层直转 | **三层隔离** |

---

## 3. 中继器方案论证

### 定位

**可选增强组件，不是必须依赖。** 架构遵循"优雅降级"原则：

- 正常运行：合约硬顶 + 中继器提前关停 → 完美体验
- 中继器宕机：合约硬顶独立工作 → 功能正常
- 中继器重启：从事件日志补全历史 → 自动恢复

### 核心设计

```javascript
class Relay {
  constructor(chains) {
    this.chains = chains;
    this.totalMinted = new Map();
    this.seenTxs = new Set();
  }

  async start() {
    for (const chain of this.chains) {
      const events = await chain.contract.queryFilter('MintEvent');
      chain.mintCount = events.length;

      chain.contract.on('MintEvent', async (minter, tokenId, tx) => {
        if (this.seenTxs.has(tx.hash)) return;
        this.seenTxs.add(tx.hash);
        chain.mintCount++;

        const total = this.chains.reduce((s, c) => s + c.mintCount, 0);
        if (total >= 500) await this.pauseAll();
      });
    }
  }

  async pauseAll() {
    for (const chain of this.chains) {
      if (!await chain.contract.paused()) {
        await chain.contract.pause();
      }
    }
  }
}
```

### 关键设计决策

| 决策 | 理由 |
|------|------|
| 内存状态（不清零） | 重启时从事件日志回溯 |
| 基于 txHash 去重 | 防止重复计数 |
| pause() 幂等 | paused 已设为真时跳过 |
| 降级安全 | 中继器宕机不影响合约功能 |

### Solana 特殊情况

Solana 没有 Solidity 式事件，使用 `@solana/web3.js` 的 `onLogs` 监听指令日志。

---

## 4. 三层资金路径论证

### 决策：用户 → NFT合约 → 金库合约 → 个人钱包

### 为什么需要三层

```
用户 USDC (10,000)
    │ approve(NFT合约, 10000)
    ▼
┌─────────────────────────────────────────┐
│  NFT 铸造合约 (ContraNFT)                │
│  作用：铸造 NFT + 收款中转               │
│  不持有资金，实时转发给金库              │
│  usdc.transfer(treasury, 10000)          │
│  → 合约余额始终为 0                     │
└───────────────┬─────────────────────────┘
                │
    ▼
┌─────────────────────────────────────────┐
│  金库合约 (Treasury)                     │
│  作用：资金归集 + 可设分账规则            │
│  记录：每笔转入的金额、来源链、时间      │
│  → 可为以后的多签/DAO管理留接口          │
└───────────────┬─────────────────────────┘
                │
    ▼
┌─────────────────────────────────────────┐
│  个人钱包地址 (beneficiary)              │
│  作用：最终收款                          │
│  → 金库合约定期或手动转入                │
└─────────────────────────────────────────┘
```

### 各层对比

| 层级 | 作用 | 审计点 | 可修改？ |
|---|------|------|:--:|
| NFT 合约 | 铸造 + 收款中转 | 是否持有余额？ | — |
| 金库合约 | 资金归集 + 分账 | 转入/转出对账 | ✅ `setTreasury()` |
| 个人钱包 | 最终收款 | 余额核对 | ✅ `setBeneficiary()` |

### 二层 vs 三层对比

| | 二层（v2.0） | 三层（v2.1） |
|------|:--:|:--:|
| 资金路径 | 用户 → recipient | 用户 → NFT合约 → 金库 → 钱包 |
| 审计能力 | 低（一笔交易，难溯源） | **高**（每层独立审计） |
| 安全隔离 | 低 | **高**（金库合约隔离） |
| 合规友好 | 一般 | **好**（资金路径透明可追溯） |
| 灵活分账 | ❌ 不支持 | ✅ 金库合约可扩展多签/DAO |
| Gas 成本 | 1 次 transferFrom | 2 次 transfer（+~$0.01） |

### 金库合约核心逻辑

```solidity
contract Treasury is Ownable {
    IERC20 public usdc;
    address public beneficiary; // 最终收款地址

    event Deposit(address from, uint256 amount, uint256 timestamp);
    event Withdraw(address to, uint256 amount);

    function deposit(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount, block.timestamp);
    }

    function withdraw(uint256 amount) external onlyOwner {
        usdc.transfer(beneficiary, amount);
        emit Withdraw(beneficiary, amount);
    }

    function setBeneficiary(address _new) external onlyOwner {
        beneficiary = _new;
    }
}
```

---

## 5. NFT 身份论证

### 核心原则：平等股东 + 关注点分离

- **所有创始股东 NFT 持有者地位平等**，不区分等级
- NFT 合约只负责铸造、转移、归属
- 收益合约（未来）独立部署，自行定义分配规则

### 为什么平等比分级好

| 维度 | 分级（v2.0） | 平等（v2.1） |
|------|:--:|:--:|
| 合约复杂度 | 需等级映射 | **更简单** |
| 社区公平性 | 有争议 | **无争议** |
| 治理复杂度 | 按权重投票 | **一人一票** |
| 未来扩展 | 需改 NFT 合约 | **收益合约独立实现** |

**未来如需差异化激励**：收益合约独立部署，根据链上行为（推荐人数、持有时长等）动态计算权重，不绑定到 NFT 合约。

### 未来收益合约（示例）

```solidity
contract ProfitDistributor {
    IERC721 public immutable shareholderNFT;
    IERC20 public immutable usdc;

    // 平等分配或自定义规则
    uint256 public rewardPerToken;

    function claim(uint256 tokenId) external {
        require(shareholderNFT.ownerOf(tokenId) == msg.sender, "Not owner");
        usdc.transfer(msg.sender, rewardPerToken);
    }
}
```

**收益合约只需要 NFT 合约的一个方法**：`ownerOf(tokenId) → address`。这是 ERC-721 标准方法，所有 ERC-721 合约自带。

### 跨链身份

- **Phase 1**：不做跨链统一，每条链独立身份
- **Phase 2**：收益合约读取多条链的 NFT 合约地址，汇总计算

---

## 6. 前端架构论证

### 决策：React 18 + Vite

无 SSR 需求，已有原型可直接迁移。

### Dashboard（v2.1 更新）

取消等级展示，改为：
- Token ID + 铸造链 + 铸造时间
- 统一股东权益说明
- 推荐链接

### 目录结构

```
frontend/
├── src/
│   ├── components/   # Navbar, Footer, HeroSection, ChainSelector...
│   ├── pages/        # Home, Mint, Whitepaper, Dashboard
│   ├── hooks/        # useWallet, useMint, useStats
│   ├── contracts/    # ABI + addresses
│   └── i18n/         # zh.json, en.json
├── vite.config.js
└── tailwind.config.js
```

---

## 7. 安全性论证

### 合约层面

| 风险 | 等级 | 缓解 |
|------|:--:|------|
| USDC 授权滥用 | 🟢 | 只授权本次铸造金额 |
| 重入攻击 | 🟢 | SafeERC20 + mint 在 transfer 之前执行 |
| Owner 权限 | 🟡 | pause/unpause/setMaxSupply/setTreasury/setBeneficiary |
| maxSupply 被恶意调低 | 🟢 | 不能低于 totalMinted，用户已持有的 NFT 不受影响 |
| 合约余额攻击 | 🟢 | NFT 合约不持有 USDC，实时转入金库 |

### 金库合约层面

| 风险 | 等级 | 缓解 |
|------|:--:|------|
| 金库余额被攻击 | 🟡 | 仅接收 NFT 合约转账，withdraw 仅 Owner |
| 金库地址被篡改 | 🟡 | 仅 Owner 可改 setTreasury |

### 三层路径特有的安全优势

| 优势 | 说明 |
|------|------|
| 资金可追溯 | 每层都有事件日志，从用户到钱包全程可审计 |
| 最小化攻击面 | 每层只处理自己的职责 |
| 快速止损 | 某层出问题只需替换该层地址 |

---

## 8. 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解措施 | 残余风险 |
|---|------|:--:|:--:|------|:--:|
| 1 | 合约 bug 导致资金损失 | 低 | 🔴 | 极简代码 + 审计 + 测试网验证 | 🟢 |
| 2 | Owner 私钥泄露 | 低 | 🔴 | 多签管理 | 🟡 |
| 3 | 金库合约被攻击 | 低 | 🔴 | 极简金库代码（3 个方法） | 🟡 |
| 4 | 某链配额卖太慢 | 中 | 🟢 | setMaxSupply 动态调整 | 🟢 |
| 5 | 前端 RPC 不可用 | 中 | 🟡 | RPC fallback 列表 | 🟢 |
| 6 | Solana 开发延迟 | 中 | 🟡 | EVM 3 链先上线 | 🟡 |
| 7 | 中继器宕机 | 低 | 🟢 | 不影响合约，只是体验优化 | 🟢 |

---

## 附录 A：v2.0 → v2.1 变化汇总

| 维度 | v2.0 | v2.1 | 变化原因 |
|------|------|------|------|
| 股东等级 | Gold/Silver/Bronze 三级 | **平等股东** | 简化股权，公平治理 |
| maxSupply 方向 | 只能减不能增 | **可增可减** | 四条链独立，不应限制 |
| 资金路径 | 二层（用户→recipient） | **三层（+NFT合→约→金库→钱包）** | 审计合规，资金透明 |
| 合约方法数 | 4 个 | **7 个（+金库合约 3 个）** | 增加 setMaxSupply + 三层路径 |
| Dashboard | 展示等级 | **不展示等级** | 平等股东 |

### 和 PM 原方案的最终差异

| 维度 | PM 原方案 | 最终方案 |
|------|------|------|
| 四链总量 | 未定 | ✅ 合约配额（可调） |
| 中继器 | 不推荐 | ✅ 保留（可选增强，用户要求） |
| 合约接口 | 7 个 + UUPS | **7 个，纯 ERC-721** |
| 资金路径 | 未设计 | **三层（NFT→金库→钱包）** |
| 分红预留 | 内置接口 | **分离到未来合约** |
| 股东等级 | 有 | **无（平等）** |
| 工期 | 30-40 人天 | **~18 人天** |

## 附录 B：部署检查清单

- [ ] 4 条链的 USDC 合约地址确认
- [ ] 每条链的 RPC 端点确认（含备份）
- [ ] Owner 地址确认（建议多签）
- [ ] 金库合约地址确认
- [ ] 个人钱包地址确认
- [ ] 初始 maxSupply 设置确认（Base 200 / BSC 100 / ETH 100 / Solana 100）
- [ ] 4 链测试网部署完成 + 端到端验证
- [ ] 中继器部署 + PM2 常驻
- [ ] 前端构建 + Nginx 部署
- [ ] 合约源码验证（Etherscan/Solscan）
- [ ] QA + Security 审查通过
- [ ] 主网部署（需 Owner 签名确认）

---

*本方案 v2.1，基于用户反馈修订。*
