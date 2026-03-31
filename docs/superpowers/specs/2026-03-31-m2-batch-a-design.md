# M2 Batch A 设计：Provider 扩展 + 终端面板 + 高峰通知

## 1. Provider 扩展（6 个 OpenAI 兼容 Provider）

### 方案
将 `handleOpenAI` 参数化为通用 handler，通过路由前缀映射不同 base_url。不需要为每个 provider 新建代理文件。

### 路由映射表
| 路由前缀 | Provider | Base URL | 备注 |
|----------|----------|----------|------|
| `/xai/*` | xAI (Grok) | `https://api.x.ai/v1` | OpenAI 兼容 |
| `/gemini/*` | Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | OpenAI 兼容层 |
| `/moonshot/*` | Moonshot (Kimi) | `https://api.moonshot.cn/v1` | OpenAI 兼容 |
| `/qwen/*` | Qwen (通义) | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI 兼容 |
| `/glm/*` | GLM (智谱) | `https://open.bigmodel.cn/api/paas/v4` | OpenAI 兼容 |
| `/deepseek/*` | Deepseek | `https://api.deepseek.com/v1` | OpenAI 兼容 |

### 改动文件
1. **src/proxy/openai.mjs** — `handleOpenAI(req, res, store, baseUrl, providerName)` 加参数
2. **src/proxy/server.mjs** — 路由表扩展，循环匹配前缀
3. **data/pricing.json** — 补全 6 个 provider 的模型定价
4. **dashboard/index.html** — filter-bar 加新 provider 按钮

### 定价数据（每 provider 取主力模型）
需要查各家官网获取最新定价，写入 pricing.json。格式沿用现有：
```json
{
  "provider/model": {
    "input_per_1m": X,
    "output_per_1m": X,
    "cache_read_per_1m": X,
    "cache_write_per_1m": X
  }
}
```

---

## 2. 终端状态面板 `pintoken status`

### 方案
新增 `src/cli/status.mjs`，纯 ANSI 转义输出，读 SQLite 数据，< 50ms。

### 布局（PRD 4.3）
```
┌── PinToken v0.1.0 ────────────────────────────────┐
├───────────────────────────────────────────────────┤
│  [像素图钉]  PinToken                              │
│              Pin your token. Save your dollar.     │
├─────────────────────┬─────────────────────────────┤
│  Usage              │  Tips                        │
│  今日花费  $X.XX    │  · [动态提示1]               │
│  累计节省  $X.XX    │  · [动态提示2]               │
│  当前状态  ● 正常   │  · [动态提示3]               │
└─────────────────────┴─────────────────────────────┘
```

### Tips 优先级规则
1. 高峰提醒（最高优先级）
2. 模型降级建议（如果最近 Opus 用量 > 80%）
3. 用量排名（"你的用量超过了 X% 的开发者" — 预留，M2 硬编码占位）
4. 月度趋势（"本月花费比上月少/多 X%"）

### 改动文件
1. **新增 src/cli/status.mjs** — 渲染逻辑
2. **bin/pintoken.mjs** — 加 `status` 子命令分支
3. **src/db/store.mjs** — 新增 `getStatusData()` 聚合查询

---

## 3. 高峰系统通知（macOS）

### 方案
用 `osascript -e 'display notification ...'` 推送原生通知，零依赖。服务启动后每 5 分钟检查一次高峰状态变化，状态变更时推送通知。

### 通知触发规则
- 从 normal → warning 时通知："30 分钟内进入 Anthropic 高峰时段"
- 从 normal/warning → peak 时通知："当前处于 Anthropic 限速高峰"
- peak → normal 时通知："高峰时段已结束，恢复正常"
- 同一状态不重复通知

### 改动文件
1. **新增 src/notify/peak.mjs** — 通知逻辑 + osascript 调用
2. **src/proxy/server.mjs** — 启动时挂载定时器
3. **src/api/routes.mjs** — 复用 `getPeakStatus()` 导出

---

## 依赖关系
三个任务完全独立，可并行实现。
