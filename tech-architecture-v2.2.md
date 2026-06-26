# Contra AI Phase 1 — 技术方案完整论证 v2.2

> Version: 2.2 | Date: 2026-06-27 | Author: Wayne  
> v2.1 → v2.2：金库自动转账 + 手动提款、Ceres 邀请系统

---

## 变更摘要

### v2.1 → v2.2
| # | 变更项 | v2.1 | v2.2 | 原因 |
|---|--------|------|------|------|
| 1 | 金库转账 | 手动 withdraw | **自动转 + 手动提款兜底** | 消除人工操作，但保留紧急通道 |
| 2 | 邀请系统 | URL参数 + 合约mapping | **Ceres DID Registry** | Ceres 作为链上身份和推荐体系 |

### v2.0 → v2.1 回顾
| # | 变更项 | v2.0 | v2.1 |
|---|--------|------|------|
| 1 | 股东等级 | Gold/Silver/Bronze | 平等股东 |
| 2 | maxSupply | 固定常量 | 可增可减 |
| 3 | 资金路径 | 二层直转 | 三层（NFT→金库→钱包） |

---

## 目录

1. 四链架构论证
2. 合约设计论证
3. 中继器方案论证
4. 三层资金路径论证（含自动转账）
5. Ceres 邀请系统论证
6. NFT 身份论证
7. 前端架构论证
8. 安全性论证
9. 风险矩阵

---

## 1. 四链架构论证

### 决策：合约配额 + 可调硬顶（Base 200 / BSC 100 / ETH 100 / Solana 100）

与 v2.1 一致。

### setMaxSupply 安全约束

```solidity
function setMaxSupply(uint256 _newMax) external onlyOwner {
    require(_newMax >= totalMinted, "Below already minted");
    maxSupply = _newMax;
}
```

唯一约束：不能低于已铸造数。可增可减。

### 双保险总控

- 合约硬顶 → 第一道防线：`require(totalMinted < maxSupply)`
- 中继器 → 第二道防线：`globalTotal >= 500 → pause()`

---

## 2. 合约设计论证

### 决策：纯 ERC-721，平等股东

### 合约接口（v2.2 最终版）

```solidity
contract ContraNFT is ERC721, Ownable {
    uint256 public maxSupply;           // 链配额（可增可减）
    uint256 public constant MINT_PRICE; // 10000 USDC
    uint256 public totalMinted;
    bool public paused;
    IERC20 public immutable usdc;

    // 三层资金路径
    address public treasury;            // 金库合约（可改）
    address public beneficiary;         // 个人钱包（可改）

    function mint() external;
    function pause() external onlyOwner;
    function unpause() external onlyOwner;
    function setMaxSupply(uint256) external onlyOwner;
    function setTreasury(address) external onlyOwner;
    function setBeneficiary(address) external onlyOwner;

    event MintEvent(address minter, uint256 tokenId);
}
```

**新增 v2.2**：Dashboard 不展示等级（平等股东），但展示 Ceres 邀请链接。

---

## 3. 中继器方案论证

与 v2.1 一致。可选增强组件，宕机不影响合约安全。

---

## 4. 三层资金路径论证（v2.2 更新）

### 决策：用户 → NFT合约 → 金库合约 → 自动转出到个人钱包

### 资金流转（v2.2）

```
用户 USDC
    │ approve(NFT合约, 10000)
    ▼
NFT 铸造合约
    │ usdc.transfer(treasury, 10000)
    ▼
金库合约 (Treasury)
    │ deposit() → 立即自动转给 beneficiary
    │ 余额始终为 0
    ▼
个人钱包地址 (beneficiary)
```

### 金库合约核心逻辑（v2.2）

```solidity
contract Treasury is Ownable {
    IERC20 public usdc;
    address public beneficiary; // 最终收款地址
    bool public autoForward = true; // 自动转账开关

    event Deposited(address from, uint256 amount, uint256 timestamp);
    event AutoForwarded(address to, uint256 amount);
    event ManualWithdraw(address to, uint256 amount);

    // 接收 USDC → 自动转给 beneficiary
    function deposit(uint256 amount) external {
        usdc.transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, block.timestamp);

        if (autoForward) {
            usdc.transfer(beneficiary, amount);
            emit AutoForwarded(beneficiary, amount);
        }
        // autoForward = false 时资金留在金库，需手动处理
    }

    // === 手动提款（紧急兜底） ===
    function manualWithdraw(uint256 amount) external onlyOwner {
        // 仅当 autoForward = false 或出现异常余额时使用
        usdc.transfer(beneficiary, amount);
        emit ManualWithdraw(beneficiary, amount);
    }

    // === 管理 ===
    function setBeneficiary(address _new) external onlyOwner {
        beneficiary = _new;
    }

    function setAutoForward(bool _enabled) external onlyOwner {
        autoForward = _enabled;
    }
}
```

