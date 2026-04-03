/**
 * PinToken 分享卡片 — 5 套皮肤配置
 * 供 share-card.js 渲染引擎使用
 * 深色模块化卡片风格
 */

const SHARE_SKINS = {
  /* ── 1. 深色经典（默认） ─────────────────────────────── */
  thermal: {
    name: 'Thermal',
    nameZh: '经典',
    bg: { color: '#141414' },
    font: { primary: 'monospace', display: 'monospace', weight: 'bold' },
    colors: {
      text: '#e8e8e8',
      textDim: '#777777',
      accent: '#FF6B35',
      highlight: '#e8e8e8',
      line: '#2a2a2a',
      brand: '#FF6B35',
      cardBg: 'rgba(255,255,255,0.04)',
    },
    features: {},
    heatmap: ['#1a1a1a', '#3d2200', '#7a4400', '#cc6600', '#FF6B35'],
  },

  /* ── 2. 霓虹 ─────────────────────────────────────────── */
  neon: {
    name: 'Neon',
    nameZh: '霓虹',
    bg: { color: '#0a0a0a' },
    font: { primary: 'sans-serif', display: 'sans-serif', weight: 'bold' },
    colors: {
      text: '#ffffff',
      textDim: '#555555',
      accent: '#FF6B35',
      highlight: '#FF6B35',
      line: '#222222',
      brand: '#FF6B35',
      glow: '#FF6B35',
      cardBg: 'rgba(255,107,53,0.04)',
    },
    features: { neonGlow: true },
    heatmap: ['#1a1a1a', '#3d1800', '#7a3000', '#cc5500', '#FF6B35'],
  },

  /* ── 3. 碳纤维 ───────────────────────────────────────── */
  carbon: {
    name: 'Carbon',
    nameZh: '碳纤维',
    bg: { color: '#161616' },
    font: { primary: 'sans-serif', display: 'sans-serif', weight: 'bold' },
    colors: {
      text: '#e0e0e0',
      textDim: '#666666',
      accent: '#FF6B35',
      highlight: '#FF6B35',
      line: '#2a2a2a',
      brand: '#FF6B35',
      cardBg: 'rgba(255,255,255,0.03)',
    },
    features: { carbonTexture: true },
    heatmap: ['#2a2a2a', '#3d2800', '#6b4400', '#cc7700', '#FF6B35'],
  },

  /* ── 4. 复古终端 ─────────────────────────────────────── */
  retro: {
    name: 'Retro',
    nameZh: '终端',
    bg: { color: '#0a150a' },
    font: { primary: 'monospace', display: 'monospace', weight: 'bold' },
    colors: {
      text: '#33ff33',
      textDim: '#1a7a1a',
      accent: '#33ff33',
      highlight: '#33ff33',
      line: '#1a3a1a',
      brand: '#33ff33',
      cardBg: 'rgba(51,255,51,0.03)',
    },
    features: { scanlines: true, crtGlow: true },
    heatmap: ['#0c1a0c', '#0d2e0d', '#1a5c1a', '#27a327', '#33ff33'],
  },

  /* ── 5. 极简 ─────────────────────────────────────────── */
  minimal: {
    name: 'Minimal',
    nameZh: '极简',
    bg: { color: '#1a1a1a' },
    font: { primary: 'sans-serif', display: 'sans-serif', weight: '800' },
    colors: {
      text: '#f0f0f0',
      textDim: '#666666',
      accent: '#FF6B35',
      highlight: '#f0f0f0',
      line: '#2a2a2a',
      brand: '#FF6B35',
      cardBg: 'rgba(255,255,255,0.05)',
    },
    features: {},
    heatmap: ['#222222', '#3d2200', '#7a4400', '#cc6600', '#FF6B35'],
  },
};

window.SHARE_SKINS = SHARE_SKINS;
