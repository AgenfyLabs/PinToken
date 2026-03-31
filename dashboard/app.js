/**
 * PinToken Dashboard — 前端逻辑
 * 纯原生 JS，无框架依赖
 * 每 5 秒轮询 API 更新数据
 */

// ===== 全局状态 =====
let currentProvider = '';       // 当前选中的 Provider 过滤器
let pollTimer = null;           // 轮询定时器句柄
let sessionStartTime = Date.now(); // 会话开始时间（页面加载时）

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

// ===== 汇总卡片更新 =====

/**
 * 拉取 /api/summary 并更新四张汇总卡片
 */
async function fetchSummary() {
  try {
    const res = await fetch('/api/summary');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // 今日 Token 用量
    document.getElementById('todayTokens').textContent =
      formatNumber(data.today_tokens);
    document.getElementById('yesterdayTokens').textContent =
      formatNumber(data.yesterday_tokens);

    // 今日花费
    document.getElementById('todayCost').textContent =
      formatCost(data.today_cost);
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
    // 空状态
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="empty-state">等待请求数据...</td>`;
    tbody.appendChild(tr);
    return;
  }

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

// ===== 轮询刷新 =====

/**
 * 执行一次完整刷新（汇总 + 请求列表）
 */
function refresh() {
  fetchSummary();
  fetchSubscription();
  fetchRequests(currentProvider);
}

/**
 * 启动 5 秒轮询
 */
function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(refresh, 5000);
}

// ===== 入口 =====

document.addEventListener('DOMContentLoaded', () => {
  initFilterButtons();  // 绑定过滤器按钮
  refresh();            // 立即首次加载
  startPolling();       // 开始轮询

  // 关闭按钮：Electron 环境关窗口，浏览器关标签页
  document.getElementById('closeBtn').addEventListener('click', () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    } else {
      window.close();
    }
  });
});
