// browser.mjs — 跨平台浏览器打开工具
import { exec } from 'node:child_process';
import { platform } from 'node:os';

/**
 * 在默认浏览器中打开指定 URL
 * 支持 macOS（open）和 Linux（xdg-open）
 * 若自动打开失败，则打印 URL 供用户手动访问
 */
export function openBrowser(url) {
  const os = platform();
  let cmd;

  if (os === 'darwin') {
    cmd = `open "${url}"`;
  } else if (os === 'linux') {
    cmd = `xdg-open "${url}"`;
  } else {
    // 其他平台（如 Windows）无法自动打开，提示用户手动访问
    console.log(`请手动在浏览器中打开：\n  ${url}`);
    return;
  }

  exec(cmd, (err) => {
    if (err) {
      // 命令执行失败时提示用户手动访问
      console.log(`无法自动打开浏览器，请手动访问：\n  ${url}`);
    }
  });
}
