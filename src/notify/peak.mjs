/**
 * 高峰时段 macOS 系统通知模块
 * 通过 osascript 推送原生通知，非 macOS 平台静默跳过
 * 零依赖，仅使用 Node.js 内置 child_process
 */

import { execSync } from 'node:child_process';
import { getPeakStatus } from '../utils/peak.mjs';

// 检查间隔：5 分钟
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * 通知消息映射
 * 根据状态转换方向决定通知内容
 */
const NOTIFICATIONS = {
  // normal → warning
  warning: {
    subtitle: '即将进入高峰',
    message: '30 分钟内进入 Anthropic 高峰时段，建议提前完成重要请求',
  },
  // normal/warning → peak
  peak: {
    subtitle: '高峰时段',
    message: '当前处于 Anthropic 限速高峰，响应可能变慢',
  },
  // peak → normal
  normal: {
    subtitle: '高峰结束',
    message: '高峰时段已结束，恢复正常',
  },
};

/**
 * 发送 macOS 原生通知
 * 非 macOS 平台或执行失败时静默跳过，不阻塞服务
 * @param {string} subtitle - 通知副标题
 * @param {string} message - 通知正文
 */
function sendNotification(subtitle, message) {
  try {
    execSync(
      `osascript -e 'display notification "${message}" with title "PinToken" subtitle "${subtitle}"'`,
      { timeout: 5000 }
    );
  } catch {
    // 非 macOS 或 osascript 不可用时静默忽略
  }
}

/**
 * 启动高峰时段通知轮询
 * - 记录上一次状态（闭包变量），状态变化时才推送通知
 * - 每 5 分钟检查一次
 * - 首次调用立即检查（但不发通知，仅记录初始状态）
 * @returns {NodeJS.Timeout} timer 引用，方便外部清理（clearInterval）
 */
export function startPeakNotifier() {
  // 闭包变量：记录上一次状态，避免重复通知
  let lastStatus = getPeakStatus().status;

  const timer = setInterval(() => {
    const current = getPeakStatus();

    // 状态未变化，跳过
    if (current.status === lastStatus) return;

    const prev = lastStatus;
    lastStatus = current.status;

    // 根据状态转换方向决定通知内容
    // normal → warning: 预警通知
    if (prev === 'normal' && current.status === 'warning') {
      const n = NOTIFICATIONS.warning;
      sendNotification(n.subtitle, n.message);
      return;
    }

    // normal/warning → peak: 高峰通知
    if (current.status === 'peak') {
      const n = NOTIFICATIONS.peak;
      sendNotification(n.subtitle, n.message);
      return;
    }

    // peak → normal: 高峰结束通知
    if (prev === 'peak' && current.status === 'normal') {
      const n = NOTIFICATIONS.normal;
      sendNotification(n.subtitle, n.message);
      return;
    }
  }, CHECK_INTERVAL_MS);

  // 不阻止进程退出
  if (timer.unref) timer.unref();

  return timer;
}
