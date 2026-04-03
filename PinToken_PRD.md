# PinToken — Product Requirements Document (PRD)
> Version 1.0 | March 2026  
> 作者：Kenny  
> 状态：MVP 开发中

---

## 1. 产品概述

### 1.0 Slogan
- **英文：** *Pin your token. Save your dollar.*
- **中文：** *Pin 住 Token，管住钱*

### 1.1 产品定位

**产品三大支柱（优先级排序）：**
1. **Token 消耗监控** — 追踪用了多少 Token、花了多少钱（按 API 计价）
2. **当前状态监控** — Provider 运行状态、高峰时段提醒
3. **分享** — 收据风格分享卡片，炫耀 Token 消耗量驱动病毒传播

**内部描述（PRD/开发用）：**
PinToken 是一个 LLM Token 消耗监控与可视化工具。默认通过 Log Observer 模式零侵入读取 Claude Code 日志，记录 token 用量与费用，并以可视化仪表盘呈现消耗数据。核心差异化：**让用户看见每一个 Token 花在哪里**，并生成可分享的收据风格卡片用于社交媒体传播。

**官网对外描述（用户可见）：**
PinToken 是一个 AI Token 消耗监控与可视化工具。零配置自动追踪你的 LLM Token 用量与费用，看清每一个 Token 花在哪里。

**设计原则：**
- **省钱相关全部弱化** — "省了多少钱"、"vs 订阅对比"等降为辅助小字。等后续能真实帮用户省钱（智能路由建议）时再强化
- **监控模式默认 Log Observer** — 不拦截 API 请求，只读日志。Dashboard 中删除所有 Proxy 模式引导/切换 UI
- **炫耀指标优先** — Token 消耗量和 API 花费是用户最想分享的数字

### 1.2 目标用户
- 重度 LLM API 用户（月账单 $50+）
- 使用多个 LLM provider 的独立开发者或小团队
- 使用 Claude Code、Cursor 等 AI coding 工具的开发者
- 希望控制 API 成本但没时间手动优化的用户

### 1.3 核心价值主张
> "你用了多少 Token，一眼看清楚。"

### 1.4 商业模式
| 功能 | 免费（本地） | 付费（云端） |
|------|------|------|
| 本地代理 + 请求拦截 | ✅ | ✅ |
| 本地仪表盘 | ✅ | ✅ |
| 数据存储 | 本地 SQLite | 云端数据库 |
| 多设备同步 | ❌ | ✅ |
| 分享卡片（云端托管 URL） | ✅（永久免费，获客钩子） | ✅ |
| 历史数据无限期 | ❌ | ✅ |
| 团队协作 | ❌ | ✅ |
| 高峰时段提醒 | ✅ | ✅ |

> 分享卡片永久免费，是 PinToken 最重要的增长引擎。

---

## 2. 安全与隐私原则（不可妥协）

1. **API Key 永远只存本地**，绝对不上传到服务器
2. 云端只同步脱敏统计数据：token 数、费用、时间戳、模型名称
3. 代码完全开源（GitHub）
4. 明确在 UI 和文档中承诺：「Your API Keys never leave your machine」
5. 提供网络请求可视化，用户可自行验证无 Key 外传
6. 本地代理仅作透传，不修改请求内容

---

## 3. 支持的 LLM Providers（MVP）

| Provider | 模型示例 | API 格式 |
|------|------|------|
| Anthropic | Claude Sonnet 4.6, Opus 4.6, Haiku 4.5 | 原生 Anthropic API |
| OpenAI | GPT-4o, GPT-4o-mini, o3 | OpenAI 兼容 |
| xAI | Grok-3, Grok-3-mini | OpenAI 兼容 |
| Google Gemini | Gemini 2.0 Flash, Pro | OpenAI 兼容 |
| Moonshot (Kimi) | kimi-k2, moonshot-v1 | OpenAI 兼容 |
| Alibaba (Qwen) | qwen-max, qwen-plus | OpenAI 兼容 |
| Zhipu (GLM) | GLM-4, GLM-4-flash | OpenAI 兼容 |
| Deepseek | deepseek-chat, deepseek-reasoner | OpenAI 兼容 |

> 大部分 provider 支持 OpenAI 兼容格式，代理层可统一处理。Anthropic 需单独适配。

---

## 4. 安装形态

### 4.1 命令行工具（npx）
目标：**30 秒内跑起来**

```bash
npx pintoken setup
```

安装流程：
1. 检测系统环境（Node.js 版本）
2. 启动本地代理服务（默认端口 `7777`）
3. 自动检测并写入常见工具配置：
   - `~/.claude/config` (Claude Code)
   - 项目根目录 `.env` 文件
   - Shell profile (`~/.zshrc` / `~/.bashrc`)
4. 启动本地 Dashboard（自动打开浏览器 `http://localhost:7777`）
5. 打印成功提示 + 下一步操作说明

用户只需将原来的 `base_url` 改为：
```
ANTHROPIC_BASE_URL=http://localhost:7777/anthropic
OPENAI_BASE_URL=http://localhost:7777/openai
```

