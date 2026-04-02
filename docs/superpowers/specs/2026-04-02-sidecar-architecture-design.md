# PinToken Sidecar 双模式架构设计 Spec

> 日期: 2026-04-02
> 状态: 已确认，待实现
> 前置依赖: 替代 PRD 第 4 节（安装形态）和第 5.1 节（本地代理）

---

## 1. 概述

PinToken 从"Proxy-only"架构升级为 **Sidecar 双模式**：

- **模式 A: Log Observer**（默认）— 零风险，读取已有日志文件，不碰 API 路径
- **模式 B: Local Proxy**（opt-in）— 精确数据，拦截 HTTP 请求，支持全部 8 家 Provider

两种模式可同时运行，数据合并层自动去重，Proxy 数据优先。

### 1.1 为什么需要这个变更

当前架构 Proxy 是 Single Point of Failure。PinToken 崩溃 = 用户所有 API 调用中断。
竞品（ccusage、claude-spend）全部选择日志解析，就是因为不愿碰 API 关键路径。
Sidecar 模式让 PinToken 默认零风险，同时保留 Proxy 的精确+多 Provider 优势。

---

## 2. 模式 A: Log Observer

### 2.1 支持的日志源（MVP）

| 日志源 | 路径 | 格式 |
|--------|------|------|
| Claude Code | `~/.claude/projects/**/*.jsonl` 或 `~/.config/claude/projects/**/*.jsonl` | JSONL |

Cursor 和其他 IDE 日志作为后续扩展，不在本次 scope 内。

### 2.2 JSONL 解析规则

每行 JSON 对象，提取以下字段：

```json
{
  "type": "assistant",
  "model": "claude-sonnet-4-20250514",
  "usage": {
    "input_tokens": 12345,
    "output_tokens": 678,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 5000
  },
  "timestamp": "2026-04-02T12:34:56Z"
}
```

过滤规则：
- 只处理 `type === "assistant"` 的行（跳过 user、system 等）
- 必须有 `usage` 字段且 `input_tokens + output_tokens > 0`
- 必须有 `model` 字段且不为 "unknown"
- 必须有 `timestamp` 字段

### 2.3 文件监听机制

使用 `fs.watch`（Node.js 原生，不引入 Chokidar 依赖）：

1. **启动时**: 扫描所有已有 JSONL 文件，增量解析（记录 byte offset 避免重复）
2. **运行时**: 监听文件变化事件（add/change），增量读取新增行
3. **解析后**: 写入 SQLite，标记 `source = 'log_observer'`、`is_estimated = true`

性能约束：
- 文件变化到数据入库 < 2 秒
- CPU 占用 < 1%（空闲时）
- 内存占用 < 50MB

### 2.4 费用估算

Log Observer 拿到的是 token 数，需要按模型定价计算费用：

```javascript
// 复用现有 data/pricing.json 中的定价数据
// 费用 = (token_count / 1_000_000) * price_per_1M
// 所有 Log Observer 数据标记 is_estimated = true
```

模型名匹配规则：
1. 精确匹配 pricing.json 中的 model ID
2. 若无精确匹配，尝试去除日期后缀匹配（如 `claude-sonnet-4-20250514` → `claude-sonnet-4`）
3. 若仍无匹配，记录数据但费用标记为 null，Dashboard 显示 "定价未知"

### 2.5 Offset 持久化

每个 JSONL 文件的读取位置（byte offset）持久化到 SQLite：

```sql
CREATE TABLE IF NOT EXISTS log_observer_state (
  file_path TEXT PRIMARY KEY,
  byte_offset INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT NOT NULL
);
```

启动时读取 offset，从上次位置继续解析，避免重复。

---

## 3. 模式 B: Local Proxy（现有 + 容错增强）

### 3.1 启用流程

```bash
pintoken proxy --enable    # 交互式引导，修改配置
pintoken proxy --disable   # 恢复原始配置
pintoken proxy --status    # 查看状态
```

`--enable` 交互流程：
1. 检测已安装的 LLM 工具（Claude Code、Shell 环境变量）
2. 列出即将执行的操作（修改哪些文件）
3. 用户确认后执行
4. 备份原始配置（用于 disable 恢复）

### 3.2 三层容错机制

