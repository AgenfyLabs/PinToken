/**
 * JSONL 日志扫描器
 * 轮询 ~/.claude/projects/ 下的所有 JSONL 文件，导入历史 token 用量记录
 */

import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseAssistantMessage } from './parser.mjs';
import { calculateCost } from '../pricing/calculator.mjs';

// 扫描定时器句柄
let scanTimer = null;

// Claude Code 日志根目录
const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

/**
 * 递归查找所有 JSONL 文件
 * 扫描 ~/.claude/projects/ 下每个项目目录中的 *.jsonl 文件
 * @returns {string[]} 完整文件路径数组
 */
function findJsonlFiles() {
  // 目录不存在则直接返回空
  if (!existsSync(CLAUDE_PROJECTS_DIR)) return [];

  const files = [];

  let projectDirs;
  try {
    projectDirs = readdirSync(CLAUDE_PROJECTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of projectDirs) {
    // 只处理子目录（即项目目录）
    if (!entry.isDirectory()) continue;

    const projectPath = join(CLAUDE_PROJECTS_DIR, entry.name);

    let entries;
    try {
      entries = readdirSync(projectPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const file of entries) {
      if (file.isFile() && file.name.endsWith('.jsonl')) {
        files.push(join(projectPath, file.name));
      }
    }
  }

  return files;
}

/**
 * 扫描单个 JSONL 文件，从上次偏移量处读取新增内容
 * @param {string} filePath - 文件完整路径
 * @param {object} store - 数据存储对象
 * @param {Function|undefined} onLog - 每条新记录的回调（可选）
 * @returns {number} 本次新增的记录数
 */
function scanFile(filePath, store, onLog) {
  // 获取上次扫描的偏移量
  const { last_offset: lastOffset } = store.getOffset(filePath);

  // 文件状态检查
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return 0;
  }

  // 文件没有新内容，跳过
  if (stat.size <= lastOffset) return 0;

  // 读取文件全部内容，然后截取新增部分
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return 0;
  }

  const newContent = content.slice(lastOffset);
  const lines = newContent.split('\n');

  let newCount = 0;

  for (const line of lines) {
    // 跳过空行
    if (!line.trim()) continue;

    // 解析行内容
    const parsed = parseAssistantMessage(line);
    if (!parsed || parsed.id === null) continue;

    // 去重：已存在则跳过
    if (store.hasRequest(parsed.id)) continue;

    // 计算费用
    const costData = calculateCost({
      provider: parsed.provider,
      model: parsed.model,
      input_tokens: parsed.input_tokens,
      output_tokens: parsed.output_tokens,
      cache_read_tokens: parsed.cache_read_tokens,
      cache_write_tokens: parsed.cache_write_tokens,
    });

    // 构造标准记录对象
    const record = {
      id: parsed.id,
      timestamp: parsed.timestamp,
      provider: parsed.provider,
      model: parsed.model,
      input_tokens: parsed.input_tokens,
      output_tokens: parsed.output_tokens,
      cache_read_tokens: parsed.cache_read_tokens,
      cache_write_tokens: parsed.cache_write_tokens,
      cost_usd: costData.cost_usd,
      baseline_cost_usd: costData.baseline_cost_usd,
      saved_usd: costData.saved_usd,
      source: 'log',
      latency_ms: 0,
      status_code: 200,
    };

    // 写入数据库
    store.insertRequest(record);
    newCount++;

    // 触发回调
    if (typeof onLog === 'function') {
      onLog(record);
    }
  }

  // 更新偏移量（记录到文件末尾，避免重复解析）
  store.setOffset(filePath, stat.size, stat.mtime.toISOString());

  return newCount;
}

/**
 * 执行一次全量扫描
 * @param {object} store - 数据存储对象
 * @param {Function|undefined} onLog - 每条新记录的回调（可选）
 * @returns {number} 本次新增的总记录数
 */
export async function scanOnce(store, onLog) {
  const files = findJsonlFiles();
  let total = 0;

  for (const filePath of files) {
    total += scanFile(filePath, store, onLog);
  }

  return total;
}

/**
 * 启动轮询扫描器
 * 立即执行一次扫描，随后每隔 interval 毫秒重复执行
 * @param {object} store - 数据存储对象
 * @param {object} options
 * @param {Function} [options.onLog] - 每条新记录的回调
 * @param {number} [options.interval=30000] - 轮询间隔（毫秒）
 * @returns {{ initialCount: number }}
 */
export async function startScanner(store, { onLog, interval } = {}) {
  // 立即执行首次扫描
  const initialCount = await scanOnce(store, onLog);

  if (initialCount > 0) {
    console.log(`[Scanner] 首次扫描导入 ${initialCount} 条 Claude Code 历史记录`);
  }

  // 启动定时轮询
  scanTimer = setInterval(() => scanOnce(store, onLog), interval || 30000);

  return { initialCount };
}

/**
 * 停止轮询扫描器
 */
export function stopScanner() {
  if (scanTimer !== null) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
}

/**
 * 检查是否存在 Claude Code JSONL 日志文件
 * @returns {boolean}
 */
export function hasClaudeLogs() {
  return findJsonlFiles().length > 0;
}
