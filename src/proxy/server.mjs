/**
 * HTTP 服务器主入口
 * 负责路由分发：Anthropic 代理 / OpenAI 代理 / Dashboard API / 静态文件
 */

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAnthropic } from './anthropic.mjs';
import { handleOpenAI } from './openai.mjs';
import { handleHealth } from './health.mjs';
import { handleAPI } from '../api/routes.mjs';
import { createStore, getDefaultDbPath } from '../db/store.mjs';
import { startScanner } from '../scanner/index.mjs';
import { startPeakNotifier } from '../notify/peak.mjs';

// 当前文件所在目录（ESM 环境无 __dirname）
const __dirname = dirname(fileURLToPath(import.meta.url));

// Dashboard 静态文件目录
const DASHBOARD_DIR = join(__dirname, '../../dashboard');

// 静态文件 MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * 构建默认日志回调
 * 输出格式：[HH:MM:SS] model-name-padded | X,XXX in  XXX out | $0.XXXX | saved $0.XXX
 */
function defaultLog({ model, input_tokens, output_tokens, cost_usd, saved_usd }) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const tokens = `${(input_tokens || 0).toLocaleString()} in  ${(output_tokens || 0).toLocaleString()} out`;
  const cost = `$${(cost_usd || 0).toFixed(4)}`;
  const savedPart = saved_usd > 0 ? ` | saved $${saved_usd.toFixed(3)}` : '';

  console.log(
    `[${time}] ${String(model || '').padEnd(25)} | ${tokens.padEnd(20)} | ${cost.padEnd(10)}${savedPart}`
  );
}

/**
 * 服务静态文件，处理目录和 SPA 回退逻辑
 * @param {string} urlPath - 请求路径
 * @param {object} res - HTTP 响应对象
 */
function serveStatic(urlPath, res) {
  // 将 / 映射到 /index.html
  if (urlPath === '/') urlPath = '/index.html';

  // 安全处理：路径穿越防护
  const safePath = urlPath.replace(/\.\./g, '');
  const resolved = path.resolve(DASHBOARD_DIR, '.' + safePath);
  if (!resolved.startsWith(DASHBOARD_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  const filePath = resolved;

  // 判断文件是否存在且不是目录
  const fileExists = existsSync(filePath) && !statSync(filePath).isDirectory();

  if (fileExists) {
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(readFileSync(filePath));
    return;
  }

  // SPA 回退：找不到文件时返回 index.html
  const indexPath = join(DASHBOARD_DIR, 'index.html');
  if (existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(readFileSync(indexPath));
    return;
  }

  // index.html 也不存在时返回 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Dashboard not found');
}

/**
 * 启动 HTTP 服务器
 * @param {object} options
 * @param {number} [options.port=7777] - 监听端口
 * @param {string} [options.dbPath] - 数据库文件路径，默认使用 ~/.pintoken/data.db
 * @param {Function} [options.onLog] - 日志回调函数，默认输出到控制台
 * @returns {Promise<{ server, store, port }>}
 */
export function startServer({ port = 7777, dbPath, onLog } = {}) {
  // 初始化数据存储
  const store = createStore(dbPath || getDefaultDbPath());

  // 记录服务启动时间（用于会话时长统计）
  const startedAt = Date.now();

  // 使用默认日志回调
  const log = onLog || defaultLog;

  // 无条件启动 JSONL 日志扫描器
  startScanner(store, { onLog: log });

  // 启动高峰时段 macOS 系统通知（每 5 分钟检查，状态变化时推送）
  startPeakNotifier();

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    // OpenAI 兼容格式 Provider 路由映射表
    const OPENAI_COMPAT_PROVIDERS = [
      { prefix: '/openai/',    baseUrl: 'https://api.openai.com/v1',                              providerName: 'openai' },
      { prefix: '/xai/',       baseUrl: 'https://api.x.ai/v1',                                    providerName: 'xai' },
      { prefix: '/gemini/',    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', providerName: 'gemini' },
      { prefix: '/moonshot/',  baseUrl: 'https://api.moonshot.cn/v1',                              providerName: 'moonshot' },
      { prefix: '/qwen/',      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',       providerName: 'qwen' },
      { prefix: '/glm/',       baseUrl: 'https://open.bigmodel.cn/api/paas/v4',                    providerName: 'glm' },
      { prefix: '/deepseek/',  baseUrl: 'https://api.deepseek.com/v1',                             providerName: 'deepseek' },
    ];

    // 匹配 OpenAI 兼容 Provider
    const matchedProvider = OPENAI_COMPAT_PROVIDERS.find((p) => url.startsWith(p.prefix));

    // 路由分发（按优先级顺序匹配）
    if (url === '/health') {
      handleHealth(req, res, startedAt);
    } else if (url.startsWith('/anthropic/')) {
      handleAnthropic(req, res, store, log);
    } else if (matchedProvider) {
      // 转发到匹配的 OpenAI 兼容 Provider
      handleOpenAI(req, res, store, log, {
        baseUrl: matchedProvider.baseUrl,
        providerName: matchedProvider.providerName,
        routePrefix: matchedProvider.prefix.slice(0, -1), // 去掉末尾斜杠，如 "/openai/" → "/openai"
      });
    } else if (url.startsWith('/api/')) {
      handleAPI(req, res, store, startedAt);
    } else if (url.startsWith('/dashboard')) {
      // 去掉 /dashboard 前缀，让 serveStatic 在 DASHBOARD_DIR 中正确定位文件
      const dashPath = url.slice('/dashboard'.length) || '/';
      serveStatic(dashPath, res);
    } else {
      // 根路径或其他路径也尝试 Dashboard 静态文件
      serveStatic(url, res);
    }
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => {
      resolve({ server, store, port });
    });
  });
}