### 4.3 终端状态面板（Terminal Status Panel）

**目标：** 每次打开新终端，自动展示 PinToken 用量摘要，对标 Claude Code 启动界面的视觉风格。

**实现方式：**
安装时自动在 `~/.zshrc` / `~/.bashrc` 末尾写入：
```bash
# PinToken status
pintoken status
```

---

**视觉规范（定稿）：**

整体风格对标 Claude Code TUI：
- 背景色：`#1e2025`
- 外边框：`1px solid #FF6B35`（橙色，与品牌色一致）
- 无阴影、无圆角（`border-radius: 4px` 极小值）
- 字体：等宽字体（`Courier New` / monospace）

**布局结构（三层）：**

```
┌── PinToken v0.1.0 ──────────────────────────────────┐  ← 顶部版本栏（橙色文字）
├─────────────────────────────────────────────────────┤  ← 橙色分隔线
│  [像素图钉 logo]  PinToken                          │  ← 品牌区（独占一行）
│                   Pin your token. Save your dollar. │
│                   Sonnet 4.6 · API Billing · xxx    │
├──────────────────────────┬──────────────────────────┤  ← 灰色分隔线
│  Usage                   │  Tips                    │  ← 两栏标签（橙色，同一横排）
│  今日花费      $0.23      │  · 你的用量超过了 92% 的  │
│  累计节省  $47.82 ↑78%   │    开发者                │
│  本窗口剩余    3h 47m     │  · 今晚 9 点后使用更划算  │
│  当前状态   ● 正常        │  · 当前任务可降级用 Haiku │
│                           │  · 本月花费比上月少 23%  │
└──────────────────────────┴──────────────────────────┘
❯ _
```

**配色规范：**

| 元素 | 颜色 |
|------|------|
| 品牌名 PinToken | `#FF6B35` 橙色 bold |
| 副标题 / slogan | `#888` 灰白 |
| meta 信息（模型/账号） | `#777` 灰 |
| 栏标题 Usage / Tips | `#FF6B35` 橙色 bold |
| 左侧 label（今日花费等） | `#666` 暗灰 |
| 今日花费 / 本月花费数值 | `#FF6B35` 橙色 |
| 累计节省数值 | `#27c93f` 绿色 |
| 本窗口剩余 | `#ffbd2e` 黄色 |
| 当前状态文字 | `#ccc` 白灰 |
| 状态绿点 | `#27c93f` |
| Tips 文字 | `#ccc` 白灰 |
| Tips 前缀 · | `#FF6B35` 橙色 |
| 行分隔线 | `#2a2d35` |
| 两栏分隔线 | `#333` |
| 光标 | `#888` 闪烁 |

**像素图钉 Logo 规范：**
- 尺寸：18×28px，基于 9×15 像素网格
- 颜色从上到下：`#FF6B35` 头部 → `#CC4A1A` 颈部 → `#AA3A10` 针身 → `#884000` / `#663000` 针尖
- 高光：左上角 2×2 像素 `#FFAA7A`
- `image-rendering: pixelated` 保持像素清晰

**Tips 内容规则（动态生成）：**
- 最多显示 4 条，按优先级排序
- 优先级：高峰提醒 > 模型降级建议 > 用量排名 > 月度趋势
- 每条不超过 18 个中文字，超出截断
- 数据来源：本地 SQLite，不发网络请求

**显示规则：**
- 本地代理未运行时静默跳过，不报错，不影响终端启动速度
- 响应时间 < 50ms
- 可通过 `pintoken status --off` 关闭自动显示
- 高峰时段状态点变为红色 `#ff5f56`，Tips 第一条强制显示高峰提醒

### 4.2 桌面 App（Electron）

**定位：** Electron 是 Dashboard（5.2）的原生容器壳，Dashboard 内容只写一份，浏览器和 Electron 两个入口共用同一套 UI。

**Electron 额外提供的原生能力：**
- 开机自启动，常驻后台
- 系统菜单栏图标（托盘）
- 图标状态随高峰时段变色：
  - 🟢 绿色：正常时段
  - 🟡 黄色：30 分钟内进入高峰
  - 🔴 红色：当前高峰时段
- 点击图标展开 mini 快速面板（内嵌 Dashboard）
- 系统级桌面通知推送（高峰提醒）

**桌面图标规范：**
- 像素风图钉，与终端面板 logo 保持一致
- 尺寸：512×512px（系统自动缩放）
- 背景：深色圆角矩形 `#1e2025`
- 图钉居中，放大版像素网格
- 菜单栏小图标：16×16px，图钉轮廓简化版，橙色 `#FF6B35`

---

## 5. 核心功能模块

### 5.1 本地代理（Proxy Core）

**技术方案：**
- Node.js HTTP 代理服务，监听 `localhost:7777`
- 路由规则：
  - `/anthropic/*` → 转发至 `https://api.anthropic.com`
  - `/openai/*` → 转发至对应 provider 的 base_url
- 请求透传：完整转发原始请求，不修改任何内容
- 响应拦截：解析响应中的 `usage` 字段，记录后原样返回
- 支持 streaming 响应（SSE）

