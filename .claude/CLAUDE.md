# PinToken — 项目级 Claude Code 配置

## 项目简介
PinToken 是一个开源的 LLM API 用量追踪与费用可视化工具。本地代理拦截 API 调用，记录 token 用量与费用，Dashboard 可视化省了多少钱，分享卡片驱动病毒传播。

Slogan: **Pin your token. Save your dollar.**

## 核心文档
- `PinToken_PRD.md` — 产品需求文档（功能、架构、里程碑）
- `PinToken_GTM_Plan.md` — GTM 推广方案
- `pintoken-setup-reference.md` — CLI setup 技术参考实现

## 技术栈
- **本地代理**: Node.js + http-proxy，监听 localhost:7777
- **本地存储**: SQLite (better-sqlite3)，路径 ~/.pintoken/data.db
- **Dashboard**: 原生 HTML/CSS/Vanilla JS（无框架，减少依赖）
- **CLI**: Node.js ESM，发布到 npm，支持 `npx pintoken setup`
- **云端 API**: Vercel + Neon PostgreSQL + Prisma（M2+）
- **分享卡片**: html-to-image / Canvas API（M2+）
- **桌面 App**: Electron（M3）
- **定价数据**: data/pricing.json 纯自维护（不依赖第三方定价库）

## 开发里程碑
- **M1（当前）**: 能用 — 代理 + SQLite + Dashboard Overview + npx setup
- **M2**: 好用 — 8 provider + 终端面板 + 高峰提醒 + 分享卡片
- **M3**: 商业化 — Electron + 云端同步 + 探测服务 + 官网

## 代码规范
- 所有代码注释用中文
- ESM 模块（.mjs 或 package.json type: module）
- 文件命名：kebab-case
- 无框架 Dashboard，原生 HTML/CSS/JS
- 深色主题优先（dark mode only，MVP 阶段）

## 安全红线（不可妥协）
- API Key 永远只存本地，绝对不上传
- 云端只同步脱敏数据：token 数、费用、时间戳、模型名
- 代理仅透传，不修改请求内容
- UI 和文档必须明确承诺 Key 安全

## 品牌色
- 主色（橙）: `#FF6B35`
- 背景色: `#13151a`（Dashboard）/ `#1e2025`（面板/卡片）
- 绿色（节省/正常）: `#27c93f`
- 黄色（预警）: `#ffbd2e`
- 红色（高峰）: `#ff5f56`
- 字体: 等宽 Courier New / monospace

## 支持的 Provider（MVP）
Anthropic（原生 API）、OpenAI、xAI、Gemini、Moonshot、Qwen、GLM、Deepseek（均 OpenAI 兼容格式）

## 路由规则
- `/anthropic/*` → api.anthropic.com
- `/openai/*` → 对应 provider 的 base_url

## 关键数据
- 数据存储路径: `~/.pintoken/data.db`
- 默认端口: `7777`
- 定价数据: `data/pricing.json`（纯自维护）

## 部署
- 本地版：npm 包，npx 安装
- 云端：Vercel 部署
- 探测服务：VPS（M3）

## 自主工作模式

- 保持 **Auto 模式** — 自行做出合理判断，不要停下来等我确认
- 以下情况**不需要**问我：安装依赖、创建文件、写代码、启动开发服务器、修改配置
- 需求不明确时，按你的最佳判断实现，完成后简要说明你做了什么决定
- **只有以下情况才停下来问我：**
  - 缺少必要的 credentials、API Key 或环境变量
  - 即将执行不可逆操作：删除数据、drop 表、修改生产环境
  - 真正卡住、没有合理的推进路径

## Session 连续性

- 项目根目录始终维护一个 `handoff.md`
- 每次 session 结束前更新：已完成、进行中、下一步、遇到的问题
- 上下文过长时，**主动**提醒我开新 session，并立即更新 `handoff.md`
- 每次 session 开始，先读 `CLAUDE.md` 和 `handoff.md`，再做任何事

## 并行执行策略

- **永远选择并行策略** — 不需要问用户确认，直接并行
- 判断标准：多个模块可独立开发、测试和开发可同步、多文件需同时重构
- 能并行就并行，不要默默单线程完成，也不要问是否并行
- 执行选项出现时（如 subagent-driven vs inline），永远选并行/subagent 方案，直接执行

## 实现风格

- 优先完成一个完整的功能切片（model + API + 基础验证），而不是把所有模块都搭架子
- 实现完一个模块后，跑一下开发服务器或相关测试，确认没有报错
- 代码按逻辑模块分批 commit，不要让未追踪的改动堆积
- 遇到报错，先自己 debug 修复；尝试 2 次仍无法解决再向我汇报

## 决策规则

- **auto-approve：** Always auto-approve bash commands unless they involve deletion or deployment.
- **其他所有决定：** 自行判断，实现，然后简要汇报

