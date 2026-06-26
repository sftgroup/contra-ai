# Contra AI Phase 1 — 技术方案完整论证 v2.3

> Version: 2.3 | Date: 2026-06-27 | Author: Wayne  
> v2.2 → v2.3：Ceres 集成精简（纯读数据，不铸造 DID）

---

## 变更摘要

### v2.2 → v2.3
| # | 变更 | v2.2 | v2.3 |
|---|------|------|------|
| 1 | Ceres 集成方式 | CeresProvider + SDK hooks | **viem readContract 纯读** |
| 2 | DID 铸造 | Contra AI 调 CeresRegistry | **用户去 Ceres 自己铸造** |
| 3 | Dashboard 工时 | 1.5 天 | **0.5 天** |

---

## 目录

1. 四链架构论证
2. 合约设计论证
3. 中继器方案论证
4. 三层资金路径论证（自动转账）
5. Ceres 邀请系统论证（极简版）
6. 前端架构论证
7. 安全性论证
8. 风险矩阵

---

## 1. 四链架构论证

与 v2.2 一致。合约配额 + 可调硬顶 + 中继器双保险。

---

## 2. 合约设计论证

### ContraNFT 接口（与 v2.2 一致）

```solidity
contract ContraNFT is ERC721, Ownable {
    uint256 public maxSupply;
    uint256 public constant MINT_PRICE = 10000 USDC;
    uint256 public totalMinted;
    bool public paused;
    IERC20 public immutable usdc;
    address public treasury;
    address public beneficiary;

    function mint() external;
    function pause() external onlyOwner;
    function unpause() external onlyOwner;
    function setMaxSupply(uint256) external onlyOwner;
    function setTreasury(address) external onlyOwner;
    function setBeneficiary(address) external onlyOwner;
}
```

**Contra NFT 不包含任何 Ceres 逻辑**。邀请系统完全在 Ceres 合约层面处理。

---

## 3. 三层资金路径（v2.2 自动转账）

```
用户 USDC → NFT合约 → 金库合约 → 自动转 beneficiary

autoForward = true  → 正常运行，收到即转
autoForward = false → 紧急关停
manualWithdraw()    → Owner 手动提款兜底
```

金库合约源码见 v2.2。

---

## 4. Ceres 邀请系统论证（v2.3 极简版）

### 核心决策：只读不写

Contra AI 不需要和 Ceres 有任何写交互——只是读取链上已有数据来展示。

### Ceres 合约结构（已确认，源码审查通过）

| 合约 | 地址 (Sepolia) | 类型 |
|------|------|------|
| `CeresDID` | `0x159f4001C8692A777A842f3F0A76f268aF1A8F39` | ERC-721 DID NFT |
| `CeresRegistry` | `0x9043489CFFe56C1C5b5E1b8Fb1E4bc384B575116` | 注册表 + 邀请树 |

### Ceres 合约关键接口

```solidity
// CeresRegistry — 我们只需要读以下三个：

/// 查地址对应的 DID tokenId（0 = 无 DID）
function tokenOf(address) external view returns (uint256);

/// 查邀请人数（子孙总数）
function descendantCount(uint256 tokenId) external view returns (uint256);

/// 查直接邀请列表
function getDirectInvitees(uint256 tokenId) external view returns (uint256[] memory);
```

三个都是 `view` 函数，零 gas 成本。

### Contra AI 集成（只读版）

```typescript
// 不需要 @ceres/sdk，直接用 viem readContract
import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const REGISTRY = '0x9043489CFFe56C1C5b5E1b8Fb1E4bc384B575116';

// 只需要 3 个函数的 ABI 片段
const registryABI = [
  'function tokenOf(address) view returns (uint256)',
  'function descendantCount(uint256) view returns (uint256)',
  'function getDirectInvitees(uint256) view returns (uint256[])',
];

const client = createPublicClient({ chain: sepolia, transport: http() });

// Dashboard 核心逻辑
async function getCeresData(userAddress: `0x${string}`) {
  const tokenId = await client.readContract({
    address: REGISTRY, abi: registryABI,
    functionName: 'tokenOf', args: [userAddress],
  });

  if (tokenId === 0n) {
    return { hasDID: false, inviteLink: null, inviteCount: 0 };
  }

  const count = await client.readContract({
    address: REGISTRY, abi: registryABI,
    functionName: 'descendantCount', args: [tokenId],
  });

  return {
    hasDID: true,
    tokenId,
    inviteCount: Number(count),
    inviteLink: `https://0xainet.top/ceres/invite?ref=${tokenId}`,
  };
}
```

### 为什么不调用 createProfile

Ceres DID 铸造由用户自己在 Ceres 完成。理由：

1. **关注点分离**：Contra AI 铸造的是股东 NFT，Ceres 铸造的是 DID 身份，两个独立的产品
2. **减少攻击面**：Contra AI 合约不需要关心 Ceres 的任何写操作
3. **Ceres 体验完整**：用户通过 Ceres 前端的邀请链接注册时，邀请关系自动在 Ceres 合约里建立

### 邀请链路

```
[Contra AI Dashboard]
    │ 展示邀请链接 → https://0xainet.top/ceres/invite?ref=<CERES_TOKEN_ID>
    ▼
