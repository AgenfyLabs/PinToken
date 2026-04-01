/**
 * 健康检查端点
 * GET /health 返回代理状态和上游连通性
 */
import https from 'node:https';

// 缓存上游检测结果（避免频繁检测）
let cachedResult = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 秒缓存

/**
 * 检测单个上游是否可达（HEAD 请求，3s 超时）
 */
function checkUpstream(hostname) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, port: 443, path: '/', method: 'HEAD', timeout: 3000 },
      (res) => { res.resume(); resolve(true); }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/**
 * 处理 GET /health 请求
 */
export async function handleHealth(req, res, startedAt) {
  const now = Date.now();

  // 使用缓存（30s 内不重复检测）
  if (cachedResult && (now - cacheTime) < CACHE_TTL) {
    const status = cachedResult.upstream.anthropic && cachedResult.upstream.openai ? 200 : 503;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cachedResult));
    return;
  }

  // 并行检测上游
  const [anthropic, openai] = await Promise.all([
    checkUpstream('api.anthropic.com'),
    checkUpstream('api.openai.com'),
  ]);

  const result = {
    status: anthropic && openai ? 'ok' : 'degraded',
    uptime_seconds: Math.floor((now - (startedAt || now)) / 1000),
    upstream: { anthropic, openai },
    timestamp: new Date().toISOString(),
  };

  // 更新缓存
  cachedResult = result;
  cacheTime = now;

  const statusCode = anthropic && openai ? 200 : 503;
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}
