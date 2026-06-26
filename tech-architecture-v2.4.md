# Contra AI Phase 1 — 技术方案 v2.4 (Ceres 集成论证)

> Version: 2.4 | Date: 2026-06-27 | Author: Wayne  
> **v2.4 核心**：Ceres 邀请——用户授权即绑定，不铸造 DID，域名使用 contra.ai

---

## Ceres 集成：两种实现路径论证

### 用户需求

1. 邀请链接域名是 `contra.ai`（不是 `0xainet.top/ceres`）
2. 被邀请人只需"打开链接 → 授权钱包"，不需要铸造 Ceres DID
3. 邀请关系通过 Ceres 记录在链上

### 路径 A：新增 invite() 方法（不改 Ceres DID 铸造流程）

在 CeresRegistry 加一个 `invite(inviter, invitee)` 方法，只记录邀请关系，不触发 DID 铸造。

```solidity
function invite(uint256 inviter, uint256 invitee) external {
    require(inviterOf[invitee] == 0, "Already has inviter");
    require(didContract.ownerOf(inviter) != address(0), "Inviter not found");
    require(didContract.ownerOf(invitee) != address(0), "Invitee not found");
    require(inviter != invitee, "Self-invite");

    inviterOf[invitee] = inviter;
    _directInvitees[inviter].push(invitee);
    _updateDescendantCounts(inviter, 1);

    emit InviteRecorded(inviter, invitee);
}
```

**前提**：双方都已拥有 Ceres DID。

| 优点 | 缺点 |
|------|------|
| 语义清晰（仅邀请，不 DID） | 需要 Ceres 合约升级 |
| 接口独立，审计范围小 | 双方需要先有 Ceres DID |
| 和现有 createProfile 兼容 | 用户还是需要 Ceres DID |

### 路径 B：后台自动 createProfile

被邀请人点"授权"后，前端自动调用 CeresRegistry.createProfile，用最小 profile 参数（name 填地址缩写、"Contra AI 成员"、avatar 空、urls 空），一笔交易同时完成 DID 铸造 + 邀请关系绑定。

```typescript
// 前端在用户点"授权"后执行
await createProfile(
  shortenAddr(address),  // name: "0x1234...5678"
  "Contra AI Member",     // bio
  "",                     // avatar
  [],                     // urls
  inviterTokenId,         // 推荐人的 Ceres tokenId
)
```

**前提**：只需要邀请人有 Ceres DID，被邀请人可以没有。

| 优点 | 缺点 |
|------|------|
| **不需要改 Ceres 合约** | 用户需要支付 gas |
| 被邀请人零 Ceres 知识 | 单笔 gas ≈ 0.001 ETH（含 DID 铸造） |
| 复用现有接口 | 用户多一个无感知的 CERES NFT |
| 立即可用 | |

### 路径对比

| | 路径 A（新 invite） | 路径 B（自动 createProfile） |
|------|:--:|:--:|
| Ceres 合约变更 | ✅ 需要 | ❌ 不需要 |
| 用户 gas 成本 | ~0.0005 ETH | ~0.001 ETH |
| 用户需 Ceres DID | 双方都要 | 只需推荐人 |
| 部署时间 | 需合约升级 | 立即可用 |
| 代码量 | +10 行合约 + 前端 | 仅前端 |
| 推荐 | | ⭐ |

### 推荐：路径 B

理由：
1. **立即可用**，不需要等 Ceres 合约升级
2. 用户全程感知："张三邀请你加入 Contra AI" → "授权" → "完成"。无 Ceres 品牌
3. DID 铸造被完全封装在授权流程中，用户不感知
4. Ceres DID 作为副产品存在，未来 Phase 2 可扩展

---

## 邀请流程图