#### 第一层：请求级 Bypass（< 200ms）

```javascript
async function proxyRequest(req, res) {
  const targetUrl = resolveTargetUrl(req);
  try {
    // PinToken 自身处理逻辑（非 LLM 响应等待）超过 200ms 直接放行
    const response = await Promise.race([
      forwardAndRecord(req, targetUrl),
      timeout(200)
    ]);
    return response;
  } catch (error) {
    // 内部错误 → 降级为纯管道，牺牲数据记录保 API 可用
    return directForward(req, targetUrl);
  }
}
```

关键点：200ms 超时是 PinToken 自身处理逻辑的超时，不是 LLM API 响应超时。

#### 第二层：进程退出自动恢复配置

```javascript
// 注册退出钩子：exit、SIGINT、SIGTERM、uncaughtException
// 退出时恢复 Claude Code settings.json 和 shell 环境变量
// SIGKILL/断电无法捕获 → 依赖启动时清理（见下）
```

启动时残留清理：
```javascript
// PinToken 启动时检查 settings.json
// 如果发现指向 localhost:7777 但 Proxy 模式未启用 → 自动清理
```

#### 第三层：健康检查 + 自动降级

```javascript
// 每 30 秒检查 /health
// 连续 3 次失败 → 尝试重启 Proxy
// 重启 3 次仍失败 → 自动降级到 Log Observer 模式
// 恢复所有配置文件，终端通知用户
```

#### Shell fallback 脚本

写入 `~/.zshrc`（替代简单 export）：

```bash
# PinToken Proxy with auto-fallback
if curl -s --max-time 0.5 http://localhost:7777/health > /dev/null 2>&1; then
  export ANTHROPIC_BASE_URL="http://localhost:7777/anthropic"
  export OPENAI_BASE_URL="http://localhost:7777/openai"
else
  unset ANTHROPIC_BASE_URL
  unset OPENAI_BASE_URL
fi
```

### 3.3 容错总结

| 保护层 | 触发条件 | 恢复时间 | 用户影响 |
|--------|---------|---------|---------|
| 第一层 | PinToken 内部处理超时/异常 | < 200ms | 零感知，请求正常转发，丢失一条数据 |
| 第二层 | PinToken 进程崩溃 | < 1s | 新终端零影响；已有终端等第一层兜底 |
| 第三层-重启 | 健康检查连续失败 | 30-90s | 短暂数据缺失 |
| 第三层-降级 | 重启 3 次仍失败 | < 2min | 自动切换 Log Observer，终端通知 |

### 3.4 /health 端点

```
GET http://localhost:7777/health

200: { "status": "ok", "mode": "proxy", "uptime_seconds": N }
503: { "status": "degraded", "reason": "..." }
```

---

## 4. 数据合并层

### 4.1 去重策略

请求唯一标识 = `hash(provider + model + timestamp_rounded_to_1s + input_tokens + output_tokens)`

当两路数据匹配到同一请求时：
- Proxy 数据优先（更精确）
- 标记 `source = 'proxy'`、`is_estimated = false`
- 丢弃 Log Observer 的重复记录

### 4.2 数据库 schema 变更

在现有 `requests` 表基础上新增两个字段：

```sql
ALTER TABLE requests ADD COLUMN source TEXT NOT NULL DEFAULT 'proxy';
-- 值: 'proxy' | 'log_observer'

ALTER TABLE requests ADD COLUMN is_estimated BOOLEAN NOT NULL DEFAULT FALSE;
-- log_observer 数据 = true, proxy 数据 = false
```

---

## 5. 安装流程变更

### 5.1 新的默认安装（替代 PRD 4.1）

```bash
npx pintoken setup
```

流程：
1. 检测系统环境（Node.js 版本）
2. 检测已安装的 LLM 工具（Claude Code、Cursor 等）
3. **启动 Log Observer**（开始读取日志文件）
4. 启动 Dashboard（打开浏览器 http://localhost:7777）
5. 打印成功提示

```
✅ PinToken 已安装

📊 追踪模式：Log Observer（默认，零风险）
   正在读取：~/.claude/projects/（检测到 23 个项目）

💡 想要精确数据 + 追踪 OpenAI / Deepseek 等更多 Provider？
   运行：pintoken proxy --enable

Dashboard：http://localhost:7777
```