**数据记录字段：**
```json
{
  "id": "uuid",
  "timestamp": "ISO8601",
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "input_tokens": 1234,
  "output_tokens": 567,
  "cache_read_tokens": 0,
  "cache_write_tokens": 0,
  "cost_usd": 0.00521,
  "baseline_cost_usd": 0.0312,
  "saved_usd": 0.0260,
  "latency_ms": 1823,
  "status_code": 200,
  "session_id": "optional"
}
```

**费用计算：**
- 按官方最新定价硬编码（定期更新）
- `cost_usd`：实际花费
- `baseline_cost_usd`：假设全用该 provider 最贵模型的花费
- `saved_usd`：baseline - actual

**本地存储：**
- SQLite（`~/.pintoken/data.db`）
- 数据永不自动删除

---

### 5.2 本地仪表盘（Dashboard）

**访问方式：**
- 浏览器：`http://localhost:7777`（免费版主入口）
- Electron App：内嵌同一套 UI，额外提供原生窗口体验（第二期）

> Dashboard 是功能内容层，Electron 是原生容器壳，两者共用同一套代码，不重复开发。

---

**视觉规范（定稿）：**

主题：深色（dark mode only，MVP 阶段，浅色为第二期）
背景色：`#13151a`
字体：等宽字体 `Courier New / monospace`

**布局：多 Tab 切换**
```
Overview | Analytics | Providers | Settings
```
Tab 标签：`#555` 灰色，active 为 `#FF6B35` 橙色 + 底部 2px 橙色线

---

**顶部导航栏（Topbar）：**

三元素横排，单行不换行：
```
[像素图钉 logo] [PinToken] [● 正常（非高峰时段）]        [✕]
```

| 元素 | 规范 |
|------|------|
| 背景 | `#1e2025`，底部 `1px solid #FF6B35` |
| logo | 像素图钉，16×24px，橙色 |
| 品牌名 | `#FF6B35`，13px，bold，letter-spacing 2px |
| 状态胶囊 | 紧跟品牌名，`background:#1a2a1a`，`border:1px solid #27c93f`，圆角 4px，内含绿点 + 文字 |
| 状态文字 | `#27c93f`，11px，`white-space:nowrap` 强制不换行 |
| 关闭按钮 | 右侧 `✕`，`#555`，无背景无边框 |

状态胶囊颜色随高峰状态变化：
- 正常：绿色边框 `#27c93f` + 绿点
- 预警：黄色边框 `#ffbd2e` + 黄点
- 高峰：红色边框 `#ff5f56` + 红点

---

**Overview Tab（首屏，定稿）：**

#### 四张总览卡片

横排 4 列，`gap: 10px`，卡片背景 `#1e2025`，边框 `1px solid #2a2d35`，圆角 6px

| 卡片 | 标题 | 数值 | 副文字 | 特殊样式 |
|------|------|------|------|------|
| 1 | 今日 Token 用量 | 284,391 | 昨日 231,042 | 橙色边框 `#FF6B3544`，标题橙色，数值 26px 白色 |
| 2 | 今日花费 | $0.23 | 昨日 $0.31 | 标准样式 |
| 3 | 本窗口剩余 | 3h 47m | 重置于 23:14 | 标准样式 |
| 4 | 累计节省 | $47.82 | ↑ 比全用 GPT-4o 省 78% | 标准样式 |

卡片文字规范：
- 标题：`#aaa`，12px，letter-spacing 1px
- 数值（标准）：`#ddd`，20px，bold
- 数值（突出，卡片1）：`#fff`，26px，bold
- 副文字：`#888`，10px

#### 请求明细列表

列表顶部有 Provider 筛选按钮：全部 / Anthropic / OpenAI / Deepseek（active 状态橙色填充）

列字段：

| 列 | 内容 |
|------|------|
| 模型 | 灰色 pill 标签 |
| Provider | 彩色小圆点 + 名称（Anthropic 橙点，Deepseek 绿点） |
| Token 用量 | 数字 |
| 占比 | 进度条（80px）+ 百分比数字 |
| 花费 | 橙色 `#FF6B35` |
| 节省 | 绿色 `#27c93f` |

表头：`#444`，10px；表格行：`#999`，11px；行分隔线：`#1a1c21`

---

**其他 Tab（第二期）：**
- Analytics：费用趋势折线图、模型使用分布饼图
- Providers：各 provider 实时状态 + 24h×7d 响应热力图
- Settings：API Key 管理、定价配置、通知设置

---

### 5.3 高峰时段提醒系统

**数据来源：探测服务（见第 6 节）**

**提醒方式：**
- 桌面通知（Electron）
- 系统托盘图标变色
- Dashboard 顶部 Banner
- 可选：邮件提醒（云端付费功能）

**提醒逻辑：**
- 提前 30 分钟预警「即将进入高峰」
- 进入高峰时推送通知
- 基于用户本地时区自动计算

**已知高峰数据（初始硬编码）：**
- Anthropic：北京时间 21:00–03:00（官方公布）
- 其他 provider：由探测服务数据驱动，持续更新

