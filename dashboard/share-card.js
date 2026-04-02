/**
 * PinToken V2 分享卡片 Canvas 渲染引擎
 * 画布内部 2160×2160（Retina 2x），导出 1080×1080 PNG
 * 依赖 share-card-skins.js 提供 SHARE_SKINS 配置
 *
 * API: window.generateShareCard(data, skinName) → <canvas>
 */

/* ============================================================
 *  辅助函数
 * ============================================================ */

/** 圆角矩形路径（不自动 fill/stroke） */
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

/** 数字格式化：1200 → 1.2K, 2400000 → 2.4M */
function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/** Token 数格式化：精度更粗 */
function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/* ============================================================
 *  主渲染函数
 * ============================================================ */

/**
 * 生成分享卡片
 * @param {Object} data  — 从 /api/share-data 获取的数据
 * @param {string} skinName — 皮肤名称，默认 'terminal'
 * @returns {HTMLCanvasElement}
 */
function generateShareCard(data, skinName) {
  skinName = skinName || 'terminal';
  const skin = (window.SHARE_SKINS || {})[skinName];
  if (!skin) {
    console.error('[PinToken] 未找到皮肤:', skinName);
    return document.createElement('canvas');
  }

  // ---------- 画布基础尺寸 ----------
  // 逻辑坐标 1080，物理像素 2160（Retina 2x）
  const SIZE = 1080;
  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE * SCALE;
  canvas.height = SIZE * SCALE;
  canvas.style.width = SIZE + 'px';
  canvas.style.height = SIZE + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  const colors = skin.colors;
  const features = skin.features || {};
  const PAD = 60; // 外边距

  // ---------- 字体工具 ----------
  function fontPrimary(size, weight) {
    return (weight || '') + ' ' + size + 'px ' + skin.font.primary;
  }
  function fontDisplay(size, weight) {
    return (weight || 'bold') + ' ' + size + 'px ' + skin.font.display;
  }

  /* ==========================================================
   *  1. 绘制背景
   * ========================================================== */
  drawBackground(ctx, skin, SIZE);

  /* ==========================================================
   *  2. Gradient 皮肤 — 半透明白色卡片容器
   * ========================================================== */
  if (features.glassCard) {
    ctx.save();
    ctx.fillStyle = colors.cardBg;
    roundRect(ctx, PAD - 20, 40, SIZE - (PAD - 20) * 2, SIZE - 80, 24);
    ctx.fill();
    // 边框
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    roundRect(ctx, PAD - 20, 40, SIZE - (PAD - 20) * 2, SIZE - 80, 24);
    ctx.stroke();
    ctx.restore();
  }

  /* ==========================================================
   *  3. Terminal 皮肤 — 交通灯
   * ========================================================== */
  if (features.trafficLights) {
    var tlY = 76;
    var tlX = PAD + 8;
    var tlColors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(tlX + i * 24, tlY, 7, 0, Math.PI * 2);
      ctx.fillStyle = tlColors[i];
      ctx.fill();
    }
  }

  /* ==========================================================
   *  4. 顶部品牌区 — Y: 60, H: 60
   * ========================================================== */
  var topY = 72;

  // 左侧：📌 PinToken
  ctx.font = fontDisplay(22, 'bold');
  ctx.fillStyle = colors.accent;
  ctx.textAlign = 'left';
  // 交通灯皮肤把文字右移
  var brandX = features.trafficLights ? PAD + 80 : PAD;
  ctx.fillText('📌 PinToken', brandX, topY);

  // 右侧：月份标签
  ctx.font = fontPrimary(18);
  ctx.fillStyle = colors.textDim;
  ctx.textAlign = 'right';
  ctx.fillText(data.month_label || '', SIZE - PAD, topY);
  ctx.textAlign = 'left';

  // 分隔线
  var divY = topY + 20;
  if (features.borderStyle === 'dashed') {
    drawDashedLine(ctx, PAD, divY, SIZE - PAD, divY, colors.border, 1);
  } else if (features.borderStyle === 'solid') {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, divY);
    ctx.lineTo(SIZE - PAD, divY);
    ctx.stroke();
  }

  /* ==========================================================
   *  5. 英雄数字区 — Y: 160, H: 280
   * ========================================================== */
  var heroY = 180;

  // "本月花费" 标签
  ctx.font = fontPrimary(18);
  ctx.fillStyle = colors.textDim;
  ctx.fillText('本月花费', PAD, heroY);

  // 大数字 $XXX.XX
  var costStr = '$' + (data.month_cost || 0).toFixed(2);
  heroY += 90;

  if (features.glow) {
    // Neon 皮肤：双层绘制 — 底层模糊 glow + 上层清晰
    ctx.save();
    ctx.font = fontDisplay(96, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillText(costStr, PAD, heroY);
    // 再画一层清晰的
    ctx.shadowBlur = 0;
    ctx.fillText(costStr, PAD, heroY);
    ctx.restore();
  } else {
    ctx.font = fontDisplay(96, 'bold');
    ctx.fillStyle = colors.accent;
    ctx.fillText(costStr, PAD, heroY);
  }

  // "省了" 行
  heroY += 52;
  ctx.font = fontDisplay(28, 'bold');
  ctx.fillStyle = colors.saving;
  var savedStr = '省了 $' + (data.saved || 0).toFixed(2) + '  ↓ ' + (data.saved_pct || 0) + '%';
  ctx.fillText(savedStr, PAD, heroY);

  /* ==========================================================
   *  6. 四格统计条 — Y: 480, H: 80
   * ========================================================== */
  var statY = 480;
  var statW = (SIZE - PAD * 2) / 4;
  var statItems = [
    { label: '请求', value: formatNum(data.month_requests || 0) },
    { label: 'Tokens', value: formatTokens(data.month_tokens || 0) },
    { label: 'Providers', value: String(data.provider_count || 0) },
    { label: '天数', value: String(data.tracking_days || 0) },
  ];

  // 统计条背景
  ctx.fillStyle = colors.cardBg;
  roundRect(ctx, PAD, statY - 16, SIZE - PAD * 2, 80, 12);
  ctx.fill();

  if (features.dashedBorder) {
    drawDashedRect(ctx, PAD, statY - 16, SIZE - PAD * 2, 80, 12, colors.border, 1);
  }

  for (var si = 0; si < statItems.length; si++) {
    var sx = PAD + statW * si + statW / 2;

    // 数字
    ctx.font = fontDisplay(26, 'bold');
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.fillText(statItems[si].value, sx, statY + 18);

    // 标签
    ctx.font = fontPrimary(14);
    ctx.fillStyle = colors.textDim;
    ctx.fillText(statItems[si].label, sx, statY + 42);

    // 分隔竖线（不画最后一个）
    if (si < statItems.length - 1) {
      var lineX = PAD + statW * (si + 1);
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineX, statY - 4);
      ctx.lineTo(lineX, statY + 52);
      ctx.stroke();
    }
  }
  ctx.textAlign = 'left';

  /* ==========================================================
   *  7. 模型分布条形图 — Y: 600, H: 280
   * ========================================================== */
  var barY = 610;
  var barAreaW = SIZE - PAD * 2;
  var models = (data.top_models || []).slice(0, 4);

  // 标题
  ctx.font = fontDisplay(18, 'bold');
  ctx.fillStyle = colors.text;
  ctx.fillText('模型分布', PAD, barY);
  barY += 32;

  var barH = 28;
  var barGap = 48;

  for (var mi = 0; mi < models.length; mi++) {
    var model = models[mi];
    var my = barY + mi * barGap;

    // 模型名 + 百分比
    ctx.font = fontPrimary(15);
    ctx.fillStyle = colors.text;
    ctx.fillText(model.name, PAD, my - 6);

    ctx.textAlign = 'right';
    ctx.fillStyle = colors.textDim;
    ctx.fillText(model.pct + '%', SIZE - PAD, my - 6);
    ctx.textAlign = 'left';

    // 背景条
    var barW = barAreaW;
    var fillW = barW * (model.pct / 100);
    var barRadius = features.roundedBars ? barH / 2 : 4;

    // 背景
    ctx.fillStyle = colors.barBg;
    roundRect(ctx, PAD, my + 2, barW, barH, barRadius);
    ctx.fill();

    if (features.outlineBars) {
      // Blueprint 皮肤：描边条形图（不填充）
      if (fillW > 0) {
        ctx.strokeStyle = colors.barFill;
        ctx.lineWidth = 2;
        roundRect(ctx, PAD, my + 2, Math.max(fillW, barRadius * 2), barH, barRadius);
        ctx.stroke();
      }
    } else {
      // 正常填充
      if (fillW > 0) {
        ctx.fillStyle = colors.barFill;
        roundRect(ctx, PAD, my + 2, Math.max(fillW, barRadius * 2), barH, barRadius);
        ctx.fill();
      }
    }
  }

  /* ==========================================================
   *  8. 底部品牌区 — Y: 940, H: 80
   * ========================================================== */
  var bottomY = 960;

  // 分隔线
  var bottomDivY = bottomY - 30;
  if (features.borderStyle === 'dashed') {
    drawDashedLine(ctx, PAD, bottomDivY, SIZE - PAD, bottomDivY, colors.border, 1);
  } else if (features.borderStyle === 'solid') {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, bottomDivY);
    ctx.lineTo(SIZE - PAD, bottomDivY);
    ctx.stroke();
  }

  // 左: pintoken.ai
  ctx.font = fontPrimary(16);
  ctx.fillStyle = colors.textDim;
  ctx.textAlign = 'left';
  ctx.fillText('pintoken.ai', PAD, bottomY);

  // 副标题
  ctx.font = fontPrimary(13);
  ctx.fillStyle = colors.textDim;
  ctx.fillText('Pin your token. Save your dollar.', PAD, bottomY + 22);

  // 右: #PinToken
  ctx.font = fontDisplay(18, 'bold');
  ctx.fillStyle = colors.accent;
  ctx.textAlign = 'right';
  ctx.fillText('#PinToken', SIZE - PAD, bottomY);
  ctx.textAlign = 'left';

  return canvas;
}

