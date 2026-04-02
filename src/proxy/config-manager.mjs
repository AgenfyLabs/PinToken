/**
 * Proxy 配置管理器
 * 负责修改和恢复 Claude Code settings.json 和 shell profile 中的代理配置
 * 所有修改前自动备份，支持一键恢复
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { detectShell, getShellProfilePath, appendEnvToProfile, removeEnvFromProfile } from '../setup/shell.mjs';
import { setClaudeBaseUrl, removeClaudeBaseUrl } from '../setup/claude.mjs';

const PINTOKEN_DIR = join(homedir(), '.pintoken');
const BACKUP_DIR = join(PINTOKEN_DIR, 'backup');
const PROXY_STATE_FILE = join(PINTOKEN_DIR, 'proxy-state.json');

const ANTHROPIC_BASE_URL = 'http://localhost:7777/anthropic';
const OPENAI_BASE_URL = 'http://localhost:7777/openai';

// Claude Code 用户级设置文件路径
const CLAUDE_SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

/**
 * 读取 Proxy 状态
 * @returns {{ enabled: boolean, enabledAt: string|null }}
 */
export function getProxyState() {
  try {
    if (existsSync(PROXY_STATE_FILE)) {
      return JSON.parse(readFileSync(PROXY_STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { enabled: false, enabledAt: null };
}

/**
 * 保存 Proxy 状态
 */
function saveProxyState(state) {
  mkdirSync(PINTOKEN_DIR, { recursive: true });
  writeFileSync(PROXY_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * 备份配置文件到 ~/.pintoken/backup/
 * @param {string} filePath - 要备份的文件路径
 * @param {string} label - 备份文件标签（如 'zshrc'、'claude-settings'）
 */
function backupFile(filePath, label) {
  if (!existsSync(filePath)) return;
  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `${label}.${timestamp}.bak`);
  copyFileSync(filePath, backupPath);
}

/**
 * 启用 Proxy 模式
 * 1. 备份当前配置
 * 2. 写入 shell profile 环境变量
 * 3. 写入 Claude Code settings.json
 * 4. 记录状态
 * @returns {{ profilePath: string, shell: string }}
 */
export function enableProxy() {
  const shell = detectShell();
  const profilePath = getShellProfilePath(shell);

  // 备份 shell profile 和 Claude Code settings
  backupFile(profilePath, `shell-profile-${shell}`);
  backupFile(CLAUDE_SETTINGS_PATH, 'claude-settings');

  // 写入环境变量到 shell profile
  appendEnvToProfile(profilePath, 'ANTHROPIC_BASE_URL', ANTHROPIC_BASE_URL);
  appendEnvToProfile(profilePath, 'OPENAI_BASE_URL', OPENAI_BASE_URL);

  // 写入 Claude Code settings.json
  setClaudeBaseUrl(ANTHROPIC_BASE_URL);

  // 记录启用状态
  saveProxyState({ enabled: true, enabledAt: new Date().toISOString() });

  return { profilePath, shell };
}

/**
 * 禁用 Proxy 模式
 * 1. 移除 shell profile 中的环境变量
 * 2. 移除 Claude Code settings 中的 base URL
 * 3. 更新状态为已禁用
 * @returns {{ profilePath: string, shell: string }}
 */
export function disableProxy() {
  const shell = detectShell();
  const profilePath = getShellProfilePath(shell);

  // 移除 shell profile 中的环境变量
  removeEnvFromProfile(profilePath, 'ANTHROPIC_BASE_URL');
  removeEnvFromProfile(profilePath, 'OPENAI_BASE_URL');

  // 移除 Claude Code settings 中的 base URL
  removeClaudeBaseUrl();

  // 更新状态为已禁用
  saveProxyState({ enabled: false, enabledAt: null });

  return { profilePath, shell };
}

/**
 * 获取 Proxy 状态详情
 * @returns {{ enabled: boolean, enabledAt: string|null, shellProfile: string, shell: string }}
 */
export function getProxyStatus() {
  const state = getProxyState();
  const shell = detectShell();
  const profilePath = getShellProfilePath(shell);

  return {
    enabled: state.enabled,
    enabledAt: state.enabledAt,
    shell,
    shellProfile: profilePath,
    anthropicBaseUrl: ANTHROPIC_BASE_URL,
    openaiBaseUrl: OPENAI_BASE_URL,
  };
}
