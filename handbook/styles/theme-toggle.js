/**
 * Agent Studio handbook — theme toggle, header helpers, code copy icons, tables.
 */
(function () {
  var STORAGE_KEY = 'agent-studio-docs-theme';

  var ICON_COPY =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
    '</svg>';

  var ICON_CHECK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M20 6L9 17l-5-5"/>' +
    '</svg>';

  function preferred() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var book = document.querySelector('.book');
    if (book) {
      book.classList.remove('color-theme-1', 'color-theme-2');
      if (theme === 'dark') book.classList.add('color-theme-2');
    }
    var btn = document.getElementById('as-theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.dataset.theme = theme;
    }
  }

  function toggle() {
    var next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    apply(next);
  }

  apply(preferred());

  function setCopyIcon(btn, mode) {
    btn.innerHTML = mode === 'check' ? ICON_CHECK : ICON_COPY;
    btn.classList.toggle('is-copied', mode === 'check');
    btn.setAttribute('aria-label', mode === 'check' ? 'Copied' : 'Copy code');
    btn.title = mode === 'check' ? 'Copied' : 'Copy';
  }

  function enhanceCopyButtons() {
    document.querySelectorAll('pre .copy-code-button, button.copy-code-button').forEach(function (btn) {
      btn.removeAttribute('style');

      if (!btn.dataset.asEnhanced) {
        btn.dataset.asEnhanced = '1';
        setCopyIcon(btn, 'copy');

        // Plugin swaps button text via jQuery .text() — re-assert icons after it runs.
        btn.addEventListener('click', function () {
          window.setTimeout(function () { setCopyIcon(btn, 'check'); }, 0);
          window.setTimeout(function () { setCopyIcon(btn, 'check'); }, 30);
          window.setTimeout(function () { setCopyIcon(btn, 'copy'); }, 2100);
        });

        if (window.MutationObserver) {
          var mo = new MutationObserver(function () {
            if (!btn.querySelector('svg')) {
              setCopyIcon(btn, /copied/i.test(btn.textContent || '') ? 'check' : 'copy');
            }
          });
          mo.observe(btn, { childList: true, characterData: true, subtree: true });
        }
      } else if (!btn.querySelector('svg')) {
        setCopyIcon(btn, btn.classList.contains('is-copied') ? 'check' : 'copy');
      } else {
        btn.removeAttribute('style');
      }
    });
  }

  function wrapTables() {
    document.querySelectorAll('.markdown-section > table').forEach(function (table) {
      if (table.parentElement && table.parentElement.classList.contains('as-table-scroll')) return;
      var wrap = document.createElement('div');
      wrap.className = 'as-table-scroll';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  function bind() {
    var btn = document.getElementById('as-theme-toggle');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', toggle);
    }

    var trailing = document.getElementById('as-header-trailing');
    var header = document.querySelector('.book-header');
    var mount = document.getElementById('as-header-search');
    var sidebarSearch = document.querySelector('.book-summary > #book-search-input');
    if (mount && sidebarSearch && !mount.contains(sidebarSearch)) {
      mount.appendChild(sidebarSearch);
    }

    if (header && trailing) {
      header.querySelectorAll('.btn.pull-right, .font-settings').forEach(function (el) {
        if (!trailing.contains(el)) trailing.appendChild(el);
      });
      // Our theme toggle replaces GitBook White/Sepia/Night + font family controls
      trailing.querySelectorAll('.font-settings').forEach(function (el) {
        el.style.display = 'none';
      });
    }

    wrapTables();
    enhanceCopyButtons();
  }

  function bindSoon() {
    bind();
    setTimeout(bind, 50);
    setTimeout(bind, 250);
    setTimeout(enhanceCopyButtons, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSoon);
  } else {
    bindSoon();
  }

  if (window.gitbook) {
    window.gitbook.push(function () {
      bindSoon();
      apply(preferred());
    });
  }
})();
