/**
 * PinToken.ai 官网交互脚本
 * 纯 Vanilla JS，无依赖
 */

(function () {
  'use strict';

  // ========== 复制按钮 ==========

  /**
   * 初始化终端代码块的复制功能
   * 点击复制图标后将 npx pintoken setup 复制到剪贴板
   * 图标短暂变为 ✓，1.5 秒后恢复
   */
  function initCopyButton() {
    var copyBtn = document.querySelector('.copy-icon');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', function () {
      var command = copyBtn.getAttribute('data-copy') || 'npx pintoken setup';

      navigator.clipboard.writeText(command).then(function () {
        // 保存原始内容
        var originalHTML = copyBtn.innerHTML;

        // 显示成功状态
        copyBtn.innerHTML = '<span style="color:#27c93f;font-size:16px;">✓</span>';
        copyBtn.classList.add('copied');

        // 1.5 秒后恢复
        setTimeout(function () {
          copyBtn.innerHTML = originalHTML;
          copyBtn.classList.remove('copied');
        }, 1500);
      }).catch(function () {
        // 降级方案：使用旧版 API
        fallbackCopy(command);
      });
    });
  }

  /**
   * 降级复制方案，兼容不支持 Clipboard API 的浏览器
   */
  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } catch (e) {
      // 静默失败
    }

    document.body.removeChild(textarea);
  }

  // ========== 平滑滚动 ==========

  /**
   * 为所有锚点链接添加平滑滚动行为
   * 拦截 href 以 # 开头的链接点击事件
   */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var targetId = link.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      // 考虑固定导航栏的高度偏移
      var nav = document.querySelector('nav') || document.querySelector('.nav');
      var offset = nav ? nav.offsetHeight : 0;

      var targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });

      // 如果移动端菜单打开，滚动后关闭
      closeMobileMenu();
    });
  }

  // ========== 导航 CTA 按钮 ==========

  /**
   * Hero "Get Started" 按钮：复制命令 + 高亮终端
   * Nav "Get Started" 按钮：滚动到终端
   */
  function initGetStarted() {
    // Hero 内的 Get Started：点击复制命令并闪烁终端
    var heroCta = document.getElementById('hero-cta');
    if (heroCta) {
      heroCta.addEventListener('click', function (e) {
        e.preventDefault();
        var terminal = document.querySelector('.terminal');
        if (!terminal) return;

        // 复制命令
        var command = 'npx pintoken setup';
        navigator.clipboard.writeText(command).catch(function () {
          fallbackCopy(command);
        });

        // 终端闪烁高亮
        terminal.style.transition = 'box-shadow 0.3s';
        terminal.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.5), 0 4px 20px rgba(0,0,0,0.08)';

        // 复制图标变 ✓
        var copyIcon = terminal.querySelector('.copy-icon');
        if (copyIcon) {
          var originalHTML = copyIcon.innerHTML;
          copyIcon.innerHTML = '<span style="color:#27c93f;font-size:16px;">✓</span>';
          setTimeout(function () {
            copyIcon.innerHTML = originalHTML;
          }, 1500);
        }

        // 按钮文字短暂变为 Copied / 已复制
        var originalText = heroCta.textContent;
        var isZh = document.documentElement.lang === 'zh';
        heroCta.textContent = isZh ? '已复制!' : 'Copied!';
        setTimeout(function () {
          heroCta.textContent = originalText;
          terminal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
        }, 1500);
      });
    }

    // 导航栏 Get Started：滚动到终端
    var navCta = document.querySelector('.nav-cta');
    if (navCta) {
      navCta.addEventListener('click', function (e) {
        e.preventDefault();
        var terminal = document.querySelector('.terminal');
        if (!terminal) return;

        var nav = document.querySelector('.nav');
        var offset = nav ? nav.offsetHeight + 20 : 20;
        var targetPosition = terminal.getBoundingClientRect().top + window.pageYOffset - offset;

        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      });
    }
  }

  // ========== 移动端汉堡菜单 ==========

  /**
   * 点击汉堡图标展开/收起导航链接
   */
  function initMobileMenu() {
    var toggle = document.querySelector('.menu-toggle') ||
                 document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links') ||
                   document.querySelector('.nav-menu');

    if (!toggle || !navLinks) return;

    toggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('active');
      toggle.classList.toggle('active', isOpen);

      // 更新无障碍属性
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // 点击导航区域外部时关闭菜单
    document.addEventListener('click', function (e) {
      if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
        closeMobileMenu();
      }
    });
  }

  /**
   * 关闭移动端菜单
   */
  function closeMobileMenu() {
    var toggle = document.querySelector('.menu-toggle') ||
                 document.querySelector('.hamburger');
    var navLinks = document.querySelector('.nav-links') ||
                   document.querySelector('.nav-menu');

    if (!toggle || !navLinks) return;

    navLinks.classList.remove('active');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
  }

  // ========== 初始化 ==========

  /**
   * 语言切换按钮点击时标记手动选择，
   * 防止自动跳转覆盖用户选择
   */
  function initLangOverride() {
    var langLinks = document.querySelectorAll('.nav-lang a');
    langLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        sessionStorage.setItem('lang-override', '1');
      });
    });
  }

  function init() {
    initCopyButton();
    initSmoothScroll();
    initGetStarted();
    initMobileMenu();
    initLangOverride();
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
