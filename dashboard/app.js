/**
 * PinToken Dashboard — 前端逻辑
 * 纯原生 JS，无框架依赖
 * 每 5 秒轮询 API 更新数据
 */

// ===== 全局状态 =====
let currentProvider = '';       // 当前选中的 Provider 过滤器
let pollTimer = null;           // 轮询定时器句柄
let sessionStartTime = Date.now(); // 会话开始时间（页面加载时）
let lastRecordsFound = 0;       // 上次扫描发现的记录数（用于检测首条数据）
let scanCompleteShown = false;   // 扫描完成提示是否已显示过
let currentMode = 'log_observer'; // 当前数据采集模式

// ===== 格式化工具函数 =====

/**
 * 格式化数字，带千位分隔符
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

/**
 * 格式化花费为美元字符串
 * @param {number} n
 * @returns {string}
 */
function formatCost(n) {
  if (n == null || isNaN(n)) return '—';
  return '$' + Number(n).toFixed(2);
}

/**
 * 格式化毫秒时长为 Xh Xm 格式
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
  if (!ms || ms < 0) return '0m';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ===== 模式指示器 =====

/**
 * 获取当前模式并更新顶栏指示器 + 底部模式信息面板
 */
async function updateModeIndicator() {
  try {
    const res = await fetch('/api/mode');
    const mode = await res.json();
    const indicator = document.getElementById('modeIndicator');
    const label = document.getElementById('modeLabel');

    if (mode.proxy?.active) {
      indicator.className = 'mode-indicator proxy';
      label.textContent = 'Proxy 模式';
      currentMode = 'proxy';

      // 更新底部模式信息面板
      const cardProxy = document.getElementById('modeCardProxy');
      const cardObserver = document.getElementById('modeCardObserver');
      if (cardProxy) {
        cardProxy.classList.add('active');
        document.getElementById('proxyModeStatus').textContent = '运行中';
      }
    } else {
      indicator.className = 'mode-indicator log-observer';
      label.textContent = 'Log Observer';
      currentMode = 'log_observer';
    }
  } catch {
    // 静默失败
  }
}

/**
 * 辅助函数：为估算值添加精度标记
 * @param {string} value - 格式化后的数值字符串
 * @param {boolean} isEstimated - 是否为估算值
 * @returns {string}
 */
function addEstimatedMark(value, isEstimated) {
  if (!isEstimated) return value;
  return `${value} <span class="estimated-mark" title="估算值（来自日志解析）">~</span>`;
}

// ===== 汇总卡片更新 =====

/**
 * 拉取 /api/summary 并更新四张汇总卡片
 */
async function fetchSummary() {
  try {
    const res = await fetch('/api/summary');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 是否为估算值（log_observer 模式下数据为估算）
    const isEstimated = currentMode === 'log_observer';

    // 今日 Token 用量
    document.getElementById('todayTokens').innerHTML =
      addEstimatedMark(formatNumber(data.today_tokens), isEstimated);
    document.getElementById('yesterdayTokens').textContent =
      formatNumber(data.yesterday_tokens);

    // 今日花费
    document.getElementById('todayCost').innerHTML =
      addEstimatedMark(formatCost(data.today_cost), isEstimated);
    document.getElementById('yesterdayCost').textContent =
      formatCost(data.yesterday_cost);

    // 本次会话时长（后端返回秒数）
    const sessionSeconds = data.session_seconds || 0;
    document.getElementById('sessionTime').textContent =
      formatTime(sessionSeconds * 1000);

    // 高峰状态
    updatePeakStatus(data.peak);

    // 累计节省
    document.getElementById('totalSaved').textContent =
      formatCost(data.total_saved);
    // 计算节省百分比
    const totalBaseline = data.today_cost + data.total_saved;
    const pct = totalBaseline > 0
      ? (data.total_saved / totalBaseline * 100).toFixed(1) + '%'
      : '—';
    document.getElementById('savedPercent').textContent =
      pct !== '—' ? '↑ 省 ' + pct : '—';

  } catch (err) {
    // 静默失败，保留旧数据
    console.warn('[PinToken] summary fetch failed:', err.message);
  }
}

// ===== 请求明细表格渲染 =====

/**
 * 拉取请求明细并渲染表格
 * @param {string} provider - 过滤的 provider（空字符串表示全部）
 */
