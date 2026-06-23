# CONTRA Dashboard v6 PRD

## 1. 产品概述
CONTRA Dashboard 是用户连接钱包后的个人控制面板。4 种身份（Partner/User/Expert/KOL）各有不同的 NFT 和权益。

## 2. 收益模块（不用折线图）
**推荐方案：环形进度条 + 三列数字卡片**
- 主体：一个 240px 的 SVG 环形进度条，显示已提取 / 总可提取收益
- 中心：大号 APR 12.8% 数字 + "Current APR" 标签
- 三列数字卡片：Monthly / Total / Pending
- 视觉：环形进度条使用渐变色填充（青→紫），发光效果

理由：环形进度条比折线图更直观，一眼看到进度比例，且视觉冲击力更强。

## 3. NFT铸造（四身份Tab，保留但视觉提升）
- Tab 切换栏：🥇Partner | 👤User | 🧠Expert | 📢KOL
- 每个 Tab：铸造条件卡（左信息+右质押额）+ 权益 2x2 grid + 配额进度条 + Mint按钮
- 已铸造面板：NFT ID + 专属数据（Expert有声誉/任务/收益，KOL有推荐/佣金/影响力）
- 视觉提升：Tab 激活态用各自身份色，过渡动画 fade-in

## 4. 治理投票（新增）
### 提案列表
- 至少 4 个模拟提案
- 每行：标题 | 状态(Active/Ended/Pending) | 你的投票权重 | 剩余时间 | 投票状态(未投/已投For/Against)
- "Vote" 按钮（仅 Active 且未投可见）

### 投票弹窗
- 点击 Vote → 弹窗
- 提案详情（标题+描述）
- 单选：For / Against / Abstain
- 确认按钮 → 模拟交易 → 关闭弹窗 → 列表更新

### 投票记录
- 已经投过的提案：显示投票选择和投票时间

## 5. 活动记录
- 10行表格，列：Time | Type(Stake/Vote/Claim/Mint) | Amount | TxHash(8位) | Status Badge

## 6. 页面布局
```
┌──────────────────────────────────────────────┐
│  Topbar: Logo | 钱包地址 | 余额 | Network     │
├──────────┬──────────┬──────────┬──────────────┤
│  TVL     │  Staked  │   NFT    │   Earned     │
├──────────┴──────────┼──────────┴──────────────┤
│  环形收益进度图      │  Monthly / Total / Pending│
│  (240px SVG ring)   │  三列纵向数字卡片        │
├─────────────────────┴─────────────────────────┤
│  🥇Partner │ 👤User │ 🧠Expert │ 📢KOL        │
│  [铸造条件卡] [权益2x2] [配额进度] [Mint按钮]  │
├──────────────────────────────────────────────┤
│  治理投票（提案列表 + Vote弹窗）               │
├──────────────────────────────────────────────┤
│  最近活动（表格10行）                          │
└──────────────────────────────────────────────┘
```

## 7. 交互流程
- Tab切换：click → class toggle → fade-in transition
- Mint：点击Mint → 该Tab切换为已铸造面板
- Vote：点击Vote → 弹窗 → 选择立场 → 确认 → 模拟交易 → 列表更新
- 不需要真实区块链交互，纯前端模拟

## 8. 数据字段
收益环形进度：`{ totalEarned: 12450, totalPending: 2180, apr: 12.8, monthlyAvg: 3240 }`
提案：`[{ id, title, description, status, weight, timeLeft, voteStatus, votesFor, votesAgainst }]`
