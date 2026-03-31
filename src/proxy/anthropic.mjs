/**
 * Anthropic API 代理转发处理器
 * 负责将客户端请求转发到 api.anthropic.com，并记录 token 用量和费用
 */

import https from 'node:https';
import { nanoid } from 'nanoid';
import { parseAnthropicSSE, parseAnthropicResponse } from './streaming.mjs';
import { calculateCost } from '../pricing/calculator.mjs';

/**
 * 记录一次请求到 store 并触发日志回调
 * @param {object} params
 * @param {object} params.store - 数据存储实例
 * @param {Function} params.onLog - 日志回调函数
 * @param {string} params.provider - 服务商名称
 * @param {string} params.model - 模型名称
 * @param {number} params.input_tokens
 * @param {number} params.output_tokens
 * @param {number} params.cache_read_tokens
 * @param {number} params.cache_write_tokens
 * @param {number} params.latency_ms - 请求延迟（毫秒）
 * @param {number} params.status_code - HTTP 响应状态码
 */
function recordRequest({
  store,
  onLog,
  provider,
  model,
  input_tokens,
  output_tokens,
  cache_read_tokens,
  cache_write_tokens,
  latency_ms,
  status_code,
}) {
  // 计算费用信息
  const { cost_usd, baseline_cost_usd, saved_usd } = calculateCost({
    provider,
    model,
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_write_tokens,
  });

  // 构造完整记录对象
  const record = {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    provider,
    model,
    input_tokens,
    output_tokens,
    cache_read_tokens,
    cache_write_tokens,
    cost_usd,
    baseline_cost_usd,
    saved_usd,
    latency_ms,
    status_code,
  };

  // 写入数据库
  store.insertRequest(record);

  // 触发终端日志
  onLog(record);
}

/**
 * 处理代理请求到 Anthropic API
 * @param {import('http').IncomingMessage} clientReq - 客户端请求
 * @param {import('http').ServerResponse} clientRes - 客户端响应
 * @param {object} store - 数据存储实例
 * @param {Function} onLog - 日志回调，接收请求记录对象
 */
export function handleAnthropic(clientReq, clientRes, store, onLog) {
  // 记录请求开始时间，用于计算延迟
  const startTime = Date.now();

  // 去除 /anthropic 前缀，剩余路径转发给上游
  const upstreamPath = clientReq.url.replace(/^\/anthropic/, '') || '/';

  // 读取完整请求体
  const chunks = [];
  clientReq.on('data', (chunk) => chunks.push(chunk));
  clientReq.on('end', () => {
    const bodyBuffer = Buffer.concat(chunks);
    const bodyStr = bodyBuffer.toString('utf-8');

    // 判断是否为流式请求
    let isStream = false;
    try {
      const parsed = JSON.parse(bodyStr);
      isStream = parsed.stream === true;
    } catch {
      // JSON 解析失败时默认非流式
    }

    // 构造转发给 Anthropic 的请求头，覆盖 host
    const upstreamHeaders = { ...clientReq.headers };
    upstreamHeaders['host'] = 'api.anthropic.com';

    // 设置正确的 Content-Length（使用 Buffer 字节数）
    upstreamHeaders['content-length'] = Buffer.byteLength(bodyBuffer);

    // 构造 HTTPS 请求选项
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: upstreamPath,
      method: clientReq.method,
      headers: upstreamHeaders,
    };

    // 发起上游请求
    const proxyReq = https.request(options, (proxyRes) => {
      // 将上游响应头转发给客户端
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

      const statusCode = proxyRes.statusCode;

      if (isStream) {
        // 流式模式：实时转发每个数据块，同时收集全部内容用于后续解析
        const sseChunks = [];

        proxyRes.on('data', (chunk) => {
          // 实时发给客户端（零延迟）
          clientRes.write(chunk);
          // 同时收集用于解析
          sseChunks.push(chunk);
        });

        proxyRes.on('end', () => {
          clientRes.end();

          const latency_ms = Date.now() - startTime;
          const rawSSE = Buffer.concat(sseChunks).toString('utf-8');
          const usage = parseAnthropicSSE(rawSSE);

          if (usage && usage.model) {
            recordRequest({
              store,
              onLog,
              provider: 'anthropic',
              model: usage.model,
              input_tokens: usage.input_tokens,
              output_tokens: usage.output_tokens,
              cache_read_tokens: usage.cache_read_tokens,
              cache_write_tokens: usage.cache_write_tokens,
              latency_ms,
              status_code,
            });
          }
        });
      } else {
        // 非流式模式：收集完整响应体，解析后发给客户端
        const bodyChunks = [];

        proxyRes.on('data', (chunk) => bodyChunks.push(chunk));

        proxyRes.on('end', () => {
          const fullBody = Buffer.concat(bodyChunks);
          clientRes.end(fullBody);

          const latency_ms = Date.now() - startTime;

          // 尝试解析响应 JSON 并记录用量
          try {
            const parsed = JSON.parse(fullBody.toString('utf-8'));
            const usage = parseAnthropicResponse(parsed);

            if (usage && usage.model) {
              recordRequest({
                store,
                onLog,
                provider: 'anthropic',
                model: usage.model,
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                cache_read_tokens: usage.cache_read_tokens,
                cache_write_tokens: usage.cache_write_tokens,
                latency_ms,
                status_code,
              });
            }
          } catch {
            // JSON 解析失败时不记录（例如上游返回错误页）
          }
        });
      }
    });

    // 代理请求出错时返回 502
    proxyReq.on('error', (err) => {
      console.error('[anthropic proxy] 上游请求失败:', err.message);

      // 若响应头还未发送，返回 502
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      }
      clientRes.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
    });

    // 将请求体写入上游请求
    proxyReq.end(bodyBuffer);
  });

  // 客户端请求读取出错
  clientReq.on('error', (err) => {
    console.error('[anthropic proxy] 客户端请求读取失败:', err.message);
  });
}
