/**
 * PinToken 分享卡片 V2 — Token 消耗量 + 热力图 Canvas 渲染引擎
 * 画布 2160×2160（Retina 2x），逻辑坐标 1080×1080
 * 依赖 share-card-skins.js 提供 SHARE_SKINS 配置
 *
 * API: window.generateShareCard(data, skinName) → <canvas>
 *
 * data 格式:
 *   { today_tokens, today_output_tokens, month_tokens, month_cost,
 *     month_label, month_label_en,
 *     top_models: [{ name, pct }],
 *     daily_activity: [{ date, tokens }] (30 天) }
 */

/* ============================================================
 *  工具函数
 * ============================================================ */

/** Token 数格式化（B / M / K），保留一位小数 */
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

function drawBg(ctx, skin, W, H) {
  var key = getSkinKey(skin);

  // 基础背景色
  ctx.fillStyle = skin.bg.color;
  ctx.fillRect(0, 0, W, H);

  // 热敏纸：微弱噪点纹理
  if (skin.features.paperNoise) {
    ctx.save();
    for (var i = 0; i < 6000; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.03) + ')';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.restore();
  }

  // 碳纤维：45° 对角线细纹
  if (skin.features.carbonTexture) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (var d = -H; d < W + H; d += 8) {
      ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + H, H); ctx.stroke();
    }
    ctx.restore();
  }

  // 复古终端：CRT 扫描线
  if (skin.features.scanlines) {
    ctx.save();
    for (var sy = 0; sy < H; sy += 3) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, sy, W, 1);
    }
    ctx.restore();
  }

  // 霓虹：背景光斑
  if (key === 'neon') {
    ctx.save();
    var g1 = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H * 0.3, 400);
    g1.addColorStop(0, 'rgba(255,107,53,0.10)');
    g1.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    var g2 = ctx.createRadialGradient(W * 0.75, H * 0.75, 0, W * 0.75, H * 0.75, 250);
    g2.addColorStop(0, 'rgba(39,201,63,0.06)');
    g2.addColorStop(1, 'rgba(39,201,63,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 复古终端：CRT 光晕
  if (skin.features.crtGlow) {
    ctx.save();
    var cg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    cg.addColorStop(0, 'rgba(51,255,51,0.04)');
    cg.addColorStop(1, 'rgba(51,255,51,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/* ============================================================
 *  皮肤专属装饰
 * ============================================================ */

/** 热敏纸锯齿边 */
function drawTearEdge(ctx, y, PAD, W, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  for (var tx = PAD; tx < W - PAD; tx += 12) {
    ctx.lineTo(tx + 6, y - 8);
    ctx.lineTo(tx + 12, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** 虚线分隔符（用字符串模拟，更有收据感） */
function drawDashedLine(ctx, y, PAD, W, skin) {
  if (skin.features.dashedDivider) {
    ctx.save();
    ctx.font = '16px ' + skin.font.primary;
    ctx.fillStyle = skin.colors.textDim;
    ctx.textAlign = 'left';
    var dash = '- '.repeat(50);
    ctx.fillText(dash, PAD, y);
    ctx.restore();
  } else if (skin.features.thinLines) {
    ctx.save();
    ctx.strokeStyle = skin.colors.line;
    ctx.lineWidth = skin.features.ultraLight ? 0.5 : 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 6);
    ctx.lineTo(W - PAD, y - 6);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = skin.colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 6);
    ctx.lineTo(W - PAD, y - 6);
    ctx.stroke();
    ctx.restore();
  }
}

/** 热敏纸阴影效果 */
function drawPaperShadow(ctx, PAD, W, H) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#faf6f0';
  ctx.fillRect(PAD - 2, 40, W - PAD * 2 + 4, H - 80);
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

/** 绘制圆角矩形（兼容不支持 roundRect 的浏览器） */
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

/* ============================================================
 *  活动格子渲染（GitHub contribution graph 风格）
 *  本月每天一个格子，有使用=亮色，没使用=暗色
 * ============================================================ */

/**
 * 绘制本月活动格子
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} dailyActivity - [{ date, tokens }]
 * @param {string} offColor - 无活动时的格子颜色
 * @param {string} onColor - 有活动时的格子颜色
 * @param {number} startX - 左上角 X
 * @param {number} startY - 左上角 Y
 * @param {number} areaW - 可用宽度
 * @param {object} skin - 皮肤配置
 * @param {string} skinName - 皮肤名称
 * @returns {number} 格子区域总高度（含日期标签）
 */
function drawActivityGrid(ctx, dailyActivity, offColor, onColor, startX, startY, areaW, skin, skinName) {
  // 构建本月完整日历
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = now.getDate();

  // dailyActivity → date map
  var actMap = {};
  (dailyActivity || []).forEach(function(d) {
    actMap[d.date] = d.tokens || 0;
  });

  var days = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    days.push({ day: d, tokens: actMap[dateStr] || 0, isFuture: d > today });
  }

  // 7 列，格子撑满可用宽度
  var cols = 7;
  var rows = Math.ceil(daysInMonth / cols);
  var gap = 6;
  var cellSize = Math.floor((areaW - (cols - 1) * gap) / cols);
  var totalW = cols * cellSize + (cols - 1) * gap;
  var offsetX = startX + Math.floor((areaW - totalW) / 2);

  for (var i = 0; i < days.length; i++) {
    var col = i % cols;
    var row = Math.floor(i / cols);
    var cx = offsetX + col * (cellSize + gap);
    var cy = startY + row * (cellSize + gap);

    ctx.save();

    if (days[i].isFuture) {
      // 未来：虚线框
      ctx.strokeStyle = offColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      drawRoundRect(ctx, cx, cy, cellSize, cellSize, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (days[i].tokens > 0) {
      // 有活动：亮色
      ctx.fillStyle = onColor;
      if (skinName === 'neon') { ctx.shadowColor = onColor; ctx.shadowBlur = 8; }
      drawRoundRect(ctx, cx, cy, cellSize, cellSize, 6);
      ctx.fill();
    } else {
      // 无活动：暗色
      ctx.fillStyle = offColor;
      drawRoundRect(ctx, cx, cy, cellSize, cellSize, 6);
      ctx.fill();
    }

    // 日期数字
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.font = 'bold 16px ' + skin.font.primary;
    // 亮格子上用深色/白色文字，暗格子用 dim 色
    if (days[i].isFuture) {
      ctx.fillStyle = skin.colors.textDim;
    } else if (days[i].tokens > 0) {
      // 亮背景上的文字颜色
      ctx.fillStyle = skinName === 'minimal' || skinName === 'thermal' ? '#ffffff' : skin.colors.text;
    } else {
      ctx.fillStyle = skin.colors.textDim;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(days[i].day), cx + cellSize / 2, cy + cellSize / 2 + 1);

    ctx.restore();
  }

  // 底部统计
  var activeDays = days.filter(function(d) { return !d.isFuture && d.tokens > 0; }).length;
  var pastDays = days.filter(function(d) { return !d.isFuture; }).length;
  var totalH = rows * (cellSize + gap);
  var statY = startY + totalH + 16;

  ctx.save();
  ctx.font = 'bold 16px ' + skin.font.primary;
  ctx.fillStyle = skin.colors.textDim;
  ctx.textAlign = 'center';
  ctx.fillText(activeDays + ' / ' + pastDays + ' 天活跃', startX + areaW / 2, statY);
  ctx.restore();

  return totalH + 36;
}

/* ============================================================
 *  主渲染函数
 * ============================================================ */

function generateShareCard(data, skinName) {
  skinName = skinName || 'thermal';
  var skin = (window.SHARE_SKINS || {})[skinName];
  if (!skin) return document.createElement('canvas');

  var W = 1080;  // 固定宽度
  var SCALE = 2;

  // 预计算高度：版本栏(100) + 品牌区(90) + 两栏标题(30) + 5行数据(5*38=190) + 底栏(60) + 上下边距
  var rowCount = 5;
  var rowH = 38;
  var H = 80 + 48 + 90 + 28 + (rowCount * rowH) + 60 + 80; // ≈ 576
  if (ft.tearEdge) H += 24; // 上下锯齿额外空间

  var canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;

  var ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  var c = skin.colors;
  var ft = skin.features;
  var PAD = 60;
  var RIGHT = W - PAD;

  // 字体快捷方式
  var ff = skin.font;
  function fp(size, weight) {
    return (weight || 'normal') + ' ' + size + 'px ' + ff.primary;
  }
  function fd(size, weight) {
    return (weight || ff.weight || 'bold') + ' ' + size + 'px ' + ff.display;
  }

  // 皮肤标志
  var isNeon = skinName === 'neon';
  var isRetro = skinName === 'retro';
  var isMinimal = skinName === 'minimal';
  var isThermal = skinName === 'thermal';

  /* ========== 背景 ========== */
  drawBg(ctx, skin, W, H);

  /* ========== 热敏纸阴影（在内容之下） ========== */
  if (ft.paperShadow) {
    drawPaperShadow(ctx, PAD, W, H);
  }

  /* ==========================================================
   *  终端面板布局（对标 PRD 4.3）
   *  顶部版本栏 → 品牌区 → 左右两栏（Usage / Tips）→ 底栏
   * ========================================================== */
  var y = 0;
  var MID = W / 2; // 左右两栏分隔线 X 坐标

  // 简化模型名的工具函数
  function shortModelName(name) {
    return name
      .replace(/^claude-/, '').replace(/^gpt-/, '')
      .replace(/-\d{8}$/, '').replace(/-\d+[km]?$/, '')
      .split('-').map(function(s) { return s.charAt(0).toUpperCase() + s.slice(1); }).join(' ');
  }

  /* ── 上边锯齿（thermal） ── */
  if (ft.tearEdge) {
    drawTearEdge(ctx, 60, PAD, W, c.line);
  }

  /* ==========================================================
   *  顶部版本栏
   * ========================================================== */
  y = 100;
  ctx.font = fd(16);
  ctx.fillStyle = c.brand;
  ctx.textAlign = 'left';
  var versionText = isRetro ? '*** PinToken v0.1.0 ***' : '── PinToken v0.1.0 ' + '─'.repeat(30);
  if (isNeon) {
    drawGlowText(ctx, versionText, PAD, y, c.glow, 15);
  } else {
    ctx.fillText(versionText, PAD, y);
  }

  // 橙色分隔线
  y += 16;
  ctx.strokeStyle = c.brand;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();

  /* ==========================================================
   *  品牌区
   * ========================================================== */
  y += 32;

  // PinToken 品牌名（大号）
  if (isNeon) {
    ctx.font = fd(28);
    ctx.fillStyle = c.brand;
    drawGlowText(ctx, 'PinToken', PAD + 4, y, c.glow, 25);
  } else {
    ctx.font = fd(28);
    ctx.fillStyle = c.brand;
    ctx.fillText('PinToken', PAD + 4, y);
  }

  // Slogan
  y += 26;
  ctx.font = fp(15);
  ctx.fillStyle = c.textDim;
  ctx.fillText('Pin your token. Save your dollar.', PAD + 4, y);

  // Meta 信息（最常用模型 · 月份）
  y += 22;
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  var topModelName = (data.top_models && data.top_models[0]) ? shortModelName(data.top_models[0].name) : 'Unknown';
  var metaText = topModelName + '  ·  ' + (data.month_label_en || data.month_label || '');
  ctx.fillText(metaText, PAD + 4, y);

  /* ==========================================================
   *  两栏分隔线 + 栏标题
   * ========================================================== */
  y += 24;

  // 水平灰线
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(RIGHT, y);
  ctx.stroke();

  // 垂直分隔线（从这里到底部）
  var colDivTop = y;
  var colDivBottom = H - 80;
  ctx.beginPath();
  ctx.moveTo(MID, colDivTop);
  ctx.lineTo(MID, colDivBottom);
  ctx.stroke();

  // 左栏标题：Usage
  y += 28;
  ctx.font = fd(16);
  ctx.fillStyle = c.brand;
  if (isNeon) {
    drawGlowText(ctx, 'Usage', PAD + 4, y, c.glow, 10);
  } else {
    ctx.fillText(isRetro ? '> Usage' : 'Usage', PAD + 4, y);
  }

  // 右栏标题：Tips
  if (isNeon) {
    drawGlowText(ctx, 'Tips', MID + 20, y, c.glow, 10);
  } else {
    ctx.fillText(isRetro ? '> Tips' : 'Tips', MID + 20, y);
  }

  /* ==========================================================
   *  左栏：Usage 数据行
   * ========================================================== */
  var LX = PAD + 4;          // 左栏 label X
  var LVX = MID - 16;        // 左栏 value X（右对齐）
  var rowH = 38;              // 每行高度
  var rowY = y + 36;

  // 辅助：绘制左栏一行（label 左对齐，value 右对齐）
  function drawRow(label, value, valueColor) {
    ctx.font = fp(16);
    ctx.fillStyle = c.textDim;
    ctx.textAlign = 'left';
    ctx.fillText(label, LX, rowY);
    ctx.font = fd(18);
    ctx.fillStyle = valueColor || c.highlight;
    ctx.textAlign = 'right';
    if (isNeon && valueColor === c.brand) {
      drawGlowText(ctx, value, LVX, rowY, c.glow, 8);
    } else {
      ctx.fillText(value, LVX, rowY);
    }
    ctx.textAlign = 'left';
    rowY += rowH;
  }

  drawRow('今日消耗', fmtTokens(data.today_output_tokens || 0), c.highlight);
  drawRow('本月累计', fmtTokens(data.month_tokens || 0), c.highlight);
  drawRow('API 花费', fmtMoney(data.month_cost), c.brand);
  drawRow('追踪天数', String(data.tracking_days || 0) + ' 天', c.text);
  drawRow('当前状态', '● 正常', c.accent);

  /* ==========================================================
   *  右栏：Tips（3-4 条动态建议）
   * ========================================================== */
  var tipY = y + 36;
  var tipX = MID + 20;
  var tipLineH = 36;

  // 动态生成 Tips
  var tips = [];

  // Tip 1: 模型占比
  if (data.top_models && data.top_models[0]) {
    tips.push(shortModelName(data.top_models[0].name) + ' 占比 ' + data.top_models[0].pct + '%');
  }

  // Tip 2: 活跃天数
  var activeDays = (data.daily_activity || []).filter(function(d) { return d.tokens > 0; }).length;
  if (activeDays > 0) {
    tips.push('本月已活跃 ' + activeDays + ' 天');
  }

  // Tip 3: 花费对比
  if (data.month_cost > 100) {
    tips.push('已超过 Max 订阅月费');
  } else if (data.month_cost > 0) {
    tips.push('本月花费 ' + fmtMoney(data.month_cost));
  }

  // Tip 4: Provider 数量
  if (data.provider_count > 1) {
    tips.push('使用了 ' + data.provider_count + ' 个 Provider');
  }

  // 兜底
  if (tips.length < 3) {
    tips.push('pintoken.ai 追踪你的 AI 消耗');
  }

  // 绘制 Tips
  for (var ti = 0; ti < Math.min(tips.length, 4); ti++) {
    ctx.font = fp(15);
    // 前缀 ·
    ctx.fillStyle = c.brand;
    if (isNeon) {
      drawGlowText(ctx, '·', tipX, tipY, c.glow, 6);
    } else {
      ctx.fillText('·', tipX, tipY);
    }
    // Tip 文字
    ctx.fillStyle = c.text;
    ctx.fillText(' ' + tips[ti], tipX + 10, tipY);
    tipY += tipLineH;
  }

  /* ==========================================================
   *  底栏：域名 + Hashtag
   * ========================================================== */
  // 底部水平线
  var bottomLineY = colDivBottom;
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, bottomLineY);
  ctx.lineTo(RIGHT, bottomLineY);
  ctx.stroke();

  y = bottomLineY + 30;

  // 左：pintoken.ai
  ctx.font = fp(14);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  if (isNeon) {
    drawGlowText(ctx, 'Track your AI spending → pintoken.ai', PAD, y, c.glow, 8);
  } else {
    ctx.fillText('Track your AI spending → pintoken.ai', PAD, y);
  }

  // 右：#PinToken
  ctx.font = fd(16);
  ctx.fillStyle = c.brand;
  ctx.textAlign = 'right';
  if (isNeon) {
    drawGlowText(ctx, '#PinToken', RIGHT, y, c.glow, 12);
  } else {
    ctx.fillText('#PinToken', RIGHT, y);
  }
  ctx.textAlign = 'left';

  // 复古终端：额外装饰
  if (isRetro) {
    y += 24;
    ctx.textAlign = 'left';
    ctx.font = fp(14);
    ctx.fillStyle = c.textDim;
    ctx.fillText('❯ _', PAD, y);
    ctx.textAlign = 'left';
  }

  /* ── 下边锯齿（thermal） ── */
  if (ft.tearEdge) {
    drawTearEdge(ctx, H - 40, PAD, W, c.line);
  }

  return canvas;
}

/* ============================================================
 *  导出
 * ============================================================ */
window.generateShareCard = generateShareCard;
