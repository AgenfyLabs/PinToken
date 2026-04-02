// routes.test.mjs — /api/scan-status 端点测试
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getScanStatus, updateScanStatus, markScanStart, markScanComplete } from '../src/scanner/status.mjs';

describe('/api/scan-status', () => {
  // 每个测试前重置状态
  beforeEach(() => {
    updateScanStatus({
      scanning: false,
      recordsFound: 0,
      filesScanned: 0,
      totalFiles: 0,
      phase: 'idle',
      proxyActive: false,
    });
  });

  it('phase=recent 时返回 scanning=true', () => {
    markScanStart(5);
    updateScanStatus({ phase: 'recent' });

    const status = getScanStatus();
    assert.equal(status.scanning, true, '扫描中应为 true');
    assert.equal(status.phase, 'recent', 'phase 应为 recent');
    assert.equal(status.totalFiles, 5, 'totalFiles 应为 5');
  });

  it('phase=idle 时返回 scanning=false', () => {
    markScanComplete();

    const status = getScanStatus();
    assert.equal(status.scanning, false, '空闲时应为 false');
    assert.equal(status.phase, 'idle', 'phase 应为 idle');
  });

  it('返回正确的 JSON 结构', () => {
    markScanStart(3);
    updateScanStatus({ phase: 'recent', recordsFound: 42 });

    const status = getScanStatus();

    // 验证所有字段存在
    assert.ok('scanning' in status, '应包含 scanning 字段');
    assert.ok('recordsFound' in status, '应包含 recordsFound 字段');
    assert.ok('filesScanned' in status, '应包含 filesScanned 字段');
    assert.ok('totalFiles' in status, '应包含 totalFiles 字段');
    assert.ok('phase' in status, '应包含 phase 字段');
    assert.ok('proxyActive' in status, '应包含 proxyActive 字段');

    // 验证类型
    assert.equal(typeof status.scanning, 'boolean');
    assert.equal(typeof status.recordsFound, 'number');
    assert.equal(typeof status.phase, 'string');
    assert.equal(typeof status.proxyActive, 'boolean');

    // 验证值
    assert.equal(status.recordsFound, 42);
    assert.equal(status.totalFiles, 3);
  });
});