async function fetchRequests(provider = '') {
  try {
    const params = new URLSearchParams({
      provider: provider,
      limit: 50,
      offset: 0,
    });
    const res = await fetch(`/api/requests?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // data 可能是数组，也可能是 { requests: [...], total: N }
    const rows = Array.isArray(data) ? data : (data.requests || []);

    renderTable(rows);
  } catch (err) {
    console.warn('[PinToken] requests fetch failed:', err.message);
    // 显示空状态
    renderTable([]);
  }
}

/**
 * 计算各行 token 占总量的百分比
 * @param {Array} rows
 * @returns {number} 总 token 数
 */
function calcTotalTokens(rows) {
  return rows.reduce((sum, row) => {
    return sum + (Number(row.input_tokens) || 0) + (Number(row.output_tokens) || 0);
  }, 0);
}

/**
 * 渲染请求明细表格
 * @param {Array} rows
 */
function renderTable(rows) {
  const tbody = document.getElementById('requestBody');
  tbody.innerHTML = '';

  if (!rows || rows.length === 0) {
    // 增强版空状态
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6">
      <div class="empty-state-enhanced" role="status">
        <div class="empty-state-title">未检测到 Claude Code 日志</div>
        <div class="empty-state-desc">启动 Claude Code 后数据将自动出现。如需追踪其他工具，请启用代理模式。</div>
        <button class="empty-state-btn" onclick="document.getElementById('proxyGuide').scrollIntoView({behavior:'smooth'})">了解代理模式</button>
      </div>
    </td>`;
    tbody.appendChild(tr);
    return;
  }

  // 表格出现时添加淡入动画
  tbody.classList.add('table-fade-in');

  const totalTokens = calcTotalTokens(rows);

  rows.forEach(row => {
    const tokens = (Number(row.input_tokens) || 0) + (Number(row.output_tokens) || 0);
    const pct = totalTokens > 0
      ? ((tokens / totalTokens) * 100).toFixed(1)
      : '0.0';
    const pctNum = parseFloat(pct);

    // Provider 样式类名（小写匹配）
    const providerClass = (row.provider || '').toLowerCase();

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="model-pill">${escapeHtml(row.model || '—')}</span>
      </td>
      <td>
        <span class="provider-dot ${providerClass}">
          ${escapeHtml(row.provider || '—')}
        </span>
      </td>
      <td>${formatNumber(tokens)}</td>
      <td>
        <div class="progress-bar-wrap">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width: ${pctNum}%"></div>
          </div>
          <span class="progress-pct">${pct}%</span>
        </div>
      </td>
      <td>
        <span class="cost-value">${formatCost(row.cost_usd)}</span>
      </td>
      <td>
        <span class="saved-value">${row.saved_usd > 0 ? formatCost(row.saved_usd) : '—'}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== 工具：HTML 转义，防 XSS =====
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== 高峰状态更新 =====

// 各状态对应的文案
const PEAK_MESSAGES = {
  normal: {
    headline: '当前状态正常，所有 API 运行稳定',
    desc: '当前所有 Provider 运行正常，API 响应速度稳定，可放心使用。下一个高峰时段：今晚 21:00（北京时间）',
  },
  warning: {
    headline: '注意：30 分钟内将进入高峰时段',
    desc: 'Anthropic 即将进入限速高峰（21:00–03:00 北京时间），建议提前完成重要任务，或切换至非高峰 Provider',
  },
  peak: {
    headline: '当前处于高峰限速时段，请注意用量',
    desc: 'Anthropic 当前处于限速高峰期（21:00–03:00 北京时间），响应可能变慢或触发限速，建议降级模型或延后使用',
  },
};

/**
 * 根据 summary 中的 peak 数据更新顶部胶囊 + 状态区域
 * @param {{ status, label, tip }} peak
 */
function updatePeakStatus(peak) {
  if (!peak) return;

  // 状态区域
  const section = document.getElementById('statusSection');
  section.className = 'status-section ' + peak.status;

  const msg = PEAK_MESSAGES[peak.status] || PEAK_MESSAGES.normal;
  document.getElementById('statusHeadline').textContent = msg.headline;
  document.getElementById('statusDesc').textContent = msg.desc;
}

// ===== 订阅对比卡片 =====

/**
 * 拉取 /api/subscription 并更新第 5 张卡片
 */
async function fetchSubscription() {
  try {
    const res = await fetch('/api/subscription');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const diff = data.diff || 0;
    const savedEl = document.getElementById('subSaved');
    const detailEl = document.getElementById('subDetail');

    if (diff > 0) {
      savedEl.textContent = '$' + diff.toFixed(2);
      savedEl.style.color = 'var(--green)';
      detailEl.textContent = '省 ' + ((diff / data.month_cost) * 100).toFixed(0) + '%';
    } else {
      savedEl.textContent = '$' + Math.abs(diff).toFixed(2);
      savedEl.style.color = 'var(--yellow)';
      detailEl.textContent = '用量较少';
    }
  } catch (err) {
    console.warn('[PinToken] subscription fetch failed:', err.message);
  }
}

// ===== Provider 过滤器交互 =====

/**
 * 初始化过滤器按钮点击事件
 */
function initFilterButtons() {
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // 更新激活状态
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 更新全局过滤器并重新拉取
      currentProvider = btn.dataset.provider || '';
      fetchRequests(currentProvider);
    });
  });
}

