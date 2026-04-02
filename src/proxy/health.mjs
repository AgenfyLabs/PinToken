/**
 * 健康检查端点
 * GET /health 返回代理状态和上游连通性
 * 同时包含自我健康检查定时器（容错第三层）
 */
import http from 'node:http';
import https from 'node:https';

// 缓存上游检测结果（避免频繁检测）
let cachedResult = null;
let cacheTime = 0;
const CACHE_TTL = 30_000; // 30 秒缓存

// 自监控定时器相关状态
let healthCheckTimer = null;
let failureCount = 0;
const MAX_FAILURES = 3;
const CHECK_INTERVAL = 30_000; // 30 秒检查一次

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

/**
 * 启动自我健康检查（容错第三层）
 * 每 30 秒检查自身 /health 端点，连续 3 次失败则自动降级
 * 降级逻辑：尝试禁用 Proxy 配置，恢复用户的直连环境
 * @param {number} port - 服务监听端口，默认 7777
 */
export function startSelfHealthCheck(port = 7777) {
  // 避免重复启动
  if (healthCheckTimer) return;

  healthCheckTimer = setInterval(async () => {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/health`, { timeout: 5000 }, resolve);
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('health check timeout')); });
      });

      // 消费响应体，避免内存泄漏
      res.resume();

      if (res.statusCode === 200) {
        failureCount = 0; // 成功，重置计数
      } else {
        failureCount++;
      }
    } catch {
      failureCount++;
    }

    if (failureCount >= MAX_FAILURES) {
      console.warn('\x1b[31m[Health] 连续 3 次健康检查失败，自动降级\x1b[0m');
      // 尝试禁用 Proxy 配置，恢复用户直连环境
      try {
        const { disableProxy } = await import('./config-manager.mjs');
        disableProxy();
        console.warn('[Health] 已自动恢复 Proxy 配置');
      } catch {
        // config-manager 可能还不存在（Agent C 正在创建），静默忽略
      }
      // 停止定时器，避免反复触发
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
  }, CHECK_INTERVAL);

  // 允许进程正常退出，不因定时器挂起
  if (healthCheckTimer.unref) {
    healthCheckTimer.unref();
  }
}

/**
 * 停止自我健康检查定时器
 */
export function stopSelfHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  failureCount = 0;
}