### 自动 vs 手动设计

| 模式 | 场景 | 运行方式 |
|------|------|------|
| **autoForward = true** | 正常运行 | 收到 USDC 立即转 beneficiary，余额始终为 0 |
| **autoForward = false** | 紧急/调试 | 资金留在金库，Owner 手动 `manualWithdraw` |

**为什么保留 manualWithdraw**：

| 场景 | 处理 |
|------|------|
| beneficiary 地址发现错误 | 关闭 autoForward → 修复 beneficiary → manualWithdraw → 开启 autoForward |
| USDC 合约升级导致自动转失败 | 关闭 autoForward → 手动处理 |
| 需要临时冻结资金 | 关闭 autoForward → 排查问题 → 恢复 |
| 金库合约有未知余额（直接转入） | manualWithdraw 提取 |

### 三层 vs 二层对比

| | 二层 | 三层（v2.2） |
|------|:--:|:--:|
| 转账方式 | 手动改地址 | 自动 + 手动兜底 |
| 审计能力 | 低 | 高 |
| 安全隔离 | 低 | 高 |
| 紧急控制 | ❌ | ✅ autoForward 开关 + manualWithdraw |
| 合规友好 | 一般 | 好 |

---

## 5. Ceres 邀请系统论证

### 决策：使用 Ceres DID Registry 作为邀请和身份体系

### 为什么不继续用 Phase 1 合约内 mapping

| | 合约 mapping（v2.1） | Ceres DID Registry（v2.2） |
|------|:--:|:--:|
| 推荐关系 | 合约内存储 | Ceres 链上存储 |
| ID 系统 | 钱包地址 | Ceres DID（标准链上 ID） |
| 跨链推荐 | ❌ 不支持 | ✅ Ceres DID 跨链通用 |
| 生态兼容 | 孤立 | ✅ 可对接 Ceres 生态 |
| Phase 2 集成 | 需迁移 | 零迁移 |
| 开发成本 | 低 | 中（需集成 Ceres SDK） |

### Ceres 邀请流程

```
[用户 A 已有 NFT]
    │ 1. Dashboard 绑定 Ceres DID（如未绑定）
    │ 2. 系统生成邀请链接：contra.ai?ref=CERES_TOKEN_ID
    ▼
[用户 B 点击邀请链接]
    │ 3. 前端解析 ?ref=CERES_TOKEN_ID
    │ 4. 铸造 NFT 时，前端调用 CeresRegistry.invite(referrerTokenId, inviteeAddress)
    │    或 createProfile(inviterTokenId=REF_TOKEN_ID)
    ▼
[Ceres Registry]
    │ 5. 链上记录推荐关系
    ▼
[Phase 2]
    │ 6. 收益合约查询 Ceres 推荐链，计算推荐奖励
```

### 关键接口

```solidity
// Ceres DID Registry（已有合约，非我们开发）
interface ICeresRegistry {
    // 用户 A 为新用户 B 创建 Profile，并绑定邀请关系
    function createProfile(
        address invitee,        // 被邀请人地址
        bytes calldata metadata // Profile 元数据
    ) external returns (uint256 tokenId);

    // 或者通过 invite 方法建立推荐关系
    function invite(
        uint256 inviterTokenId,  // 推荐人的 CeresDID Token ID
        address invitee          // 被邀请人地址
    ) external;
}
```

### 我们的集成点

**Phase 1 只需要两件事：**

1. **Dashboard 生成邀请链接**
   - 查询用户是否已绑定 Ceres DID
   - 如未绑定：提示用户先绑定 Ceres DID
   - 如已绑定：生成 `contra.ai?ref=<CERES_TOKEN_ID>`

2. **铸造时关联推荐**
   - 前端解析 URL 参数 `?ref=<CERES_TOKEN_ID>`
   - 在用户铸造 NFT 后，前端调用 CeresRegistry 建立邀请关系
   - Ceres 链上自动记录