关键变化：
- 不自动启动 Proxy
- 不自动修改任何配置文件
- 不自动修改 base_url
- 只启动 Log Observer + Dashboard

### 5.2 常驻管理命令

```bash
pintoken start     # 启动（Log Observer + Dashboard，如果之前启用了 Proxy 则同时启动）
pintoken stop      # 停止（如果 Proxy 在运行，先恢复配置再停止）
pintoken status    # 终端状态面板
```

---

## 6. Dashboard UI 变更

### 6.1 模式指示器

导航栏右侧显示当前模式：

- Log Observer 模式：`💡 Log Observer`
- Proxy 模式：`🔌 Proxy 模式`
- 两者同时：`🔌 Proxy 模式`（Proxy 优先显示）

### 6.2 数据精度标记

当数据来自 Log Observer 时，数值旁显示 `~` 符号：

```
今日花费    $0.23 ~
                 ↑ 鼠标悬浮："估算值（来自日志解析）"
```

Proxy 数据不显示标记（精确值）。

### 6.3 升级引导

Dashboard Settings 页面新增"数据采集模式"区域：

- 显示当前模式（Log Observer / Proxy）
- 显示各模式支持的 Provider 列表
- Proxy 模式的启用按钮（引导用户在终端运行 `pintoken proxy --enable`）

---

## 7. 文件结构变更

```
src/
├── log-observer/
│   ├── observer.mjs        # 文件监听 + JSONL 解析主逻辑
│   ├── claude-parser.mjs   # Claude Code JSONL 格式解析器
│   └── cost-estimator.mjs  # 基于 pricing.json 的费用估算
├── proxy/
│   ├── server.mjs          # 现有 Proxy 服务器（增加容错）
│   ├── health.mjs          # /health 端点
│   ├── bypass.mjs          # 请求级 bypass 逻辑
│   └── config-manager.mjs  # 配置文件修改/恢复/清理
├── data/
│   └── merger.mjs          # 数据合并去重层
└── bin/
    └── pintoken.mjs        # CLI 入口（新增 proxy 子命令）
```

---

## 8. 开发优先级

| 优先级 | 功能 | 估时 |
|--------|------|------|
| P0 | Log Observer（Claude Code JSONL 解析 + 文件监听） | 2-3 天 |
| P0 | 数据合并层 + SQLite schema 变更 | 1 天 |
| P0 | 安装流程重构（默认不启动 Proxy） | 1 天 |
| P0 | Dashboard 模式指示器 + 数据精度标记 | 0.5 天 |
| P1 | Proxy 容错第一层（请求级 bypass） | 1 天 |
| P1 | Proxy 容错第二层（进程退出恢复配置） | 1 天 |
| P1 | `pintoken proxy --enable/--disable` 命令 | 1 天 |
| P1 | Proxy 容错第三层（健康检查 + 自动降级） | 1 天 |
| P2 | Dashboard Settings 模式切换 UI | 0.5 天 |

建议发布顺序：
1. 先发布模式 A only 版本（Log Observer + Dashboard）
2. 下一版本加入 Proxy 模式 + 容错机制

---

## 9. 不做的事情（YAGNI）

- 不做 Cursor 日志解析（MVP 只支持 Claude Code）
- 不做云端同步（M3 范围）
- 不做自动检测新 Provider 日志格式
- 不做日志文件的写入或修改（只读）
- 不做 Proxy 模式的 GUI 开关（只通过 CLI 启用）

---

## 10. 与 PRD 现有章节的映射

| PRD 章节 | 变更说明 |
|---------|---------|
| 4.1 命令行工具 | 替换：默认安装不再启动 Proxy |
| 5.1 本地代理 | 重构：Proxy 从"唯一数据源"变为"可选增强层" |
| 5.2 本地仪表盘 | 增加：模式指示器、数据精度标记、模式切换 UI |
| 4.3 终端状态面板 | 不变：数据源从 Proxy only 扩展为 Log Observer 或 Proxy |
| 2. 安全与隐私 | 增强：模式 A 完全不接触 API 请求，隐私保证更强 |

---

*文档结束*
*版本 1.0 | 2026-04-02*
