/**
 * PinToken 分享卡片 — 收据/账单风格 Canvas 渲染引擎
 * 画布 2160×2160（Retina 2x），逻辑坐标 1080×1080
 * 依赖 share-card-skins.js 提供 SHARE_SKINS 配置
 *
 * API: window.generateShareCard(data, skinName) → <canvas>
 *
 * data 格式:
 *   { month_label, month_cost, saved, saved_pct, month_requests,
 *     month_tokens, provider_count, tracking_days, top_models: [{ name, pct }] }
 */

/* ============================================================
 *  工具函数
 * ============================================================ */

/** Token 数格式化（B / M / K） */
function fmtTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/** 金额格式化 */
function fmtMoney(n) {
  return '$' + (n || 0).toFixed(2);
}

/** HEX → rgba */
function hexRgba(hex, alpha) {
  if (!hex || hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** 获取皮肤名（反向查找） */
function getSkinKey(skin) {
  var skins = window.SHARE_SKINS || {};
  for (var k in skins) {
    if (skins[k] === skin) return k;
  }
  return '';
}

/* ============================================================
 *  背景绘制
 * ============================================================ */

function drawBg(ctx, skin, SIZE) {
  var key = getSkinKey(skin);

  // 基础背景色
  ctx.fillStyle = skin.bg.color;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 热敏纸：微弱噪点纹理
  if (skin.features.paperNoise) {
    ctx.save();
    for (var i = 0; i < 8000; i++) {
      var nx = Math.random() * SIZE;
      var ny = Math.random() * SIZE;
      var na = Math.random() * 0.03;
      ctx.fillStyle = 'rgba(0,0,0,' + na + ')';
      ctx.fillRect(nx, ny, 1, 1);
    }
    ctx.restore();
  }

  // 碳纤维：45° 对角线细纹
  if (skin.features.carbonTexture) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (var d = -SIZE; d < SIZE * 2; d += 8) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + SIZE, SIZE);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 复古终端：CRT 扫描线
  if (skin.features.scanlines) {
    ctx.save();
    for (var sy = 0; sy < SIZE; sy += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, sy, SIZE, 1);
    }
    ctx.restore();
  }

  // 霓虹：背景光斑
  if (key === 'neon') {
    ctx.save();
    // 橙色光斑（中上）
    var g1 = ctx.createRadialGradient(SIZE / 2, 260, 0, SIZE / 2, 260, 400);
    g1.addColorStop(0, 'rgba(255,107,53,0.10)');
    g1.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // 绿色光斑（右下）
    var g2 = ctx.createRadialGradient(800, 800, 0, 800, 800, 300);
    g2.addColorStop(0, 'rgba(39,201,63,0.06)');
    g2.addColorStop(1, 'rgba(39,201,63,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
  }

  // 复古终端：CRT 光晕
  if (skin.features.crtGlow) {
    ctx.save();
    var cg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.7);
    cg.addColorStop(0, 'rgba(51,255,51,0.04)');
    cg.addColorStop(1, 'rgba(51,255,51,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.restore();
  }
}

/* ============================================================
 *  皮肤专属装饰
 * ============================================================ */

/** 热敏纸锯齿边 */
function drawTearEdge(ctx, y, PAD, SIZE, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  for (var tx = PAD; tx < SIZE - PAD; tx += 12) {
    ctx.lineTo(tx + 6, y - 8);
    ctx.lineTo(tx + 12, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** 虚线分隔符（用字符串模拟，更有收据感） */
function drawDashedLine(ctx, y, PAD, SIZE, skin) {
  if (skin.features.dashedDivider) {
    ctx.save();
    ctx.font = '16px ' + skin.font.primary;
    ctx.fillStyle = skin.colors.textDim;
    ctx.textAlign = 'left';
    // 用 '- ' 重复填充宽度
    var dash = '- '.repeat(50);
    ctx.fillText(dash, PAD, y);
    ctx.restore();
  } else if (skin.features.thinLines) {
    // 极细线分隔
    ctx.save();
    ctx.strokeStyle = skin.colors.line;
    ctx.lineWidth = skin.features.ultraLight ? 0.5 : 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 6);
    ctx.lineTo(SIZE - PAD, y - 6);
    ctx.stroke();
    ctx.restore();
  } else {
    // 默认实线
    ctx.save();
    ctx.strokeStyle = skin.colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 6);
    ctx.lineTo(SIZE - PAD, y - 6);
    ctx.stroke();
    ctx.restore();
  }
}

/** 热敏纸阴影效果 */
function drawPaperShadow(ctx, PAD, SIZE) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#faf6f0';
  ctx.fillRect(PAD - 2, 60, SIZE - PAD * 2 + 4, SIZE - 120);
  ctx.shadowColor = 'transparent';
  ctx.restore();
}

/** 霓虹发光文字绘制 */
function drawGlowText(ctx, text, x, y, color, blurMax) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blurMax || 40;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = (blurMax || 40) * 0.4;
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

  var SIZE = 1080;
  var SCALE = 2;
  var canvas = document.createElement('canvas');
  canvas.width = SIZE * SCALE;
  canvas.height = SIZE * SCALE;

  var ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  var c = skin.colors;
  var ft = skin.features;
  var PAD = 80;
  var RIGHT = SIZE - PAD;

  // 字体快捷方式
  var ff = skin.font;
  function fp(size, weight) {
    return (weight || 'normal') + ' ' + size + 'px ' + ff.primary;
  }
  function fd(size, weight) {
    return (weight || ff.weight || 'bold') + ' ' + size + 'px ' + ff.display;
  }

  // 是否霓虹皮肤
  var isNeon = skinName === 'neon';
  var isRetro = skinName === 'retro';
  var isMinimal = skinName === 'minimal';
  var isThermal = skinName === 'thermal';

  /* ========== 背景 ========== */
  drawBg(ctx, skin, SIZE);

  /* ========== 热敏纸阴影（在内容之下） ========== */
  if (ft.paperShadow) {
    drawPaperShadow(ctx, PAD, SIZE);
  }

  /* ==========================================================
   *  Y 坐标布局（基于 1080 逻辑坐标）
   * ========================================================== */
  var y = 0;

  /* ── 上边锯齿 ── */
  if (ft.tearEdge) {
    y = 72;
    drawTearEdge(ctx, y, PAD, SIZE, c.line);
  }

  /* ==========================================================
   *  区域 1：品牌头部
   * ========================================================== */
  y = 110;

  // 📌 PinToken
  ctx.textAlign = 'center';
  if (isNeon) {
    ctx.font = fd(28);
    ctx.fillStyle = c.brand;
    drawGlowText(ctx, '📌  PinToken', SIZE / 2, y, c.glow, 30);
  } else if (isRetro) {
    ctx.font = fd(24);
    ctx.fillStyle = c.brand;
    ctx.fillText('*** PinToken ***', SIZE / 2, y);
  } else if (isMinimal) {
    ctx.font = '300 24px ' + ff.display;
    ctx.fillStyle = c.textDim;
    ctx.fillText('PinToken', SIZE / 2, y);
  } else {
    ctx.font = fd(24);
    ctx.fillStyle = c.brand;
    ctx.fillText('📌  PinToken', SIZE / 2, y);
  }

  // 副标题 AI Usage Receipt
  y += 32;
  if (isRetro) {
    ctx.font = fp(16);
    ctx.fillStyle = c.textDim;
    ctx.fillText('>> AI USAGE RECEIPT <<', SIZE / 2, y);
  } else if (isMinimal) {
    ctx.font = '300 14px ' + ff.display;
    ctx.fillStyle = c.textDim;
    ctx.fillText('AI Usage Receipt', SIZE / 2, y);
  } else {
    ctx.font = fp(16);
    ctx.fillStyle = c.textDim;
    ctx.fillText('AI Usage Receipt', SIZE / 2, y);
  }

  // 月份
  y += 26;
  ctx.font = fp(15);
  ctx.fillStyle = c.textDim;
  ctx.fillText(data.month_label || '', SIZE / 2, y);
  ctx.textAlign = 'left';

  /* ── 第一道分隔 ── */
  y += 30;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 2：TOKEN CONSUMED — 第一视觉焦点
   * ========================================================== */
  y += 20;

  // 小标签
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('TOKEN CONSUMED', PAD, y);

  // 超大 Token 数字
  y += 70;
  var tokenStr = fmtTokens(data.month_tokens || 0);

  if (isNeon) {
    ctx.font = fd(96);
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    drawGlowText(ctx, tokenStr, PAD, y, c.glow, 50);
  } else if (isMinimal) {
    ctx.font = '800 100px ' + ff.display;
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    ctx.fillText(tokenStr, PAD, y);
  } else {
    ctx.font = fd(96);
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    ctx.fillText(tokenStr, PAD, y);
  }

  // "tokens" 标注
  y += 30;
  ctx.font = fp(16);
  ctx.fillStyle = c.textDim;
  ctx.fillText('tokens', PAD, y);

  /* ── 分隔 ── */
  y += 36;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 3：API COST — 第二冲击数字
   * ========================================================== */
  y += 20;

  // 小标签
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('API COST', PAD, y);

  // 大金额
  y += 56;
  var costStr = fmtMoney(data.month_cost);

  if (isNeon) {
    ctx.font = fd(72);
    ctx.fillStyle = c.highlight;
    drawGlowText(ctx, costStr, PAD, y, c.glowAlt || c.glow, 35);
  } else if (isMinimal) {
    ctx.font = '800 76px ' + ff.display;
    ctx.fillStyle = c.accent;
    ctx.fillText(costStr, PAD, y);
  } else if (isThermal) {
    ctx.font = fd(72);
    ctx.fillStyle = c.highlight;
    ctx.fillText(costStr, PAD, y);
  } else {
    ctx.font = fd(72);
    ctx.fillStyle = c.accent;
    ctx.fillText(costStr, PAD, y);
  }

  // 请求数辅助信息
  y += 30;
  ctx.font = fp(14);
  ctx.fillStyle = c.textDim;
  ctx.fillText((data.month_requests || 0).toLocaleString() + ' requests  ·  ' + (data.provider_count || 0) + ' providers  ·  ' + (data.tracking_days || 0) + ' days', PAD, y);

  /* ── 分隔 ── */
  y += 36;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 4：模型明细 — 发票行项目
   * ========================================================== */
  y += 20;

  // 表头
  ctx.font = fp(12);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('MODEL', PAD, y);
  ctx.textAlign = 'center';
  ctx.fillText('SHARE', SIZE / 2 + 60, y);
  ctx.textAlign = 'right';
  ctx.fillText('COST', RIGHT, y);
  ctx.textAlign = 'left';

  y += 8;

  // 模型行
  var models = (data.top_models || []).slice(0, 5);
  var totalCost = data.month_cost || 0;

  for (var mi = 0; mi < models.length; mi++) {
    y += 30;
    var m = models[mi];
    var mCost = (m.pct / 100) * totalCost;

    // 模型名（左对齐）
    ctx.font = fp(16);
    ctx.fillStyle = c.text;
    ctx.textAlign = 'left';
    ctx.fillText(m.name, PAD, y);

    // 百分比（居中偏右）
    ctx.textAlign = 'center';
    ctx.fillStyle = c.textDim;
    ctx.fillText(m.pct + '%', SIZE / 2 + 60, y);

    // 金额（右对齐）
    ctx.textAlign = 'right';
    ctx.fillStyle = c.text;
    ctx.fillText(fmtMoney(mCost), RIGHT, y);

    ctx.textAlign = 'left';
  }

  /* ── 分隔 ── */
  y += 36;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 5：合计 — 收据高潮
   * ========================================================== */
  y += 24;

  // SUBTOTAL
  ctx.font = fp(16);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('SUBTOTAL', PAD, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = c.text;
  ctx.fillText(fmtMoney(data.month_cost), RIGHT, y);

  // MAX SUBSCRIPTION（假设 $200 Pro 套餐对标价）
  y += 30;
  var subCost = data.month_cost + (data.saved || 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = c.textDim;
  ctx.font = fp(16);
  ctx.fillText('EQUIVALENT SUB', PAD, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = c.text;
  ctx.fillText(fmtMoney(subCost), RIGHT, y);

  // 细线
  y += 18;
  ctx.save();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = ft.ultraLight ? 0.5 : 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();
  ctx.restore();

  // YOU SAVED — 高亮行
  y += 32;
  ctx.textAlign = 'left';
  if (isNeon) {
    ctx.font = fd(24);
    ctx.fillStyle = c.glowAlt || '#27c93f';
    drawGlowText(ctx, 'YOU SAVED', PAD, y, c.glowAlt || '#27c93f', 20);
    ctx.textAlign = 'right';
    drawGlowText(ctx, fmtMoney(data.saved) + '  (' + (data.saved_pct || 0) + '%)', RIGHT, y, c.glowAlt || '#27c93f', 20);
  } else if (isRetro) {
    ctx.font = fd(24);
    ctx.fillStyle = c.accent;
    ctx.fillText('>> YOU SAVED', PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(data.saved) + '  (' + (data.saved_pct || 0) + '%) <<', RIGHT, y);
  } else if (isMinimal) {
    ctx.font = '800 24px ' + ff.display;
    ctx.fillStyle = c.accent;
    ctx.fillText('YOU SAVED', PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(data.saved), RIGHT, y);
  } else {
    ctx.font = fd(24);
    ctx.fillStyle = isThermal ? c.brand : c.accent;
    ctx.fillText('YOU SAVED', PAD, y);
    ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(data.saved) + '  (' + (data.saved_pct || 0) + '%)', RIGHT, y);
  }
  ctx.textAlign = 'left';

  /* ── 最后一道分隔 ── */
  y += 40;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 6：品牌底栏
   * ========================================================== */
  y += 26;
  ctx.textAlign = 'center';

  // 域名
  if (isNeon) {
    ctx.font = fd(16);
    ctx.fillStyle = c.textDim;
    drawGlowText(ctx, 'pintoken.ai', SIZE / 2, y, c.glow, 15);
  } else {
    ctx.font = isMinimal ? ('300 15px ' + ff.display) : fp(15);
    ctx.fillStyle = c.textDim;
    ctx.fillText('pintoken.ai', SIZE / 2, y);
  }

  // Slogan
  y += 24;
  ctx.font = isMinimal ? ('300 13px ' + ff.display) : fp(13);
  ctx.fillStyle = c.textDim;
  ctx.fillText('Pin your token. Save your dollar.', SIZE / 2, y);

  // Hashtag
  y += 24;
  ctx.font = fd(16);
  ctx.fillStyle = c.brand;
  if (isNeon) {
    drawGlowText(ctx, '#PinToken', SIZE / 2, y, c.glow, 15);
  } else {
    ctx.fillText('#PinToken', SIZE / 2, y);
  }

  // 复古终端装饰
  if (isRetro) {
    y += 32;
    ctx.font = fp(14);
    ctx.fillStyle = c.textDim;
    ctx.fillText('> PRESS ANY KEY TO CONTINUE█', SIZE / 2, y);
  }

  ctx.textAlign = 'left';

  /* ── 下边锯齿 ── */
  if (ft.tearEdge) {
    drawTearEdge(ctx, SIZE - 60, PAD, SIZE, c.line);
  }

  return canvas;
}

/* ============================================================
 *  导出
 * ============================================================ */
window.generateShareCard = generateShareCard;
