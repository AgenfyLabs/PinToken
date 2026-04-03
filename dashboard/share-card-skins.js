/**
 * PinToken 分享卡片 — 5 套收据风格皮肤配置
 * 供 share-card.js 渲染引擎使用
 */

const SHARE_SKINS = {
  /* ── 1. 热敏纸收据 ─────────────────────────────────── */
  thermal: {
    name: 'Thermal',
    nameZh: '热敏纸',
    bg: { color: '#faf6f0' },
    font: { primary: 'monospace', display: 'monospace', weight: 'bold' },
    colors: {
      text: '#2a2a2a',
      textDim: '#888888',
      accent: '#2a2a2a',
      highlight: '#2a2a2a',
      line: '#cccccc',
      brand: '#FF6B35',
    },
    features: {
      tearEdge: true,
      dashedDivider: true,
      paperShadow: true,
      paperNoise: true,
    },
  },

  /* ── 2. 霓虹收据 ───────────────────────────────────── */
  neon: {
    name: 'Neon',
    nameZh: '霓虹',
    bg: { color: '#0a0a0a' },
    font: { primary: 'sans-serif', display: 'sans-serif', weight: 'bold' },
    colors: {
      text: '#ffffff',
      textDim: '#666666',
      accent: '#FF6B35',
      highlight: '#FF6B35',
      line: '#333333',
      brand: '#FF6B35',
      glow: '#FF6B35',
      glowAlt: '#27c93f',
    },
    features: {
      neonGlow: true,
      dashedDivider: false,
    },
  },

  /* ── 3. 碳纤维发票 ─────────────────────────────────── */
  carbon: {
    name: 'Carbon',
    nameZh: '碳纤维',
    bg: { color: '#1a1a1a' },
    font: { primary: 'sans-serif', display: 'sans-serif', weight: 'bold' },
    colors: {
      text: '#e0e0e0',
      textDim: '#777777',
      accent: '#FF6B35',
      highlight: '#FF6B35',
      line: '#333333',
      brand: '#FF6B35',
    },
    features: {
      carbonTexture: true,
      dashedDivider: false,
      thinLines: true,
    },
  },

  /* ── 4. 复古终端 ───────────────────────────────────── */
  retro: {
    name: 'Retro',
    nameZh: '复古终端',
    bg: { color: '#0c1a0c' },
    font: { primary: 'monospace', display: 'monospace', weight: 'bold' },
    colors: {
      text: '#33ff33',
      textDim: '#1a8a1a',
      accent: '#33ff33',
      highlight: '#33ff33',
      line: '#1a8a1a',
      brand: '#33ff33',
    },
    features: {
      scanlines: true,
      dashedDivider: true,
      cursor: true,
      crtGlow: true,
    },
  },

  /* ── 5. 极简收据 ───────────────────────────────────── */
  minimal: {
    name: 'Minimal',
    nameZh: '极简',
    bg: { color: '#ffffff' },
    font: { primary: 'sans-serif', display: 'sans-serif', weight: '800' },
    colors: {
      text: '#111111',
      textDim: '#999999',
      accent: '#FF6B35',
      highlight: '#111111',
      line: '#e0e0e0',
      brand: '#FF6B35',
    },
    features: {
      dashedDivider: false,
      thinLines: true,
      ultraLight: true,
    },
  },
};

window.SHARE_SKINS = SHARE_SKINS;
