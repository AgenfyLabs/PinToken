/**
 * SQLite 数据存储层测试
 * 使用 node:test 框架，TDD 风格
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStore } from '../src/db/store.mjs';

// 生成测试用请求记录
function makeRecord(overrides = {}) {
  return {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    input_tokens: 100,
    output_tokens: 200,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    cost_usd: 0.003,
    baseline_cost_usd: 0.005,
    saved_usd: 0.002,
    latency_ms: 500,
    status_code: 200,
    ...overrides,
  };
}

describe('createStore', () => {
  let store;
  let tmpDir;

  before(() => {
    // 使用临时目录作为测试数据库路径
    tmpDir = mkdtempSync(join(tmpdir(), 'pintoken-test-'));
    const dbPath = join(tmpDir, 'test.db');
    store = createStore(dbPath);
  });

  after(() => {
    // 关闭数据库并清理临时目录
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('insertRequest + getRequests', () => {
    it('应该能插入一条记录并读取回来', () => {
      const record = makeRecord({ id: 'test-insert-1' });
      store.insertRequest(record);

      const results = store.getRequests({});
      assert.ok(results.length >= 1, '应至少有一条记录');

      const found = results.find((r) => r.id === 'test-insert-1');
      assert.ok(found, '应该能找到插入的记录');
      assert.equal(found.provider, 'anthropic');
      assert.equal(found.model, 'claude-3-5-sonnet-20241022');
      assert.equal(found.input_tokens, 100);
      assert.equal(found.output_tokens, 200);
    });

    it('应该按 timestamp DESC 排序返回记录', () => {
      // 插入两条不同时间戳的记录
      const older = makeRecord({
        id: 'test-sort-old',
        timestamp: '2024-01-01T00:00:00.000Z',
      });
      const newer = makeRecord({
        id: 'test-sort-new',
        timestamp: '2024-06-01T00:00:00.000Z',
      });
      store.insertRequest(older);
      store.insertRequest(newer);

      const results = store.getRequests({});
      const idx_old = results.findIndex((r) => r.id === 'test-sort-old');
      const idx_new = results.findIndex((r) => r.id === 'test-sort-new');
      assert.ok(idx_new < idx_old, 'newer 记录应该排在 older 之前');
    });

    it('应该支持 limit 和 offset 分页', () => {
      // 插入5条记录
      for (let i = 0; i < 5; i++) {
        store.insertRequest(makeRecord({ id: `test-page-${i}` }));
      }

      const page1 = store.getRequests({ limit: 2, offset: 0 });
      const page2 = store.getRequests({ limit: 2, offset: 2 });

      assert.equal(page1.length, 2);
      assert.equal(page2.length, 2);
      // 两页的记录 id 不应重叠
      const ids1 = new Set(page1.map((r) => r.id));
      const ids2 = new Set(page2.map((r) => r.id));
      for (const id of ids2) {
        assert.ok(!ids1.has(id), '分页记录不应重叠');
      }
    });
  });

  describe('getRequests 按 provider 过滤', () => {
    it('应该只返回指定 provider 的记录', () => {
      const openaiRecord = makeRecord({
        id: 'test-provider-openai',
        provider: 'openai',
        model: 'gpt-4o',
      });
      const anthropicRecord = makeRecord({
        id: 'test-provider-anthropic',
        provider: 'anthropic',
      });
      store.insertRequest(openaiRecord);
      store.insertRequest(anthropicRecord);

      const openaiResults = store.getRequests({ provider: 'openai' });
      const anthropicResults = store.getRequests({ provider: 'anthropic' });

      assert.ok(
        openaiResults.every((r) => r.provider === 'openai'),
        '过滤结果应全为 openai'
      );
      assert.ok(
        anthropicResults.every((r) => r.provider === 'anthropic'),
        '过滤结果应全为 anthropic'
      );

      assert.ok(
        openaiResults.some((r) => r.id === 'test-provider-openai'),
        '应包含插入的 openai 记录'
      );
      assert.ok(
        anthropicResults.some((r) => r.id === 'test-provider-anthropic'),
        '应包含插入的 anthropic 记录'
      );
    });
  });

  describe('getSummary', () => {
    it('应该返回包含正确字段的汇总数据', () => {
      const summary = store.getSummary();
      assert.ok('today_tokens' in summary, '缺少 today_tokens');
      assert.ok('today_cost' in summary, '缺少 today_cost');
      assert.ok('today_requests' in summary, '缺少 today_requests');
      assert.ok('yesterday_tokens' in summary, '缺少 yesterday_tokens');
      assert.ok('yesterday_cost' in summary, '缺少 yesterday_cost');
      assert.ok('total_saved' in summary, '缺少 total_saved');
    });

    it('今日数据应统计当天插入的记录', () => {
      // 创建一个独立的 store 以便精确统计
      const isolatedDir = mkdtempSync(join(tmpdir(), 'pintoken-summary-'));
      const isolatedStore = createStore(join(isolatedDir, 'summary.db'));

      try {
        const todayTs = new Date().toISOString();
        isolatedStore.insertRequest(
          makeRecord({
            id: 'summary-today-1',
            timestamp: todayTs,
            input_tokens: 50,
            output_tokens: 100,
            cost_usd: 0.002,
            saved_usd: 0.001,
          })
        );
        isolatedStore.insertRequest(
          makeRecord({
            id: 'summary-today-2',
            timestamp: todayTs,
            input_tokens: 30,
            output_tokens: 70,
            cost_usd: 0.001,
            saved_usd: 0.0005,
          })
        );

        const summary = isolatedStore.getSummary();
        assert.equal(summary.today_requests, 2, '今日请求数应为 2');
        assert.equal(summary.today_tokens, 50 + 100 + 30 + 70, '今日 token 数应正确');
        assert.ok(summary.total_saved > 0, 'total_saved 应大于 0');
      } finally {
        isolatedStore.close();
        rmSync(isolatedDir, { recursive: true, force: true });
      }
    });
  });

  describe('Scanner offset 管理', () => {
    it('setOffset + getOffset 应能正确读写', () => {
      store.setOffset('/path/to/file.jsonl', 1234, '2026-03-31T00:00:00.000Z');
      const result = store.getOffset('/path/to/file.jsonl');
      assert.equal(result.last_offset, 1234);
      assert.equal(result.last_modified, '2026-03-31T00:00:00.000Z');
    });

    it('未知文件应返回 offset 0', () => {
      const result = store.getOffset('/path/to/nonexistent.jsonl');
      assert.equal(result.last_offset, 0);
      assert.equal(result.last_modified, null);
    });

    it('更新已有 offset 应覆盖旧值', () => {
      store.setOffset('/path/to/update.jsonl', 100, '2026-01-01T00:00:00.000Z');
      store.setOffset('/path/to/update.jsonl', 999, '2026-03-31T00:00:00.000Z');
      const result = store.getOffset('/path/to/update.jsonl');
      assert.equal(result.last_offset, 999);
      assert.equal(result.last_modified, '2026-03-31T00:00:00.000Z');
    });

    it('hasRequest 已存在返回 true，不存在返回 false', () => {
      const record = makeRecord({ id: 'has-request-test-1' });
      store.insertRequest(record);
      assert.equal(store.hasRequest('has-request-test-1'), true);
      assert.equal(store.hasRequest('nonexistent-id-xyz'), false);
    });
  });

  describe('getProviderStats', () => {
    it('应该返回每个 provider 的统计数组', () => {
      const isolatedDir = mkdtempSync(join(tmpdir(), 'pintoken-stats-'));
      const isolatedStore = createStore(join(isolatedDir, 'stats.db'));

      try {
        // 插入 2 条 anthropic，1 条 openai
        isolatedStore.insertRequest(
          makeRecord({ id: 'stats-ant-1', provider: 'anthropic', input_tokens: 100, output_tokens: 50, cost_usd: 0.002, saved_usd: 0.001 })
        );
        isolatedStore.insertRequest(
          makeRecord({ id: 'stats-ant-2', provider: 'anthropic', input_tokens: 200, output_tokens: 80, cost_usd: 0.003, saved_usd: 0.002 })
        );
        isolatedStore.insertRequest(
          makeRecord({ id: 'stats-oai-1', provider: 'openai', input_tokens: 150, output_tokens: 60, cost_usd: 0.004, saved_usd: 0.0005 })
        );

        const stats = isolatedStore.getProviderStats();
        assert.ok(Array.isArray(stats), '应返回数组');

        const antStats = stats.find((s) => s.provider === 'anthropic');
        const oaiStats = stats.find((s) => s.provider === 'openai');

        assert.ok(antStats, '应有 anthropic 的统计');
        assert.ok(oaiStats, '应有 openai 的统计');

        assert.equal(antStats.request_count, 2, 'anthropic 请求数应为 2');
        assert.equal(antStats.total_tokens, 100 + 50 + 200 + 80, 'anthropic token 总数正确');
        assert.equal(oaiStats.request_count, 1, 'openai 请求数应为 1');

        // 验证字段完整性
        for (const stat of stats) {
          assert.ok('provider' in stat);
          assert.ok('request_count' in stat);
          assert.ok('total_tokens' in stat);
          assert.ok('total_cost' in stat);
          assert.ok('total_saved' in stat);
        }
      } finally {
        isolatedStore.close();
        rmSync(isolatedDir, { recursive: true, force: true });
      }
    });
  });
});
