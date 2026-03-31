# PinToken JSONL Scanner 设计文档

> 日期：2026-03-31
> 状态：已通过 brainstorming 审核
> 范围：为 Claude Code Max 订阅用户提供 token 用量追踪

---

## 1. 背景

PinToken M1 的代理模式要求用户有 API Key，请求经过 `localhost:7777` 代理转发。但大量 Claude Code 用户使用 Max 订阅（OAuth 认证），请求不经过标准 API endpoint，代理模式无法拦截。

调研发现 Claude Code 在本地存储了完整的对话日志（`~/.claude/projects/**/*.jsonl`），每条 assistant 消息包含 model 名和完整 token usage 数据。直接解析这些日志即可获取用量数据，无需代理拦截。

## 2. 目标

1. Max 订阅用户装好 PinToken 就能看到 token 用量和费用数据（零配置）
2. 提供「如果按 API 付费，本月花费约 $XX」的对比，帮用户判断 Max vs API 哪个更划算
3. 与现有代理模式并存，数据汇入同一个 SQLite + Dashboard

## 3. 架构

```
~/.claude/projects/**/*.jsonl   ← Claude Code 自动写入
        │
        │  每 30 秒轮询增量读取
        ▼
┌─────────────────────────────────┐
│      JSONL Scanner              │
│  - 扫描所有 project 目录        │
│  - 记录每文件已读 offset        │
│  - 解析 type:"assistant" 消息   │
│  - 提取 model + usage          │
│  - 调用费用计算引擎             │
│  - 去重（用 message.id）        │
│  - 写入 SQLite                 │
└──────────────┬──────────────────┘
               │
               ▼
        现有 SQLite + API + Dashboard（不改）
```

### 数据流

1. Claude Code 用户正常使用（聊天、调用工具），Claude Code 自动把每轮对话写入 `~/.claude/projects/-Users-{user}-{project}/{session-id}.jsonl`
2. PinToken Scanner 每 30 秒扫描这些文件的增量内容
3. 找到 `type: "assistant"` 且包含 `message.usage` 的行
4. 提取 model + tokens → 调用现有费用计算引擎 → 写入 SQLite
5. Dashboard 通过现有 API 展示数据（无需修改）

## 4. JSONL 数据格式

Claude Code 写入的 assistant 消息格式：

```json
{
  "type": "assistant",
  "message": {
    "id": "msg_01XYZ...",
    "model": "claude-sonnet-4-6",
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 40686,
      "cache_read_input_tokens": 0
    }
  },
  "timestamp": "2026-03-31T12:34:56.789Z"
}
```

### 字段映射

| JSONL 字段 | SQLite requests 表字段 |
|------------|----------------------|
| `message.id` | `id`（去重键） |
| `message.model` | `model` |
| 从 model 推断 | `provider`（`claude-*` → `anthropic`） |
| `message.usage.input_tokens` | `input_tokens` |
| `message.usage.output_tokens` | `output_tokens` |
| `message.usage.cache_read_input_tokens` | `cache_read_tokens` |
| `message.usage.cache_creation_input_tokens` | `cache_write_tokens` |
| 费用计算引擎 | `cost_usd`, `baseline_cost_usd`, `saved_usd` |
| 无（日志无延迟数据） | `latency_ms`（设为 0） |
| 无 | `status_code`（设为 200） |
| 固定值 `'log'` | `source`（新增字段） |

## 5. SQLite 变更

### requests 表新增列

```sql
ALTER TABLE requests ADD COLUMN source TEXT DEFAULT 'proxy';
```

值：`'proxy'`（代理模式）或 `'log'`（日志解析模式）

### 新增 scanner_offsets 表

```sql
CREATE TABLE IF NOT EXISTS scanner_offsets (
  file_path TEXT PRIMARY KEY,
  last_offset INTEGER DEFAULT 0,
  last_modified TEXT
);
```

追踪每个 JSONL 文件已读到的字节偏移量，避免重复解析。

## 6. 模块设计

### 6.1 Scanner 核心（`src/scanner/index.mjs`）

**职责：** 定时扫描 JSONL 文件，提取 usage 数据，写入 SQLite

**导出：**
- `startScanner(store, options)` — 启动 30 秒间隔的轮询扫描
- `stopScanner()` — 停止扫描
- `scanOnce(store)` — 执行一次完整扫描（用于测试和首次启动）

**扫描逻辑：**
1. 递归列出 `~/.claude/projects/` 下所有 `*.jsonl` 文件
2. 对每个文件，查 `scanner_offsets` 表获取 `last_offset`
3. 从 `last_offset` 开始读取新增内容
4. 逐行解析 JSON，过滤 `type === "assistant"` 且有 `message.usage`
5. 用 `message.id` 查 `requests` 表去重
6. 调用 `calculateCost()` 计算费用
7. `store.insertRequest(record)` 写入
8. 更新 `scanner_offsets` 表的 offset

### 6.2 JSONL Parser（`src/scanner/parser.mjs`）

**职责：** 解析 JSONL 行，提取标准化的 usage 记录

**导出：**
- `parseAssistantMessage(line)` — 解析一行 JSON，返回标准化记录或 null
- `inferProvider(model)` — 从 model 名推断 provider（`claude-*` → `anthropic`）

### 6.3 Store 扩展

在现有 `src/db/store.mjs` 中新增：
- `getOffset(filePath)` — 查询文件 offset
- `setOffset(filePath, offset, lastModified)` — 更新文件 offset
- `hasRequest(id)` — 检查请求 ID 是否已存在（去重）

## 7. 自动检测与 setup 集成

`pintoken setup` 时的检测逻辑：

```
1. 检查 ~/.claude/projects/ 是否存在
2. 是否有 *.jsonl 文件
3. 如有 → 提示用户：
   "检测到 Claude Code 对话日志，已启用日志追踪模式。
    即使没有 API Key，也能追踪你的 token 用量。"
4. 代理模式仍然配置（两者不冲突）
```

## 8. 费用对比展示

Dashboard Summary 区域新增一个小模块：

```
订阅对比
如果按 API 付费，本月花费约 $23.47
Claude Code Max 月费 $100
（API 模式更划算 / Max 更划算）
```

数据来源：累加本月所有 `source='log'` 记录的 `cost_usd`，与 Max 月费对比。

Max 月费硬编码：$100（Pro）/ $200（Max），默认 $200。可在 Settings 中修改。

## 9. 不在本次范围内

- OpenTelemetry 接收器（M2/M3 高级功能）
- Cursor / 其他 IDE 的日志解析
- 实时 fs.watch 文件监听
- 历史数据回溯（首次启动时导入全部历史）→ 首次启动时做一次全量扫描
- Dashboard UI 大改（仅新增订阅对比模块）

## 10. 设计决策记录

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| 数据源 | Hooks / JSONL / OTel | JSONL | 零配置，数据已在本地，包含完整 usage |
| 模式关系 | 替代代理 / 补充代理 / 砍掉代理 | 补充代理 | 服务不同用户群，代理已实现 |
| 读取时机 | 全量+watch / 仅启动 / 定时轮询 | 30s 轮询 | fs.watch 不稳定，轮询足够实时 |
| 去重策略 | message.id | message.id | Claude Code 每条消息有唯一 ID |
