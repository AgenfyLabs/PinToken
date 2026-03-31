/**
 * SQLite 数据存储层
 * 负责管理 ~/.pintoken/data.db 中的请求记录和统计数据
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/**
 * 返回默认数据库路径 ~/.pintoken/data.db
 */
export function getDefaultDbPath() {
  return join(homedir(), '.pintoken', 'data.db');
}

/**
 * 创建或打开 SQLite 数据库，返回操作对象
 * @param {string} dbPath - 数据库文件路径
 */
export function createStore(dbPath) {
  // 自动创建目录
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);

  // 启用 WAL 模式，提升写入性能
  db.pragma('journal_mode = WAL');

  // 创建表结构和索引
  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id                 TEXT PRIMARY KEY,
      timestamp          TEXT NOT NULL,
      provider           TEXT NOT NULL,
      model              TEXT NOT NULL,
      input_tokens       INTEGER DEFAULT 0,
      output_tokens      INTEGER DEFAULT 0,
      cache_read_tokens  INTEGER DEFAULT 0,
      cache_write_tokens INTEGER DEFAULT 0,
      cost_usd           REAL DEFAULT 0,
      baseline_cost_usd  REAL DEFAULT 0,
      saved_usd          REAL DEFAULT 0,
      latency_ms         INTEGER DEFAULT 0,
      status_code        INTEGER DEFAULT 200
    );
    CREATE INDEX IF NOT EXISTS idx_timestamp ON requests(timestamp);
    CREATE INDEX IF NOT EXISTS idx_provider  ON requests(provider);
    CREATE TABLE IF NOT EXISTS scanner_offsets (
      file_path      TEXT PRIMARY KEY,
      last_offset    INTEGER DEFAULT 0,
      last_modified  TEXT
    );
  `);

  // 兼容已有数据库：追加 source 列（若已存在则忽略）
  try {
    db.exec("ALTER TABLE requests ADD COLUMN source TEXT DEFAULT 'proxy'");
  } catch {
    // 列已存在，忽略
  }

  // 预编译插入语句，提升批量写入性能
  const stmtInsert = db.prepare(`
    INSERT INTO requests (
      id, timestamp, provider, model,
      input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
      cost_usd, baseline_cost_usd, saved_usd,
      latency_ms, status_code, source
    ) VALUES (
      @id, @timestamp, @provider, @model,
      @input_tokens, @output_tokens, @cache_read_tokens, @cache_write_tokens,
      @cost_usd, @baseline_cost_usd, @saved_usd,
      @latency_ms, @status_code, @source
    )
  `);

  /**
   * 插入一条请求记录
   * @param {object} record - 请求记录对象
   */
  function insertRequest(record) {
    stmtInsert.run({
      source: 'proxy',
      ...record,
      input_tokens: record.input_tokens ?? 0,
      output_tokens: record.output_tokens ?? 0,
      cache_read_tokens: record.cache_read_tokens ?? 0,
      cache_write_tokens: record.cache_write_tokens ?? 0,
      cost_usd: record.cost_usd ?? 0,
      baseline_cost_usd: record.baseline_cost_usd ?? 0,
      saved_usd: record.saved_usd ?? 0,
      latency_ms: record.latency_ms ?? 0,
      status_code: record.status_code ?? 200,
    });
  }

  /**
   * 查询请求记录，支持按 provider 过滤和分页
   * @param {object} options
   * @param {string} [options.provider] - 可选，过滤指定 provider
   * @param {number} [options.limit=50]
   * @param {number} [options.offset=0]
   */
  function getRequests({ provider, limit = 50, offset = 0 } = {}) {
    if (provider) {
      const stmt = db.prepare(`
        SELECT * FROM requests
        WHERE provider = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `);
      return stmt.all(provider, limit, offset);
    }

    const stmt = db.prepare(`
      SELECT * FROM requests
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  /**
   * 获取今日、昨日汇总数据及累计节省金额
   * @returns {{ today_tokens, today_cost, today_requests, yesterday_tokens, yesterday_cost, total_saved }}
   */
  function getSummary() {
    // 获取今日和昨日的 UTC 日期前缀（ISO 格式前10位）
    const now = new Date();
    const todayPrefix = now.toISOString().slice(0, 10);

    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayPrefix = yesterday.toISOString().slice(0, 10);

    const stmtDay = db.prepare(`
      SELECT
        COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens), 0) AS tokens,
        COALESCE(SUM(cost_usd), 0) AS cost,
        COUNT(*) AS requests
      FROM requests
      WHERE timestamp LIKE ?
    `);

    const todayRow = stmtDay.get(`${todayPrefix}%`);
    const yesterdayRow = stmtDay.get(`${yesterdayPrefix}%`);

    const stmtTotal = db.prepare(`
      SELECT COALESCE(SUM(saved_usd), 0) AS total_saved FROM requests
    `);
    const totalRow = stmtTotal.get();

    return {
      today_tokens: todayRow.tokens,
      today_cost: todayRow.cost,
      today_requests: todayRow.requests,
      yesterday_tokens: yesterdayRow.tokens,
      yesterday_cost: yesterdayRow.cost,
      total_saved: totalRow.total_saved,
    };
  }

  /**
   * 按 provider 汇总统计数据
   * @returns {Array<{ provider, request_count, total_tokens, total_cost, total_saved }>}
   */
  function getProviderStats() {
    const stmt = db.prepare(`
      SELECT
        provider,
        COUNT(*) AS request_count,
        COALESCE(SUM(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens), 0) AS total_tokens,
        COALESCE(SUM(cost_usd), 0) AS total_cost,
        COALESCE(SUM(saved_usd), 0) AS total_saved
      FROM requests
      GROUP BY provider
      ORDER BY request_count DESC
    `);
    return stmt.all();
  }

  /**
   * 获取指定文件的扫描偏移量
   * @param {string} filePath - 文件路径
   * @returns {{ last_offset: number, last_modified: string|null }}
   */
  function getOffset(filePath) {
    const row = db.prepare('SELECT last_offset, last_modified FROM scanner_offsets WHERE file_path = ?').get(filePath);
    return row || { last_offset: 0, last_modified: null };
  }

  /**
   * 更新或插入指定文件的扫描偏移量
   * @param {string} filePath - 文件路径
   * @param {number} offset - 当前字节偏移量
   * @param {string} lastModified - 文件最后修改时间（ISO 字符串）
   */
  function setOffset(filePath, offset, lastModified) {
    db.prepare(`
      INSERT INTO scanner_offsets (file_path, last_offset, last_modified)
      VALUES (?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET last_offset = ?, last_modified = ?
    `).run(filePath, offset, lastModified, offset, lastModified);
  }

  /**
   * 检查指定 id 的请求记录是否已存在（用于去重）
   * @param {string} id - 请求 id
   * @returns {boolean}
   */
  function hasRequest(id) {
    const row = db.prepare('SELECT 1 FROM requests WHERE id = ?').get(id);
    return !!row;
  }

  /**
   * 关闭数据库连接
   */
  function close() {
    db.close();
  }

  return {
    insertRequest,
    getRequests,
    getSummary,
    getProviderStats,
    getOffset,
    setOffset,
    hasRequest,
    close,
  };
}
