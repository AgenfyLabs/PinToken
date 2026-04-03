/**
 * PinToken 分享卡片 — 深色模块化卡片布局
 * 参考 Virtus Task Manager 设计风格：深色圆角卡片嵌套、大号数字、橙色 accent
 * 宽度 1080，高度自适应。Retina 2x。
 *
 * API: window.generateShareCard(data, skinName) → <canvas>
 */

/* ============================================================
 *  工具函数
 * ============================================================ */

function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1);
  if (n >= 1e6) return (n / 1e6).toFixed(1);
  if (n >= 1e3) return (n / 1e3).toFixed(1);
  return String(n);
}

function fmtTokenUnit(n) {
  if (n >= 1e9) return 'B';
  if (n >= 1e6) return 'M';
  if (n >= 1e3) return 'K';
  return '';
}

function fmtMoney(n) { return '$' + (n || 0).toFixed(0); }

function hexRgba(hex, a) {
  if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function shortModel(name) {
  return name
    .replace(/^claude-/, '').replace(/^gpt-/, '')
    .replace(/-\d{8}$/, '').replace(/-\d+[km]?$/, '')
    .split('-').map(function(s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join(' ');
}

function rr(ctx, x, y, w, h, r) {
  if (r > h / 2) r = h / 2;
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

/** 估算用量排名百分位（基于月 token 消耗量） */
function estimateRank(monthTokens) {
  // 基于 Claude Code 用户月消耗分布估算
  // 大多数用户 < 50M tokens/月，重度用户 100-500M，极限用户 500M+
  if (monthTokens >= 500e6) return 99;
  if (monthTokens >= 200e6) return 95;
  if (monthTokens >= 100e6) return 90;
  if (monthTokens >= 50e6) return 80;
  if (monthTokens >= 20e6) return 65;
  if (monthTokens >= 10e6) return 50;
  if (monthTokens >= 5e6) return 35;
  return 20;
}

/** 生成 PRD 规定的 Tips（按优先级排序，最多 4 条） */
function generateTips(data) {
  var tips = [];

  // 优先级 1: 高峰提醒
  var hour = new Date().getHours();
  // 北京时间 21:00-03:00 = UTC 13:00-19:00
  if (hour >= 13 && hour <= 19) {
    tips.push('当前处于高峰时段，注意限速');
  } else if (hour >= 11 && hour < 13) {
    tips.push('即将进入高峰，建议提前完成任务');
  }

  // 优先级 2: 模型降级建议
  if (data.top_models && data.top_models[0]) {
    var topPct = data.top_models[0].pct;
    var topName = shortModel(data.top_models[0].name);
    if (topPct > 80 && topName.toLowerCase().indexOf('opus') >= 0) {
      tips.push('简单任务可降级用 Sonnet 省额度');
    }
  }

  // 优先级 3: 用量排名
  var rank = estimateRank(data.month_tokens || 0);
  if (rank >= 50) {
    tips.push('你的用量超过了 ' + rank + '% 的开发者');
  }

  // 优先级 4: 月度趋势 / 活跃天数
  var activeDays = (data.daily_activity || []).filter(function(d) { return d.tokens > 0; }).length;
  if (activeDays > 0) {
    tips.push('本月已活跃 ' + activeDays + ' 天');
  }

  // 补充：Provider 数量
  if (tips.length < 4 && data.provider_count > 1) {
    tips.push('使用了 ' + data.provider_count + ' 个 Provider');
  }

  return tips.slice(0, 4);
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
  var c = skin.colors;
  var ft = skin.features || {};
  var ff = skin.font;
  var isNeon = skinName === 'neon';
  var isRetro = skinName === 'retro';
  var isMinimal = skinName === 'minimal';
  var isThermal = skinName === 'thermal';
  var isCarbon = skinName === 'carbon';

  // 字体快捷
  function fp(sz, wt) { return (wt || 'normal') + ' ' + sz + 'px ' + ff.primary; }
  function fd(sz, wt) { return (wt || ff.weight || 'bold') + ' ' + sz + 'px ' + ff.display; }

  // 颜色
  var BG = skin.bg.color;
  var CARD = c.cardBg || hexRgba(c.text, 0.04);
  var BORDER = c.line;
  var ACCENT = c.brand;
  var TEXT = c.text;
  var DIM = c.textDim;
  var HIGHLIGHT = c.highlight;

  // 布局参数
  var PAD = 40;
  var GAP = 16;
  var RIGHT = W - PAD;
  var CW = W - PAD * 2; // 内容总宽

  // 预计算高度
  // 品牌栏(60) + gap + 顶部两卡片行(160) + gap + 中间两栏(200) + gap + 底栏(48)
  var H = PAD + 52 + GAP + 160 + GAP + 210 + GAP + 44 + PAD;

  var canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  /* ========== 背景 ========== */
  // 底色
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // 皮肤专属背景效果
  if (ft.paperNoise) {
    for (var i = 0; i < 4000; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.02) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
  }
  if (ft.carbonTexture) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 0.5;
    for (var d = -H; d < W + H; d += 6) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke();
    }
    ctx.restore();
  }
  if (ft.scanlines) {
    for (var sy = 0; sy < H; sy += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, sy, W, 1);
    }
  }
  if (isNeon) {
    ctx.save();
    var g1 = ctx.createRadialGradient(W * 0.25, H * 0.3, 0, W * 0.25, H * 0.3, 350);
    g1.addColorStop(0, 'rgba(255,107,53,0.08)');
    g1.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    var g2 = ctx.createRadialGradient(W * 0.8, H * 0.7, 0, W * 0.8, H * 0.7, 200);
    g2.addColorStop(0, 'rgba(39,201,63,0.05)');
    g2.addColorStop(1, 'rgba(39,201,63,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (ft.crtGlow) {
    ctx.save();
    var cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5);
    cg.addColorStop(0, 'rgba(51,255,51,0.03)');
    cg.addColorStop(1, 'rgba(51,255,51,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /** 绘制霓虹发光文字 */
  function glow(text, x, y, color, blur) {
    if (!isNeon) { ctx.fillText(text, x, y); return; }
    ctx.save();
    ctx.shadowColor = color || ACCENT;
    ctx.shadowBlur = blur || 20;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = (blur || 20) * 0.3;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** 绘制内嵌卡片（圆角矩形 + 描边） */
  function card(x, y, w, h, radius) {
    radius = radius || 16;
    ctx.fillStyle = CARD;
    rr(ctx, x, y, w, h, radius);
    ctx.fill();
    if (!isMinimal) {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      rr(ctx, x, y, w, h, radius);
      ctx.stroke();
    }
  }

  var y = PAD;

  /* ==========================================================
   *  品牌栏
   * ========================================================== */
  // 左：PinToken
  ctx.textAlign = 'left';
  ctx.font = fd(24);
  ctx.fillStyle = ACCENT;
  glow('PinToken', PAD, y + 28, ACCENT, 18);

  // 中：Slogan
  var bw = ctx.measureText('PinToken').width;
  ctx.font = fp(13);
  ctx.fillStyle = DIM;
  ctx.fillText('Pin your token. Save your dollar.', PAD + bw + 14, y + 28);

  // 右：月份
  ctx.textAlign = 'right';
  ctx.font = fp(14);
  ctx.fillStyle = DIM;
  ctx.fillText(data.month_label_en || data.month_label || '', RIGHT, y + 28);
  ctx.textAlign = 'left';

  // 品牌色细线
  y += 44;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();

  y += GAP;

  /* ==========================================================
   *  第一行：三张数据卡片（今日消耗 / 用量排名 / 本月累计）
   * ========================================================== */
  var row1H = 160;
  var c1W = Math.floor(CW * 0.38); // 今日消耗（较宽）
  var c2W = Math.floor(CW * 0.24); // 用量排名
  var c3W = CW - c1W - c2W - GAP * 2; // 本月累计

  // 卡片 1: 今日消耗
  var cx1 = PAD;
  card(cx1, y, c1W, row1H);

  ctx.font = fp(12);
  ctx.fillStyle = DIM;
  ctx.fillText('Today output', cx1 + 20, y + 30);

  // 超大数字
  var todayNum = fmtTokens(data.today_output_tokens || 0);
  var todayUnit = fmtTokenUnit(data.today_output_tokens || 0);
  ctx.font = fd(56);
  ctx.fillStyle = ACCENT;
  glow(todayNum, cx1 + 20, y + 95, ACCENT, 25);
  // 单位（小号，紧跟数字）
  var numW = ctx.measureText(todayNum).width;
  ctx.font = fd(24);
  ctx.fillStyle = DIM;
  ctx.fillText(todayUnit, cx1 + 20 + numW + 4, y + 95);

  ctx.font = fp(12);
  ctx.fillStyle = DIM;
  ctx.fillText('tokens', cx1 + 20, y + 116);

  // 卡片 2: 用量排名（圆形进度指示器）
  var cx2 = cx1 + c1W + GAP;
  card(cx2, y, c2W, row1H);

  ctx.font = fp(12);
  ctx.fillStyle = DIM;
  ctx.textAlign = 'center';
  ctx.fillText('Rank', cx2 + c2W / 2, y + 30);

  // 圆形进度环
  var rank = estimateRank(data.month_tokens || 0);
  var ringCx = cx2 + c2W / 2;
  var ringCy = y + 82;
  var ringR = 36;

  // 背景环
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 6;
  ctx.stroke();

  // 进度环
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + (rank / 100) * Math.PI * 2);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineCap = 'butt';

  // 中心数字
  ctx.font = fd(28);
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'center';
  glow(rank + '%', ringCx, ringCy + 10, ACCENT, 12);

  ctx.font = fp(11);
  ctx.fillStyle = DIM;
  ctx.fillText('超过开发者', ringCx, y + row1H - 14);
  ctx.textAlign = 'left';

  // 卡片 3: 本月累计
  var cx3 = cx2 + c2W + GAP;
  card(cx3, y, c3W, row1H);

  ctx.font = fp(12);
  ctx.fillStyle = DIM;
  ctx.fillText('This month', cx3 + 20, y + 30);

  var monthNum = fmtTokens(data.month_tokens || 0);
  var monthUnit = fmtTokenUnit(data.month_tokens || 0);
  ctx.font = fd(48);
  ctx.fillStyle = HIGHLIGHT;
  glow(monthNum, cx3 + 20, y + 82, ACCENT, 18);
  var mnW = ctx.measureText(monthNum).width;
  ctx.font = fd(22);
  ctx.fillStyle = DIM;
  ctx.fillText(monthUnit, cx3 + 20 + mnW + 4, y + 82);

  // 花费副标
  ctx.font = fp(14);
  ctx.fillStyle = ACCENT;
  ctx.fillText(fmtMoney(data.month_cost), cx3 + 20, y + 108);

  // 模型分布（小字）
  var models = (data.top_models || []).slice(0, 2);
  if (models.length > 0) {
    ctx.font = fp(12);
    ctx.fillStyle = DIM;
    var modelStr = models.map(function(m) { return shortModel(m.name) + ' ' + m.pct + '%'; }).join('  ·  ');
    ctx.fillText(modelStr, cx3 + 20, y + 132);
  }

  y += row1H + GAP;

  /* ==========================================================
   *  第二行：左栏 Usage 明细 + 右栏 Tips
   * ========================================================== */
  var row2H = 210;
  var leftW = Math.floor(CW * 0.52);
  var rightW = CW - leftW - GAP;

  // 左卡：Usage 明细
  var lx = PAD;
  card(lx, y, leftW, row2H);

  ctx.font = fd(14);
  ctx.fillStyle = ACCENT;
  ctx.fillText(isRetro ? '> Usage' : 'Usage', lx + 20, y + 30);

  // 数据行
  var rowY = y + 56;
  var ROW_H = 36;
  var valX = lx + leftW - 20;

  function drawUsageRow(label, value, valColor) {
    ctx.font = fp(14);
    ctx.fillStyle = DIM;
    ctx.textAlign = 'left';
    ctx.fillText(label, lx + 20, rowY);
    ctx.font = fd(18);
    ctx.fillStyle = valColor || HIGHLIGHT;
    ctx.textAlign = 'right';
    glow(value, valX, rowY, ACCENT, 8);
    ctx.textAlign = 'left';
    rowY += ROW_H;
  }

  drawUsageRow('今日消耗', fmtTokens(data.today_output_tokens || 0) + fmtTokenUnit(data.today_output_tokens || 0) + ' tokens', HIGHLIGHT);
  drawUsageRow('本月累计', fmtTokens(data.month_tokens || 0) + fmtTokenUnit(data.month_tokens || 0) + ' tokens', HIGHLIGHT);
  drawUsageRow('API 花费', fmtMoney(data.month_cost), ACCENT);
  drawUsageRow('追踪天数', (data.tracking_days || 0) + ' 天', TEXT);

  // 状态行
  ctx.font = fp(14);
  ctx.fillStyle = DIM;
  ctx.textAlign = 'left';
  ctx.fillText('当前状态', lx + 20, rowY);
  ctx.font = fd(18);
  ctx.textAlign = 'right';
  // 绿色状态
  var greenColor = isRetro ? '#33ff33' : '#27c93f';
  ctx.fillStyle = greenColor;
  glow('● 正常', valX, rowY, greenColor, 8);
  ctx.textAlign = 'left';

  // 右卡：Tips
  var rx = lx + leftW + GAP;
  card(rx, y, rightW, row2H);

  ctx.font = fd(14);
  ctx.fillStyle = ACCENT;
  ctx.fillText(isRetro ? '> Tips' : 'Tips', rx + 20, y + 30);

  // 生成 PRD 规定的 Tips
  var tips = generateTips(data);
  var tipY = y + 58;
  var TIP_H = 36;

  for (var ti = 0; ti < tips.length; ti++) {
    // 橙色前缀点
    ctx.font = fd(14);
    ctx.fillStyle = ACCENT;
    glow('·', rx + 20, tipY, ACCENT, 4);
    // Tip 内容
    ctx.font = fp(14);
    ctx.fillStyle = TEXT;
    // 截断到 18 个字符
    var tipText = tips[ti];
    if (tipText.length > 18) tipText = tipText.slice(0, 17) + '…';
    ctx.fillText(tipText, rx + 36, tipY);
    tipY += TIP_H;
  }

  y += row2H + GAP;

  /* ==========================================================
   *  底栏
   * ========================================================== */
  ctx.font = fp(13);
  ctx.fillStyle = DIM;
  ctx.textAlign = 'left';
  ctx.fillText(isRetro ? '❯ pintoken.ai' : 'pintoken.ai  ·  Track your AI spending', PAD, y + 24);

  ctx.font = fd(15);
  ctx.fillStyle = ACCENT;
  ctx.textAlign = 'right';
  glow('#PinToken', RIGHT, y + 24, ACCENT, 10);
  ctx.textAlign = 'left';

  return canvas;
}

/* ============================================================
 *  导出
 * ============================================================ */
window.generateShareCard = generateShareCard;
