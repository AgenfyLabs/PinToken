/**
 * 数据合并去重层
 * 当 Log Observer 和 Proxy 同时运行时，避免同一请求被记录两次
 * 去重策略：hash(provider + model + timestamp_rounded_to_1s + input_tokens + output_tokens)
 * Proxy 数据优先（更精确）
 */
import { createHash } from 'node:crypto';

/**
 * 生成请求的去重 hash
 * @param {object} record - 请求记录
 * @returns {string} 16 字符的 hex hash
 */
export function computeDedupeHash({ provider, model, timestamp, input_tokens, output_tokens }) {
  // 时间戳精确到秒（去掉毫秒和时区后缀）
  const ts = timestamp ? timestamp.slice(0, 19) : '';
  const raw = `${provider || ''}|${model || ''}|${ts}|${input_tokens || 0}|${output_tokens || 0}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * 检查是否应该插入该记录（去重逻辑）
 * @param {object} store - 数据存储
 * @param {object} record - 待插入记录
 * @returns {{ shouldInsert: boolean, reason: string }}
 */
export function shouldInsertRecord(store, record) {
  // 先用 id 去重
  if (store.hasRequest(record.id)) {
    return { shouldInsert: false, reason: 'duplicate_id' };
  }

  // Proxy 数据直接插入（优先级最高）
  if (record.source === 'proxy') {
    return { shouldInsert: true, reason: 'proxy_priority' };
  }

  // Log Observer 数据，检查是否已有同一请求的 Proxy 数据
  const hash = computeDedupeHash(record);
  const existing = store.findByDedupeHash?.(hash);

  if (existing && existing.source === 'proxy') {
    return { shouldInsert: false, reason: 'proxy_exists' };
  }

  return { shouldInsert: true, reason: 'new_record' };
}
