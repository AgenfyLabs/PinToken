/**
 * 高峰时段判断逻辑（共享模块）
 * Anthropic 高峰：北京时间 21:00–03:00（硬编码，PRD 要求）
 */

/**
 * 判断当前高峰时段状态
 * @returns {{ status: 'normal'|'warning'|'peak', label: string, tip: string }}
 */
export function getPeakStatus() {
  const now = new Date();
  // 转换为北京时间小时（UTC+8）
  const bjHour = (now.getUTCHours() + 8) % 24;
  const bjMinute = now.getUTCMinutes();

  // 高峰：21:00–03:00 北京时间
  const isPeak = bjHour >= 21 || bjHour < 3;
  // 预警：20:30–21:00 北京时间
  const isWarning = bjHour === 20 && bjMinute >= 30;

  if (isPeak) {
    return {
      status: 'peak',
      label: '高峰',
      tip: 'Anthropic 当前处于限速高峰期，建议延后或降级模型',
    };
  }
  if (isWarning) {
    return {
      status: 'warning',
      label: '即将高峰',
      tip: '30 分钟内进入 Anthropic 高峰时段',
    };
  }
  return {
    status: 'normal',
    label: '正常',
    tip: '',
  };
}
