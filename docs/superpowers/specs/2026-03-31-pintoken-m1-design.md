# PinToken M1 设计文档

> 日期：2026-03-31
> 状态：已通过 brainstorming 审核
> 范围：M1 — "能用"

---

## 1. 目标

用真实 API Key 发一条 LLM 请求，Dashboard 能看到这条记录和费用。安装到首次数据可见 ≤ 2 分钟。

## 2. 系统架构

单进程，单端口（`localhost:7777`），三层路由：

```
用户的 LLM 工具 (Claude Code / Cursor / 自写代码)
        │
        │  ANTHROPIC_BASE_URL=http://localhost:7777/anthropic
        │  OPENAI_BASE_URL=http://localhost:7777/openai
        ▼
┌─────────────────────────────────────────────┐
│          PinToken 本地服务 (localhost:7777)    │
│                                             │
│  路由层：                                    │
│    /anthropic/*  → 代理转发 api.anthropic.com │
│    /openai/*     → 代理转发 api.openai.com    │
│    /api/*        → 本地数据 API (JSON)        │
│    /*            → Dashboard 静态文件          │
│                                             │
│  代理核心：                                   │
│    请求透传 → SSE 实时 pipe → 旁路解析 usage   │
│                    │                         │
│                    ▼                         │
│              费用计算引擎                      │
│           (pricing.json 查询)                 │
│                    │                         │
│                    ▼                         │
│              SQLite 写入                      │
│         (~/.pintoken/data.db)                │
└─────────────────────────────────────────────┘
```

### 数据流（一次请求的完整生命周期）

1. 客户端发请求到 `localhost:7777/anthropic/v1/messages`
2. 代理原样转发到 `api.anthropic.com/v1/messages`（携带原始 headers，包含用户的 API Key）
3. 响应回来后，实时 pipe 给客户端（零延迟）
4. 旁路 transform stream 解析每个 SSE chunk，提取最后的 `usage` 字段
5. 费用计算：`pricing.json` 查定价 → 算 cost + baseline + saved
6. 写入 SQLite
7. 终端打印一行请求日志

### 安全保证

- 代理仅透传，不修改请求/响应内容
- API Key 只在本地内存中经过，不存储、不记录、不上传
- SQLite 只记录脱敏统计数据（token 数、费用、模型名）

## 3. 模块设计

### 3.1 代理核心（Proxy Core）

**职责：** HTTP 代理转发 + SSE streaming 旁路解析

**路由规则：**
- `POST /anthropic/v1/messages` → `https://api.anthropic.com/v1/messages`
- `POST /openai/v1/chat/completions` → `https://api.openai.com/v1/chat/completions`

**Streaming 拦截策略：**
- 实时 pipe 所有 SSE 事件给客户端（零延迟）
- 旁路 transform stream 解析每个 `data:` 行
- Anthropic 格式：在 `message_stop` 事件前的 `message_delta` 中提取 `usage`
- OpenAI 格式：在 `[DONE]` 前的最后一个 chunk 中提取 `usage`
- 非 streaming 请求：直接从响应 body 提取 `usage`

**依赖：** Node.js 原生 `http` 模块（不用 http-proxy 包，减少依赖）

### 3.2 SQLite 存储

**路径：** `~/.pintoken/data.db`（首次启动时自动创建目录和数据库）

**Schema：**

```sql
CREATE TABLE IF NOT EXISTS requests (
  id            TEXT PRIMARY KEY,
  timestamp     TEXT NOT NULL,
  provider      TEXT NOT NULL,
  model         TEXT NOT NULL,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_read_tokens  INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost_usd      REAL DEFAULT 0,
  baseline_cost_usd REAL DEFAULT 0,
  saved_usd     REAL DEFAULT 0,
  latency_ms    INTEGER DEFAULT 0,
  status_code   INTEGER DEFAULT 200
);

CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp);
CREATE INDEX IF NOT EXISTS idx_provider ON requests(provider);
```

**数据永不自动删除。**

### 3.3 费用计算引擎

**数据源：** `data/pricing.json`（纯自维护，不依赖第三方库）

**M1 只需 Anthropic + OpenAI 两家定价，数据已在 PRD 附录A 中完整定义。**

**计算逻辑：**
- `cost_usd` = input_tokens × input_price + output_tokens × output_price + cache 费用
- `baseline_cost_usd` = 同样 token 数，按同 provider 最贵模型定价计算
  - Anthropic baseline: Claude Opus 4.6
  - OpenAI baseline: GPT-4o
- `saved_usd` = baseline_cost_usd - cost_usd
- 未知模型：cost 记为 0，Dashboard 显示「定价未知」

### 3.4 Dashboard 数据 API

| 接口 | 方法 | 返回 |
|------|------|------|
| `/api/summary` | GET | 今日 token 总量、今日花费、累计节省、昨日对比数据 |
| `/api/requests` | GET | 请求列表，支持 `?provider=&limit=50&offset=0` |
| `/api/providers` | GET | 各 provider 的请求数、token 总量、费用占比 |

所有接口返回 JSON，查询 SQLite。

### 3.5 Dashboard（Overview Tab）

**技术：** 原生 HTML/CSS/Vanilla JS，无框架

**访问：** `http://localhost:7777`（代理服务器同时 serve 静态文件）

