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
    var dash = '- '.repeat(50);
    ctx.fillText(dash, PAD, y);
    ctx.restore();
  } else if (skin.features.thinLines) {
    ctx.save();
    ctx.strokeStyle = skin.colors.line;
    ctx.lineWidth = skin.features.ultraLight ? 0.5 : 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y - 6);
    ctx.lineTo(SIZE - PAD, y - 6);
    ctx.stroke();
    ctx.restore();
  } else {
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
  // 构建本月完整日历（补齐没有数据的天）
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = now.getDate();

  // 把 dailyActivity 转成 date → tokens 的 map
  var actMap = {};
  (dailyActivity || []).forEach(function(d) {
    actMap[d.date] = d.tokens || 0;
  });

  // 生成本月每天的数据
  var days = [];
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    days.push({
      day: d,
      tokens: actMap[dateStr] || 0,
      isFuture: d > today,
    });
  }

  // 7 列排列（一周 7 天），行数自动计算
  var cols = 7;
  var rows = Math.ceil(daysInMonth / cols);
  var gap = 4;
  var cellSize = Math.min(28, Math.floor((areaW - (cols - 1) * gap) / cols));

  // 总宽度居中
  var totalW = cols * cellSize + (cols - 1) * gap;
  var offsetX = startX + Math.floor((areaW - totalW) / 2);

  for (var i = 0; i < days.length; i++) {
    var col = i % cols;
    var row = Math.floor(i / cols);
    var cx = offsetX + col * (cellSize + gap);
    var cy = startY + row * (cellSize + gap);

    ctx.save();

    if (days[i].isFuture) {
      // 未来的天：虚线边框，不填充
      ctx.strokeStyle = offColor;
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 2]);
      drawRoundRect(ctx, cx, cy, cellSize, cellSize, 4);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (days[i].tokens > 0) {
      // 有活动：亮色
      ctx.fillStyle = onColor;
      // 霓虹皮肤：亮格子加 glow
      if (skinName === 'neon') {
        ctx.shadowColor = onColor;
        ctx.shadowBlur = 6;
      }
      drawRoundRect(ctx, cx, cy, cellSize, cellSize, 4);
      ctx.fill();
    } else {
      // 无活动：暗色
      ctx.fillStyle = offColor;
      drawRoundRect(ctx, cx, cy, cellSize, cellSize, 4);
      ctx.fill();
    }

    // 在格子内显示日期数字（小字）
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.font = '10px ' + skin.font.primary;
    ctx.fillStyle = days[i].tokens > 0 ? (skinName === 'minimal' ? '#fff' : skin.colors.text) : skin.colors.textDim;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(days[i].day), cx + cellSize / 2, cy + cellSize / 2);

    ctx.restore();
  }

  // 底部统计：X 天活跃 / Y 天
  var activeDays = days.filter(function(d) { return !d.isFuture && d.tokens > 0; }).length;
  var pastDays = days.filter(function(d) { return !d.isFuture; }).length;
  var totalH = rows * (cellSize + gap);
  var statY = startY + totalH + 12;

  ctx.save();
  ctx.font = '13px ' + skin.font.primary;
  ctx.fillStyle = skin.colors.textDim;
  ctx.textAlign = 'center';
  ctx.fillText(activeDays + ' / ' + pastDays + ' 天活跃', startX + areaW / 2, statY);
  ctx.restore();

  return totalH + 30; // 格子高度 + 统计文字
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
  var PAD = 72;
  var RIGHT = SIZE - PAD;

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
   *  区域 1：品牌头部 — PinToken + 月份
   * ========================================================== */
  y = 100;

  // 左侧：PinToken
  ctx.textAlign = 'left';
  if (isNeon) {
    ctx.font = fd(26);
    ctx.fillStyle = c.brand;
    drawGlowText(ctx, 'PinToken', PAD, y, c.glow, 25);
  } else if (isRetro) {
    ctx.font = fd(22);
    ctx.fillStyle = c.brand;
    ctx.fillText('*** PinToken ***', PAD, y);
  } else if (isMinimal) {
    ctx.font = '300 22px ' + ff.display;
    ctx.fillStyle = c.textDim;
    ctx.fillText('PinToken', PAD, y);
  } else {
    ctx.font = fd(24);
    ctx.fillStyle = c.brand;
    ctx.fillText('PinToken', PAD, y);
  }

  // 右侧：月份标签
  ctx.textAlign = 'right';
  ctx.font = fp(18);
  ctx.fillStyle = c.textDim;
  ctx.fillText(data.month_label_en || data.month_label || '', RIGHT, y);
  ctx.textAlign = 'left';

  /* ── 第一道分隔 ── */
  y = 130;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 2：TODAY — 今日 output tokens（第一视觉焦点）
   * ========================================================== */
  y = 160;

  // 小标签
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  ctx.textAlign = 'left';
  if (isRetro) {
    ctx.fillText('> TODAY', PAD, y);
  } else {
    ctx.fillText('TODAY', PAD, y);
  }

  // 超大今日 output tokens 数字
  y = 230;
  var todayStr = fmtTokens(data.today_output_tokens || 0);

  if (isNeon) {
    ctx.font = fd(80);
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    drawGlowText(ctx, todayStr, PAD, y, c.glow, 50);
  } else if (isMinimal) {
    ctx.font = '800 84px ' + ff.display;
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    ctx.fillText(todayStr, PAD, y);
  } else {
    ctx.font = fd(80);
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    ctx.fillText(todayStr, PAD, y);
  }

  // "output tokens" 标注
  y = 260;
  ctx.font = fp(16);
  ctx.fillStyle = c.textDim;
  ctx.fillText('output tokens', PAD, y);

  /* ==========================================================
   *  区域 3：THIS MONTH — 本月累计 tokens + 花费
   * ========================================================== */
  y = 300;

  // 小标签
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  if (isRetro) {
    ctx.fillText('> THIS MONTH', PAD, y);
  } else {
    ctx.fillText('THIS MONTH', PAD, y);
  }

  // 大号本月 tokens 数字
  y = 360;
  var monthStr = fmtTokens(data.month_tokens || 0);

  if (isNeon) {
    ctx.font = fd(56);
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    drawGlowText(ctx, monthStr, PAD, y, c.glow, 35);
  } else if (isMinimal) {
    ctx.font = '800 60px ' + ff.display;
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    ctx.fillText(monthStr, PAD, y);
  } else {
    ctx.font = fd(56);
    ctx.fillStyle = c.highlight;
    ctx.textAlign = 'left';
    ctx.fillText(monthStr, PAD, y);
  }

  // "total tokens · $549" 标注
  y = 392;
  ctx.font = fp(16);
  ctx.fillStyle = c.textDim;
  var monthNote = 'total tokens';
  if (data.month_cost) {
    monthNote += '  ·  ' + fmtMoney(data.month_cost);
  }
  ctx.fillText(monthNote, PAD, y);

  /* ── 分隔 ── */
  y = 430;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 4：ACTIVITY — 30 天热力图
   * ========================================================== */
  y = 460;

  // 小标签
  ctx.font = fp(13);
  ctx.fillStyle = c.textDim;
  if (isRetro) {
    ctx.fillText('> ACTIVITY', PAD, y);
  } else {
    ctx.fillText('ACTIVITY', PAD, y);
  }

  // 绘制活动格子（GitHub 风格：有用=亮，没用=暗）
  var gridStartY = y + 20;
  var gridOffColor = skin.heatmap ? skin.heatmap[0] : '#333';
  var gridOnColor = skin.heatmap ? skin.heatmap[4] : '#bbb';
  var gridH = drawActivityGrid(
    ctx, data.daily_activity || [],
    gridOffColor, gridOnColor,
    PAD, gridStartY, RIGHT - PAD,
    skin, skinName
  );

  /* ==========================================================
   *  区域 5：模型分布 — 一行文字
   * ========================================================== */
  y = gridStartY + gridH + 16;

  var models = (data.top_models || []).slice(0, 4);
  if (models.length > 0) {
    // 拼接模型分布字符串：Opus 87% · Sonnet 13%
    var modelParts = [];
    for (var mi = 0; mi < models.length; mi++) {
      var m = models[mi];
      // 简化模型名：去掉前缀（claude-、gpt-、等）
      var shortName = m.name
        .replace(/^claude-/, '')
        .replace(/^gpt-/, '')
        .replace(/-\d{8}$/, '')  // 去掉日期后缀
        .replace(/-\d+[km]?$/, '');  // 去掉版本号后缀
      // 首字母大写
      shortName = shortName.charAt(0).toUpperCase() + shortName.slice(1);
      modelParts.push(shortName + ' ' + m.pct + '%');
    }
    var modelLine = modelParts.join('  ·  ');

    ctx.textAlign = 'center';
    if (isNeon) {
      ctx.font = fd(18);
      ctx.fillStyle = c.textDim;
      drawGlowText(ctx, modelLine, SIZE / 2, y, c.glow, 10);
    } else if (isRetro) {
      ctx.font = fp(16);
      ctx.fillStyle = c.textDim;
      ctx.fillText('[ ' + modelLine + ' ]', SIZE / 2, y);
    } else if (isMinimal) {
      ctx.font = '400 16px ' + ff.display;
      ctx.fillStyle = c.textDim;
      ctx.fillText(modelLine, SIZE / 2, y);
    } else {
      ctx.font = fp(16);
      ctx.fillStyle = c.textDim;
      ctx.fillText(modelLine, SIZE / 2, y);
    }
    ctx.textAlign = 'left';
  }

  /* ── 最后一道分隔 ── */
  y += 40;
  drawDashedLine(ctx, y, PAD, SIZE, skin);

  /* ==========================================================
   *  区域 6：品牌底栏 — Slogan + 域名 + Hashtag
   * ========================================================== */
  y += 36;
  ctx.textAlign = 'center';

  // Slogan
  if (isNeon) {
    ctx.font = fp(15);
    ctx.fillStyle = c.textDim;
    drawGlowText(ctx, 'Pin your token. Save your dollar.', SIZE / 2, y, c.glow, 10);
  } else if (isRetro) {
    ctx.font = fp(14);
    ctx.fillStyle = c.textDim;
    ctx.fillText('>> Pin your token. Save your dollar. <<', SIZE / 2, y);
  } else if (isMinimal) {
    ctx.font = '300 14px ' + ff.display;
    ctx.fillStyle = c.textDim;
    ctx.fillText('Pin your token. Save your dollar.', SIZE / 2, y);
  } else {
    ctx.font = fp(14);
    ctx.fillStyle = c.textDim;
    ctx.fillText('Pin your token. Save your dollar.', SIZE / 2, y);
  }

  // 底部一行：左边域名，右边 hashtag
  y += 32;
  ctx.textAlign = 'left';
  if (isNeon) {
    ctx.font = fp(15);
    ctx.fillStyle = c.textDim;
    drawGlowText(ctx, 'pintoken.ai', PAD, y, c.glow, 12);
  } else {
    ctx.font = isMinimal ? ('300 14px ' + ff.display) : fp(14);
    ctx.fillStyle = c.textDim;
    ctx.fillText('pintoken.ai', PAD, y);
  }

  ctx.textAlign = 'right';
  if (isNeon) {
    ctx.font = fd(16);
    ctx.fillStyle = c.brand;
    drawGlowText(ctx, '#PinToken', RIGHT, y, c.glow, 15);
  } else {
    ctx.font = fd(15);
    ctx.fillStyle = c.brand;
    ctx.fillText('#PinToken', RIGHT, y);
  }
  ctx.textAlign = 'left';

  // 复古终端：额外装饰
  if (isRetro) {
    y += 28;
    ctx.textAlign = 'center';
    ctx.font = fp(14);
    ctx.fillStyle = c.textDim;
    ctx.fillText('> PRESS ANY KEY TO CONTINUE\u2588', SIZE / 2, y);
    ctx.textAlign = 'left';
  }

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