---

### 5.4 分享卡片（Share Card）

**触发：** 用户点击「生成分享卡片」按钮

**卡片内容：**
```
┌─────────────────────────────┐
│  🪙 PinToken                │
│                             │
│  本月节省了                  │
│  $ 47.23                    │
│  ████████████████ 78%       │
│                             │
│  处理请求  1,247 次           │
│  最聪明的选择                 │
│  Deepseek 替代 GPT-4o        │
│  单次省 $0.89                │
│                             │
│  比「无脑用 GPT-4o」的用户    │
│  省了 78%                    │
│                             │
│  pintoken.io/card/abc123    │
└─────────────────────────────┘
```

**技术实现：**
- 本地用 Canvas / HTML-to-image 生成卡片图片
- 上传至 PinToken 云端，生成永久公开 URL（免费）
- URL 格式：`pintoken.io/card/{nanoid}`
- 卡片页面包含：完整数据展示 + 下载 PinToken 的 CTA

**分享入口：**
- 一键复制链接
- 一键下载图片
- 预填充推文文案（可编辑）

---

## 6. LLM 状态探测服务（后台基础设施）

### 6.1 目的
建立各 LLM provider 的「限速热力图」数据库，支撑高峰提醒功能，作为 PinToken 独家数据资产。

### 6.2 部署
- 部署在 VPS（已购置）
- 24 小时 × 7 天持续运行
- 使用 Kenny 自己的 API Key（不使用用户 Key）

### 6.3 探测逻辑
```
每 10 分钟，对每个 provider 发送：
- 请求内容："Hi" （约 5 tokens）
- 使用各家最便宜的模型
- 记录：响应时间(ms)、状态码、是否 429

生成数据：
- 响应时间序列
- 限速发生时间点
- 24h × 7d 热力图
```

### 6.4 成本估算
```
10 分钟一次 × 8 个 provider × 24h = 1,152 次/天
每次 ~10 tokens × 两端 = 20 tokens
总计：23,040 tokens/天

按混合最便宜模型定价：< $0.10/天 ≈ $3/月
```

### 6.5 数据同步
- 探测数据每小时同步至 PinToken 云端
- 所有客户端拉取同一份热力图数据
- 随时间积累，数据精度持续提升

---

## 7. 技术架构

### 7.1 本地（免费版）
```
┌─────────────────────────────────────┐
│           用户的 LLM 工具             │
│  (Claude Code / Cursor / 自写代码)   │
└──────────────┬──────────────────────┘
               │ base_url 指向本地代理
               ▼
┌─────────────────────────────────────┐
│        PinToken 本地代理              │
│        localhost:7777               │
│  - 请求透传                          │
│  - usage 数据提取                    │
│  - 费用计算                          │
│  - 写入 SQLite                       │
└──────┬────────────────┬─────────────┘
       │                │
       ▼                ▼
  转发至各家          本地 Dashboard
  LLM API           localhost:7777
                    (HTML/CSS/JS)
```

### 7.2 云端（付费版）
```
本地代理 → 脱敏统计数据（无 Key）→ PinToken 云端 API
                                         │
                                    Neon PostgreSQL
                                         │
                              多设备同步 / 分享卡片托管
```

### 7.3 技术栈
| 层级 | 技术选型 |
|------|------|
| 本地代理 | Node.js + `http-proxy` |
| 本地存储 | SQLite (`better-sqlite3`) |
| 本地 Dashboard | HTML/CSS/Vanilla JS（无框架，减少依赖） |
| 桌面 App | Electron |
| 命令行工具 | Node.js CLI（发布到 npm） |
| 云端 API | Node.js + Vercel |
| 云端数据库 | Neon PostgreSQL + Prisma |
| 分享卡片生成 | `html-to-image` 或 Canvas API |
| 探测服务 | Node.js，部署在 VPS（cron job） |

---

## 8. 开发里程碑

---

### M1 — 能用（目标：2 周）

**验收标准：** 用真实 API Key 发一条请求，Dashboard 能看到这条记录和费用。Kenny 自己能稳定使用。

**功能清单：**

- [ ] 本地代理核心
  - Anthropic + OpenAI 两个 provider 透传
  - SSE Streaming 支持（参考 Helicone 开源实现）
  - 响应拦截：解析 `usage` 字段，记录后原样返回
  - 监听端口 `localhost:7777`

- [ ] SQLite 本地存储
  - 记录字段：timestamp、provider、model、input_tokens、output_tokens、cost_usd、baseline_cost_usd、saved_usd、latency_ms、status_code
  - 数据永不自动删除

- [ ] 费用计算引擎
  - 集成 TokenCost npm 包（主数据源）
  - 补充 pricing-supplement.json（Kimi/Qwen/GLM/Deepseek 等）
  - 未知模型显示「定价未知」

- [ ] Dashboard 基础版（Overview Tab）
  - 顶部导航栏：logo + 状态 + ✕
  - 四张总览卡片：今日 Token 用量 / 今日花费 / 本窗口剩余 / 累计节省
  - 请求明细列表：模型 / Provider / Token 用量 / 占比进度条 / 花费 / 节省
  - Provider 筛选按钮

