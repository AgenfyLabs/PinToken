/**
 * Dashboard 数据 API 路由处理
 * 处理所有 /api/* 请求
 */

import { getPeakStatus } from '../utils/peak.mjs';
import { getScanStatus } from '../scanner/status.mjs';

/**
 * 统一设置响应头
 */
function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
}

/**
 * 主路由处理函数
 * @param {object} req - HTTP 请求对象
 * @param {object} res - HTTP 响应对象
 * @param {object} store - 数据存储实例
 * @param {number} startedAt - 服务启动时间戳（毫秒）
 */
export async function handleAPI(req, res, store, startedAt) {
  setHeaders(res);

  try {
    // 解析 URL 和查询参数
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // GET /api/mode — 返回当前数据采集模式
    if (pathname === '/api/mode' && req.method === 'GET') {
      // 检查代理路由是否在运行（proxy 模式的标志）
      const hasProxy = true; // 服务器同时提供 proxy + scanner
      const hasScanner = true; // scanner 总是开启的

      const mode = {
        current: hasProxy ? 'hybrid' : 'log_observer',
        log_observer: { active: true, label: 'Log Observer' },
        proxy: { active: hasProxy, label: 'Proxy 模式' },
      };

      res.writeHead(200);
      res.end(JSON.stringify(mode));
      return;
    }

    // GET /api/summary — 返回汇总统计，附加会话秒数和高峰状态
    if (pathname === '/api/summary' && req.method === 'GET') {
      const summary = await store.getSummary();
      const session_seconds = Math.floor((Date.now() - startedAt) / 1000);
      const peak = getPeakStatus();
      res.writeHead(200);
      res.end(JSON.stringify({ ...summary, session_seconds, peak }));
      return;
    }

    // GET /api/scan-status — 返回扫描器状态
    if (pathname === '/api/scan-status' && req.method === 'GET') {
      const status = getScanStatus();
      res.writeHead(200);
      res.end(JSON.stringify(status));
      return;
    }

    // GET /api/peak-status — 返回当前高峰时段状态
    if (pathname === '/api/peak-status' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(getPeakStatus()));
      return;
    }

    // GET /api/requests — 返回请求记录列表，支持分页和 provider 过滤
    if (pathname === '/api/requests' && req.method === 'GET') {
      const providerParam = url.searchParams.get('provider');
      const provider = providerParam === '' || providerParam === null ? undefined : providerParam;
      const limit = parseInt(url.searchParams.get('limit'), 10) || 50;
      const offset = parseInt(url.searchParams.get('offset'), 10) || 0;

      const requests = await store.getRequests({ provider, limit, offset });
      res.writeHead(200);
      res.end(JSON.stringify(requests));
      return;
    }

    // GET /api/subscription — 返回本月费用 vs 订阅对比数据
    if (pathname === '/api/subscription' && req.method === 'GET') {
      const monthData = await store.getMonthSummary();
      // Max 订阅月费 $100（Claude Code Max），$200（Team Max）
      const maxMonthly = 100;
      const diff = monthData.month_cost - maxMonthly;
      res.writeHead(200);
      res.end(JSON.stringify({
        ...monthData,
        subscription_cost: maxMonthly,
        diff,              // 正数 = API 更贵，负数 = 订阅更贵
        saved_by_sub: diff > 0 ? diff : 0,
      }));
      return;
    }

    // GET /api/providers — 返回各 provider 统计数据
    if (pathname === '/api/providers' && req.method === 'GET') {
      const providers = await store.getProviderStats();
      res.writeHead(200);
      res.end(JSON.stringify(providers));
      return;
    }

    // GET /api/analytics/trend — 近 N 天每日花费趋势
    if (pathname === '/api/analytics/trend' && req.method === 'GET') {
      const days = parseInt(url.searchParams.get('days'), 10) || 30;
      const trend = await store.getDailyTrend(days);
      res.writeHead(200);
      res.end(JSON.stringify(trend));
      return;
    }

    // GET /api/analytics/models — 模型使用分布
    if (pathname === '/api/analytics/models' && req.method === 'GET') {
      const models = await store.getModelDistribution();
      // 过滤掉无效数据：unknown provider、0 tokens、合成模型
      const filtered = models.filter(m => m.provider !== 'unknown' && m.total_tokens > 0);
      res.writeHead(200);
      res.end(JSON.stringify(filtered));
      return;
    }

    // GET /api/analytics/providers — 各 Provider 详情
    if (pathname === '/api/analytics/providers' && req.method === 'GET') {
      const providers = await store.getProviderDetails();
      // 过滤掉 unknown provider（来自扫描器无法识别的日志条目）
      const filtered = providers.filter(p => p.provider !== 'unknown');
      res.writeHead(200);
      res.end(JSON.stringify(filtered));
      return;
    }

    // GET /api/share-data — 返回生成分享卡片所需的全部数据
    if (pathname === '/api/share-data' && req.method === 'GET') {
      const month = await store.getMonthSummary();
      const models = await store.getModelDistribution();
      const topModel = models.length > 0 ? models[0].model : 'unknown';

      res.writeHead(200);
      res.end(JSON.stringify({
        month_cost: month.month_cost,
        subscription_cost: 100,  // Max 月费
        saved: Math.max(month.month_cost - 100, 0),
        saved_pct: month.month_cost > 0 ? ((month.month_cost - 100) / month.month_cost * 100) : 0,
        month_requests: month.month_requests,
        month_tokens: month.month_tokens,
        top_model: topModel,
        month_label: month.month_label,
      }));
      return;
    }

    // 未知路径 → 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    // 服务端错误 → 500
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}
