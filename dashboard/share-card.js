/**
 * PinToken 分享卡片 Canvas 渲染引擎
 * 纯 Canvas API，零依赖
 * 数据由外部传入，渲染函数不做任何 fetch
 * 返回 canvas 元素，调用方可以 toDataURL() 或 toBlob()
 */

/**
 * 生成分享卡片
 * @param {object} data - 卡片数据
 * @param {number} data.month_cost - 本月 API 等值花费
 * @param {number} data.subscription_cost - 订阅月费
 * @param {number} data.saved - 节省金额
 * @param {number} data.saved_pct - 节省百分比 (0-100)
 * @param {number} data.month_requests - 本月请求数
 * @param {number} data.month_tokens - 本月 token 总数
 * @param {string} data.top_model - 最常用模型名
 * @param {string} data.month_label - 月份标签如 "2026-03"
 * @returns {HTMLCanvasElement}
 */
function generateShareCard(data) {
  const W = 600, H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 绘制卡片背景（圆角矩形）
  ctx.fillStyle = '#1e2025';
  roundRect(ctx, 0, 0, W, H, 16);
  ctx.fill();

  // 顶部橙色装饰线
  ctx.fillStyle = '#FF6B35';
  ctx.fillRect(24, 0, W - 48, 3);

  // Logo + 品牌名
  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('\u{1FA99} PinToken', 40, 60);

  // 品牌 Slogan
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '13px monospace';
  ctx.fillText('Pin your token. Save your dollar.', 40, 88);

  // 第一条分隔线
  ctx.strokeStyle = '#2a2d35';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 110);
  ctx.lineTo(W - 40, 110);
  ctx.stroke();

  // 「本月订阅帮你省了」标签
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('本月订阅帮你省了', W / 2, 160);

  // 核心大数字：节省金额
  ctx.fillStyle = '#27c93f';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('$' + data.saved.toFixed(2), W / 2, 240);

  // 节省比例说明
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '13px monospace';
  ctx.fillText('相比按 API 计费省了 ' + data.saved_pct.toFixed(0) + '%', W / 2, 275);

  // 进度条背景
  const barX = 60, barY = 300, barW = W - 120, barH = 12;
  ctx.fillStyle = '#2a2d35';
  roundRect(ctx, barX, barY, barW, barH, 6);
  ctx.fill();

  // 进度条填充（按节省比例）
  const fillW = Math.min(data.saved_pct / 100, 1) * barW;
  ctx.fillStyle = '#27c93f';
  roundRect(ctx, barX, barY, fillW, barH, 6);
  ctx.fill();

  // 进度条左侧标签：订阅费
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('Max $' + data.subscription_cost, barX, barY + 30);

  // 进度条右侧标签：API 等值花费
  ctx.textAlign = 'right';
  ctx.fillText('API $' + data.month_cost.toFixed(0), barX + barW, barY + 30);

  // 第二条分隔线
  ctx.strokeStyle = '#2a2d35';
  ctx.beginPath();
  ctx.moveTo(40, 370);
  ctx.lineTo(W - 40, 370);
  ctx.stroke();

  // 统计数据 — 左列：请求数
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8eaf0';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(formatNum(data.month_requests), W / 4, 420);
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '12px monospace';
  ctx.fillText('次请求', W / 4, 445);

  // 统计数据 — 右列：Token 量
  ctx.fillStyle = '#e8eaf0';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(formatTokens(data.month_tokens), W * 3 / 4, 420);
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '12px monospace';
  ctx.fillText('Tokens', W * 3 / 4, 445);

  // 第三条分隔线
  ctx.strokeStyle = '#2a2d35';
  ctx.beginPath();
  ctx.moveTo(40, 475);
  ctx.lineTo(W - 40, 475);
  ctx.stroke();

  // 模型洞察标签
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '13px monospace';
  ctx.fillText('最常用模型', W / 2, 515);

  // 模型名称（品牌橙高亮）
  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(data.top_model || 'unknown', W / 2, 545);

  // 月份标签
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '12px monospace';
  ctx.fillText(data.month_label + ' 数据', W / 2, 580);

  // 底部分隔线
  ctx.strokeStyle = '#2a2d35';
  ctx.beginPath();
  ctx.moveTo(40, 700);
  ctx.lineTo(W - 40, 700);
  ctx.stroke();

  // 底部 CTA 链接
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Track your AI spending → pintoken.io', W / 2, 740);

  // 底部品牌 hashtag
  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('#PinToken', W / 2, 770);

  // 重置文本对齐，避免影响后续绘制
  ctx.textAlign = 'left';

  return canvas;
}

/**
 * 辅助函数：绘制圆角矩形路径
 * @param {CanvasRenderingContext2D} ctx - Canvas 上下文
 * @param {number} x - 左上角 x
 * @param {number} y - 左上角 y
 * @param {number} w - 宽度
 * @param {number} h - 高度
 * @param {number} r - 圆角半径
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * 辅助函数：格式化数字（千/百万缩写）
 * @param {number} n - 原始数字
 * @returns {string} 格式化后的字符串
 */
function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/**
 * 辅助函数：格式化 token 数量（十亿/百万/千缩写）
 * @param {number} n - 原始 token 数
 * @returns {string} 格式化后的字符串
 */
function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// 挂载到 window，供 Dashboard 页面直接调用
window.generateShareCard = generateShareCard;