```
[股东 A — Contra AI Dashboard]
    │ 钱包已连接
    │ CeresRegistry.tokenOf(A地址) → A的CeresTokenId
    │ 生成链接：contra.ai/invite?ref=A_ADDRESS
    │ 展示：descendantCount[A_tokenId]
    ▼
[用户 B — 打开 contra.ai/invite?ref=A_ADDRESS]
    │ 页面：Connect Wallet
    │ 解析 ref=A_ADDRESS → CeresRegistry.tokenOf(A地址) → inviterTokenId
    │ 页面："A_ADDRESS 邀请你加入 Contra AI"
    ▼
[用户 B — 点"授权加入"]
    │ 钱包弹窗 → confirm 交易
    │ 前端调 CeresRegistry.createProfile(
    │   name: "0x5678",
    │   bio: "Contra AI Member",
    │   avatar: "",
    │   urls: [],
    │   inviterTokenId: A的CeresTokenId
    │ )
    │ → 交易成功
    │ → 链上：inviterOf[B_tokenId] = A_tokenId
    │ → 链上：descendantCount[A_tokenId] += 1
    ▼
[完成]
    │ 页面："已加入！"
    │ → "前往铸造股东 NFT" 按钮
    │ → "前往 Dashboard" 按钮
```

---

## 合约影响

| 合约 | 变更 |
|------|------|
| ContraNFT | 不变（7 个方法，无 Ceres 逻辑） |
| Treasury | 不变（自动转 + manualWithdraw） |
| CeresRegistry | **不变**（直接用 createProfile） |
| CeresDID | 不变 |

**结论：Zero 合约变更。** Contra AI 侧只需要前端调用 Ceres SDK 的 `useCreateProfile` hook。

---

## 技术实现

### 邀请落地页 (`contra.ai/invite`)

```tsx
import { useCreateProfile } from '@ceres/sdk';
import { useSearchParams } from 'react-router-dom';

function InvitePage() {
  const [params] = useSearchParams();
  const ref = params.get('ref'); // A 的钱包地址
  const { createProfile } = useCreateProfile();
  const { address } = useAccount();

  // 解析 ref 地址 → Ceres tokenId
  const { data: inviterTokenId } = useReadContract({
    ...registryContract,
    functionName: 'tokenOf',
    args: ref ? [ref as `0x${string}`] : undefined,
  });

  const handleJoin = async () => {
    await createProfile(
      `${address?.slice(0, 6)}`,  // 简短 name
      "Contra AI Member",          // bio
      "",                          // avatar
      [],                          // urls
      inviterTokenId,              // 推荐人 Ceres tokenId
    );
    // 跳转 Dashboard 或铸造页
  };

  if (!address) return <ConnectWallet />;
  return (
    <div>
      <h1>{ref} 邀请你加入 Contra AI</h1>
      <button onClick={handleJoin}>授权加入</button>
    </div>
  );
}
```

### Dashboard 显示邀请

```tsx
function Dashboard() {
  const { address } = useAccount();

  // 查自己的 Ceres tokenId
  const { data: myTokenId } = useReadContract({
    ...registryContract,
    functionName: 'tokenOf',
    args: [address],
  });

  // 查邀请人数
  const { data: inviteCount } = useReadContract({
    ...registryContract,
    functionName: 'descendantCount',
    args: myTokenId ? [myTokenId] : undefined,
  });

  return (
    <div>
      {/* 邀请链接 */}
      <InviteLink
        url={`https://contra.ai/invite?ref=${address}`}
        count={inviteCount}
      />

      {/* NFT 资产 */}
      <NFTCard />
    </div>
  );
}
```

---

## 安全性

| 风险 | 缓解 |
|------|------|
| 伪造 ref 参数 | CeresRegistry.createProfile 会验证 inviterTokenId 存在 |
| 重复授权 | CeresRegistry.AlreadyHasDID() 拒绝重复 |
| gas 攻击 | 用户自付 gas，和我们无关 |
| 隐私泄露 | ref 传的是公开地址，无隐私风险 |

---

## 工时变更

| 任务 | v2.3 | v2.4 | 变化 |
|------|:--:|:--:|------|
| Dashboard Ceres 集成 | 0.5 | **1** | +0.5（新增写操作） |
| 邀请落地页 | 无 | **1** | +1（新页面） |
| Ceres 合约变更 | 0 | 0 | 不需要 |
| **总计** | 18.5 | **19.5** | +1 |

---

*本文档 v2.4。*
