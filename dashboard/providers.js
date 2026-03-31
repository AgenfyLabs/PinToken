/**
 * PinToken Dashboard — Providers Tab 逻辑
 * 负责拉取 Provider 汇总数据并渲染卡片
 */

// Provider 品牌色映射
const PROVIDER_COLORS = {
  anthropic: '#FF6B35',
  openai:    '#10a37f',
  xai:       '#1DA1F2',
  gemini:    '#4285f4',
  moonshot:  '#6366f1',
  qwen:      '#7c3aed',
  glm:       '#0ea5e9',
  deepseek:  '#06b6d4',
};

/**
 * 格式化 token 数量为简短形式（K / M / B）
 * @param {number} n
 * @returns {string}
 */
function formatTokensShort(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

/**
 * 拉取 /api/analytics/providers 并渲染卡片
 */
async function fetchProviders() {
  try {
    const res = await fetch('/api/analytics/providers');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderProviderCards(data);
  } catch (err) {
    console.warn('[PinToken] providers fetch failed:', err.message);
    const grid = document.getElementById('providersGrid');
    if (grid) {
      grid.innerHTML = '<div class="providers-empty">加载失败，请稍后重试</div>';
    }
  }
}

/**
 * 渲染 Provider 卡片列表
 * @param {Array} providers - 后端返回的 provider 汇总数组
 */
function renderProviderCards(providers) {
  const grid = document.getElementById('providersGrid');
  if (!grid) return;

  // 空状态
  if (!providers || providers.length === 0) {
    grid.innerHTML = '<div class="providers-empty">暂无 Provider 数据</div>';
    return;
  }

  // 找出最大请求数，用于柱状图百分比计算
  const maxRequests = Math.max(...providers.map(p => p.request_count || 0));

  grid.innerHTML = providers.map(p => {
    const provider = (p.provider || '').toLowerCase();
    const color = PROVIDER_COLORS[provider] || '#8b8fa8';
    const barPct = maxRequests > 0 ? ((p.request_count || 0) / maxRequests * 100) : 0;
    const costStr = '$' + Number(p.total_cost || 0).toFixed(2);
    const tokensStr = formatTokensShort(p.total_tokens || 0);
    // 首字母大写的 Provider 名称
    const displayName = provider.charAt(0).toUpperCase() + provider.slice(1);

    return `
      <div class="provider-card">
        <div class="provider-card-header">
          <span class="provider-card-name">
            <span class="provider-card-dot ${provider}"></span>
            ${displayName}
          </span>
          <span class="provider-card-badge active">活跃</span>
        </div>
        <div class="provider-card-stats">
          <div class="provider-stat">
            <div class="provider-stat-value">${(p.request_count || 0).toLocaleString()}</div>
            <div class="provider-stat-label">请求数</div>
          </div>
          <div class="provider-stat">
            <div class="provider-stat-value">${tokensStr}</div>
            <div class="provider-stat-label">Tokens</div>
          </div>
          <div class="provider-stat">
            <div class="provider-stat-value cost">${costStr}</div>
            <div class="provider-stat-label">花费</div>
          </div>
        </div>
        <div class="provider-bar-wrap">
          <div class="provider-bar-fill" style="width:${barPct.toFixed(1)}%;background:${color}"></div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== 初始化：监听 tab 切换，自动拉取数据 =====

document.addEventListener('DOMContentLoaded', () => {
  const panel = document.querySelector('[data-tab="providers"]');
  if (!panel) return;

  // 用 MutationObserver 监听 style 变化，tab 显示时自动拉取
  const observer = new MutationObserver(() => {
    if (panel.style.display !== 'none') {
      fetchProviders();
    }
  });

  observer.observe(panel, { attributes: true, attributeFilter: ['style'] });
});
