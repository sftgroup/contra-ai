# CONTRA Dashboard v5 — 合并需求规格

## 目标
把 v1 的高颜值设计 + v2 的四身份 Tab 功能合成一个完整 Dashboard。

## 视觉规范（继承 v1 高颜值）

```
背景: bg-gradient-to-br from-[#0a0a0f] via-[#0d1117] to-[#0a0a0f]
卡片: bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl (hover: border-brand/30 shadow-[0_0_30px_rgba(0,229,255,0.08)])
主色: #00e5ff (brand) / #00ff88 (green) / #7c3aed (purple) / #f59e0b (gold)
字体: Space Grotesk + JetBrains Mono
数据卡片: font-mono 数字, tracking-widest 标签
SVG 面积图 (polyline + linearGradient)，不用 Chart.js
使用 Tailwind CSS CDN
```

## 页面结构（从上到下）

### 1. Topbar (sticky, glass card)
- Logo "C" circle + "CONTRA Dashboard"
- 钱包 Badge: `0x1234...5678` (复制提示)
- 余额: `125,000 CONTRA` (渐变文字)
- Network 下拉: Ethereum | Base | BSC | Solana

### 2. 4 Stats Cards (grid 4 cols, 每个 glass card + glow hover)
- TVL: $2,847,392 · 绿色 ↑12.3% · 图标: vault
- Staked: 100,000 CONTRA · Gold Tier Badge · 图标: lock
- NFT: #0421 · Gold Badge · 图标: diamond
- Earned: $12,450.80 · 图标: dollar

### 3. Revenue Section (2 cols)
- Left: SVG 面积图（polyline + linearGradient fill, 30天模拟数据点），viewBox="0 0 300 120"
- Right: 4 stat rows — APR 12.8% / Monthly $3,240 / Total $12,450 / Next Claim 6d 14h

### 4. NFT Identity Tabs (核心)
标签栏（居中，glass card 容器内）:
```
🥇 Partner  |  👤 User  |  🧠 Expert  |  📢 KOL
```

**每个 Tab 内容结构相同（JS 切换）：**

A. 铸造条件卡（2列: 左信息+图标 / 右质押金额大号渐变数字）
B. 权益列表（grid 2x2 小卡，每卡带绿色 ✓ 图标）
C. 配额进度条（渐变填充, 标签: minted/total · 百分比）
D. "Mint [身份] NFT" 按钮（渐变发光 btn-mint）

**点击 Mint 后 → 该 Tab 切换到"已铸造面板"（纯 CSS/JS class 切换，不需区块链）：**
- 显示 NFT ID badge
- 该身份的专属数据面板

**各身份数据：**

| Tab | NFT | 质押 | 权益 | 配额 | 已铸造面板内容 |
|Partner|Gold NFT|100K CONTRA|10%协议费/3x投票/优先Agent/早期功能|180/1,000|NFT ID +#00180 + 收益面板 + 治理提案|
|User|Bronze NFT|5K CONTRA|3%费/1x投票/基础Agent/社区投票|6,300/10,000|NFT ID +#06300 + 基础面板|
|Expert|Expert NFT|25K+KYC|任务匹配/声誉/5%费/1.5x投票|2,100/10,000|NFT ID + 声誉89/任务47/进行中3/收益$28,450|
|KOL|KOL NFT|50K+验证|推荐佣金/专属链接/社区激励/2x投票|128/500|NFT ID + 推荐234人/佣金$15,680/影响力87|

### 5. Governance Proposals (2 cards, grid 2 cols)
- CIP-12: Adjust Fee Split · Active · 剩余3d · Vote按钮
- CIP-11: Onboard Solana Agents · Active · 剩余5d · Vote按钮

### 6. Recent Activity Table (5 rows)
- Columns: Time | Type(Stake/Vote/Claim/Mint) | Amount | Tx(截断8位) | Status Badge
- Status: Confirmed(default绿)/Pending(黄)/Failed(红)

## 交互要求
- Tab 切换: class toggle, fade-in 过渡
- Mint 点击: 切换该 Tab 的 mintedState, 显示已铸造面板 + 该身份专属数据
- 无需区块链交互, 纯前端模拟

## 输出
write `/home/ubuntu/.openclaw/workspace/projects/ai-consulting-platform/ui-prototype/dashboard.html`
