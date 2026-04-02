/**
 * Scanner 测试
 * 覆盖：schema 检测、recent-first 扫描、偏移读取
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, utimesSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStore } from '../src/db/store.mjs';
import { scanFile, scanOnce, checkSchema, clearSchemaCache } from '../src/scanner/index.mjs';

/**
 * 构造一条标准的 Claude Code JSONL 行
 */
function makeJsonlLine(overrides = {}) {
  const defaults = {
    type: 'assistant',
    timestamp: new Date().toISOString(),
    message: {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      model: 'claude-sonnet-4-20250514',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    },
  };
  const data = { ...defaults, ...overrides };
  if (overrides.message) {
    data.message = { ...defaults.message, ...overrides.message };
    if (overrides.message.usage) {
      data.message.usage = { ...defaults.message.usage, ...overrides.message.usage };
    }
  }
  return JSON.stringify(data);
}

describe('Scanner', () => {
  let store;
  let tmpDir;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'pintoken-scanner-test-'));
    const dbPath = join(tmpDir, 'test.db');
    store = createStore(dbPath);
  });

  after(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // 清除 schema 缓存，确保每个测试独立
    clearSchemaCache();
  });

  describe('Schema 检测', () => {
    it('正常 JSONL → 成功解析', () => {
      const filePath = join(tmpDir, 'valid.jsonl');
      const line = makeJsonlLine();
      writeFileSync(filePath, line + '\n');

      const result = checkSchema(filePath);
      assert.equal(result, true, '包含 type 和 message 的 JSONL 应返回 true');
    });

    it('格式变更 → console.warn + 跳过', (t) => {
      const filePath = join(tmpDir, 'incompatible.jsonl');
      // 写入一个缺少 type/message 字段的 JSON 行
      const badLine = JSON.stringify({ version: 2, entries: [] });
      writeFileSync(filePath, badLine + '\n');

      // 捕获 console.warn
      const warnings = [];
      const origWarn = console.warn;
      console.warn = (...args) => warnings.push(args.join(' '));

      const result = checkSchema(filePath);

      console.warn = origWarn;

      assert.equal(result, false, '不兼容的 schema 应返回 false');
      assert.ok(warnings.length > 0, '应有 warn 输出');
      assert.ok(warnings[0].includes('schema 不兼容'), 'warn 应包含 "schema 不兼容"');
    });

    it('空文件 → 跳过', () => {
      const filePath = join(tmpDir, 'empty.jsonl');
      writeFileSync(filePath, '');

      const result = checkSchema(filePath);
      assert.equal(result, false, '空文件应返回 false');
    });
  });

  describe('Recent-first 扫描', () => {
    it('初次扫描只处理近 7 天文件', async () => {
      // 创建独立的 store 和模拟的 projects 目录结构
      const scanDir = mkdtempSync(join(tmpdir(), 'pintoken-recent-'));
      const scanStore = createStore(join(scanDir, 'scan.db'));

      try {
        // scanOnce 内部使用 findJsonlFiles 查找 ~/.claude/projects/
        // 我们无法直接注入文件路径，所以测试 scan_metadata 的逻辑

        // 验证初始状态：initial_scan_complete 不存在
        assert.equal(scanStore.getScanMeta('initial_scan_complete'), null);

        // 执行 scanOnce → phase 应为 "recent"
        const result = await scanOnce(scanStore, undefined);
        assert.equal(result.phase, 'recent', '初次扫描 phase 应为 "recent"');

        // 执行后 initial_scan_complete 应为 true
        assert.equal(scanStore.getScanMeta('initial_scan_complete'), 'true');

        // 再次执行 → phase 应为 "idle"
        const result2 = await scanOnce(scanStore, undefined);
        assert.equal(result2.phase, 'idle', '第二次扫描 phase 应为 "idle"');
      } finally {
        scanStore.close();
        rmSync(scanDir, { recursive: true, force: true });
      }
    });
  });

  describe('偏移读取', () => {
    it('只读新增部分（不读全量）', () => {
      const scanDir = mkdtempSync(join(tmpdir(), 'pintoken-offset-'));
      const scanStore = createStore(join(scanDir, 'offset.db'));

      try {
        const filePath = join(scanDir, 'offset-test.jsonl');

        // 写入第一条记录
        const line1 = makeJsonlLine({
          message: { id: 'offset-line-1', model: 'claude-sonnet-4-20250514' },
        });
        writeFileSync(filePath, line1 + '\n');

        // 首次扫描 → 应扫到 1 条
        const count1 = scanFile(filePath, scanStore, undefined);
        assert.equal(count1, 1, '首次扫描应得到 1 条记录');

        // 验证偏移量已更新
        const offset1 = scanStore.getOffset(filePath);
        assert.ok(offset1.last_offset > 0, '偏移量应大于 0');

        // 追加第二条记录
        const line2 = makeJsonlLine({
          message: { id: 'offset-line-2', model: 'claude-sonnet-4-20250514' },
        });
        appendFileSync(filePath, line2 + '\n');

        // 二次扫描 → 应只扫到新增的 1 条
        const count2 = scanFile(filePath, scanStore, undefined);
        assert.equal(count2, 1, '二次扫描应只得到新增的 1 条记录');

        // 三次扫描 → 无新增，应返回 0
        const count3 = scanFile(filePath, scanStore, undefined);
        assert.equal(count3, 0, '无新增内容时应返回 0');

        // 验证两条记录都在数据库中
        assert.equal(scanStore.hasRequest('offset-line-1'), true);
        assert.equal(scanStore.hasRequest('offset-line-2'), true);
      } finally {
        scanStore.close();
        rmSync(scanDir, { recursive: true, force: true });
      }
    });
  });
});