**布局（按 PRD 5.2 视觉规范）：**
1. 顶部导航栏：像素图钉 logo + PinToken + 状态胶囊（绿色"正常"）
2. 四张总览卡片（横排）：
   - 今日 Token 用量（橙色强调）
   - 今日花费
   - 本次会话时长（M1 简化：显示代理启动后经过的时间，M2 接入高峰数据后改为"本窗口剩余"）
   - 累计节省
3. Provider 筛选按钮：全部 / Anthropic / OpenAI
4. 请求明细列表：模型 / Provider / Token 用量 / 占比进度条 / 花费 / 节省

**数据刷新：** 轮询 `/api/*` 接口，每 5 秒一次

**配色：** 严格按 PRD 品牌色规范（深色主题 `#13151a`，橙色 `#FF6B35`，绿色 `#27c93f`）

### 3.6 CLI（npx pintoken）

**两个命令：**

| 命令 | 行为 |
|------|------|
| `npx pintoken setup` | 首次：配置 + 启动。重复执行：幂等检测，已配置则直接启动 |
| `npx pintoken start` | 跳过配置，直接启动代理 |

**setup 配置步骤（首次）：**
1. 检测 shell 类型（zsh/bash/fish）
2. 写入 shell profile：`export ANTHROPIC_BASE_URL=http://localhost:7777/anthropic`、`OPENAI_BASE_URL=http://localhost:7777/openai`
3. 写入 Claude Code `~/.claude/settings.json`：`env.ANTHROPIC_BASE_URL`
4. 写入当前目录 `.env`（如果存在）
5. 启动代理（前台进程）
6. 自动打开浏览器 `http://localhost:7777`

**幂等检测：** 通过 marker 注释 `# Added by PinToken` 判断是否已配置

**代理运行方式：** 前台进程，终端显示启动 banner + 实时请求日志，Ctrl+C 停止

**终端输出格式：**
```
🪙 PinToken v0.1.0
   Proxy running on http://localhost:7777
   Dashboard: http://localhost:7777

[12:34:56] claude-sonnet-4-6  │ 1,234 in  567 out │ $0.0052 │ saved $0.026
[12:35:12] gpt-4o-mini        │   892 in  234 out │ $0.0003 │ saved $0.012
```

## 4. 项目结构

```
pintoken/
├── bin/
│   └── pintoken.mjs          # CLI 入口（npx 入口点）
├── src/
│   ├── proxy/
│   │   ├── server.mjs         # HTTP 服务器 + 路由分发
│   │   ├── anthropic.mjs      # Anthropic 代理 + SSE 解析
│   │   ├── openai.mjs         # OpenAI 代理 + SSE 解析
│   │   └── streaming.mjs      # SSE streaming 公共工具
│   ├── db/
│   │   ├── schema.sql         # SQLite schema（建表语句）
│   │   └── store.mjs          # 数据读写接口
│   ├── pricing/
│   │   └── calculator.mjs     # 费用计算引擎
│   ├── api/
│   │   └── routes.mjs         # /api/* 数据接口
│   └── setup/
│       ├── index.mjs          # setup 主流程编排
│       ├── shell.mjs          # shell 检测 + profile 写入
│       ├── claude.mjs         # Claude Code settings.json 写入
│       └── browser.mjs        # 自动打开浏览器
├── dashboard/
│   ├── index.html             # Dashboard 主页面
│   ├── style.css              # 样式（PRD 品牌色规范）
│   └── app.js                 # 前端逻辑（轮询 + 渲染）
├── data/
│   └── pricing.json           # 自维护定价数据
├── package.json
├── LICENSE                    # MIT
└── README.md
```

## 5. 依赖（最小化）

```json
{
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "nanoid": "^5.0.0"
  }
}
```

- **better-sqlite3**: SQLite 同步驱动，性能好，无需 async
- **nanoid**: 生成请求 ID
- **其他全部用 Node.js 内置模块**（http、fs、path、url、crypto）

## 6. 设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| M1 范围 | 全做 / 最小切片 | 全做 | 5 个模块互相依赖，拆开增加返工 |
| Dashboard 部署 | 同端口 / 分端口 / 独立文件 | 同端口 | PRD 一致，用户体验最简单 |
| 定价数据源 | TokenCost / 自维护 / 混合 | 纯自维护 | TokenCost 是 Python 包，npm 无成熟替代 |
| Streaming 拦截 | 旁路解析 / 缓冲全部 / 不支持 | 旁路解析 | 零延迟，标准做法 |
| CLI setup 行为 | 仅配置 / 配置+启动 / 智能判断 | 智能判断 | 首次配置+启动，后续跳过配置直接启动 |
| 代理运行方式 | 前台 / 后台守护 / 可选 | 前台 | 终端展示是产品体验的一部分 |
| 节省计算基准 | 同 provider 最贵 / 全局 GPT-4o | 同 provider 最贵 | 更精确，Anthropic 按 Opus，OpenAI 按 GPT-4o |
| HTTP 代理实现 | http-proxy 包 / 原生 http | 原生 http | 减少依赖，代理逻辑不复杂 |

## 7. 不在 M1 范围内

- 终端状态面板（两栏 TUI）→ M2
- 高峰时段提醒 → M2
- 分享卡片生成 → M2
- 8 provider 全接入（M1 只做 Anthropic + OpenAI）→ M2
- Analytics / Providers / Settings Tab → M2
- Electron 桌面 App → M3
- 云端同步 → M3
- 探测服务 → M3
- 后台守护进程 / --daemon → M2/M3
