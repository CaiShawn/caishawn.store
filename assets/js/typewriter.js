/* ----------------------------------------------------------------- *
 * typewriter.js — self-contained vanilla typewriter effect         *
 *                                                                  *
 * Discovers all `.typed-text[data-typed="true"]` nodes and animates *
 * them with a per-character speed profile when they first scroll   *
 * into view (10% threshold via IntersectionObserver). Runs once    *
 * per element (unobserves after first trigger).                    *
 *                                                                  *
 * Per-character delay profile:                                     *
 *   '-'  → 600ms           long pause: between phrases             *
 *   '/'  → 200ms           medium: path segment boundary           *
 *   ' '  → 150ms           short: between words                    *
 *   CJK  → 150 + rnd(30)ms 汉字读得清                              *
 *   else → 75  + rnd(15)ms regular keystroke                      *
 *                                                                  *
 * Respects `prefers-reduced-motion: reduce`: original text shown   *
 * as-is, no animation, no caret created.                           *
 *                                                                  *
 * Loaded with `<script defer src="assets/js/typewriter.js">` from  *
 * both index.html and 404.html. No globals are exposed.            *
 * ----------------------------------------------------------------- */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // CJK Unified Ideographs (basic + ext A) + CJK Compatibility blocks.
  // Covers 99%+ of modern Chinese / Japanese Kanji used in web copy.
  function isCJK(ch) {
    var code = ch.codePointAt(0);
    return (code >= 0x4E00 && code <= 0x9FFF) ||
           (code >= 0x3400 && code <= 0x4DBF) ||
           (code >= 0xF900 && code <= 0xFAFF);
  }

  function startTyped(el) {
    var text = el.textContent;
    if (reducedMotion || !text) return;

    el.textContent = '';
    var cur = document.createElement('span');
    cur.className = 'caret caret-typed';
    cur.setAttribute('aria-hidden', 'true');
    el.appendChild(cur);

    var i = 0;
    function tick() {
      if (i >= text.length) return; // leave caret blinking
      cur.before(text[i++]);
      var ch = text[i - 1];
      var delay;
      if (ch === '-')        delay = 600;                          // 长停顿：词组之间
      else if (ch === '/')   delay = 200;                          // 中停顿：路径段间（加快）
      else if (ch === ' ')   delay = 150;                          // 小停顿：词间空格
      else if (isCJK(ch))    delay = 150 + Math.random() * 30;     // 150-180ms：CJK 读得清
      else                   delay =  75 + Math.random() * 15;     //  75- 90ms：英文 / 数字 / 其他
      setTimeout(tick, delay);
    }
    tick();
  }

  function startTypewriters() {
    var typedEls = document.querySelectorAll('.typed-text[data-typed="true"]');
    if ('IntersectionObserver' in window) {
      var typedIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            startTyped(entry.target);
            typedIO.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      typedEls.forEach(function (el) { typedIO.observe(el); });
    } else {
      // very old browser fallback: fire immediately
      typedEls.forEach(startTyped);
    }
  }

  ready(startTypewriters);
})();
