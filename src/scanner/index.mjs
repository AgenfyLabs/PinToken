/**
 * JSONL 日志扫描器
 * 轮询 ~/.claude/projects/ 下的所有 JSONL 文件，导入历史 token 用量记录
 * 支持 schema 版本检测、recent-first 扫描策略、偏移读取
 */

import { existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseAssistantMessage } from './parser.mjs';
import { calculateCost } from '../pricing/calculator.mjs';
import { markScanStart, markFileScanned, markScanComplete, updateScanStatus } from './status.mjs';

// 扫描定时器句柄
let scanTimer = null;
// 后台补扫定时器句柄
let backfillTimer = null;
// 后台补扫连续无数据轮次计数
let backfillEmptyRounds = 0;

// Claude Code 日志根目录
const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');

// 近 7 天的毫秒数
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
 * 检查 JSONL 文件的 schema 兼容性
 * 读取第一行非空行，验证是否包含 type 和 message 字段
 * @param {string} filePath - 文件路径
 * @returns {boolean} 是否兼容
 */
export function checkSchema(filePath) {
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return false;
  }

  // 空文件 → 跳过
  if (stat.size === 0) return false;

  // 读取文件前 4KB 足够获取第一行
  const readLen = Math.min(stat.size, 4096);
  let content;
  try {
    const fd = openSync(filePath, 'r');
    const buf = Buffer.alloc(readLen);
    readSync(fd, buf, 0, readLen, 0);
    closeSync(fd);
    content = buf.toString('utf-8');
  } catch {
    return false;
  }

  // 找到第一行非空内容
  const lines = content.split('\n');
  let firstLine = null;
  for (const line of lines) {
    if (line.trim()) {
      firstLine = line.trim();
      break;
    }
  }

  if (!firstLine) return false;

  // 尝试解析 JSON 并检查 schema
  // Claude Code JSONL 每行有 type 字段，assistant 行有 message 字段
  // 第一行可能不是 assistant（如 session start），所以只检查 type 字段
  try {
    const obj = JSON.parse(firstLine);
    if (typeof obj.type === 'string') {
      return true;
    }
    // 不兼容的 schema
    console.warn(`[Scanner] schema 不兼容，跳过文件: ${filePath} (缺少 type 字段)`);
    return false;
  } catch {
    console.warn(`[Scanner] schema 不兼容，跳过文件: ${filePath} (JSON 解析失败)`);
    return false;
  }
}

// 缓存已验证的 schema 结果，避免重复检查
const schemaCache = new Map();

/**
 * 扫描单个 JSONL 文件，从上次偏移量处读取新增内容
 * @param {string} filePath - 文件完整路径
 * @param {object} store - 数据存储对象
 * @param {Function|undefined} onLog - 每条新记录的回调（可选）
 * @returns {number} 本次新增的记录数
 */
export function scanFile(filePath, store, onLog) {
  // 获取上次扫描的偏移量
  const { last_offset: lastOffset } = store.getOffset(filePath);

  // 首次扫描该文件时进行 schema 检测
  if (lastOffset === 0 && !schemaCache.has(filePath)) {
    const compatible = checkSchema(filePath);
    schemaCache.set(filePath, compatible);
    if (!compatible) return 0;
  } else if (schemaCache.has(filePath) && !schemaCache.get(filePath)) {
    return 0;
  }

  // 文件状态检查
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return 0;
  }

  // 文件没有新内容，跳过
  if (stat.size <= lastOffset) return 0;

  // 只读取新增部分（偏移读取，避免全量读取大文件）
  let newContent;
  try {
    const fd = openSync(filePath, 'r');
    const len = stat.size - lastOffset;
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, lastOffset);
    closeSync(fd);
    newContent = buf.toString('utf-8');
  } catch {
    return 0;
  }
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
 * 获取文件列表及其 mtime，按 mtime DESC 排序
 * @returns {Array<{path: string, mtime: Date}>}
 */
function getFilesWithMtime() {
  const files = findJsonlFiles();
  const result = [];

  for (const filePath of files) {
    try {
      const stat = statSync(filePath);
      result.push({ path: filePath, mtime: stat.mtime });
    } catch {
      // 文件不可访问，跳过
    }
  }

  // 按 mtime 降序排列（最近修改的排前面）
  result.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  return result;
}