- [ ] `npx pintoken setup` 安装脚本
  - 启动本地代理服务
  - 自动写入 Claude Code config
  - 自动写入 shell profile（zsh/bash）
  - 自动打开浏览器 `localhost:7777`
  - ⚠️ 需提前用 Perplexity 调研边界情况（见附录C）

**技术栈：** Node.js + SQLite（better-sqlite3）+ 原生 HTML/CSS/JS Dashboard

**M1 成功指标：**
- 安装到首次数据可见 ≤ 2 分钟
- Kenny 自用连续 ≥ 7 天无中断

---

### M2 — 好用（目标：M1 后 2 周）

**验收标准：** 功能完整，可以公开给其他开发者使用，分享卡片能在社交媒体传播。

**功能清单：**

- [ ] 补全 6 个 Provider 接入
  - xAI（Grok）、Google Gemini、Moonshot（Kimi）、Qwen、GLM、Deepseek
  - 均为 OpenAI 兼容格式，M1 架构跑通后批量接入

- [ ] Dashboard 完善
  - Analytics Tab：费用趋势折线图（近 30 天）+ 模型使用分布饼图
  - Providers Tab：各 provider 实时状态 + 高峰时段热力图
  - 深色/浅色主题切换

- [ ] 终端状态面板（`pintoken status`）
  - 终端启动时自动展示两栏面板（对标 Claude Code 界面风格）
  - 写入 shell profile 自动触发
  - 静默跳过（代理未运行时不报错）

- [ ] 高峰时段提醒
  - Anthropic 高峰硬编码（北京时间 21:00–03:00）
  - 系统通知推送（macOS / Linux）
  - 基于用户本地时区自动转换

- [ ] 分享卡片
  - 本地用 html-to-image 生成卡片图片
  - 上传云端生成永久公开 URL（`pintoken.io/card/{nanoid}`）
  - 一键复制链接 + 下载图片 + 预填推文

- [ ] 云端基础设施（分享卡片专用）
  - Vercel + Neon PostgreSQL
  - 只存脱敏统计数据（无 API Key）
  - 分享卡片页面含 PinToken 下载 CTA

**M2 成功指标：**
- 支持 8 个 provider 全部接入
- 分享卡片生成数首月 ≥ 10 张
- 通过分享卡片带来新安装 ≥ 20%

---

### M3 — 商业化（目标：M2 后 3-4 周）

**验收标准：** 正式对外发布，开始收费，云端同步上线。

**功能清单：**

- [ ] Electron 桌面 App
  - 系统菜单栏常驻图标（绿/黄/红三态）
  - 开机自启动
  - 内嵌 Dashboard（与浏览器版共用同一套 UI）
  - 像素图钉 App 图标（三种状态色背景）

- [ ] 云端同步（付费功能）
  - 多设备数据同步
  - 无限历史数据
  - 用户注册 / 登录系统

- [ ] LLM 状态探测服务
  - 部署在 VPS，24 小时持续运行
  - 每 10 分钟探测 8 个 provider
  - 生成各家 24h×7d 限速热力图
  - 数据同步至云端供所有客户端使用

- [ ] 官网（pintoken.io）
  - 产品介绍 + Slogan
  - 下载 / 安装入口
  - 分享卡片托管页面

- [ ] 开源发布
  - GitHub 公开仓库
  - README 完整文档
  - 明确 Key 安全承诺

- [ ] 商业化上线
  - 付费订阅（Pro $9/月，Team $29/月）
  - 分享卡片永久免费

**M3 成功指标：**
- 付费用户 ≥ 10 人
- GitHub Stars ≥ 200
- 探测服务稳定运行 ≥ 30 天

---

## 9. 定价模型

| 方案 | 价格 | 说明 |
|------|------|------|
| Free | $0 | 本地运行，无限期使用 |
| Pro | $9/月 | 云端同步 + 多设备 + 无限历史 |
| Team | $29/月 | 最多 5 人 + 团队用量汇总 |

> 分享卡片所有用户永久免费，是 PinToken 最重要的增长引擎。

---

## 10. 成功指标汇总

| 阶段 | 指标 | 目标 |
|------|------|------|
| M1 | 安装到首次数据可见 | ≤ 2 分钟 |
| M1 | Kenny 自用连续天数 | ≥ 7 天 |
| M2 | 分享卡片生成数 | 首月 ≥ 10 张 |
| M2 | 分享卡片带来新安装占比 | ≥ 20% |
| M3 | 付费用户 | ≥ 10 人 |
| M3 | GitHub Stars | ≥ 200 |

---

## 附录A：定价数据管理方案

### 定价数据源策略：TokenCost + 自维护补充

**主数据源：TokenCost 开源库**
- GitHub ~1.5K stars，MIT 许可，覆盖 400+ 模型定价
- 直接 npm/pip 集成，省去手动维护大部分模型定价
- 项目地址：`https://github.com/AgentOps-AI/tokencost`
- 适合覆盖国际主流模型（Anthropic、OpenAI、xAI、Gemini 等）

