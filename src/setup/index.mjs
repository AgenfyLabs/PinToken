// index.mjs — Setup 流程编排（双模式：Scanner 默认 / Proxy opt-in）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

import { detectShell, getShellProfilePath, appendEnvToProfile, isConfigured } from './shell.mjs';
import { setClaudeBaseUrl } from './claude.mjs';
import { hasClaudeLogs } from '../scanner/index.mjs';

// 代理服务器本地地址
const ANTHROPIC_BASE_URL = 'http://localhost:7777/anthropic';
const OPENAI_BASE_URL = 'http://localhost:7777/openai';

/**
 * 检测 ~/.claude/settings.json 中是否残留指向 localhost:7777 的旧代理配置
 * 如有则输出提示信息
 * @returns {boolean} 是否检测到旧配置
 */
export function detectLegacyProxyConfig() {
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    if (!existsSync(settingsPath)) return false;
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    const baseUrl = settings?.env?.ANTHROPIC_BASE_URL || '';
    if (baseUrl.includes('localhost:7777')) {
      console.log('⚠️  检测到旧的代理配置，建议运行 pintoken setup 重新配置');
      return true;
    }
  } catch {
    // 文件不存在、不可读或 JSON 解析失败，均静默忽略
  }
  return false;
}

/**
 * 解析 .env 文件内容为结构化条目列表
 * 保留注释和空行的原始顺序
 */
function parseDotEnv(content) {
  const entries = [];
  const keys = new Set();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // 空行或注释行原样保留
    if (!trimmed || trimmed.startsWith('#')) {
      entries.push({ type: 'passthrough', raw: line });
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)/);
    if (match) {
      const [, key, value] = match;
      keys.add(key);
      entries.push({ type: 'var', key, value, raw: line });
    } else {
      entries.push({ type: 'passthrough', raw: line });
    }
  }

  return { entries, keys };
}

/**
 * 向 .env 文件中 upsert 环境变量
 * 已存在的变量会被更新（覆盖），不存在的追加到末尾
 */
function upsertDotEnv(envPath, vars) {
  const resolvedPath = resolve(envPath);
  let content = '';

  if (existsSync(resolvedPath)) {
    content = readFileSync(resolvedPath, 'utf-8');
  }

  const { entries, keys } = parseDotEnv(content);

  for (const [key, value] of Object.entries(vars)) {
    if (keys.has(key)) {
      // 原地更新现有变量
      const idx = entries.findIndex((e) => e.type === 'var' && e.key === key);
      if (idx !== -1) {
        entries[idx].value = value;
        entries[idx].raw = `${key}=${value}`;
      }
    } else {
      // 追加新变量
      entries.push({ type: 'var', key, value, raw: `${key}=${value}` });
    }
  }

  const output = entries.map((e) => e.raw).join('\n');
  writeFileSync(resolvedPath, output.endsWith('\n') ? output : output + '\n');
}

/**
 * 执行 PinToken setup 流程（双模式）
 * @param {Object} options - 配置选项
 * @param {boolean} options.proxy - 是否启用代理模式（默认 false，即 Scanner 模式）
 * @returns {boolean} true 表示配置完成
 */
export async function runSetup(options = {}) {
  const { proxy = false } = options;

  // 第一步：检测旧代理配置
  detectLegacyProxyConfig();

  // Scanner 模式（默认）：不写入任何用户配置文件
  if (!proxy) {
    console.log('Scanner 模式已启动，将自动读取 Claude Code 日志');

    // 检测 Claude Code 日志
    if (hasClaudeLogs()) {
      console.log('检测到 Claude Code 对话日志，已启用日志追踪模式');
      console.log('即使没有 API Key，也能追踪你的 token 用量');
    }

    return true;
  }

  // Proxy 模式（--proxy）：执行完整代理配置流程
  // 1. 检测 shell 和 profile 路径
  const shell = detectShell();
  const profilePath = getShellProfilePath(shell);

  console.log(`检测到 shell: ${shell}`);
  console.log(`Shell profile: ${profilePath}`);

  // 2. 若已配置过，直接返回
  if (isConfigured(profilePath)) {
    console.log('\n已检测到配置，跳过重复写入。');
    console.log('如需重新配置，请手动删除 profile 中带有 "# Added by PinToken" 的行。');
    return false;
  }

  // 3. 向 shell profile 写入环境变量
  const anthropicResult = appendEnvToProfile(profilePath, 'ANTHROPIC_BASE_URL', ANTHROPIC_BASE_URL);
  const openaiResult = appendEnvToProfile(profilePath, 'OPENAI_BASE_URL', OPENAI_BASE_URL);

  // 打印每个变量的操作结果
  const resultLabel = { added: '已添加', updated: '已更新', skipped: '已跳过（用户自定义）' };
  console.log(`ANTHROPIC_BASE_URL: ${resultLabel[anthropicResult] || anthropicResult}`);
  console.log(`OPENAI_BASE_URL: ${resultLabel[openaiResult] || openaiResult}`);

  // 4. 写入 Claude Code settings.json
  const settingsPath = setClaudeBaseUrl(ANTHROPIC_BASE_URL);
  console.log(`已写入 Claude Code 设置: ${settingsPath}`);

  // 5. 若当前目录存在 .env 文件，也更新其中的变量
  const envPath = resolve('.env');
  if (existsSync(envPath)) {
    upsertDotEnv(envPath, {
      ANTHROPIC_BASE_URL,
      OPENAI_BASE_URL,
    });
    console.log(`已更新 .env: ${envPath}`);
  }

  // 6. 检测 Claude Code 日志
  if (hasClaudeLogs()) {
    console.log('\n检测到 Claude Code 对话日志，已启用日志追踪模式');
    console.log('即使没有 API Key，也能追踪你的 token 用量');
  }

  // 7. 打印使用说明
  console.log('\n配置完成！请重启终端或执行以下命令使配置生效：');
  console.log(`  source ${profilePath}`);
  console.log('\n然后启动 Claude Code，流量将通过 PinToken 代理进行追踪。');

  return true;
}
