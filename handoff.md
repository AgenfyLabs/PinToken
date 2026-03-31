## 状态：已完成（M1 + Scanner）

## 最后完成
- M1 全部 11 个 Task 实现完毕，23 个单元测试通过
- JSONL Scanner 功能完成（4 个 Task），支持 Claude Code Max 订阅用户
- 真实数据验证通过：今日 283 条请求，31.7M tokens，$66.16 API 等值
- Dashboard 字段名 bug 已修复（camelCase → snake_case）

## 已完成的模块

### M1 核心
1. 项目脚手架（package.json, pricing.json, LICENSE）
2. SQLite 存储层（src/db/store.mjs）— 含 scanner offset 扩展
3. 费用计算引擎（src/pricing/calculator.mjs）
4. SSE streaming 解析器（src/proxy/streaming.mjs）
5. Anthropic 代理转发（src/proxy/anthropic.mjs）
6. OpenAI 代理转发（src/proxy/openai.mjs）
7. Dashboard 数据 API（src/api/routes.mjs）
8. HTTP 服务器 + 路由（src/proxy/server.mjs）— 含 scanner 集成
9. Dashboard UI（dashboard/index.html + style.css + app.js）
10. CLI setup/start（bin/pintoken.mjs + src/setup/）— 含日志检测

### Scanner 扩展
11. JSONL 行解析器（src/scanner/parser.mjs）
12. 日志扫描器（src/scanner/index.mjs）
13. Store 扩展：scanner_offsets 表 + hasRequest + source 列

## 下一步（按优先级）
1. **Dashboard 订阅对比模块** — 显示「如果按 API 付费，本月花费约 $XX」vs Max 月费
2. **费用计算异常** — 日志中 input_tokens 显示为 1-3（可能是 Claude Code 的 token 计数方式不同于标准 API），需要调研 JSONL 中 cache tokens 是否已包含在 input_tokens 中
3. **README.md** — 按 PRD 附录D 七段式结构编写
4. **M2 规划** — 8 provider 全接入 + 终端面板 + 高峰提醒 + 分享卡片

## 未解决问题
- JSONL 日志中 input_tokens 值很小（1-3），但 cache_creation_input_tokens 很大（数万）。费用计算可能需要调整：cache tokens 是否应该算入总 token 数？
- bin/pintoken.mjs 中 Dashboard URL 指向 `/dashboard` 而非 `/`，server.mjs 中 `/` 即为 Dashboard
- 尚未用真实 API Key 测试代理转发（用户是 Max 订阅）

## 最近修改的文件
- src/scanner/index.mjs, parser.mjs（新增）
- src/db/store.mjs（扩展 offset + source）
- src/proxy/server.mjs（集成 scanner）
- src/setup/index.mjs（集成日志检测）
- dashboard/app.js（修复字段名）
- test/store.test.mjs, parser.test.mjs（新增测试）

## 关键上下文
- 设计 spec: docs/superpowers/specs/2026-03-31-pintoken-m1-design.md
- Scanner spec: docs/superpowers/specs/2026-03-31-jsonl-scanner-design.md
- 实施计划: docs/superpowers/plans/2026-03-31-pintoken-m1.md
- Scanner 计划: docs/superpowers/plans/2026-03-31-jsonl-scanner.md
- PRD: PinToken_PRD.md
- 用户是 Max 订阅，无 API Key，Scanner 是主要数据源
