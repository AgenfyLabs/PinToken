/**
 * PinToken 分享卡片 — 5 套皮肤配置
 * 供 share-card.js 渲染引擎使用
 */

const SHARE_SKINS = {
  terminal: {
    name: 'Terminal',
    nameZh: '终端暗夜',
    bg: { type: 'solid', color: '#0d1117', glow: { color: '#FF6B35', opacity: 0.08, y: 200, radius: 400 } },
    font: { primary: 'monospace', display: 'monospace' },
    colors: {
      text: '#e6edf3',
      textDim: '#8b949e',
      accent: '#FF6B35',
      saving: '#27c93f',
      barFill: '#FF6B35',
      barBg: '#21262d',
      cardBg: 'rgba(255,255,255,0.03)',
      border: '#30363d',
    },
    features: { trafficLights: true, borderStyle: 'solid' },
  },

  neon: {
    name: 'Neon',
    nameZh: '霓虹闪烁',
    bg: { type: 'solid', color: '#000000', glow: { color: '#FF6B35', opacity: 0.15, y: 540, radius: 500 } },
    font: { primary: 'sans-serif', display: 'sans-serif' },
    colors: {
      text: '#ffffff',
      textDim: '#888888',
      accent: '#FF6B35',
      saving: '#00ff88',
      barFill: '#FF6B35',
      barBg: '#1a1a1a',
      cardBg: 'rgba(255,255,255,0.04)',
      border: '#333333',
    },
    features: { glow: true, borderStyle: 'none' },
  },

  minimal: {
    name: 'Minimal',
    nameZh: '极简白',
    bg: { type: 'split', topColor: '#fafafa', bottomColor: '#f0f0f0', splitY: 720 },
    font: { primary: 'sans-serif', display: 'sans-serif' },
    colors: {
      text: '#1a1a1a',
      textDim: '#888888',
      accent: '#FF6B35',
      saving: '#16a34a',
      barFill: '#FF6B35',
      barBg: '#e5e5e5',
      cardBg: 'rgba(0,0,0,0.02)',
      border: '#e0e0e0',
    },
    features: { roundedBars: true, borderStyle: 'none' },
  },

  gradient: {
    name: 'Gradient',
    nameZh: '渐变冲击',
    bg: {
      type: 'gradient',
      stops: [
        { pos: 0, color: '#1a0a2e' },
        { pos: 0.5, color: '#2d1b69' },
        { pos: 1, color: '#FF6B35' },
      ],
      angle: 135,
    },
    font: { primary: 'sans-serif', display: 'sans-serif' },
    colors: {
      text: '#ffffff',
      textDim: 'rgba(255,255,255,0.6)',
      accent: '#ffffff',
      saving: '#ffffff',
      barFill: '#ffffff',
      barBg: 'rgba(255,255,255,0.15)',
      cardBg: 'rgba(255,255,255,0.08)',
      border: 'rgba(255,255,255,0.15)',
    },
    features: { glassCard: true, borderStyle: 'none' },
  },

  blueprint: {
    name: 'Blueprint',
    nameZh: '工程蓝图',
    bg: { type: 'solid', color: '#0a192f', grid: { size: 40, color: '#172a45', opacity: 0.3 } },
    font: { primary: 'monospace', display: 'monospace' },
    colors: {
      text: '#ccd6f6',
      textDim: '#8892b0',
      accent: '#64ffda',
      saving: '#64ffda',
      barFill: '#FF6B35',
      barBg: '#172a45',
      cardBg: 'rgba(100,255,218,0.03)',
      border: '#233554',
    },
    features: { dashedBorder: true, outlineBars: true, borderStyle: 'dashed' },
  },
};

window.SHARE_SKINS = SHARE_SKINS;
