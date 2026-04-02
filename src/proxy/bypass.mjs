/**
 * 请求级 Bypass 包装器（容错第一层）
 * PinToken 内部处理出现异常时，降级为纯管道透传
 * 核心原则：PinToken 出错绝不能影响用户的 API 调用
 */

import https from 'node:https';
import http from 'node:http';

/**
 * 带容错保护的请求处理包装器
 * 当 handler 内部抛出同步异常时，自动降级到 fallback 透传
 * 注意：handler 内部的异步流（stream pipe）错误由 handler 自身的 error 事件处理
 * @param {Function} handler - 原始处理函数 (req, res, ...args) => void
 * @param {Function} fallback - 降级处理函数 (req, res, ...args) => void（纯透传）
 * @returns {Function} 包装后的处理函数
 */
export function withBypass(handler, fallback) {
  return (req, res, ...args) => {
    try {
      handler(req, res, ...args);
    } catch (error) {
      console.error(`\x1b[33m[Bypass] PinToken 内部错误，降级透传: ${error.message}\x1b[0m`);
      // 如果响应头还没发送，使用 fallback 透传
      if (!res.headersSent) {
        try {
          fallback(req, res, ...args);
        } catch (fbErr) {
          // fallback 也失败了，返回 502
          console.error(`[Bypass] fallback 也失败: ${fbErr.message}`);
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Bad Gateway', message: 'Proxy bypass failed' }));
          }
        }
      }
    }
  };
}

/**
 * 创建 Anthropic API 的降级透传函数
 * 纯管道透传到 api.anthropic.com，不记录任何数据
 * @returns {Function} fallback 处理函数
 */
export function createAnthropicFallback() {
  return (clientReq, clientRes) => {
    console.warn('\x1b[33m[Bypass] 使用 Anthropic 降级透传\x1b[0m');

    const targetPath = clientReq.url.replace(/^\/anthropic/, '') || '/';

    // 收集请求体后转发
    const chunks = [];
    clientReq.on('data', (chunk) => chunks.push(chunk));
    clientReq.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks);

      const upstreamHeaders = { ...clientReq.headers, host: 'api.anthropic.com' };
      delete upstreamHeaders['transfer-encoding'];
      upstreamHeaders['content-length'] = Buffer.byteLength(bodyBuffer);

      const proxyReq = https.request({
        hostname: 'api.anthropic.com',
        port: 443,
        path: targetPath,
        method: clientReq.method,
        headers: upstreamHeaders,
      }, (proxyRes) => {
        if (!clientRes.headersSent) {
          clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        }
        proxyRes.pipe(clientRes);
      });

      proxyReq.on('error', (err) => {
        console.error('[Bypass] Anthropic 直连失败:', err.message);
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        }
        clientRes.end(JSON.stringify({
          error: 'Bad Gateway',
          message: 'Bypass 直连 Anthropic 失败: ' + err.message,
        }));
      });

      proxyReq.end(bodyBuffer);
    });

    clientReq.on('error', (err) => {
      console.error('[Bypass] 客户端请求读取失败:', err.message);
    });
  };
}

/**
 * 创建 OpenAI 兼容 Provider 的降级透传函数
 * 纯管道透传到目标 API，不记录任何数据
 * @param {string} baseUrl - 目标 API base URL（如 https://api.openai.com/v1）
 * @param {string} routePrefix - 路由前缀（如 "/openai"）
 * @returns {Function} fallback 处理函数
 */
export function createOpenAIFallback(baseUrl, routePrefix) {
  return (clientReq, clientRes) => {
    console.warn(`\x1b[33m[Bypass] 使用 ${routePrefix} 降级透传\x1b[0m`);

    const parsedBase = new URL(baseUrl);
    const strippedPath = clientReq.url.replace(new RegExp(`^${routePrefix}`), '') || '/';
    const targetPath = parsedBase.pathname.replace(/\/$/, '') + strippedPath;
    const targetHostname = parsedBase.hostname;

    // 根据协议选择模块
    const mod = parsedBase.protocol === 'https:' ? https : http;

    // 收集请求体后转发
    const chunks = [];
    clientReq.on('data', (chunk) => chunks.push(chunk));
    clientReq.on('end', () => {
      const bodyBuffer = Buffer.concat(chunks);

      const upstreamHeaders = { ...clientReq.headers, host: targetHostname };
      delete upstreamHeaders['transfer-encoding'];
      upstreamHeaders['content-length'] = Buffer.byteLength(bodyBuffer);

      const proxyReq = mod.request({
        hostname: targetHostname,
        port: parsedBase.protocol === 'https:' ? 443 : 80,
        path: targetPath,
        method: clientReq.method,
        headers: upstreamHeaders,
      }, (proxyRes) => {
        if (!clientRes.headersSent) {
          clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
        }
        proxyRes.pipe(clientRes);
      });

      proxyReq.on('error', (err) => {
        console.error(`[Bypass] ${routePrefix} 直连失败:`, err.message);
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        }
        clientRes.end(JSON.stringify({
          error: 'Bad Gateway',
          message: `Bypass 直连 ${routePrefix} 失败: ${err.message}`,
        }));
      });

      proxyReq.end(bodyBuffer);
    });

    clientReq.on('error', (err) => {
      console.error('[Bypass] 客户端请求读取失败:', err.message);
    });
  };
}