**补充数据源：PinToken 自维护 JSON**
- 覆盖 TokenCost 未收录的模型（Kimi、Qwen、GLM、Deepseek 等）
- 作为 TokenCost 的 fallback，模型未找到时查自维护表
- 存放位置：GitHub repo `/data/pricing-supplement.json`

**为什么不只用 LiteLLM 定价 JSON：**
- 社区维护，非官方数据源，准确性无保证
- 结构与各家原生 API 命名不完全对应，需额外映射层

### PinToken 自维护补充定价 JSON

**存放位置：** GitHub repo `/data/pricing.json`

**数据结构：**
```json
{
  "anthropic/claude-sonnet-4-6": {
    "input_per_1m": 3.00,
    "output_per_1m": 15.00,
    "cache_write_per_1m": 3.75,
    "cache_read_per_1m": 0.30,
    "currency": "USD",
    "source": "https://anthropic.com/pricing",
    "updated": "2026-03-30"
  },
  "anthropic/claude-opus-4-6": {
    "input_per_1m": 15.00,
    "output_per_1m": 75.00,
    "cache_write_per_1m": 18.75,
    "cache_read_per_1m": 1.50,
    "currency": "USD",
    "source": "https://anthropic.com/pricing",
    "updated": "2026-03-30"
  },
  "anthropic/claude-haiku-4-5": {
    "input_per_1m": 0.80,
    "output_per_1m": 4.00,
    "currency": "USD",
    "source": "https://anthropic.com/pricing",
    "updated": "2026-03-30"
  },
  "openai/gpt-4o": {
    "input_per_1m": 2.50,
    "output_per_1m": 10.00,
    "currency": "USD",
    "source": "https://openai.com/api/pricing",
    "updated": "2026-03-30"
  },
  "openai/gpt-4o-mini": {
    "input_per_1m": 0.15,
    "output_per_1m": 0.60,
    "currency": "USD",
    "source": "https://openai.com/api/pricing",
    "updated": "2026-03-30"
  },
  "xai/grok-3": {
    "input_per_1m": 3.00,
    "output_per_1m": 15.00,
    "currency": "USD",
    "source": "https://x.ai/api",
    "updated": "2026-03-30"
  },
  "google/gemini-2.0-flash": {
    "input_per_1m": 0.10,
    "output_per_1m": 0.40,
    "currency": "USD",
    "source": "https://ai.google.dev/pricing",
    "updated": "2026-03-30"
  },
  "deepseek/deepseek-chat": {
    "input_per_1m": 0.27,
    "output_per_1m": 1.10,
    "currency": "USD",
    "source": "https://platform.deepseek.com/docs/pricing",
    "updated": "2026-03-30"
  },
  "moonshot/kimi-k2": {
    "input_per_1m": 0.15,
    "output_per_1m": 2.50,
    "currency": "USD",
    "source": "https://platform.moonshot.cn/docs/pricing",
    "updated": "2026-03-30"
  },
  "qwen/qwen-max": {
    "input_per_1m": 0.40,
    "output_per_1m": 1.20,
    "currency": "USD",
    "source": "https://www.alibabacloud.com/help/en/model-studio/pricing",
    "updated": "2026-03-30"
  },
  "zhipu/glm-4": {
    "input_per_1m": 0.14,
    "output_per_1m": 0.14,
    "currency": "USD",
    "source": "https://open.bigmodel.cn/pricing",
    "updated": "2026-03-30"
  }
}
```

### 更新机制

**成本计算优先级：**
```
1. 调用 TokenCost 库查询模型定价
2. 未找到 → 查 pricing-supplement.json（本地缓存）
3. 仍未找到 → Dashboard 显示「定价未知」，提示用户手动输入
```

**客户端加载逻辑：**
```
1. 启动时加载 TokenCost（npm 包，随 PinToken 一起安装）
2. 同时读取本地 pricing-supplement.json 缓存
3. 每 24 小时从 GitHub 拉取最新 pricing-supplement.json
4. 拉取失败则继续用本地缓存，不影响运行
```

**定价变动检测（探测服务附带任务）：**
- VPS 上每天定时访问各家定价页面
- 对比关键数字是否变化
- 有变动时发 Telegram / 邮件通知 Kenny 手动核实后更新

**未知模型兜底：**
- 用户使用了 pricing.json 中没有的模型
- Dashboard 显示「定价未知，请手动添加」
- 提供入口让用户自己输入定价（存本地，不上报）

> ⚠️ 所有定价数据以各家官网为准，PinToken 不对计算误差负责。界面上需注明数据来源链接。

---

## 附录B：产品路线图 — PinToken → Token管家

**第一阶段：PinToken（当前）**
- 目标用户：个人开发者，API pay-as-you-go 用户
- 核心价值：个人用量监控 + 省钱可视化 + 晒账单传播
- 市场：全球开发者
- 商业模式：本地免费 + 云端同步付费