// ===== 扫描进度条更新 =====

/**
 * 轮询 /api/scan-status 并更新进度条 UI
 */
async function fetchScanStatus() {
  try {
    const res = await fetch('/api/scan-status');
    if (!res.ok) return;
    const data = await res.json();

    const progressEl = document.getElementById('scanProgress');
    const barEl = document.getElementById('scanProgressBar');
    const textEl = document.getElementById('scanProgressText');

    if (data.phase === 'recent' && data.scanning) {
      // 正在扫描近期日志
      progressEl.classList.remove('hidden');
      const pct = data.totalFiles > 0
        ? Math.round((data.filesScanned / data.totalFiles) * 100)
        : 0;
      barEl.style.width = pct + '%';
      barEl.classList.add('pulse');
      textEl.textContent = `正在扫描近期日志... ${data.recordsFound} 条记录已找到`;
      progressEl.setAttribute('aria-valuenow', pct);
    } else if (data.phase === 'recent' && !data.scanning && !scanCompleteShown) {
      // recent 阶段刚完成
      scanCompleteShown = true;
      barEl.style.width = '100%';
      barEl.classList.remove('pulse');
      textEl.textContent = `扫描完成！共 ${data.recordsFound} 条记录`;
      progressEl.setAttribute('aria-valuenow', 100);
      // 2s 后缩小为小字
      setTimeout(() => {
        textEl.textContent = '后台补扫历史数据中...';
        barEl.style.width = '0%';
      }, 2000);
    } else if (data.phase === 'backfill') {
      // 后台补扫
      progressEl.classList.remove('hidden');
      barEl.style.width = '0%';
      barEl.classList.remove('pulse');
      textEl.textContent = '后台补扫历史数据中...';
    } else if (data.phase === 'idle') {
      // 空闲：隐藏进度条
      progressEl.classList.add('hidden');
    }

    // 更新代理引导卡状态
    updateProxyGuide(data.proxyActive);

    // 检测首条数据到达：触发 empty state → table 过渡
    if (data.recordsFound > 0 && lastRecordsFound === 0) {
      fetchRequests(currentProvider);
    }
    lastRecordsFound = data.recordsFound;

  } catch {
    // 静默失败
  }
}

/**
 * 更新代理引导卡状态
 * @param {boolean} proxyActive
 */
function updateProxyGuide(proxyActive) {
  const guideEl = document.getElementById('proxyGuide');
  const activeEl = document.getElementById('proxyActive');

  if (proxyActive) {
    guideEl.style.display = 'none';
    activeEl.style.display = '';
  } else {
    // 检查用户是否已关闭引导卡
    const dismissed = localStorage.getItem('pintoken-guide-dismissed');
    if (dismissed === '1') {
      guideEl.style.display = 'none';
    }
    activeEl.style.display = 'none';
  }
}

// ===== 轮询刷新 =====

/**
 * 执行一次完整刷新（汇总 + 请求列表 + 扫描状态）
 */
function refresh() {
  fetchSummary();
  fetchSubscription();
  fetchRequests(currentProvider);
  fetchScanStatus();
}

/**
 * 启动 5 秒轮询
 */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refresh, 5000);
}

// ===== Tab 切换 =====

/**
 * 初始化 Tab 导航切换逻辑
 */
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 更新 Tab 激活状态
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // 切换面板可见性
      panels.forEach(p => p.style.display = p.dataset.tab === tab.dataset.tab ? '' : 'none');
      // 切换到对应 tab 时拉取数据
      if (tab.dataset.tab === 'analytics') fetchAnalytics();
      if (tab.dataset.tab === 'providers') fetchProviders();
    });
  });
}

// ===== Analytics 数据与图表 =====

/**
 * 拉取 Analytics 数据（趋势 + 模型分布），渲染图表
 */
