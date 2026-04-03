/**
 * PinToken 分享卡片 — 终端面板风格 Canvas 渲染引擎
 * 宽度固定 1080，高度自适应内容
 * 依赖 share-card-skins.js 提供 SHARE_SKINS 配置
 *
 * API: window.generateShareCard(data, skinName) → <canvas>
 */

/* ============================================================
 *  工具函数
 * ============================================================ */

function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function fmtMoney(n) {
  return '$' + (n || 0).toFixed(2);
}

function hexRgba(hex, a) {
  if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function getSkinKey(skin) {
  for (var k in window.SHARE_SKINS || {}) {
    if (window.SHARE_SKINS[k] === skin) return k;
  }
  return '';
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function shortModelName(name) {
  return name
    .replace(/^claude-/, '').replace(/^gpt-/, '')
    .replace(/-\d{8}$/, '').replace(/-\d+[km]?$/, '')
    .split('-').map(function(s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join(' ');
}

/* ============================================================
 *  背景绘制
 * ============================================================ */

function drawBg(ctx, skin, W, H) {
  var key = getSkinKey(skin);

  ctx.fillStyle = skin.bg.color;
  ctx.fillRect(0, 0, W, H);

  // 热敏纸噪点
  if (skin.features.paperNoise) {
    ctx.save();
    for (var i = 0; i < 5000; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.025) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.restore();
  }

  // 碳纤维纹理
  if (skin.features.carbonTexture) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 0.5;
    for (var d = -H; d < W + H; d += 6) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke();
    }
    ctx.restore();
  }

  // CRT 扫描线
  if (skin.features.scanlines) {
    ctx.save();
    for (var sy = 0; sy < H; sy += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, sy, W, 1);
    }
    ctx.restore();
  }

  // 霓虹光斑
  if (key === 'neon') {
    ctx.save();
    var g1 = ctx.createRadialGradient(W * 0.3, H * 0.35, 0, W * 0.3, H * 0.35, 350);
    g1.addColorStop(0, 'rgba(255,107,53,0.12)');
    g1.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    var g2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, 200);
    g2.addColorStop(0, 'rgba(39,201,63,0.07)');
    g2.addColorStop(1, 'rgba(39,201,63,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // CRT 中心光晕
  if (skin.features.crtGlow) {
    ctx.save();
    var cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.55);
    cg.addColorStop(0, 'rgba(51,255,51,0.035)');
    cg.addColorStop(1, 'rgba(51,255,51,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/* ============================================================
 *  装饰函数
 * ============================================================ */

/** 热敏纸锯齿边 */
function drawTearEdge(ctx, y, PAD, W, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  for (var tx = PAD; tx < W - PAD; tx += 10) {
    ctx.lineTo(tx + 5, y - 6);
    ctx.lineTo(tx + 10, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** 霓虹发光文字 */
function drawGlow(ctx, text, x, y, color, blur) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur || 30;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = (blur || 30) * 0.35;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/* ============================================================
 *  主渲染函数
 * ============================================================ */

function generateShareCard(data, skinName) {
  skinName = skinName || 'thermal';
  var skin = (window.SHARE_SKINS || {})[skinName];
  if (!skin) return document.createElement('canvas');

  var W = 1080;
  var SCALE = 2;
  var ft = skin.features;
  var c = skin.colors;
  var PAD = 56;
  var RIGHT = W - PAD;
  var ff = skin.font;

  // 字体快捷方式
  function fp(sz, wt) { return (wt || 'normal') + ' ' + sz + 'px ' + ff.primary; }
  function fd(sz, wt) { return (wt || ff.weight || 'bold') + ' ' + sz + 'px ' + ff.display; }

  var isNeon = skinName === 'neon';
  var isRetro = skinName === 'retro';

  // 预计算高度
  var ROW_H = 44;
  var ROWS = 5;
  // 品牌区(56) + 分隔(2) + 栏标题(32) + 数据行(5×44=220) + 底栏(48) + 边距(上40+下40)
  var H = 40 + 56 + 2 + 32 + (ROWS * ROW_H) + 16 + 48 + 40;
  if (ft.tearEdge) H += 20;

  var canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  /* ========== 背景 ========== */
  drawBg(ctx, skin, W, H);

  /* ========== 锯齿上边（thermal） ========== */
  if (ft.tearEdge) drawTearEdge(ctx, 36, PAD, W, c.line);

  var y = ft.tearEdge ? 50 : 40;

  /* ==========================================================
   *  品牌栏：一行搞定 — PinToken · Slogan · 月份
   * ========================================================== */

  // 左：品牌名
  ctx.textAlign = 'left';
  ctx.font = fd(22);
  ctx.fillStyle = c.brand;
  if (isNeon) {
    drawGlow(ctx, 'PinToken', PAD, y + 22, c.glow, 20);
  } else {
    ctx.fillText('PinToken', PAD, y + 22);
  }

  // 中：Slogan（紧跟品牌名）
  var brandW = ctx.measureText('PinToken').width;
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  ctx.fillText('Pin your token. Save your dollar.', PAD + brandW + 16, y + 22);

  // 右：月份 + 模型
  ctx.textAlign = 'right';
  ctx.font = fp(14);
  ctx.fillStyle = c.textDim;
  var topModel = (data.top_models && data.top_models[0]) ? shortModelName(data.top_models[0].name) : '';
  var rightMeta = (data.month_label_en || data.month_label || '');
  if (topModel) rightMeta = topModel + '  ·  ' + rightMeta;
  ctx.fillText(rightMeta, RIGHT, y + 22);
  ctx.textAlign = 'left';

  /* ── 品牌色分隔线 ── */
  y += 42;
  ctx.strokeStyle = c.brand;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();

  /* ==========================================================
   *  两栏区域
   * ========================================================== */
  var colTop = y;
  // 左栏 55%，右栏 45%
  var MID = PAD + Math.round((RIGHT - PAD) * 0.55);

  // 垂直分隔线
  var colBottom = y + 32 + ROWS * ROW_H + 8;
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MID, colTop);
  ctx.lineTo(MID, colBottom);
  ctx.stroke();

  /* ── 栏标题 ── */
  y += 26;
  ctx.font = fd(14);
  ctx.fillStyle = c.brand;
  if (isNeon) {
    drawGlow(ctx, 'Usage', PAD + 4, y, c.glow, 8);
    drawGlow(ctx, 'Tips', MID + 16, y, c.glow, 8);
  } else {
    ctx.fillText(isRetro ? '> Usage' : 'Usage', PAD + 4, y);
    ctx.fillText(isRetro ? '> Tips' : 'Tips', MID + 16, y);
  }

  /* ==========================================================
   *  左栏：Usage 数据
   *  标签 14px dim + 数值 24px bold highlight，大小对比 = 冲击力
   * ========================================================== */
  var rowY = y + 32;
  var LX = PAD + 4;
  var LVX = MID - 14;

  function row(label, value, valColor) {
    // 标签（左对齐，dim）
    ctx.font = fp(14);
    ctx.fillStyle = c.textDim;
    ctx.textAlign = 'left';
    ctx.fillText(label, LX, rowY);

    // 数值（右对齐，大号 bold）
    ctx.font = fd(22);
    ctx.fillStyle = valColor || c.highlight;
    ctx.textAlign = 'right';
    if (isNeon) {
      drawGlow(ctx, value, LVX, rowY, c.glow, 10);
    } else {
      ctx.fillText(value, LVX, rowY);
    }
    ctx.textAlign = 'left';
    rowY += ROW_H;
  }

  row('今日消耗', fmtTokens(data.today_output_tokens || 0), c.highlight);
  row('本月累计', fmtTokens(data.month_tokens || 0), c.highlight);
  row('API 花费', fmtMoney(data.month_cost), c.brand);
  row('追踪天数', String(data.tracking_days || 0) + ' 天', c.text);

  // 状态行特殊处理：绿点 + 文字
  ctx.font = fp(14);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('当前状态', LX, rowY);
  ctx.font = fd(22);
  ctx.fillStyle = c.accent;
  ctx.textAlign = 'right';
  var statusText = '● 正常';
  if (isNeon) {
    drawGlow(ctx, statusText, LVX, rowY, '#27c93f', 10);
  } else {
    ctx.fillText(statusText, LVX, rowY);
  }
  ctx.textAlign = 'left';

  /* ==========================================================
   *  右栏：Tips（动态生成，3-4 条）
   * ========================================================== */
  var tipY = y + 32;
  var tipX = MID + 16;
  var tipH = ROW_H;

  var tips = [];
  if (data.top_models && data.top_models[0]) {
    tips.push(shortModelName(data.top_models[0].name) + ' 占比 ' + data.top_models[0].pct + '%');
  }
  var activeDays = (data.daily_activity || []).filter(function(d) { return d.tokens > 0; }).length;
  if (activeDays > 0) tips.push('本月已活跃 ' + activeDays + ' 天');
  if (data.month_cost > 100) {
    tips.push('已超过 Max 订阅月费');
  } else if (data.month_cost > 0) {
    tips.push('花费 ' + fmtMoney(data.month_cost));
  }
  if (data.provider_count > 1) tips.push(data.provider_count + ' 个 Provider');
  if (tips.length < 3) tips.push('pintoken.ai');

  for (var ti = 0; ti < Math.min(tips.length, ROWS); ti++) {
    // 橙色前缀点
    ctx.font = fd(14);
    ctx.fillStyle = c.brand;
    if (isNeon) {
      drawGlow(ctx, '·', tipX, tipY, c.glow, 4);
    } else {
      ctx.fillText('·', tipX, tipY);
    }
    // Tip 文字
    ctx.font = fp(14);
    ctx.fillStyle = c.text;
    ctx.fillText(tips[ti], tipX + 14, tipY);
    tipY += tipH;
  }

  /* ==========================================================
   *  底栏
   * ========================================================== */
  // 底部水平线
  y = colBottom;
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();

  y += 28;

  // 左：域名
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  var footText = isRetro ? '❯ pintoken.ai' : 'Track your AI spending → pintoken.ai';
  if (isNeon) {
    drawGlow(ctx, footText, PAD, y, c.glow, 6);
  } else {
    ctx.fillText(footText, PAD, y);
  }

  // 右：#PinToken
  ctx.font = fd(15);
  ctx.fillStyle = c.brand;
  ctx.textAlign = 'right';
  if (isNeon) {
    drawGlow(ctx, '#PinToken', RIGHT, y, c.glow, 10);
  } else {
    ctx.fillText('#PinToken', RIGHT, y);
  }
  ctx.textAlign = 'left';

  /* ── 锯齿下边（thermal） ── */
  if (ft.tearEdge) drawTearEdge(ctx, H - 30, PAD, W, c.line);

  return canvas;
}

/* ============================================================
 *  导出
 * ============================================================ */
window.generateShareCard = generateShareCard;