**第二阶段：Token管家（企业版，6-12个月后）**
- 目标用户：中国企业/团队，B2B
- 核心价值：企业成本归因 + 预算管控 + 飞书/钉钉集成
- 市场：中国企业市场
- 商业模式：Freemium + 按管理 Token 量阶梯计费
- 差异化：One-API 数据源直连 + 飞书原生体验 + 国产模型全覆盖

**两个产品共用：**
- 本地代理核心引擎
- TokenCost + 自维护定价数据
- Provider 状态探测服务
- 分享卡片云端基础设施

> 参考调研：Token管家竞品分析报告（2026-03-30）显示中国 AI FinOps 赛道目前零专门创业公司，飞书生态存在明确市场空白。PinToken 验证 PMF 后，Token管家是自然的企业版延伸方向。
---

## 附录C：npx 安装脚本调研清单（开发前必读）

开发 `npx pintoken setup` 之前，需通过 Perplexity 调研以下问题，结果整理后交给 Claude Code：

1. Claude Code 配置文件的路径（2026 最新版本）
2. 如何在 Node.js 中检测用户当前 shell 类型（zsh / bash / fish）
3. macOS / Linux 下 shell profile 文件的标准路径
4. npx CLI 工具修改 shell profile 的最佳实践（避免重复写入）
5. Node.js 检测并写入 .env 文件的安全方式
6. 如何在 npx 安装完成后自动打开浏览器（跨平台）

> 调研完成后将结论作为上下文提供给 Claude Code，避免实现时踩坑。
---

## 附录D：GitHub 开源页面规范

### README 结构（七段式，顺序不可乱）

每段都有明确目的，访客从上到下经历：「看懂 → 想要 → 安装 → 信任 → 行动」

---

**第一段：Hero（3秒让人知道这是什么）**

```markdown
<div align="center">
  <img src="assets/logo.png" width="60" />
  
  # PinToken
  
  **Pin your token. Save your dollar.**
  
  ![MIT License](https://img.shields.io/badge/license-MIT-orange)
  ![npm version](https://img.shields.io/npm/v/pintoken)
  ![Providers](https://img.shields.io/badge/providers-8-blue)
  ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)
</div>
```

规范：
- Logo 居中，像素图钉，60px
- 产品名加 slogan 一行
- Badge 行：MIT / npm版本 / Provider数 / 平台
- 不超过 5 行，不写任何解释

---

**第二段：Demo（只看图就想装）**

- 两张截图并排：左边终端状态面板，右边 Dashboard
- 截图必须是真实数据，不用假数据
- 图片宽度 100%，圆角处理
- 图下方一句话说明即可，不超过 15 字

```markdown
<img src="assets/terminal-preview.png" width="48%" />
<img src="assets/dashboard-preview.png" width="48%" />

> 终端启动时自动展示用量摘要，浏览器仪表盘实时可见每一分花费。
```

---

**第三段：Install（门槛越低越好）**

```markdown
## Install

\`\`\`bash
npx pintoken setup
\`\`\`

Done. PinToken auto-configures Claude Code and your shell.  
Open [http://localhost:7777](http://localhost:7777) to see your dashboard.
```

规范：
- 只写一行安装命令，放最显眼位置
- 说明自动配置了什么（Claude Code + shell）
- 不写任何前置条件，Node.js 版本要求放后面的 Requirements 里

---

**第四段：Features（四个卡片，每个一句话）**

```markdown
## Features

| | |
|---|---|
| **Token 用量监控** 实时记录每次 LLM 调用的 token 消耗与费用 | **省钱可视化** 对比全用贵模型的假设成本，看见省了多少 |
| **高峰时段提醒** 自动提醒避开限速高峰，延长可用窗口 | **分享账单卡片** 生成可分享的省钱报告，一键发 X / Twitter |

**Supported Providers**  
Anthropic · OpenAI · xAI · Google Gemini · Moonshot (Kimi) · Qwen · GLM · Deepseek
```

规范：
- 每个 feature 不超过 15 字
- Provider 列表一行展示，用 · 分隔
- 不写技术实现细节

---

**第五段：Security（正面回答开发者最担心的问题）**

```markdown
## Security

- ✅ **API Keys never leave your machine** — local proxy only, no key transmission
- ✅ **Cloud sync is opt-in** — only anonymized stats (token counts, costs, timestamps)
- ✅ **Fully open source** — audit the code yourself
- ✅ **Local SQLite** — your data stays on your disk
```

规范：
- 必须放在 Features 后，Installation 前或后均可，但不能在页面下半段
- 四条绿勾，每条一句话
- 第一条最重要，放最前

---

**第六段：Stats 数字行**

```markdown
<div align="center">

| 8 Providers | < 2 min Setup | MIT License | Free Local Use |
|:-----------:|:-------------:|:-----------:|:--------------:|

</div>
```

规范：
- 四个数字，居中对齐
- 只放客观事实，不放估算数据

---

**第七段：Star CTA（页面最底部）**

```markdown
---

If PinToken saved you money, consider giving it a ⭐  
Share your savings card with [#PinToken](https://twitter.com/search?q=%23PinToken) on X.
```

规范：
- 一句话，不超过 20 字
- 加 #PinToken 话题引导，形成社区聚合效应
- 放最后，不要放在中间打断阅读

