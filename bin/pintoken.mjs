#!/usr/bin/env node
// PinToken CLI 入口 — 支持 setup / start / --version / --help

import { setTimeout as delay } from 'node:timers/promises';
import { runSetup } from '../src/setup/index.mjs';
import { openBrowser } from '../src/setup/browser.mjs';
import { startServer } from '../src/proxy/server.mjs'; // Task 8 实现，此处仅声明引用
import { createStore, getDefaultDbPath } from '../src/db/store.mjs';
import { renderStatusPanel } from '../src/cli/status.mjs';

const VERSION = '0.1.0';
const PORT = 7777;

// ANSI 橙色（256色：208）
const ORANGE = '\x1b[38;5;208m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * 打印启动横幅
 */
function printBanner() {
  console.log('');
  console.log(`${ORANGE}${BOLD}🪙 PinToken v${VERSION}${RESET}`);
  console.log(`${ORANGE}  代理地址: http://localhost:${PORT}${RESET}`);
  console.log(`${ORANGE}  控制台:   http://localhost:${PORT}/dashboard${RESET}`);
  console.log('');
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(`
PinToken v${VERSION} — 本地 LLM API 用量追踪代理

用法:
  pintoken [命令]

命令:
  setup     初始化配置并启动代理服务器（默认）
  start     直接启动代理服务器（跳过配置写入）
  status    显示终端用量状态面板
  --version 显示版本号
  --help    显示此帮助信息
`);
}

/**
 * 启动代理服务器，并在 500ms 后自动打开控制台
 */
async function runServer() {
  printBanner();

  // 注册优雅退出信号处理
  const handleExit = () => {
    console.log('\n正在关闭 PinToken 服务器...');
    process.exit(0);
  };
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // 启动代理服务器（Task 8 实现）
  await startServer({ port: PORT });

  // 延迟 500ms 后打开控制台（等服务器就绪）
  await delay(500);
  openBrowser(`http://localhost:${PORT}/dashboard`);
}

/**
 * CLI 主入口
 */
async function main() {
  const command = process.argv[2] || 'setup';

  switch (command) {
    case 'setup': {
      // 先执行配置写入，再启动服务器
      await runSetup();
      await runServer();
      break;
    }

    case 'start': {
      // 直接启动服务器，跳过配置写入
      await runServer();
      break;
    }

    case 'status': {
      // 只读数据库，打印状态面板后退出（不启动服务器）
      const store = createStore(getDefaultDbPath());
      try {
        const data = store.getStatusData();
        renderStatusPanel(data);
      } finally {
        store.close();
      }
      break;
    }

    case '--version':
    case '-v': {
      console.log(`PinToken v${VERSION}`);
      break;
    }

    case '--help':
    case '-h': {
      printHelp();
      break;
    }

    default: {
      console.error(`未知命令: ${command}`);
      printHelp();
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
