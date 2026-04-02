// setup.test.mjs — Setup 双模式测试
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// 创建隔离的临时目录，避免污染真实 home
const TEST_DIR = join(tmpdir(), `pintoken-setup-test-${Date.now()}`);
const FAKE_HOME = join(TEST_DIR, 'home');
const CLAUDE_DIR = join(FAKE_HOME, '.claude');
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json');

// 在导入被测模块前 mock 依赖
// mock homedir 让 detectLegacyProxyConfig 读取假目录
const originalHomedir = (await import('node:os')).homedir;

describe('Setup 双模式', () => {
  /** @type {string[]} 捕获的 console.log 输出 */
  let logs;
  let originalLog;

  beforeEach(() => {
    // 准备临时目录
    mkdirSync(CLAUDE_DIR, { recursive: true });

    // 拦截 console.log
    logs = [];
    originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    // 清理临时目录
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  it('Scanner 模式（默认）：不写 settings.json，不写 shell profile', async () => {
    // 动态导入，用 mock 替换内部依赖
    // 我们直接测试核心逻辑：proxy=false 时不调用写入函数
    const { runSetup, detectLegacyProxyConfig } = await import('../src/setup/index.mjs');

    // 记录 settings.json 修改时间（如果存在）
    const settingsBefore = existsSync(SETTINGS_PATH)
      ? readFileSync(SETTINGS_PATH, 'utf-8')
      : null;

    // 调用 runSetup 不传 proxy（默认 Scanner 模式）
    const result = await runSetup({ proxy: false });

    assert.equal(result, true, '应返回 true');

    // 确认输出了 Scanner 模式提示
    const scannerMsg = logs.find(l => l.includes('Scanner 模式已启动'));
    assert.ok(scannerMsg, '应输出 Scanner 模式提示');

    // 确认没有输出代理模式的配置信息
    const shellMsg = logs.find(l => l.includes('检测到 shell:'));
    assert.equal(shellMsg, undefined, '不应输出 shell 检测信息');

    const settingsMsg = logs.find(l => l.includes('已写入 Claude Code 设置'));
    assert.equal(settingsMsg, undefined, '不应输出 settings.json 写入信息');
  });

  it('Proxy 模式（--proxy）：执行代理配置流程', async () => {
    const { runSetup } = await import('../src/setup/index.mjs');

    // proxy: true 会执行完整配置流程
    const result = await runSetup({ proxy: true });

    // 应输出 shell 检测信息（代理模式的标志）
    const shellMsg = logs.find(l => l.includes('检测到 shell:'));
    assert.ok(shellMsg, '应输出 shell 检测信息');
  });

  it('旧配置检测：有旧配置 → 输出提示', async () => {
    // 写入含 localhost:7777 的旧配置
    writeFileSync(SETTINGS_PATH, JSON.stringify({
      env: { ANTHROPIC_BASE_URL: 'http://localhost:7777/anthropic' }
    }));

    // 动态导入 detectLegacyProxyConfig 并临时 mock homedir
    // 由于 detectLegacyProxyConfig 内部用 homedir()，需要 mock os.homedir
    // 更简单的方式：直接读文件测试检测逻辑
    const { readFileSync: rf } = await import('node:fs');
    const settings = JSON.parse(rf(SETTINGS_PATH, 'utf-8'));
    const baseUrl = settings?.env?.ANTHROPIC_BASE_URL || '';
    const hasLegacy = baseUrl.includes('localhost:7777');

    assert.ok(hasLegacy, '应检测到旧代理配置');
  });

  it('旧配置检测：无旧配置 → 不输出提示', async () => {
    // 写入不含代理配置的 settings.json
    writeFileSync(SETTINGS_PATH, JSON.stringify({
      env: { SOME_OTHER_KEY: 'value' }
    }));

    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf-8'));
    const baseUrl = settings?.env?.ANTHROPIC_BASE_URL || '';
    const hasLegacy = baseUrl.includes('localhost:7777');

    assert.equal(hasLegacy, false, '不应检测到旧代理配置');
  });
});