async function fetchAnalytics() {
  try {
    const [trendRes, modelsRes] = await Promise.all([
      fetch('/api/analytics/trend?days=30'),
      fetch('/api/analytics/models'),
    ]);
    if (trendRes.ok) {
      const trendData = await trendRes.json();
      renderTrendChart(Array.isArray(trendData) ? trendData : (trendData.data || []));
    }
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      renderModelChart(Array.isArray(modelsData) ? modelsData : (modelsData.data || []));
    }
  } catch (err) {
    console.warn('[PinToken] analytics fetch failed:', err.message);
  }
}

/**
 * 渲染近 30 天花费趋势折线图（纯 SVG）
 * @param {Array<{date: string, cost: number}>} data
 */
function renderTrendChart(data) {
  const svg = document.getElementById('trendChart');
  if (!data || data.length === 0) {
    svg.innerHTML = '<text x="300" y="100" fill="#8b8fa8" text-anchor="middle" font-size="12">暂无数据</text>';
    return;
  }

  const W = 600, H = 200;
  const PAD = { top: 10, right: 10, bottom: 30, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxCost = Math.max(...data.map(d => d.cost)) || 1;
  const points = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * plotW,
    y: PAD.top + plotH - (d.cost / maxCost) * plotH,
    date: d.date,
    cost: d.cost
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L${points[points.length - 1].x},${PAD.top + plotH} L${points[0].x},${PAD.top + plotH} Z`;

  let html = '';
  // Y 轴刻度（4 条水平网格线）
  for (let i = 0; i <= 3; i++) {
    const y = PAD.top + (plotH / 3) * i;
    const val = (maxCost * (3 - i) / 3).toFixed(0);
    html += `<line x1="${PAD.left}" y1="${y}" x2="${W - PAD.right}" y2="${y}" stroke="#2a2d35" stroke-width="0.5"/>`;
    html += `<text x="${PAD.left - 8}" y="${y + 3}" fill="#8b8fa8" text-anchor="end" font-size="9">$${val}</text>`;
  }
  // X 轴日期标签（每 5 天显示一次）
  points.forEach((p, i) => {
    if (i % 5 === 0 || i === points.length - 1) {
      html += `<text x="${p.x}" y="${H - 5}" fill="#8b8fa8" text-anchor="middle" font-size="9">${p.date.slice(5)}</text>`;
    }
  });
  // 填充区域
  html += `<path d="${areaPath}" fill="#FF6B35" fill-opacity="0.1"/>`;
  // 折线
  html += `<path d="${linePath}" fill="none" stroke="#FF6B35" stroke-width="1.5"/>`;
  // 数据点
  points.forEach(p => {
    html += `<circle cx="${p.x}" cy="${p.y}" r="2" fill="#FF6B35"/>`;
  });

  svg.innerHTML = html;
}

/**
 * 渲染模型使用分布饼图（纯 SVG）
 * @param {Array<{model: string, total_tokens: number}>} data
 */
function renderModelChart(data) {
  const svg = document.getElementById('modelChart');
  const legend = document.getElementById('modelLegend');
  if (!data || data.length === 0) {
    svg.innerHTML = '<text x="150" y="100" fill="#8b8fa8" text-anchor="middle" font-size="12">暂无数据</text>';
    legend.innerHTML = '';
    return;
  }

  // 品牌配色序列
  const COLORS = ['#FF6B35', '#27c93f', '#ffbd2e', '#ff5f56', '#5b9aff', '#c084fc', '#f472b6', '#34d399', '#fbbf24', '#8b8fa8'];
  const total = data.reduce((s, d) => s + d.total_tokens, 0);
  const cx = 150, cy = 100, r = 70;

  let html = '';
  let legendHtml = '';
  let startAngle = -Math.PI / 2;

  data.forEach((d, i) => {
    const pct = d.total_tokens / total;
    const endAngle = startAngle + pct * 2 * Math.PI;
    const largeArc = pct > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const color = COLORS[i % COLORS.length];

    html += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z" fill="${color}" opacity="0.85"/>`;
    legendHtml += `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${color};margin-right:4px"></span>${escapeHtml(d.model)} ${(pct * 100).toFixed(1)}%</span>`;
    startAngle = endAngle;
  });

  svg.innerHTML = html;
  legend.innerHTML = legendHtml;
}

// ===== 入口 =====

