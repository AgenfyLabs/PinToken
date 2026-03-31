/**
 * HTTP 服务器主入口
 * 负责路由分发：Anthropic 代理 / OpenAI 代理 / Dashboard API / 静态文件
 */

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAnthropic } from './anthropic.mjs';
import { handleOpenAI } from './openai.mjs';
import { handleAPI } from '../api/routes.mjs';
import { createStore, getDefaultDbPath } from '../db/store.mjs';
import { startScanner, hasClaudeLogs } from '../scanner/index.mjs';

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

  // 安全处理：去除路径中的 .. 防止目录穿越
  const safePath = urlPath.replace(/\.\./g, '');
  const filePath = join(DASHBOARD_DIR, safePath);

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

  // 启动 JSONL 日志扫描器（如果检测到 Claude Code 日志）
  if (hasClaudeLogs()) {
    startScanner(store, { onLog: log });
  }

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    // 路由分发（按优先级顺序匹配）
    if (url.startsWith('/anthropic/')) {
      handleAnthropic(req, res, store, log);
    } else if (url.startsWith('/openai/')) {
      handleOpenAI(req, res, store, log);
    } else if (url.startsWith('/api/')) {
      handleAPI(req, res, store, startedAt);
    } else {
      // 静态文件：Dashboard 前端资源
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