/**
 * 执行一次扫描（支持 recent-first 策略）
 * @param {object} store - 数据存储对象
 * @param {Function|undefined} onLog - 每条新记录的回调（可选）
 * @returns {{ count: number, phase: string }} 本次新增的总记录数和当前阶段
 */
export async function scanOnce(store, onLog) {
  const initialComplete = store.getScanMeta('initial_scan_complete');

  if (initialComplete !== 'true') {
    // Phase "recent"：只处理近 7 天的文件，按 mtime DESC 排序
    const filesWithMtime = getFilesWithMtime();
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const recentFiles = filesWithMtime.filter(f => f.mtime.getTime() > cutoff);
    let total = 0;

    // 更新扫描状态
    markScanStart(recentFiles.length);
    updateScanStatus({ phase: 'recent' });

    for (const { path: filePath } of recentFiles) {
      const count = scanFile(filePath, store, onLog);
      markFileScanned(count);
      total += count;
    }

    // 标记初始扫描完成
    store.setScanMeta('initial_scan_complete', 'true');
    markScanComplete();

    return { count: total, phase: 'recent' };
  }

  // Phase "idle"：正常轮询，只处理有新内容的文件
  const files = findJsonlFiles();
  let total = 0;

  updateScanStatus({ phase: 'idle', scanning: false });

  for (const filePath of files) {
    total += scanFile(filePath, store, onLog);
  }

  return { count: total, phase: 'idle' };
}

/**
 * 启动后台补扫（处理 7 天前的旧文件）
 * 每 60s 扫 1 个旧文件，连续 3 轮无新数据则停止
 * @param {object} store - 数据存储对象
 * @param {Function|undefined} onLog
 */
function startBackfill(store, onLog) {
  // 获取所有旧文件（mtime <= 7 天前）
  let oldFiles = null;
  let oldFileIndex = 0;

  backfillTimer = setInterval(() => {
    // 延迟获取旧文件列表（首次进入时才计算）
    if (oldFiles === null) {
      const cutoff = Date.now() - SEVEN_DAYS_MS;
      const allFiles = getFilesWithMtime();
      oldFiles = allFiles.filter(f => f.mtime.getTime() <= cutoff);
      updateScanStatus({ phase: 'backfill' });
    }

    // 没有更多旧文件，停止
    if (oldFileIndex >= oldFiles.length) {
      clearInterval(backfillTimer);
      backfillTimer = null;
      return;
    }

    const { path: filePath } = oldFiles[oldFileIndex];
    oldFileIndex++;

    const count = scanFile(filePath, store, onLog);

    if (count === 0) {
      backfillEmptyRounds++;
    } else {
      backfillEmptyRounds = 0;
    }

    // 连续 3 轮无新数据则停止
    if (backfillEmptyRounds >= 3) {
      clearInterval(backfillTimer);
      backfillTimer = null;
    }
  }, 60000);
}

/**
 * 启动轮询扫描器
 * 立即执行一次扫描，随后每隔 interval 毫秒重复执行
 * @param {object} store - 数据存储对象
 * @param {object} options
 * @param {Function} [options.onLog] - 每条新记录的回调
 * @param {number} [options.interval=30000] - 轮询间隔（毫秒）
 * @returns {Promise<{ initialCount: number, phase: string }>}
 */
export async function startScanner(store, { onLog, interval } = {}) {
  // 立即执行首次扫描
  const { count: initialCount, phase } = await scanOnce(store, onLog);

  if (initialCount > 0) {
    console.log(`[Scanner] 首次扫描导入 ${initialCount} 条 Claude Code 历史记录 (phase: ${phase})`);
  }

  // 启动定时轮询
  scanTimer = setInterval(() => scanOnce(store, onLog), interval || 30000);

  // 初始扫描完成后启动后台补扫
  startBackfill(store, onLog);

  return { initialCount, phase };
}

/**
 * 停止轮询扫描器
 */
export function stopScanner() {
  if (scanTimer !== null) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (backfillTimer !== null) {
    clearInterval(backfillTimer);
    backfillTimer = null;
  }
}

/**
 * 检查是否存在 Claude Code JSONL 日志文件
 * @returns {boolean}
 */
export function hasClaudeLogs() {
  return findJsonlFiles().length > 0;
}

/**
 * 清除 schema 缓存（测试用）
 */
export function clearSchemaCache() {
  schemaCache.clear();
}
