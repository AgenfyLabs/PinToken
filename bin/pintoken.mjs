#!/usr/bin/env node
// PinToken CLI 入口 — 支持 setup / start / stop / status / uninstall / --version / --help

import { setTimeout as delay } from 'node:timers/promises';
import { writeFileSync, readFileSync, unlinkSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { runSetup } from '../src/setup/index.mjs';
import { openBrowser } from '../src/setup/browser.mjs';
import { startServer } from '../src/proxy/server.mjs';
import { createStore, getDefaultDbPath } from '../src/db/store.mjs';
import { renderStatusPanel } from '../src/cli/status.mjs';
import { removeClaudeBaseUrl } from '../src/setup/claude.mjs';
import { removeEnvFromProfile, detectShell, getShellProfilePath } from '../src/setup/shell.mjs';

const VERSION = '0.1.0';
const PORT = 7777;
const PID_FILE = join(homedir(), '.pintoken', 'pintoken.pid');

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
  setup     初始化并启动（默认 Scanner 模式，--proxy 启用代理模式）
  start     直接启动代理服务器（跳过配置写入）
  stop      停止代理服务器
  status    显示终端用量状态面板
  uninstall 停止代理并清理所有注入配置
  --version 显示版本号
  --help    显示此帮助信息
`);
}

/**
 * 启动代理服务器，并在 500ms 后自动打开控制台
 */
async function runServer() {
  printBanner();

  // 写入 PID 文件，供 stop 命令使用
  writeFileSync(PID_FILE, String(process.pid));

  // 注册优雅退出信号处理：清理 PID 文件
  const handleExit = () => {
    console.log('\n正在关闭 PinToken 服务器...');
    try { unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // 未捕获异常：记录到错误日志，清理 PID，退出
  process.on('uncaughtException', (err) => {
    const errorLog = join(homedir(), '.pintoken', 'error.log');
    const entry = `[${new Date().toISOString()}] ${err.stack || err.message}\n`;
    try { appendFileSync(errorLog, entry); } catch {}
    console.error('致命错误:', err.message);
    try { unlinkSync(PID_FILE); } catch {}
    process.exit(1);
  });

  // 启动代理服务器
  await startServer({ port: PORT });

  // 延迟 500ms 后打开控制台（等服务器就绪）
  await delay(500);
  openBrowser(`http://localhost:${PORT}/dashboard`);
}

/**
 * 停止 PinToken 代理进程，返回是否成功停止
 */
async function stopProxy() {
  const { execSync } = await import('node:child_process');
  let stopped = false;

  // 优先使用 PID 文件
  if (existsSync(PID_FILE)) {
    try {
      const pid = Number(readFileSync(PID_FILE, 'utf-8').trim());
      process.kill(pid, 'SIGTERM');
      try { unlinkSync(PID_FILE); } catch {}
      stopped = true;
    } catch {}
  }

  // PID 文件无效时回退到端口查找
  if (!stopped) {
    try {
      const pids = execSync('lsof -ti:7777', { encoding: 'utf-8' }).trim();
      if (pids) {
        for (const pid of pids.split('\n')) {
          try { process.kill(Number(pid), 'SIGTERM'); } catch {}
        }
        stopped = true;
      }
    } catch {}
  }

  return stopped;
}

/**
 * CLI 主入口
 */
async function main() {
  const command = process.argv[2] || 'setup';

  switch (command) {
    case 'setup': {
      // 解析 --proxy flag，决定 Scanner 模式（默认）还是 Proxy 模式
      const proxyFlag = process.argv.includes('--proxy');
      await runSetup({ proxy: proxyFlag });
      await runServer();
      break;
    }

    case 'start': {
      // 直接启动服务器，跳过配置写入
      await runServer();
      break;
    }

    case 'stop': {
      const stopped = await stopProxy();
      console.log(stopped
        ? `${ORANGE}✓ PinToken 代理已停止${RESET}`
        : 'PinToken 代理未在运行');
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

    case 'uninstall': {
      // 1. 先停止进程
      const stopped = await stopProxy();
      if (stopped) {
        console.log(`${ORANGE}✓ 代理进程已停止${RESET}`);
      }

      // 2. 清理 Claude Code settings.json
      const claudeRemoved = removeClaudeBaseUrl();
      console.log(claudeRemoved
        ? `${ORANGE}✓ 已移除 Claude Code 中的 ANTHROPIC_BASE_URL${RESET}`
        : '  Claude Code 配置中未找到 PinToken 设置');

      // 3. 清理 shell profile
      const shell = detectShell();
      const profilePath = getShellProfilePath(shell);
      const r1 = removeEnvFromProfile(profilePath, 'ANTHROPIC_BASE_URL');
      const r2 = removeEnvFromProfile(profilePath, 'OPENAI_BASE_URL');
      if (r1 === 'removed' || r2 === 'removed') {
        console.log(`${ORANGE}✓ 已清理 ${profilePath} 中的环境变量${RESET}`);
      } else {
        console.log(`  ${profilePath} 中未找到 PinToken 环境变量`);
      }

      // 4. 数据保留提示
      console.log('');
      console.log(`📊 用量数据保留在 ~/.pintoken/data.db`);
      console.log(`   如需彻底删除：rm -rf ~/.pintoken`);
      console.log('');
      console.log(`${ORANGE}${BOLD}PinToken 已卸载完成${RESET}`);
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