[Ceres 邀请页]
    │ 用户连接钱包 → 填写 Profile → CeresRegistry.createProfile(name,..., ref)
    │ Ceres 合约自动记录 inviterOf + descendantCount
    ▼
[Contra AI Dashboard]
    │ 重新读取 descendantCount → 更新邀请统计
```

**Contra AI 和 Ceres 的分工**：

| 能力 | Ceres | Contra AI |
|------|:--:|:--:|
| DID 铸造（合约） | ✅ `createProfile` | ❌ |
| 邀请关系记录（合约） | ✅ `inviterOf` + `descendantCount` | ❌ |
| 股东 NFT 铸造 | ❌ | ✅ `mint` |
| 资金归集 | ❌ | ✅ 金库 |
| Dashboard 展示 | ❌ | ✅ 读 Ceres + NFT |

---

## 5. 前端架构

### Dashboard（v2.3 极简 Ceres 集成）

```tsx
function Dashboard() {
  const { address } = useAccount();

  // 读 Ceres 数据
  const ceres = useReadContract({
    address: CERES_REGISTRY,
    abi: [tokenOf, descendantCount],
    functionName: 'tokenOf',
    args: [address],
  });

  // 读 NFT 数据
  const nftBalance = useReadContract({
    address: CONTRA_NFT,
    abi: nftABI,
    functionName: 'balanceOf',
    args: [address],
  });

  return (
    <div>
      {/* NFT 资产 */}
      <NFTCard balance={nftBalance} />

      {/* Ceres 邀请 */}
      <CeresInvite
        tokenId={ceres.tokenId}
        count={ceres.count}
        link={ceres.link}
      />

      {/* 股东权益 */}
      <ShareholderRights />
    </div>
  );
}
```

---

## 6. 安全性

### 与 v2.2 一致的金库安全 + 新增 Ceres 安全

| 风险 | 缓解 |
|------|------|
| Ceres 合约被篡改 | 我们只读数据，不受影响 |
| Ceres 不可用 | Dashboard 邀请模块降级，不影响核心功能 |
| tokenOf 返回错误地址 | 我们自己链上查，不信前端 |

---

## 7. 风险矩阵

| # | 风险 | 概率 | 影响 | 缓解 | 残余 |
|---|------|:--:|:--:|------|:--:|
| 1 | 合约bug资金损失 | 低 | 🔴 | 极简+审计 | 🟢 |
| 2 | Owner私钥泄露 | 低 | 🔴 | 多签 | 🟡 |
| 3 | 自动转失败 | 低 | 🟡 | try-catch+manualWithdraw | 🟢 |
| 4 | Ceres 不可用 | 低 | 🟡 | 铸造不受影响 | 🟢 |
| 5 | 中继器宕机 | 低 | 🟢 | 合约硬顶兜底 | 🟢 |

---

## 附录 A：版本全览

| 维度 | v2.0 | v2.1 | v2.2 | v2.3 |
|------|------|------|------|------|
| 等级 | 三级 | 平等 | 平等 | 平等 |
| maxSupply | 只能减 | 可增可减 | 可增可减 | 可增可减 |
| 资金 | 二层 | 三层手动 | 三层自动 | 三层自动 |
| Ceres | 无 | 合约mapping | SDK集成 | **纯读** |
| 工时 | 17天 | 18天 | 20天 | **18.5天** |

## 附录 B：部署清单

- [ ] 4链 USDC 合约地址
- [ ] RPC 端点（含备份）
- [ ] Owner 多签地址
- [ ] 金库合约地址 + 个人钱包地址
- [ ] **Ceres Registry 合约地址（每条链）**
- [ ] 初始 maxSupply
- [ ] 测试网部署 + 验证
- [ ] 中继器 PM2
- [ ] 前端 Nginx
- [ ] QA + Security
- [ ] 主网部署

---

*本方案 v2.3。*
