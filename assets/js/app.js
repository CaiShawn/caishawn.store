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
      var hints = document.getElementById('cmd-hints');
      if (!input || !out) return;

      /* sections / HOME / currentTab / goto 均从外层 ready() 闭包取值——不在这里重复声明 */
      var aboutData = {
        name:  'shawn',
        title: 'software engineer',
        loc:   'Guangzhou',
        /* 第二行：贴合本站内容（PLANS / HABITS / 封存的小想法）。 */
        intro: 'chewing on ideas, jotting down plans, habits, and small thoughts.',
        email: 'caishawn@163.com'   /* 仅 cat contact.txt 用 */
      };

      /* 每个 output 独立一份 runner（line/append 闭包到自己的 out） */
      function makeRunner(out, hints) {
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

        /* ---- 命令注册表 ----
         * 数组 + 元信息（desc / usage），help 由 makeHelp() 遍历生成；
         * 新增命令只需填一项，help / dispatcher 都不必改。fn 仍是纯函数:
         *   ({ cmd, head, rest }) → result
         * result 字段（均可选）：
         *   lines  要追加的 <p class="line[...]"> 节点数组
         *   goto   切到这个 tab；dispatcher 会在 out 追加 echo + pwd
         *   scroll 切 tab 后是否滚到页首
         *   clear  是否清空 cmd-output（与 goto 互斥）
         */
        var commands = [
          { name: 'help',   desc: 'show this help',
            fn: function () { return { lines: makeHelp().map(line) }; } },
          { name: 'whoami', desc: 'short bio',
            fn: function () {
              return { lines: [
                line(aboutData.name + ' — ' + aboutData.title + ' based in ' + aboutData.loc + '.'),
                line(aboutData.intro)
              ] };
            } },
          { name: 'cat',    desc: 'read a file', usage: 'cat <file>',
            fn: function (ctx) {
              return /contact\.txt/.test(ctx.cmd)
                ? { lines: [line('e-mail:' + aboutData.email)] }
                : { lines: [line("cat: try 'contact.txt'", 'err')] };
            } },
          { name: 'ls',     desc: 'list sections',
            fn: function () {
              var items = sections.map(function (s) { return '~/' + s.dataset.tab; });
              return { lines: [line('~ ' + items.join(' '))] };
            } },
          { name: 'pwd',    desc: 'print working directory',
            fn: function () {
              return { lines: [line(currentTab === HOME ? '~' : '~/' + currentTab)] };
            } },
          { name: 'cd',     desc: 'open a section', usage: 'cd <section>',
            fn: function (ctx) {
              var target = ctx.rest.replace(/[\/~]/g, '');
              var resolved;
              if (target === '' || target === '~')                          resolved = HOME;
              else if (sections.some(function (s) { return s.dataset.tab === target; })) resolved = target;
              if (!resolved) return { lines: [line("cd: no such section: " + target + ". try 'ls'.", 'err')] };
              return { goto: resolved, scroll: true };
            } },
          { name: 'clear',  desc: 'clear output',
            fn: function () { return { clear: true }; } },
        ];
        /* 别名：'?' / '？' = help；'cls' = clear */
        var aliases = { '?': 'help', '？': 'help', 'cls': 'clear' };

        function makeHelp() {
          /* usage 优先于 name；左对齐到 18 列后接 desc。 */
          return commands.map(function (c) {
            var use = c.usage || c.name;
            return (use + ' '.repeat(Math.max(1, 18 - use.length))) + c.desc;
          });
        }
        function resolve(head) {
          var name = aliases[head] || head;
          for (var i = 0; i < commands.length; i++) {
            if (commands[i].name === name) return commands[i];
          }
          return null;
        }

        /* ---- ↑↓ history (stateful; hIdx 0..size，=size 表示在 draft 区) ---- */
        function makeHistory() {
          var list = [];
          var hIdx = 0;
          var draft = '';
          return {
            push: function (cmd) {
              cmd = cmd.trim();
              if (!cmd) return false;
              /* 连续重复合并（shell HISTCONTROL=ignoredups 语义） */
              if (list.length && list[list.length - 1] === cmd) return false;
              list.push(cmd);
              hIdx = list.length;
              draft = '';
              return true;
            },
            reset: function () { list = []; hIdx = 0; draft = ''; },
            size: function () { return list.length; },
            hIdx: function () { return hIdx; },
            /* 首次进入历史前暂存当前 input；仅 hIdx===size 时生效 */
            saveDraft: function (v) { if (hIdx === list.length) draft = v; },
            /* delta: -1 = ↑, +1 = ↓；边界 clamp */
            move: function (delta) {
              if (delta === -1 && hIdx > 0)               hIdx--;
              else if (delta === +1 && hIdx < list.length) hIdx++;
            },
            current: function () {
              return hIdx === list.length ? draft : list[hIdx];
            },
            last: function () { return list.length ? list[list.length - 1] : ''; },
            peek: function () {
              return { list: list.slice(), hIdx: hIdx, draft: draft };
            }
          };
        }
        var history = makeHistory();

        /* ---- Tab completion (返回新值 + matches 供 caller 决定是否列出) ----
 * 两阶段：parts[2] 存在（已敲空格）→ 补参数；否则 → 补命令名。
 * 参数表里没登记该命令则安静返回原值，不抢命令名路径。 */
        function makeCompleter(cmds, aliasMap, args) {
          var lastMatches = null;
          function complete(value) {
            var parts = value.split(/(\s+)/);  // 保留空白 token
            var head  = (parts[0] || '').toLowerCase();
            if (!head) { lastMatches = null; return value; }
            if (parts[2] !== undefined) {
              var candidates = args[head] || [];
              var am = candidates.filter(function (a) { return a.startsWith(parts[2]); });
              if (!am.length) { lastMatches = null; return value; }
              if (am.length === 1) {
                parts[2] = am[0];
                lastMatches = null;
                return parts.join('');
              }
              lastMatches = am;
              return value;
            }
            var names = [];
            for (var i = 0; i < cmds.length; i++) names.push(cmds[i].name);
            for (var k in aliasMap) names.push(k);
            var matches = names.filter(function (n) { return n.startsWith(head); });
            if (!matches.length) { lastMatches = null; return value; }
            if (matches.length === 1) {
              parts[0] = matches[0];
              lastMatches = null;
              return parts.join('');
            }
            /* 多匹配：保持原值，caller 用 matches() 列出候选。 */
            lastMatches = matches;
            return value;
          }
          return {
            complete: complete,
            matches: function () { return lastMatches; }
          };
        }
        /* 参数补全表：键 = 命令名，值 = 合法参数候选。只支持 1 个参数（parts[2]）。 */
        var argTable = {
          cat: ['contact.txt'],
          cd:  sections.map(function (s) { return s.dataset.tab; })
        };
        var completer = makeCompleter(commands, aliases, argTable);

        function run(raw) {
          var cmd = raw.trim();
          if (!cmd) return;
          history.push(cmd);
          var parts = cmd.split(/\s+/);
          var head = parts[0].toLowerCase();
          var rest = parts.slice(1).join(' ');

          var c = resolve(head);
          if (!c) {
            append(line('> ' + cmd, 'echo'));
            append(line("command not found: " + head + ". try 'help'.", 'err'));
            return;
          }
          var r = c.fn({ cmd: cmd, head: head, rest: rest }) || {};
          if (r.goto) {
            /* 切 tab 时 out 由 goto 清空；之后回显命令 + pwd，模拟 shell。 */
            goto(r.goto, r.scroll);
            append(line('> ' + cmd, 'echo'));
            append(line(currentTab === HOME ? '~' : '~/' + currentTab));
          } else if (r.clear) {
            /* clear：清空 output 但保留刚输入的命令（让用户看到“执行了 clear”）。 */
            out.replaceChildren();
            append(line('> ' + cmd, 'echo'));
          } else {
            append(line('> ' + cmd, 'echo'));
            (r.lines || []).forEach(append);
          }
        }
        return {
          run: run,
          history: history,
          completer: completer,
          /* Tab 多匹配时调用：调用者不需要知道 append 内部实现（append 是
           * makeRunner 闭包内的 helper）。 */
          listCandidates: function (names) {
            /* Tab 多匹配提示：不进 cmd-output，进 cmd-hints（input 下方临时区）。
             * 每次清后填，保证只有一行。 */
            var target = hints || out;
            target.replaceChildren();
            target.appendChild(line('  ' + names.join('  '), 'candidates'));
          }
        };
      }

      var runner = makeRunner(out, hints);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        runner.run(input.value);
        input.value = '';
        input.focus();
      });

      /* input event: 用户修改 input（打字/删字/粘贴）→ 立即清空 hints。
 * 'input' event 在 value 改变时触发（与键入/paste/cut/JS set 都挂钩）。 */
      input.addEventListener('input', function () {
        if (hints && hints.firstChild) hints.replaceChildren();
      });

      /* keydown: ↑↓ 翻历史；Tab 补全。IME 输入中不抢。 */
      input.addEventListener('keydown', function (e) {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          var h = runner.history;
          if (e.key === 'ArrowUp'   && h.hIdx() === 0)         return;
          if (e.key === 'ArrowDown' && h.hIdx() === h.size()) return;
          e.preventDefault();
          h.saveDraft(input.value);
          h.move(e.key === 'ArrowUp' ? -1 : 1);
          input.value = h.current();
        } else if (e.key === 'Tab') {
          if (!input.value) return;
          e.preventDefault();
          input.value = runner.completer.complete(input.value);
          /* 多匹配：在 cmd-output 列出候选。 */
          var ms = runner.completer.matches();
          if (ms && ms.length > 1) runner.listCandidates(ms);
        }
      });

      // auto-focus on desktop only (don't steal focus on touch devices)
      if (matchMedia && matchMedia('(hover: hover)').matches) {
        window.addEventListener('load', function () { input.focus({ preventScroll: true }); });
      }
    })();

    document.body.classList.add('app');
  });
})();
