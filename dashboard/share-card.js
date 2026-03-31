/**
 * PinToken 分享卡片 Canvas 渲染引擎
 * 终端面板风格（对标 PRD 4.3 Terminal Status Panel）
 */

function generateShareCard(data) {
  const W = 720, H = 400;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const FONT = '14px monospace';
  const FONT_SM = '12px monospace';
  const FONT_BOLD = 'bold 14px monospace';
  const FONT_LG = 'bold 20px monospace';
  const FONT_XL = 'bold 28px monospace';

  const BG = '#1e2025';
  const BORDER = '#2a2d35';
  const ORANGE = '#FF6B35';
  const GREEN = '#27c93f';
  const WHITE = '#e8eaf0';
  const GRAY = '#8b8fa8';
  const DIM = '#555';

  const PAD = 20;        // 外边距
  const LN = 18;         // 行高

  // 辅助：绘制边框字符风格的线
  function hLine(y, left, right) {
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  function vLine(x, top, bottom) {
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // ===== 背景 =====
  ctx.fillStyle = '#13151a';
  ctx.fillRect(0, 0, W, H);

  // 主面板背景
  ctx.fillStyle = BG;
  roundRect(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, 4);
  ctx.fill();

  // 面板边框（橙色）
  ctx.strokeStyle = ORANGE;
  ctx.lineWidth = 1;
  roundRect(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, 4);
  ctx.stroke();

  const L = PAD + 16;       // 文字左边距
  const R = W - PAD - 16;   // 文字右边距
  let y = PAD + 12;

  // ===== 顶部版本栏 =====
  ctx.fillStyle = ORANGE;
  ctx.font = FONT_BOLD;
  ctx.fillText('── PinToken v0.1.0 ' + '─'.repeat(30), L, y += LN);

  // 橙色分隔线
  hLine(y + 8, PAD, W - PAD);
  y += 16;

  // 品牌区
  ctx.fillStyle = ORANGE;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('PinToken', L + 4, y += LN + 4);

  ctx.fillStyle = GRAY;
  ctx.font = FONT_SM;
  ctx.fillText('Pin your token. Save your dollar.', L + 4, y += LN);

  ctx.fillStyle = DIM;
  ctx.font = '11px monospace';
  ctx.fillText(data.top_model + ' · ' + data.month_label, L + 4, y += LN);

  // 分隔线 + 两栏标签
  hLine(y + 10, PAD, W - PAD);
  y += 10;

  const MID = W / 2;
  vLine(MID, y, H - PAD - 40);

  y += LN + 2;

  // ===== 左栏：Usage =====
  ctx.fillStyle = ORANGE;
  ctx.font = FONT_BOLD;
  ctx.fillText('Usage', L, y);

  // 右栏标题
  ctx.fillText('Stats', MID + 16, y);

  y += LN + 6;

  // 左栏数据行
  function leftRow(label, value, valueColor) {
    ctx.fillStyle = DIM;
    ctx.font = FONT_SM;
    ctx.fillText(label, L, y);
    ctx.fillStyle = valueColor;
    ctx.font = FONT_BOLD;
    ctx.textAlign = 'right';
    ctx.fillText(value, MID - 16, y);
    ctx.textAlign = 'left';
    y += LN + 4;
  }

  leftRow('消耗 Token', formatTokens(data.month_tokens), WHITE);
  leftRow('本月花费', '$' + data.month_cost.toFixed(2), ORANGE);
  leftRow('订阅省了', '$' + data.saved.toFixed(2), GREEN);
  leftRow('省了比例', '↑ ' + data.saved_pct.toFixed(0) + '%', GREEN);
  leftRow('处理请求', formatNum(data.month_requests) + ' 次', WHITE);

  // ===== 右栏：Stats =====
  let ry = y - (LN + 4) * 5; // 回到右栏起始行

  function rightRow(label, value, valueColor) {
    ctx.fillStyle = DIM;
    ctx.font = FONT_SM;
    ctx.fillText(label, MID + 16, ry);
    ctx.fillStyle = valueColor;
    ctx.font = FONT_BOLD;
    ctx.textAlign = 'right';
    ctx.fillText(value, R, ry);
    ctx.textAlign = 'left';
    ry += LN + 4;
  }

  rightRow('Max 订阅月费', '$' + data.subscription_cost, WHITE);
  rightRow('API 等值', '$' + data.month_cost.toFixed(0), ORANGE);
  rightRow('最常用模型', data.top_model || '—', ORANGE);
  rightRow('当前状态', '● 正常', GREEN);

  // Tips 行
  ry += 4;
  ctx.fillStyle = ORANGE;
  ctx.font = FONT_SM;
  ctx.fillText('·', MID + 16, ry);
  ctx.fillStyle = GRAY;
  ctx.fillText(' 比按 API 计费省了 ' + data.saved_pct.toFixed(0) + '%', MID + 24, ry);

  // ===== 底部 =====
  hLine(H - PAD - 36, PAD, W - PAD);

  ctx.fillStyle = DIM;
  ctx.font = '11px monospace';
  ctx.fillText('Track your AI spending → PinToken.ai', L, H - PAD - 14);

  ctx.fillStyle = ORANGE;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('#PinToken', R, H - PAD - 14);
  ctx.textAlign = 'left';

  return canvas;
}

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

function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

window.generateShareCard = generateShareCard;
