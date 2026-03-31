/**
 * 终端状态面板渲染模块
 * 纯 ANSI 转义输出，无外部依赖
 */

import { getPeakStatus } from '../utils/peak.mjs';

// ── ANSI 颜色常量 ──
const C = {
  orange:  '\x1b[38;5;208m',
  green:   '\x1b[38;5;34m',
  red:     '\x1b[38;5;196m',
  yellow:  '\x1b[38;5;220m',
  gray:    '\x1b[38;5;240m',  // 边框/分隔线
  label:   '\x1b[38;5;245m',  // label 文字
  white:   '\x1b[38;5;252m',  // Tips 文字
  bold:    '\x1b[1m',
  reset:   '\x1b[0m',
};

const VERSION = '0.1.0';

// 面板总宽度（内容区域，不含边框字符本身的宽度占位）
const TOTAL_WIDTH = 50;
const LEFT_WIDTH = 22;
const RIGHT_WIDTH = TOTAL_WIDTH - LEFT_WIDTH - 1; // -1 给中间竖线

/**
 * 格式化美元金额
 * @param {number} value
 * @returns {string}
 */
function fmtUSD(value) {
  return `$${value.toFixed(2)}`;
}

/**
 * 用空格填充字符串到指定可见宽度（不计 ANSI 转义序列）
 * @param {string} str - 可能包含 ANSI 的字符串
 * @param {number} width - 目标可见宽度
 * @returns {string}
 */
function pad(str, width) {
  // 去除 ANSI 转义序列计算可见长度
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = width - visible.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

/**
 * 生成 Tips 列表（最多4条，按优先级排序）
 * @param {object} data - getStatusData() 返回值
 * @param {object} peak - getPeakStatus() 返回值
 * @returns {string[]}
 */
function generateTips(data, peak) {
  const tips = [];

  // 1. 高峰提醒（最高优先级）
  if (peak.status === 'peak') {
    tips.push('Anthropic 限速高峰期，建议降级模型');
  } else if (peak.status === 'warning') {
    tips.push('30 分钟内进入高峰时段');
  }

  // 2. 模型建议（Opus 用量高时） — 简化为花费提醒
  if (data.today_cost > 5) {
    tips.push('今日花费较高，可尝试 Sonnet 降本');
  }

  // 3. 月度趋势
  if (data.last_month_cost > 0) {
    const pct = ((data.month_cost - data.last_month_cost) / data.last_month_cost * 100).toFixed(0);
    if (data.month_cost > data.last_month_cost) {
      tips.push(`本月花费比上月多 ${pct}%`);
    } else if (data.month_cost < data.last_month_cost) {
      tips.push(`本月花费比上月少 ${Math.abs(pct)}%`);
    } else {
      tips.push('本月花费与上月持平');
    }
  }

  // 4. 硬编码占位
  tips.push('输入 pintoken help 查看更多');

  // 最多返回4条
  return tips.slice(0, 4);
}

/**
 * 根据高峰状态返回带颜色的状态指示器
 * @param {object} peak
 * @returns {string}
 */
function statusIndicator(peak) {
  switch (peak.status) {
    case 'peak':
      return `${C.red}●${C.reset} ${C.red}高峰${C.reset}`;
    case 'warning':
      return `${C.yellow}●${C.reset} ${C.yellow}即将高峰${C.reset}`;
    default:
      return `${C.green}●${C.reset} ${C.green}正常${C.reset}`;
  }
}

/**
 * 渲染终端状态面板
 * @param {object} data - store.getStatusData() 返回值
 */
export function renderStatusPanel(data) {
  const peak = getPeakStatus();
  const tips = generateTips(data, peak);

  const g = C.gray;   // 边框色快捷引用
  const r = C.reset;

  // ── 顶部标题栏 ──
  const titleText = ` PinToken v${VERSION} `;
  const titleLine = `${g}┌──${r}${C.orange}${C.bold}${titleText}${r}${g}${'─'.repeat(TOTAL_WIDTH - titleText.length - 2)}┐${r}`;

  // ── 品牌区 ──
  const brandLine1 = `${g}│${r}  ${C.orange}${C.bold}🪙 PinToken${r}${' '.repeat(TOTAL_WIDTH - 13)}${g}│${r}`;
  const brandLine2 = `${g}│${r}${C.label}     Pin your token. Save your dollar.${r}${' '.repeat(TOTAL_WIDTH - 38)}${g}│${r}`;
  const sepFull    = `${g}├${'─'.repeat(TOTAL_WIDTH)}┤${r}`;

  // ── 双栏分隔线 ──
  const sepDouble  = `${g}├${'─'.repeat(LEFT_WIDTH)}┬${'─'.repeat(RIGHT_WIDTH)}┤${r}`;
  const sepBottom  = `${g}└${'─'.repeat(LEFT_WIDTH)}┴${'─'.repeat(RIGHT_WIDTH)}┘${r}`;

  // ── 左栏数据行 ──
  const leftRows = [
    { label: 'Usage', value: '', isHeader: true },
    { label: '今日花费', value: `${C.orange}${fmtUSD(data.today_cost)}${r}` },
    { label: '累计节省', value: `${C.green}${fmtUSD(data.total_saved)}${r}` },
    { label: '本月花费', value: `${C.orange}${fmtUSD(data.month_cost)}${r}` },
    { label: '当前状态', value: statusIndicator(peak) },
  ];

  // ── 右栏 Tips 行 ──
  const rightRows = [
    { text: 'Tips', isHeader: true },
    ...tips.map(t => ({ text: t })),
  ];

  // 确保两栏行数一致（用空行补齐）
  const maxRows = Math.max(leftRows.length, rightRows.length);
  while (leftRows.length < maxRows) leftRows.push({ label: '', value: '' });
  while (rightRows.length < maxRows) rightRows.push({ text: '' });

  // ── 逐行渲染双栏 ──
  const contentLines = [];
  for (let i = 0; i < maxRows; i++) {
    const left = leftRows[i];
    const right = rightRows[i];

    // 左栏内容
    let leftStr;
    if (left.isHeader) {
      leftStr = `  ${C.label}${C.bold}${left.label}${r}`;
    } else if (left.label) {
      leftStr = `  ${C.label}${left.label}${r}    ${left.value}`;
    } else {
      leftStr = '';
    }

    // 右栏内容
    let rightStr;
    if (right.isHeader) {
      rightStr = `  ${C.label}${C.bold}${right.text}${r}`;
    } else if (right.text) {
      rightStr = `  ${C.orange}·${r} ${C.white}${right.text}${r}`;
    } else {
      rightStr = '';
    }

    const line = `${g}│${r}${pad(leftStr, LEFT_WIDTH)}${g}│${r}${pad(rightStr, RIGHT_WIDTH)}${g}│${r}`;
    contentLines.push(line);
  }

  // ── 组装输出 ──
  const output = [
    '',
    titleLine,
    sepFull,
    brandLine1,
    brandLine2,
    sepDouble,
    ...contentLines,
    sepBottom,
    '',
  ].join('\n');

  console.log(output);
}
