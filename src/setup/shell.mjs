// shell.mjs — Shell 检测与 profile 写入
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir, platform } from 'node:os';
import { execSync } from 'node:child_process';

// 标记注释，用于标识由 PinToken 添加的行
const MARKER = '# Added by PinToken';

/**
 * 将 shell 名称原始字符串规范化为 zsh/bash/fish
 */
function normalizeShellName(raw) {
  if (!raw) return null;
  const name = basename(raw).replace(/^-/, ''); // 去掉登录 shell 的前导 dash
  if (name.includes('zsh')) return 'zsh';
  if (name.includes('bash')) return 'bash';
  if (name.includes('fish')) return 'fish';
  return name || null;
}

/**
 * 检测用户当前使用的 shell
 * 优先级：CLAUDE_CODE_SHELL 环境变量 → 父进程名 → $SHELL → 'bash'
 */
export function detectShell() {
  // 1. Claude Code 设置的显式覆盖
  if (process.env.CLAUDE_CODE_SHELL) {
    return normalizeShellName(process.env.CLAUDE_CODE_SHELL);
  }

  // 2. 通过 ps 查询父进程名（最准确，反映实际运行中的 shell）
  try {
    const ppid = process.ppid;
    const parentName = execSync(`ps -o comm= -p ${ppid}`, {
      encoding: 'utf-8',
      timeout: 3000,
    }).trim();
    const shell = normalizeShellName(parentName);
    if (shell) return shell;
  } catch {
    // ps 不可用或失败，继续下一个检测方式
  }

  // 3. $SHELL 环境变量（登录 shell）
  if (process.env.SHELL) {
    return normalizeShellName(process.env.SHELL);
  }

  // 4. 默认回退
  return 'bash';
}

/**
 * 根据 shell 类型返回最佳的 profile 文件路径
 * 返回第一个已存在的文件，若都不存在则返回首选路径
 */
export function getShellProfilePath(shell) {
  const home = homedir();
  const isMac = platform() === 'darwin';

  const candidates = {
    zsh: [
      join(home, '.zshrc'),       // 交互式 shell，macOS/Linux 通用
      join(home, '.zprofile'),    // 登录 shell，macOS
    ],
    bash: isMac
      ? [
          join(home, '.bash_profile'), // macOS 默认使用登录 shell
          join(home, '.bashrc'),
          join(home, '.profile'),
        ]
      : [
          join(home, '.bashrc'),       // Linux 交互式 shell
          join(home, '.bash_profile'),
          join(home, '.profile'),
        ],
    fish: [
      join(home, '.config', 'fish', 'config.fish'),
    ],
  };

  const paths = candidates[shell] || candidates.bash;
  return paths.find((p) => existsSync(p)) || paths[0];
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 幂等地向 shell profile 文件追加环境变量
 * - 若已有 PinToken 标记的该变量 → 原地更新，返回 'updated'
 * - 若该变量已存在但无标记 → 跳过，返回 'skipped'
 * - 否则 → 追加，返回 'added'
 */
export function appendEnvToProfile(profilePath, key, value) {
  // 确保父目录存在（fish 的 ~/.config/fish/ 可能不存在）
  mkdirSync(dirname(profilePath), { recursive: true });

  const exportLine = `export ${key}="${value}"`;
  const markedLine = `${exportLine}  ${MARKER}`;

  if (existsSync(profilePath)) {
    const content = readFileSync(profilePath, 'utf-8');

    // 检查是否已有 PinToken 管理的该变量
    const markedRegex = new RegExp(
      `^export ${escapeRegExp(key)}=.*${escapeRegExp(MARKER)}$`,
      'm'
    );
    if (markedRegex.test(content)) {
      // 原地更新
      const updated = content.replace(markedRegex, markedLine);
      writeFileSync(profilePath, updated);
      return 'updated';
    }

    // 检查是否有用户手动设置的同名变量（无标记）
    const manualRegex = new RegExp(`^export ${escapeRegExp(key)}=`, 'm');
    if (manualRegex.test(content)) {
      // 不覆盖用户手动配置
      return 'skipped';
    }
  }

  // 追加新行
  appendFileSync(profilePath, `\n${markedLine}\n`);
  return 'added';
}

/**
 * 检查 profile 文件中是否已有 PinToken 标记
 */
export function isConfigured(profilePath) {
  if (!existsSync(profilePath)) return false;
  const content = readFileSync(profilePath, 'utf-8');
  return content.includes(MARKER);
}

/**
 * 从 shell profile 中移除 PinToken 标记的环境变量行
 * @param {string} profilePath - profile 文件路径
 * @param {string} key - 环境变量名（如 ANTHROPIC_BASE_URL）
 * @returns {'removed'|'not_found'} 操作结果
 */
export function removeEnvFromProfile(profilePath, key) {
  if (!existsSync(profilePath)) return 'not_found';

  const content = readFileSync(profilePath, 'utf-8');
  const markedRegex = new RegExp(
    `\\n?^export ${escapeRegExp(key)}=.*${escapeRegExp(MARKER)}\\n?`,
    'gm'
  );

  if (!markedRegex.test(content)) return 'not_found';

  const cleaned = content.replace(markedRegex, '\n').replace(/\n{3,}/g, '\n\n');
  writeFileSync(profilePath, cleaned);
  return 'removed';
}
