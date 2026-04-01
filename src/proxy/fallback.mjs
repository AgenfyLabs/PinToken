/**
 * 直连上游 API 的回退转发
 * 当代理逻辑异常时调用，跳过 token 记录，只保证请求不断
 */
import https from 'node:https';

export function directProxy(hostname, upstreamPath, method, headers, bodyBuffer, clientRes) {
  // 黄色警告
  console.warn('\x1b[33m⚠️  PinToken 代理异常，已自动直连 ' + hostname + '\x1b[0m');

  const upstreamHeaders = { ...headers, host: hostname };
  // 删除可能干扰的头
  delete upstreamHeaders['transfer-encoding'];
  upstreamHeaders['content-length'] = Buffer.byteLength(bodyBuffer);

  const options = { hostname, port: 443, path: upstreamPath, method, headers: upstreamHeaders };

  const proxyReq = https.request(options, (proxyRes) => {
    if (!clientRes.headersSent) {
      clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    }
    proxyRes.pipe(clientRes);
  });

  proxyReq.on('error', (err) => {
    // 直连也失败了，这时才真正返回 502
    console.error('[fallback] 直连也失败:', err.message);
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    }
    clientRes.end(JSON.stringify({ error: 'Bad Gateway', message: '代理和直连均失败: ' + err.message }));
  });

  proxyReq.end(bodyBuffer);
}
