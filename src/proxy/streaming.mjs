/**
 * SSE streaming 解析器
 * 支持 Anthropic 和 OpenAI 两种格式的流式/非流式响应解析
 */

/**
 * 解析单个 SSE 事件块，返回 { event, data } 或 null
 * @param {string} block - 单个事件块文本（\n\n 分隔的一段）
 */
function parseSSEBlock(block) {
  const lines = block.split('\n');
  let event = null;
  let dataStr = null;

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      event = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataStr = line.slice(6).trim();
    }
  }

  if (!dataStr) return null;

  try {
    const data = JSON.parse(dataStr);
    return { event, data };
  } catch {
    // JSON 解析失败则跳过
    return null;
  }
}

/**
 * 解析 Anthropic SSE 流式响应，提取用量信息
 * Anthropic SSE 格式：每个事件以 \n\n 分隔，包含 event: type 和 data: {json}
 * - message_start: 包含 model 和 input token 信息
 * - message_delta: 包含 output_tokens
 * @param {string} rawSSE - 完整的 SSE 文本
 * @returns {{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens } | null}
 */
export function parseAnthropicSSE(rawSSE) {
  const blocks = rawSSE.split('\n\n').filter(b => b.trim().length > 0);

  let model = null;
  let input_tokens = 0;
  let output_tokens = 0;
  let cache_read_tokens = 0;
  let cache_write_tokens = 0;
  let hasMessageStart = false;

  for (const block of blocks) {
    const parsed = parseSSEBlock(block);
    if (!parsed) continue;

    const { event, data } = parsed;

    // message_start 包含模型名称和输入 token 信息
    if (event === 'message_start' && data.message) {
      hasMessageStart = true;
      model = data.message.model ?? null;
      const usage = data.message.usage ?? {};
      input_tokens = usage.input_tokens ?? 0;
      cache_read_tokens = usage.cache_read_input_tokens ?? 0;
      cache_write_tokens = usage.cache_creation_input_tokens ?? 0;
    }

    // message_delta 包含输出 token 信息
    if (event === 'message_delta' && data.usage) {
      output_tokens = data.usage.output_tokens ?? 0;
    }
  }

  if (!hasMessageStart || model === null) return null;

  return { model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens };
}

/**
 * 解析 OpenAI SSE 流式响应，提取用量信息
 * OpenAI SSE 格式：每行 data: {json}，以 data: [DONE] 结尾
 * - usage 通常出现在 [DONE] 前的最后一个数据块
 * @param {string} rawSSE - 完整的 SSE 文本
 * @returns {{ model, input_tokens, output_tokens, cache_read_tokens: 0, cache_write_tokens: 0 } | null}
 */
export function parseOpenAISSE(rawSSE) {
  const lines = rawSSE.split('\n').filter(l => l.startsWith('data: '));

  let model = null;
  let usageFound = null;

  for (const line of lines) {
    const dataStr = line.slice(6).trim();
    if (dataStr === '[DONE]') continue;

    try {
      const data = JSON.parse(dataStr);
      // 记录最后一次出现的 model 和 usage
      if (data.model) model = data.model;
      if (data.usage) usageFound = data.usage;
    } catch {
      // JSON 解析失败则跳过
    }
  }

  if (!usageFound) return null;

  return {
    model: model ?? null,
    input_tokens: usageFound.prompt_tokens ?? 0,
    output_tokens: usageFound.completion_tokens ?? 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };
}

/**
 * 解析非流式 Anthropic JSON 响应体，提取用量信息
 * @param {object} body - 已解析的响应 JSON 对象
 * @returns {{ model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens } | null}
 */
export function parseAnthropicResponse(body) {
  if (!body || !body.usage) return null;

  const { model, usage } = body;
  if (!model || !usage.input_tokens == null || usage.output_tokens == null) {
    // 宽松检查：只要有 usage 对象就继续
  }

  return {
    model: model ?? null,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * 解析非流式 OpenAI JSON 响应体，提取用量信息
 * @param {object} body - 已解析的响应 JSON 对象
 * @returns {{ model, input_tokens, output_tokens, cache_read_tokens: 0, cache_write_tokens: 0 } | null}
 */
export function parseOpenAIResponse(body) {
  if (!body || !body.usage) return null;

  const { model, usage } = body;

  return {
    model: model ?? null,
    input_tokens: usage.prompt_tokens ?? 0,
    output_tokens: usage.completion_tokens ?? 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  };
}
