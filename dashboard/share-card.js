/**
 * PinToken 分享卡片 Canvas 渲染引擎
 * 横屏小卡片，纯 Canvas API，零依赖
 */

/**
 * 生成分享卡片（横屏 800×420）
 * @param {object} data
 * @returns {HTMLCanvasElement}
 */
function generateShareCard(data) {
  const W = 800, H = 420;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = '#1e2025';
  roundRect(ctx, 0, 0, W, H, 12);
  ctx.fill();

  // 顶部橙色装饰线
  ctx.fillStyle = '#FF6B35';
  ctx.fillRect(20, 0, W - 40, 2);

  // ===== 左侧区域（品牌 + 核心数字）=====
  const LEFT = 36, MID = 420;

  // 品牌
  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('PinToken', LEFT, 36);
  ctx.fillStyle = '#555';
  ctx.font = '10px monospace';
  ctx.fillText(data.month_label, LEFT + 120, 36);

  // Token 消耗（核心大数字）
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '11px monospace';
  ctx.fillText('TOTAL TOKENS CONSUMED', LEFT, 76);

  ctx.fillStyle = '#e8eaf0';
  ctx.font = 'bold 42px monospace';
  ctx.fillText(formatTokens(data.month_tokens), LEFT, 124);

  // 请求数
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '12px monospace';
  ctx.fillText(formatNum(data.month_requests) + ' requests', LEFT, 154);

  // 分隔线
  ctx.strokeStyle = '#2a2d35';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LEFT, 176);
  ctx.lineTo(MID - 30, 176);
  ctx.stroke();

  // 节省金额
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '11px monospace';
  ctx.fillText('SAVED VS API PRICING', LEFT, 206);

  ctx.fillStyle = '#27c93f';
  ctx.font = 'bold 36px monospace';
  ctx.fillText('$' + data.saved.toFixed(2), LEFT, 248);

  // 节省比例 badge
  const pctText = data.saved_pct.toFixed(0) + '% off';
  ctx.fillStyle = 'rgba(39, 201, 63, 0.15)';
  const badgeX = LEFT + ctx.measureText('$' + data.saved.toFixed(2)).width + 14;
  roundRect(ctx, badgeX, 224, ctx.measureText(pctText).width + 16, 24, 4);
  ctx.fill();
  ctx.fillStyle = '#27c93f';
  ctx.font = 'bold 12px monospace';
  // 先量一下宽度
  ctx.fillText(pctText, badgeX + 8, 241);

  // 对比条
  const barX = LEFT, barY = 270, barW = MID - LEFT - 40, barH = 6;
  ctx.fillStyle = '#2a2d35';
  roundRect(ctx, barX, barY, barW, barH, 3);
  ctx.fill();
  ctx.fillStyle = '#27c93f';
  roundRect(ctx, barX, barY, Math.min(data.saved_pct / 100, 1) * barW, barH, 3);
  ctx.fill();

  ctx.fillStyle = '#555';
  ctx.font = '10px monospace';
  ctx.fillText('Max $' + data.subscription_cost, barX, barY + 18);
  ctx.textAlign = 'right';
  ctx.fillText('API $' + data.month_cost.toFixed(0), barX + barW, barY + 18);
  ctx.textAlign = 'left';

  // ===== 右侧区域（统计卡片）=====
  const RIGHT = MID + 10;
  const CARD_W = W - RIGHT - 30;

  // 竖分隔线
  ctx.strokeStyle = '#2a2d35';
  ctx.beginPath();
  ctx.moveTo(MID - 10, 24);
  ctx.lineTo(MID - 10, H - 50);
  ctx.stroke();

  // 最常用模型
  ctx.fillStyle = '#8b8fa8';
  ctx.font = '10px monospace';
  ctx.fillText('TOP MODEL', RIGHT, 76);
  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(data.top_model || 'unknown', RIGHT, 98);

  // 三个统计块
  const stats = [
    { label: 'API 等值花费', value: '$' + data.month_cost.toFixed(2), color: '#FF6B35' },
    { label: '订阅月费', value: '$' + data.subscription_cost, color: '#e8eaf0' },
    { label: '本月请求', value: formatNum(data.month_requests) + ' 次', color: '#e8eaf0' },
  ];

  stats.forEach((s, i) => {
    const sy = 136 + i * 56;
    ctx.fillStyle = '#1a1c20';
    roundRect(ctx, RIGHT, sy, CARD_W, 44, 6);
    ctx.fill();
    ctx.strokeStyle = '#2a2d35';
    ctx.stroke();

    ctx.fillStyle = '#8b8fa8';
    ctx.font = '10px monospace';
    ctx.fillText(s.label, RIGHT + 12, sy + 17);
    ctx.fillStyle = s.color;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(s.value, RIGHT + 12, sy + 35);
  });

  // ===== 底部 =====
  ctx.strokeStyle = '#2a2d35';
  ctx.beginPath();
  ctx.moveTo(20, H - 44);
  ctx.lineTo(W - 20, H - 44);
  ctx.stroke();

  ctx.fillStyle = '#555';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('pintoken.io', LEFT, H - 18);

  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('#PinToken', W - 36, H - 18);

  ctx.textAlign = 'left';
  return canvas;
}

/** 圆角矩形路径 */
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

/** 格式化数字 */
function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/** 格式化 Token 数 */
function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

window.generateShareCard = generateShareCard;
