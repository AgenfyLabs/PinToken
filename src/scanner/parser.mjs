/**
 * JSONL 行解析器
 * 解析 Claude Code 日志中的 assistant 消息，提取 token 用量信息
 */

/**
 * 根据模型名称推断 provider
 * @param {string} model - 模型名称
 * @returns {'anthropic' | 'openai' | 'unknown'}
 */
export function inferProvider(model) {
  if (!model) return 'unknown';
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3')) return 'openai';
  return 'unknown';
}

/**
 * 解析单行 JSONL，提取 assistant 消息的 token 用量
 * @param {string | null} line - 原始 JSONL 行
 * @returns {object | null} 标准化的用量对象，或 null（跳过该行）
 */
export function parseAssistantMessage(line) {
  // 空输入直接跳过
  if (!line) return null;

  // 解析 JSON，失败则跳过
  let data;
  try {
    data = JSON.parse(line);
  } catch {
    return null;
  }

  // 只处理 assistant 类型
  if (data.type !== 'assistant') return null;

  const msg = data.message || {};
  const usage = msg.usage;

  // 必须有 usage 字段
  if (!usage) return null;

  return {
    id: msg.id || null,
    model: msg.model || 'unknown',
    provider: inferProvider(msg.model),
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    cache_read_tokens: usage.cache_read_input_tokens || 0,
    cache_write_tokens: usage.cache_creation_input_tokens || 0,
    timestamp: data.timestamp || new Date().toISOString(),
    source: 'log',
  };
}