/* ============================================================
 *  背景绘制
 * ============================================================ */

function drawBackground(ctx, skin, SIZE) {
  var bg = skin.bg;

  if (bg.type === 'solid') {
    // 纯色背景
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else if (bg.type === 'gradient') {
    // 角度渐变
    var grad = createAngledGradient(ctx, bg.angle || 135, SIZE);
    var stops = bg.stops || [];
    for (var i = 0; i < stops.length; i++) {
      grad.addColorStop(stops[i].pos, stops[i].color);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  } else if (bg.type === 'split') {
    // 分色背景
    var splitY = bg.splitY || SIZE / 2;
    ctx.fillStyle = bg.topColor;
    ctx.fillRect(0, 0, SIZE, splitY);
    ctx.fillStyle = bg.bottomColor;
    ctx.fillRect(0, splitY, SIZE, SIZE - splitY);
  }

  // 光晕效果
  if (bg.glow) {
    var g = bg.glow;
    var radGrad = ctx.createRadialGradient(SIZE / 2, g.y, 0, SIZE / 2, g.y, g.radius);
    radGrad.addColorStop(0, hexToRgba(g.color, g.opacity));
    radGrad.addColorStop(1, hexToRgba(g.color, 0));
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // 网格线
  if (bg.grid) {
    var grid = bg.grid;
    ctx.strokeStyle = hexToRgba(grid.color, grid.opacity);
    ctx.lineWidth = 1;
    for (var x = 0; x <= SIZE; x += grid.size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SIZE);
      ctx.stroke();
    }
    for (var y = 0; y <= SIZE; y += grid.size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
  }
}

/* ============================================================
 *  辅助绘制函数
 * ============================================================ */

/** 按角度创建线性渐变 */
function createAngledGradient(ctx, angleDeg, size) {
  var rad = (angleDeg * Math.PI) / 180;
  var dx = Math.cos(rad) * size;
  var dy = Math.sin(rad) * size;
  var cx = size / 2;
  var cy = size / 2;
  return ctx.createLinearGradient(cx - dx / 2, cy - dy / 2, cx + dx / 2, cy + dy / 2);
}

/** HEX 颜色转 rgba 字符串 */
function hexToRgba(hex, alpha) {
  // 如果已经是 rgba/rgb 直接返回（不精确但够用）
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** 虚线 */
function drawDashedLine(ctx, x1, y1, x2, y2, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** 虚线圆角矩形 */
function drawDashedRect(ctx, x, y, w, h, r, color, width) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([6, 4]);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* ============================================================
 *  导出
 * ============================================================ */

window.generateShareCard = generateShareCard;
window.roundRect = roundRect;
window.formatNum = formatNum;
window.formatTokens = formatTokens;