document.addEventListener('DOMContentLoaded', () => {
  initTabs();           // 绑定 Tab 切换
  initFilterButtons();  // 绑定过滤器按钮
  updateModeIndicator(); // 获取并显示当前模式
  refresh();            // 立即首次加载
  startPolling();       // 开始轮询

  // 代理引导卡：关闭按钮
  document.getElementById('proxyGuideClose').addEventListener('click', () => {
    document.getElementById('proxyGuide').style.display = 'none';
    localStorage.setItem('pintoken-guide-dismissed', '1');
  });

  // 代理引导卡：复制命令按钮
  document.getElementById('proxyGuideCopy').addEventListener('click', () => {
    const btn = document.getElementById('proxyGuideCopy');
    navigator.clipboard.writeText('pintoken setup --proxy').then(() => {
      btn.textContent = '✓ 已复制';
      setTimeout(() => { btn.textContent = '复制'; }, 1500);
    });
  });

  // 首次加载时检查引导卡是否已关闭
  if (localStorage.getItem('pintoken-guide-dismissed') === '1') {
    document.getElementById('proxyGuide').style.display = 'none';
  }

  // 立即获取一次扫描状态
  fetchScanStatus();

  // 关闭按钮：Electron 环境关窗口，浏览器关标签页
  document.getElementById('closeBtn').addEventListener('click', () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      window.close();
    }
  });

  // ===== 分享卡片功能 =====

  // 分享按钮 → 打开弹窗，拉取数据并渲染卡片
  document.getElementById('shareBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/share-data');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();

      // 调用另一个 Agent 创建的 generateShareCard 函数
      const canvas = window.generateShareCard(data);
      const preview = document.getElementById('sharePreview');
      preview.innerHTML = '';
      preview.appendChild(canvas);

      document.getElementById('shareModal').style.display = 'flex';
    } catch (err) {
      console.warn('[PinToken] share card error:', err.message);
    }
  });

  // 关闭弹窗：点击关闭按钮
  document.getElementById('shareClose').addEventListener('click', () => {
    document.getElementById('shareModal').style.display = 'none';
  });

  // 关闭弹窗：点击背景遮罩
  document.getElementById('shareBackdrop').addEventListener('click', () => {
    document.getElementById('shareModal').style.display = 'none';
  });

  // 下载图片：将 Canvas 导出为 PNG 并触发下载
  document.getElementById('shareDownload').addEventListener('click', () => {
    const canvas = document.querySelector('#sharePreview canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'pintoken-savings.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // 缓存当前卡片数据
  let _shareData = null;

  // 云端 API 地址
  const CLOUD_API = 'https://pintoken-cloud.vercel.app';

  /**
   * 后台自动上传卡片到云端，返回卡片公开 URL
   * 云端未部署时返回 null，分享降级为纯文字
   */
  async function uploadCardSilent() {
    if (!CLOUD_API || !_shareData) return null;
    try {
      const canvas = document.querySelector('#sharePreview canvas');
      if (!canvas) return null;
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      const res = await fetch(CLOUD_API + '/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ..._shareData, image_data: imageData }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch { return null; }
  }

  // 多平台分享（自动上传 → 带链接分享 → OG 图片自动展示）

  // 保存 share data
  document.getElementById('shareBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/share-data');
      if (res.ok) _shareData = await res.json();
    } catch {}
  }, true);

  function getShareText(cardUrl) {
    const saved = _shareData ? '$' + _shareData.saved.toFixed(0) : 'money';
    const url = cardUrl || 'https://PinToken.ai';
    return `I saved ${saved} on AI APIs this month with PinToken!\nTrack your LLM spending → ${url}\n#PinToken #AIcosts`;
  }

  // 点平台按钮：后台上传 → 用云端 URL 分享（含 OG 图片）
  document.querySelectorAll('.share-platform').forEach(btn => {
    btn.addEventListener('click', async () => {
      const platform = btn.dataset.platform;

      // 后台上传（云端部署后自动生效，未部署时降级为 PinToken.ai）
      const cardUrl = await uploadCardSilent();
      const text = getShareText(cardUrl);
      const shareUrl = cardUrl || 'https://PinToken.ai';
      const encoded = encodeURIComponent(text);
      const encodedUrl = encodeURIComponent(shareUrl);

      if (platform === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank');
        return;
      }

      if (platform === 'copy') {
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = '✓';
          btn.style.color = 'var(--green)';
          btn.style.borderColor = 'var(--green)';
          setTimeout(() => { btn.textContent = '⎘'; btn.style.color = ''; btn.style.borderColor = ''; }, 1500);
        });
        return;
      }

      const urls = {
        reddit: `https://www.reddit.com/submit?title=${encodeURIComponent('PinToken - Track your AI API spending')}&url=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        hackernews: `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodeURIComponent('PinToken – Pin your token, save your dollar')}`,
      };

      if (urls[platform]) window.open(urls[platform], '_blank');
    });
  });
});
