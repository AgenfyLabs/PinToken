// 费用计算引擎：根据 provider/model 和 token 用量计算 USD 费用
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

// 加载定价数据（相对于本文件的路径）
const __dirname = dirname(fileURLToPath(import.meta.url));
const pricingPath = join(__dirname, '../../data/pricing.json');
const pricing = JSON.parse(readFileSync(pricingPath, 'utf-8'));

// 基准模型：用于计算节省了多少费用（每个 provider 选最贵的模型作为基准）
const BASELINE_MODELS = {
  anthropic: 'anthropic/claude-opus-4-6',
  openai: 'openai/gpt-4o',
  xai: 'xai/grok-3',
  gemini: 'gemini/gemini-2.5-pro',
  moonshot: 'moonshot/moonshot-v1-128k',
  qwen: 'qwen/qwen-max',
  glm: 'glm/glm-4-plus',
  deepseek: 'deepseek/deepseek-reasoner',
};

/**
 * 获取指定 provider 的基准（最贵）模型 key
 * @param {string} provider
 * @returns {string|null}
 */
export function getBaselineModel(provider) {
  return BASELINE_MODELS[provider] ?? null;
}

/**
 * 计算单次调用的 USD 费用
 * @param {object} params
 * @param {string} params.provider - 服务商（anthropic / openai 等）
 * @param {string} params.model - 模型名称（可含斜杠前缀，也可不含）
 * @param {number} params.input_tokens - 输入 token 数
 * @param {number} params.output_tokens - 输出 token 数
 * @param {number} [params.cache_read_tokens=0] - 缓存读取 token 数
 * @param {number} [params.cache_write_tokens=0] - 缓存写入 token 数
 * @returns {{ cost_usd: number, baseline_cost_usd: number, saved_usd: number, unknown: boolean }}
 */
export function calculateCost({
  provider,
  model,
  input_tokens = 0,
  output_tokens = 0,
  cache_read_tokens = 0,
  cache_write_tokens = 0,
}) {
  // 构造完整的定价 key（若已含 / 则直接用，否则拼接 provider 前缀）
  const modelKey = model.includes('/') ? model : `${provider}/${model}`;

  // 模型不存在时返回 unknown
  if (!pricing[modelKey]) {
    return { cost_usd: 0, baseline_cost_usd: 0, saved_usd: 0, unknown: true };
  }

  // 计算指定模型的费用
  const cost_usd = computeCost(pricing[modelKey], {
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_write_tokens,
  });

  // 计算基准模型费用（不含缓存，仅用相同的 input/output token 数）
  const baselineKey = getBaselineModel(provider);
  let baseline_cost_usd = cost_usd; // 默认与自身相同（当前模型就是基准时）

  if (baselineKey && baselineKey !== modelKey && pricing[baselineKey]) {
    baseline_cost_usd = computeCost(pricing[baselineKey], {
      input_tokens,
      output_tokens,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
    });
  }

  // 节省金额不能为负
  const saved_usd = Math.max(0, baseline_cost_usd - cost_usd);

  return {
    cost_usd: round(cost_usd),
    baseline_cost_usd: round(baseline_cost_usd),
    saved_usd: round(saved_usd),
    unknown: false,
  };
}

/**
 * 根据定价配置和 token 数计算费用（内部辅助函数）
 */
function computeCost(priceConfig, { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens }) {
  const {
    input_per_1m = 0,
    output_per_1m = 0,
    cache_read_per_1m = 0,
    cache_write_per_1m = 0,
  } = priceConfig;

  return (
    (input_tokens / 1_000_000) * input_per_1m +
    (output_tokens / 1_000_000) * output_per_1m +
    (cache_read_tokens / 1_000_000) * cache_read_per_1m +
    (cache_write_tokens / 1_000_000) * cache_write_per_1m
  );
}

/**
 * 保留足够精度的小数（避免浮点误差）
 */
function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
