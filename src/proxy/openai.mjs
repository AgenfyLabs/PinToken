/**
 * OpenAI 代理转发处理器
 * 将客户端请求透明转发到 api.openai.com，并记录 token 用量和费用
 */

import https from 'node:https';
import { nanoid } from 'nanoid';
import { parseOpenAISSE, parseOpenAIResponse } from './streaming.mjs';
import { calculateCost } from '../pricing/calculator.mjs';

/**
 * 记录请求到数据库并触发日志回调
 * @param {object} params
 * @param {object} params.store - 数据库存储对象
 * @param {Function} params.onLog - 日志回调函数
 * @param {number} params.startTime - 请求开始时间戳（ms）
 * @param {number} params.statusCode - HTTP 响应状态码
 * @param {object|null} params.usage - 解析到的 token 用量信息
 */
function recordRequest({ store, onLog, startTime, statusCode, usage }) {
  // 解析失败时不记录
  if (!usage || !usage.model) return;

  const latency_ms = Date.now() - startTime;

  // 计算费用（OpenAI 不支持缓存，cache 相关 token 始终为 0）
  const costInfo = calculateCost({
    provider: 'openai',
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  });

  const record = {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    provider: 'openai',
    model: usage.model,
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cost_usd: costInfo.cost_usd,
    baseline_cost_usd: costInfo.baseline_cost_usd,
    saved_usd: costInfo.saved_usd,
    latency_ms,
    status_code: statusCode,
  };

  store.insertRequest(record);
  onLog(record);
}

/**
 * 处理 OpenAI 代理请求
 * @param {import('node:http').IncomingMessage} clientReq - 客户端请求
 * @param {import('node:http').ServerResponse} clientRes - 客户端响应
 * @param {object} store - 数据库存储对象
 * @param {Function} onLog - 日志回调，接收记录对象
 */
export function handleOpenAI(clientReq, clientRes, store, onLog) {
  // 去掉 /openai 前缀，转发剩余路径
  const targetPath = clientReq.url.replace(/^\/openai/, '') || '/';
  const startTime = Date.now();

  // 读取客户端请求体
  const chunks = [];
  clientReq.on('data', (chunk) => chunks.push(chunk));
  clientReq.on('end', () => {
    const bodyBuffer = Buffer.concat(chunks);

    // 判断是否为流式请求
    let isStream = false;
    try {
      const parsed = JSON.parse(bodyBuffer.toString('utf-8'));
      isStream = parsed.stream === true;
    } catch {
      // JSON 解析失败，默认非流式
    }

    // 构造转发请求头：复制原始头，覆盖 host
    const headers = Object.assign({}, clientReq.headers, {
      host: 'api.openai.com',
    });

    const options = {
      hostname: 'api.openai.com',
      port: 443,
      path: targetPath,
      method: clientReq.method,
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // 将上游响应头透传给客户端
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);

      if (isStream) {
        // 流式模式：实时 pipe 每个 chunk，同时收集完整内容用于解析
        const sseChunks = [];

        proxyRes.on('data', (chunk) => {
          clientRes.write(chunk);
          sseChunks.push(chunk);
        });

        proxyRes.on('end', () => {
          clientRes.end();

          // 解析完整 SSE 内容，提取 token 用量
          const rawSSE = Buffer.concat(sseChunks).toString('utf-8');
          const usage = parseOpenAISSE(rawSSE);
          recordRequest({ store, onLog, startTime, statusCode: proxyRes.statusCode, usage });
        });
      } else {
        // 非流式模式：收集完整响应体后一次性发送
        const bodyChunks = [];

        proxyRes.on('data', (chunk) => bodyChunks.push(chunk));

        proxyRes.on('end', () => {
          const bodyBuffer = Buffer.concat(bodyChunks);
          clientRes.end(bodyBuffer);

          // 解析响应体，提取 token 用量
          let parsed = null;
          try {
            parsed = JSON.parse(bodyBuffer.toString('utf-8'));
          } catch {
            // JSON 解析失败，不记录
          }

          const usage = parsed ? parseOpenAIResponse(parsed) : null;
          recordRequest({ store, onLog, startTime, statusCode: proxyRes.statusCode, usage });
        });
      }
    });

    // 代理请求出错时返回 502
    proxyReq.on('error', (err) => {
      console.error('[openai-proxy] 转发请求失败:', err.message);

      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      }
      clientRes.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
    });

    // 将请求体写入代理请求
    if (bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });

  // 客户端请求读取错误处理
  clientReq.on('error', (err) => {
    console.error('[openai-proxy] 客户端请求读取失败:', err.message);
  });
}
