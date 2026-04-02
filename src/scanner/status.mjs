/**
 * 扫描器状态追踪模块
 * 维护内存中的扫描进度状态，供 /api/scan-status 端点使用
 */

// 扫描状态：phase 可能是 'recent' | 'backfill' | 'idle'
const state = {
  scanning: false,
  recordsFound: 0,
  filesScanned: 0,
  totalFiles: 0,
  phase: 'idle',
  proxyActive: false,
};

/**
 * 获取当前扫描状态的快照
 * @returns {object} 扫描状态对象
 */
export function getScanStatus() {
  return { ...state };
}

/**
 * 更新扫描状态
 * @param {object} updates - 要更新的字段
 */
export function updateScanStatus(updates) {
  Object.assign(state, updates);
}

/**
 * 标记扫描开始
 * @param {number} totalFiles - 总文件数
 */
export function markScanStart(totalFiles) {
  state.scanning = true;
  state.totalFiles = totalFiles;
  state.filesScanned = 0;
  state.phase = 'recent';
}

/**
 * 标记一个文件扫描完成
 * @param {number} newRecords - 本文件新增的记录数
 */
export function markFileScanned(newRecords) {
  state.filesScanned++;
  state.recordsFound += newRecords;
}

/**
 * 标记扫描完成，进入空闲状态
 */
export function markScanComplete() {
  state.scanning = false;
  state.filesScanned = state.totalFiles;
  state.phase = 'idle';
}

/**
 * 设置代理模式是否激活
 * @param {boolean} active
 */
export function setProxyActive(active) {
  state.proxyActive = active;
}