**我们不需要开发 Ceres 合约**——Ceres Registry 是已有基础设施，我们只是调用它的接口。

### 万一用户没有 Ceres DID

| 场景 | 处理 |
|------|------|
| 被邀请人没有 Ceres DID | 铸造后指引用户创建 Ceres DID（跳转 Ceres 官网） |
| 推荐人没有 Ceres DID | 邀请链接不生成，引导先绑定 |
| Ceres Registry 某条链未部署 | 该链暂时不支持邀请，Dashboard 提示"即将上线" |

---

## 6. NFT 身份论证

### 核心原则：平等股东 + Ceres DID 作为通用身份

- 所有创始股东 NFT 持有者地位平等
- Ceres DID 是用户的**通用链上身份**，不绑定到 Contra NFT
- 收益合约（未来）独立部署，同时验证 Contra NFT + Ceres DID

---

## 7. 前端架构论证

### Dashboard（v2.2 更新）

| 模块 | 内容 |
|------|------|
| NFT 资产 | Token ID、铸造链、合约地址、铸造时间 |
| 股东权益 | 统一权益说明（平等股东） |
| **Ceres DID 绑定** | 绑定状态 + 引导绑定 |
| **邀请链接** | `contra.ai?ref=<CERES_TOKEN_ID>` + 一键复制 |
| 邀请统计 | 已邀请人数（从 Ceres 查询） |

### 铸造页面（v2.2 更新）

- 新增：解析 `?ref=` 参数 → 展示推荐人 Ceres DID → 铸造后调用 CeresRegistry 建立关系

---

## 8. 安全性论证（v2.2 更新）

### 金库自动转账安全

| 风险 | 缓解 |
|------|------|
| beneficiary 地址错误 | autoForward 可关闭，manualWithdraw 兜底 |
| USDC transfer 失败阻塞铸造 | Try-catch 包装自动转账，失败不影响 NFT 铸造 |
| 自动转金额太大 | 单笔 10000 USDC，无累积风险 |

### Ceres 集成安全

| 风险 | 缓解 |
|------|------|
| 伪造 ref 参数 | CeresRegistry 链上验证推荐人 tokenId 有效性 |
| 自引用（推荐自己） | Ceres 合约层校验 |
| 重复邀请 | Ceres DID 唯一绑定，重复无效 |

---

## 9. 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解措施 | 残余风险 |
|---|------|:--:|:--:|------|:--:|
| 1 | 合约 bug 导致资金损失 | 低 | 🔴 | 极简代码 + 审计 + 测试网验证 | 🟢 |
| 2 | Owner 私钥泄露 | 低 | 🔴 | 多签管理 | 🟡 |
| 3 | 自动转账失败阻塞铸造 | 低 | 🟡 | Try-catch + manualWithdraw 兜底 | 🟢 |
| 4 | Ceres Registry 不可用 | 低 | 🟡 | 铸造功能不受影响，邀请暂不可用 | 🟢 |
| 5 | Ceres 某链未部署 | 中 | 🟡 | 分链逐步上线 | 🟡 |
| 6 | 中继器宕机 | 低 | 🟢 | 不影响合约 | 🟢 |

---

## 附录 A：版本变化全览

| 维度 | v2.0 | v2.1 | v2.2 |
|------|------|------|------|
| 股东等级 | 三级 | 平等 | 平等 |
| maxSupply | 只能减 | 可增可减 | 可增可减 |
| 资金路径 | 二层直转 | 三层手动 | **三层自动+手动兜底** |
| 邀请系统 | URL参→合约mapping | 同左 | **Ceres DID Registry** |
| 合约方法数 | 4 | 7 | 7（+金库3） |

## 附录 B：部署检查清单

- [ ] 4 条链的 USDC 合约地址确认
- [ ] 每条链的 RPC 端点确认（含备份）
- [ ] Owner 地址确认（建议多签）
- [ ] 金库合约地址确认
- [ ] 个人钱包地址确认
- [ ] Ceres Registry 合约地址确认（每条链）
- [ ] 初始 maxSupply 设置确认
- [ ] 4 链测试网部署完成 + 端到端验证
- [ ] 中继器部署 + PM2 常驻
- [ ] 前端构建 + Nginx 部署
- [ ] QA + Security 审查通过
- [ ] 主网部署（需 Owner 签名确认）

---

*本方案 v2.2，基于用户反馈修订。*