---

### 其他 GitHub 页面配置

**repository description（仓库副标题）：**
```
Track your LLM API usage & costs locally. Supports Anthropic, OpenAI, xAI, Gemini, Kimi, Qwen, GLM, Deepseek.
```

**Topics（标签，影响搜索排名）：**
```
llm, api, token, cost-management, anthropic, openai, claude, developer-tools, cli, proxy
```

**社区文件（必须有）：**
- `LICENSE`：MIT
- `CONTRIBUTING.md`：贡献指南
- `SECURITY.md`：安全政策，重申 Key 本地化承诺
- `.github/ISSUE_TEMPLATE/`：bug report + feature request 模板

---

## 附录E：开源 GTM 方案

### 核心原则

开源产品爆火靠的不是运气，而是在正确的时间把正确的内容投放到正确的渠道。PinToken 的传播核心是**分享卡片**——每张卡片都是一个带链接的广告位，产品内置了增长引擎。

---

### 第一波：发布当天（决定能不能起势，48 小时窗口）

**必须三个平台同时发，时间差不超过 2 小时。**

**Hacker News（最重要）**
- 标题：`Show HN: PinToken – open source local proxy that tracks your LLM API spending`
- 发布时间：周一或周二，美东时间上午 9 点（新加坡时间晚上 9-10 点）
- 内容：说明为什么做这个、解决什么问题、一行安装命令、截图
- 不要写广告文案，要写「我遇到了这个问题，所以做了这个工具」

**X / Twitter**
- 发一张终端截图 + 一张分享卡片截图
- 文案模板：
  ```
  I built a tool that shows exactly how much I'm spending on AI APIs.
  
  Saved $47 last month by routing simple tasks to cheaper models.
  
  Local proxy. API keys never leave your machine. Open source.
  
  npx pintoken setup
  
  github: [链接]
  #ClaudeCode #OpenAI #buildinpublic
  ```
- 发布后前 30 分钟持续互动回复

**Reddit**
- `r/ClaudeAI`：发使用体验帖，说自己用 Claude Code 时发现额度消耗很快，做了这个工具
- `r/LocalLLaMA`：聚焦「本地运行、数据不出去」的角度
- `r/SideProject`：发「I built this over the weekend」风格的帖子

---

### 第二波：分享卡片病毒传播（产品内置增长引擎）

**机制设计：**
- 每张分享卡片底部有 `pintoken.io/card/xxx` 永久链接
- 卡片落地页底部放下载 CTA：「Generate your own savings card」
- README 底部放「社区分享墙」，展示 #PinToken 话题下的真实卡片截图

**激励用户晒卡片：**
- README 里加一行：「Share your card with #PinToken on X」
- 发布帖里附上自己的第一张卡片作为示范
- 首批 10 张卡片的用户在 README Contributors 里特别致谢

---

### 第三波：借力社区（发布后 2-4 周）

| 渠道 | 动作 | 预期效果 |
|------|------|------|
| Claude Code GitHub | 在 Discussions 里发帖，说明如何配合 PinToken 优化 Max 套餐 | 直接触达核心用户 |
| Awesome 系列 | 提交到 `awesome-claude`、`awesome-llm-tools`、`awesome-developer-tools` | 长尾 SEO 流量 |
| Anthropic Discord | 在 #tools 频道分享 | 精准用户曝光 |
| AI Newsletter | 投稿给 TLDR AI、Ben's Bites、The Rundown | 每封 newsletter 10 万+ 订阅 |
| Product Hunt | M1 完成后上线 PH，准备 hunter + 首日冲榜 | 集中曝光 + badge |

---

### 第四波：数据内容营销（持续，每 1-2 周一篇）

用 PinToken 积累的真实数据产出洞察内容，这类内容天然有传播力：

- 「分析了 500 个 PinToken 用户，发现 62% 的 Opus 调用用 Sonnet 完全够」
- 「Claude Code 用户高峰 vs 非高峰 token 消耗差距实测」
- 「8 个 LLM Provider 的真实响应速度对比（PinToken 探测服务数据）」

发布渠道：X + HN + Dev.to，每篇文章底部附 PinToken 链接。

---

### 发布前准备清单

**T-7（发布前一周）：**
- [ ] README 完整，截图真实好看
- [ ] npx 安装全程测试，确保 30 秒内跑通
- [ ] 分享卡片生成功能上线
- [ ] pintoken.io 官网基础版上线

**T-1（发布前一天）：**
- [ ] 联系 20-30 位开发者朋友，告知明天发布，请他们第一时间 star + 转发
- [ ] 准备好 HN / X / Reddit 的发帖文案
- [ ] 截好产品截图（真实数据）

**T-0（发布当天）：**
- [ ] 同时发 HN + X + Reddit
- [ ] 前 2 小时持续互动，回复每一条评论
- [ ] 请朋友圈同时转发，制造第一波 star 冲量

> ⚠️ 发布当天前 2 小时的互动质量决定算法是否推荐。HN 的「Show HN」如果前 2 小时有 10+ 评论互动，就会进入首页，带来数千访问。
