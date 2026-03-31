// claude.mjs — Claude Code settings.json 写入
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// Claude Code 用户级设置文件路径
const CLAUDE_SETTINGS_DIR = join(homedir(), '.claude');
const CLAUDE_SETTINGS_PATH = join(CLAUDE_SETTINGS_DIR, 'settings.json');

/**
 * 读取现有的 Claude Code settings.json
 * 文件不存在或解析失败时返回空对象
 */
function readClaudeSettings() {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * 将 settings 对象写回 Claude Code settings.json
 */
function writeClaudeSettings(settings) {
  mkdirSync(CLAUDE_SETTINGS_DIR, { recursive: true });
  writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

/**
 * 将 ANTHROPIC_BASE_URL 写入 Claude Code 用户设置文件的 env 对象
 * 不会覆盖其他已有设置
 * 返回 settings.json 的文件路径
 */
export function setClaudeBaseUrl(baseUrl) {
  const settings = readClaudeSettings();
  settings.env = settings.env || {};
  settings.env.ANTHROPIC_BASE_URL = baseUrl;
  // 注意：OPENAI_BASE_URL 只通过 shell profile 设置，不写入 Claude Code settings
  writeClaudeSettings(settings);
  return CLAUDE_SETTINGS_PATH;
}
