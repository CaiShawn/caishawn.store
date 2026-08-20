/* ----------------------------------------------------------------- *
 * app.js — shared page logic for index.html / 404.html              *
 *                                                                    *
 * Extracted from the inline <script> in index.html so that CSP can   *
 * drop 'unsafe-inline' from script-src (see Caddy header config).    *
 * Loaded with <script defer> on both pages; no globals exposed.      *
 *                                                                    *
 * Two independent parts:                                             *
 *   1. shared()  — runs everywhere: 404 path display + avatar error  *
 *      fallback (local SVG, avoids data: URI under strict img-src).  *
 *   2. boot()    — index.html SPA only: hash router + footer nav +   *
 *      interactive command prompt. Early-returns on pages without    *
 *      [data-tab] sections (i.e. 404), so no .app class is applied   *
 *      there and the stacked no-JS layout stays intact.              *
 * ----------------------------------------------------------------- */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ 1. shared: works on every page ============ */

  ready(function () {
    /* 404: echo the visited path into #path-display (no animation) */
    var pathEl = document.getElementById('path-display');
    if (pathEl) pathEl.textContent = window.location.pathname + window.location.search;

    /* friend-card avatars: on load failure swap to local fallback SVG.
     * Inline onerror attributes were removed (blocked under strict CSP). */
    var avatars = document.querySelectorAll('.friend-card img.avatar');
    avatars.forEach(function (img) {
      img.addEventListener('error', function () {
        this.src = 'assets/img/avatar-fallback.svg';
        this.classList.add('avatar-fallback');
      });
    });
  });

  /* ============ 2. boot: index.html SPA only ============ */

  ready(function () {
    var main = document.getElementById('main');
    if (!main) return;
    var sections = Array.prototype.slice.call(main.querySelectorAll(':scope> section[data-tab]'));
    if (!sections.length) return; // 404 / any non-SPA page: keep stacked layout

    var framed = document.querySelector('section.framed-block');
    var HOME = 'home'; // virtual tab id for the home page

    function hashFor(tab) {
      return tab === HOME ? '#~' : '#~/' + tab;
    }
    function tabFromHash(h) {
      var s = (h || '').replace(/^#~?\/?/, '');
      return s === '' ? HOME : s;
    }

    // Title block also navigates to home
    var titleBlock = document.querySelector('.title-block');
    if (titleBlock) {
      function goHome(e) {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        goto(HOME);
      }
      titleBlock.addEventListener('click', goHome);
      titleBlock.addEventListener('keydown', goHome);
    }

    var pathEl = document.getElementById('title-path');
    var currentTab = HOME; // tracked globally so pwd can read it
    function setPath(tab) {
      if (!pathEl) return;
      var path = tab === HOME ? '~' : '~/' + tab;
      pathEl.textContent = path;
    }
    function activate(tab) {
      currentTab = tab;
      var isHome = (tab === HOME);
      // toggle main sections
      sections.forEach(function (s) {
        s.classList.toggle('active', s.dataset.tab === tab);
      });
      /* 当前路由状态挂到 body[data-tab]：CSS 用属性选择器响应（取代 .has-js + .home 双开关） */
      document.body.dataset.tab = (tab === HOME ? 'home' : tab);
      // sync title-path with current location
      setPath(tab);
      // hash routing: replace, not push (no history noise)
      try { history.replaceState(null, '', hashFor(tab)); }
      catch (e) { location.hash = hashFor(tab); }
    }
    /* goto = activate 路由 + 清空 cmd-output。scroll=true 时额外滚到页首。 */
    function goto(tab, scroll) {
      activate(tab);
      var out = document.getElementById('cmd-output');
      if (out) out.replaceChildren();
      if (scroll) window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    // initial: from hash, else home
    var initial = tabFromHash(location.hash);
    var exists = (initial === HOME) || sections.some(function (s) { return s.dataset.tab === initial; });
    goto(exists ? initial : HOME);

    // respond to back/forward
    window.addEventListener('hashchange', function () {
      var t = tabFromHash(location.hash);
      var ok = (t === HOME) || sections.some(function (s) { return s.dataset.tab === t; });
      if (ok) goto(t);
    });

    // ===== Footer nav: prev / top / next (4-tab cycle; home is OUTSIDE the loop) =====
    // ORDER 不含 HOME：plans ↔ habits ↔ friends ↔ about 双向循环
    // 首页不显示箭头 → 进入循环只能通过命令或 hash，navTo 只需处理循环部分
    var ORDER = sections.map(function (s) { return s.dataset.tab; });
    function navTo(dir) {
      var i = ORDER.indexOf(currentTab);
      // 箭头在首页隐藏：调用 navTo 时 currentTab 必然在 ORDER 中
      var target = ORDER[(i + dir + ORDER.length) % ORDER.length];
      goto(target, true);
    }
    var backTop = document.querySelector('.back-to-top');
    if (backTop) {
      backTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    }
    var navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        navTo(parseInt(btn.getAttribute('data-nav'), 10) || 0);
      });
    });

    /* typewriter 效果由 assets/js/typewriter.js 独立处理 */

    // ===== Interactive command prompt =====
    (function promptInit() {
      /* 顶部唯一 prompt：共享 #cmd-form / #cmd-output */
      var form = document.getElementById('cmd-form');
      if (!form) return;
      var input = form.querySelector('input');
      var out = document.getElementById('cmd-output');
      if (!input || !out) return;

      /* sections / HOME / currentTab / goto 均从外层 ready() 闭包取值——不在这里重复声明 */
      var aboutData = {
        name: 'Cai Shawn',
        edu:  'TJU SE-grad',
        vibe: 'engineer',
        loc:  'Hubei_HG',
        bio:  '咀嚼自我，随心一记'
      };
      var HELP = [
        'whoami            short bio',
        'ls                list sections',
        'cd <section>      open a section',
        'clear             clear output'
      ];

      /* 每个 output 独立一份 runner（line/appendText/appendKw/append 闭包到自己的 out） */
      function makeRunner(out) {
        function append(node) {
          out.appendChild(node);
          node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        function line(text, cls) {
          var p = document.createElement('p');
          p.className = 'line' + (cls ? ' ' + cls : '');
          p.textContent = text;
          return p;
        }
        /* DOM-API 辅助：所有数据走 textContent / createTextNode，无 innerHTML，避免拼接 HTML 字符串带来的 XSS */
        function appendText(parent, s) {
          parent.appendChild(document.createTextNode(s));
        }
        function appendKw(parent, label) {
          var s = document.createElement('span');
          s.className = 'kw';
          s.textContent = label;
          parent.appendChild(s);
        }

        /* ---- 命令注册表 ----
         * 每个 handler 纯函数: ({ cmd, head, rest }) → result
         * result 字段（均可选）：
         *   lines  要追加的 <p class="line[...]"> 节点数组
         *   goto   切到这个 tab
         *   scroll 切 tab 后是否滚到页首
         *   clear  是否清空 cmd-output
         */
        var commands = {
          help: function () { return { lines: HELP.map(line) }; },
          whoami: function () {
            var p = document.createElement('p');
            p.className = 'line';
            appendKw(p, 'name'); appendText(p, ': ' + aboutData.name + ' ');
            appendKw(p, 'edu');  appendText(p, ': ' + aboutData.edu + ' ');
            appendKw(p, 'loc');  appendText(p, ': ' + aboutData.loc);
            return { lines: [p] };
          },
          cat: function (ctx) {
            return /motto\.txt/.test(ctx.cmd)
              ? { lines: [line(aboutData.bio)] }
              : { lines: [line("cat: try 'motto.txt'", 'err')] };
          },
          ls: function () {
            var items = sections.map(function (s) { return '~/' + s.dataset.tab; });
            return { lines: [line('~ ' + items.join(' '))] };
          },
          pwd: function () {
            return { lines: [line(currentTab === HOME ? '~' : '~/' + currentTab)] };
          },
          cd: function (ctx) {
            var target = ctx.rest.replace(/[\/~]/g, '');
            var resolved;
            if (target === '' || target === '~')                          resolved = HOME;
            else if (sections.some(function (s) { return s.dataset.tab === target; })) resolved = target;
            if (!resolved) return { lines: [line("cd: no such section: " + target + ". try 'ls'.", 'err')] };
            return { goto: resolved, scroll: true };
          },
          clear: function () { return { clear: true }; },
        };
        /* 别名：'?' / '？' = help；'cls' = clear */
        commands['?']   = commands.help;
        commands['？']  = commands.help;
        commands.cls    = commands.clear;

        function run(raw) {
          var cmd = raw.trim();
          if (!cmd) return;
          append(line('> ' + cmd, 'echo'));
          var parts = cmd.split(/\s+/);
          var head = parts[0].toLowerCase();
          var rest = parts.slice(1).join(' ');

          var handler = commands[head];
          if (!handler) {
            append(line("command not found: " + head + ". try 'help'.", 'err'));
            return;
          }
          var r = handler({ cmd: cmd, head: head, rest: rest }) || {};
          /* 顺序：先 goto（自带清空）→ 后追加 lines → 保留 goto 后才追加的反馈行可见 */
          if (r.goto) goto(r.goto, r.scroll);
          else if (r.clear) out.replaceChildren();
          (r.lines || []).forEach(append);
        }
        return { run: run };
      }

      var runner = makeRunner(out);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        runner.run(input.value);
        input.value = '';
        input.focus();
      });

      // auto-focus on desktop only (don't steal focus on touch devices)
      if (matchMedia && matchMedia('(hover: hover)').matches) {
        window.addEventListener('load', function () { input.focus({ preventScroll: true }); });
      }
    })();

    document.body.classList.add('app');
  });
})();
