/* ==========================================================================
   CombDesk — a demo trading desk for Bee Swarm Simulator.
   Every value rendered on this page comes from the public BSS Index JSON API
   (https://bss-index.vercel.app/api/v1). No mock data, no hardcoded items.
   ========================================================================== */
(function () {
  'use strict';

  var API_BASE = '/api/v1';
  var SITE = 'https://bss-index.vercel.app';
  var WIDGET_BASE = SITE + '/w/';

  /* ------------------------------------------------------------ utilities */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(v) {
    var n = Number(v);
    return (v === null || v === undefined || v === '' || isNaN(n)) ? null : n;
  }

  /** Stars, rounded the same way the BSS Index UI rounds them. */
  function stars(v) {
    var n = num(v);
    if (n === null) return '—';
    return Number(n.toFixed(2)).toLocaleString('en-US');
  }

  /** Signed percentage: +12.3% / −12.3% / 0.0% */
  function pct(v) {
    var n = num(v);
    if (n === null) return '';
    return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(1) + '%';
  }

  /** Unsigned magnitude: 12.3% (used where the arrow already carries the sign) */
  function pctAbs(v) {
    var n = num(v);
    if (n === null) return '';
    return Math.abs(n).toFixed(1) + '%';
  }

  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }

  /** GET a JSON endpoint of the BSS Index API. `pairs` is an array of [key, value]. */
  function api(path, pairs) {
    var qs = (pairs || [])
      .filter(function (p) { return p && p[1] !== undefined && p[1] !== null; })
      .map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); })
      .join('&');
    var url = API_BASE + path + (qs ? '?' + qs : '');
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        return res.json();
      })
      .catch(function (err) {
        throw new Error(err && err.message ? err.message : 'Network error');
      });
  }

  function showError(slotId, title, err) {
    var slot = document.getElementById(slotId);
    if (!slot) return;
    slot.hidden = false;
    slot.innerHTML =
      '<div class="error-box"><span aria-hidden="true">⚠</span><div><strong>' + esc(title) + '</strong>' +
      'The BSS Index API did not answer correctly. ' +
      esc(err && err.message ? err.message : 'Unknown error') +
      ' — check your connection and reload.</div></div>';
  }

  function clearError(slotId) {
    var slot = document.getElementById(slotId);
    if (!slot) return;
    slot.hidden = true;
    slot.innerHTML = '';
  }

  function thumbHtml(item, extraClass) {
    var initial = (item.name || '?').trim().charAt(0).toUpperCase();
    var img = item.image
      ? '<img src="' + esc(item.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-img="1">'
      : '';
    return '<span class="thumb ' + (extraClass || '') + '"><span class="thumb-init">' + esc(initial) + '</span>' + img + '</span>';
  }

  /** Replace broken item images with the letter placeholder. */
  function decorateThumbs(root) {
    $$('img[data-img]', root).forEach(function (img) {
      img.addEventListener('error', function () { img.classList.add('is-broken'); });
      if (img.complete && img.naturalWidth === 0) img.classList.add('is-broken');
    });
  }

  function chipHtml(change) {
    var n = num(change);
    if (n === null) return '';
    if (n > 0) return '<span class="chip chip-up">▲ ' + pctAbs(n) + '</span>';
    if (n < 0) return '<span class="chip chip-down">▼ ' + pctAbs(n) + '</span>';
    return '<span class="chip chip-flat">→ 0.0%</span>';
  }

  /* -------------------------------------------------------------- 0. stats */

  function loadStats() {
    api('/stats.json').then(function (s) {
      $('#stat-items').textContent = Number(s.itemCount).toLocaleString('en-US');
      $('#stat-avg').textContent = stars(s.averageValue) + ' ★';
      $('#stat-max').textContent = stars(s.maxValue) + ' ★';
      $('#stat-updated').textContent = fmtDateTime(s.lastUpdated);
      $('#stat-history').textContent = Number(s.itemsWithHistory).toLocaleString('en-US') + ' items with price history';
      var live = $('[data-live="updated"]');
      if (live) live.textContent = fmtDateTime(s.lastUpdated);
      clearError('stats-error');
    }).catch(function (err) {
      $('#stat-items').textContent = '—';
      $('#stat-avg').textContent = '—';
      $('#stat-max').textContent = '—';
      $('#stat-updated').textContent = '—';
      showError('stats-error', 'Statistics unavailable', err);
    });
  }

  /* ---------------------------------------------------------- 1. live search */

  var searchState = { q: '', category: '', limit: 24, offset: 0, total: 0, shown: 0, seq: 0, timer: null };

  function renderSkeletons(grid, n) {
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="skeleton"><span class="skeleton-thumb"></span><span class="skeleton-lines">' +
        '<span class="skeleton-line w60"></span><span class="skeleton-line w40"></span></span></div>';
    }
    grid.innerHTML = html;
  }

  function itemCardHtml(item) {
    var chip = chipHtml(item.change7d);
    return '<article class="item-card">' +
      thumbHtml(item) +
      '<div class="item-body">' +
        '<h3 class="item-name">' + esc(item.name) + '</h3>' +
        '<p class="item-cat">' + esc(item.category) + '</p>' +
        '<div class="item-foot"><span class="item-value">' + stars(item.value) +
        ' <span class="star">★</span></span>' + chip + '</div>' +
      '</div>' +
      '<a class="item-link" href="' + esc(item.url) + '" target="_blank" rel="noopener">Open ↗</a>' +
    '</article>';
  }

  function emptyStateHtml() {
    var q = searchState.q;
    return '<div class="empty-state">' +
      '<div class="empty-icon" aria-hidden="true">🔍</div>' +
      '<h3>No items match “' + esc(q) + '”</h3>' +
      '<p>The BSS Index search returned zero hits for that query. Try a shorter word — ' +
      '“bee”, “leaf”, “sticker” — or clear the category filter.</p>' +
    '</div>';
  }

  function updateMeta() {
    var meta = $('#search-meta');
    var bits = [];
    if (searchState.q) bits.push('“<strong>' + esc(searchState.q) + '</strong>”');
    if (searchState.category) {
      var opt = $('#category-filter').querySelector('option[value="' + searchState.category + '"]');
      bits.push('in <strong>' + esc(opt ? opt.textContent.split(' (')[0] : searchState.category) + '</strong>');
    }
    var total = searchState.total;
    var shown = searchState.shown;
    var lead = bits.length ? bits.join(' ') + ' — ' : '';
    meta.innerHTML = lead + '<strong>' + total + '</strong> result' + (total === 1 ? '' : 's') +
      ' · showing ' + shown + (total > shown ? ' (load more below)' : '');
  }

  function updateMoreButton() {
    var btn = $('#search-more');
    if (searchState.total > searchState.shown) {
      btn.hidden = false;
      btn.textContent = 'Load ' + Math.min(searchState.limit, searchState.total - searchState.shown) + ' more';
    } else {
      btn.hidden = true;
    }
  }

  function runSearch(reset) {
    var grid = $('#search-results');
    var seq = ++searchState.seq;
    grid.setAttribute('aria-busy', 'true');
    if (reset) {
      searchState.offset = 0;
      searchState.shown = 0;
      renderSkeletons(grid, 8);
    }

    var pairs = [['q', searchState.q], ['limit', searchState.limit], ['offset', searchState.offset]];
    if (searchState.category) pairs.push(['category', searchState.category]);

    api('/search', pairs).then(function (data) {
      if (seq !== searchState.seq) return;
      grid.setAttribute('aria-busy', 'false');
      clearError('search-error');
      var items = data.items || [];
      if (reset) grid.innerHTML = '';
      if (!items.length && reset) {
        grid.innerHTML = emptyStateHtml();
      } else if (items.length) {
        grid.insertAdjacentHTML('beforeend', items.map(itemCardHtml).join(''));
        searchState.shown += items.length;
        decorateThumbs(grid);
      }
      searchState.total = Number(data.total) || 0;
      updateMeta();
      updateMoreButton();
    }).catch(function (err) {
      if (seq !== searchState.seq) return;
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML = '';
      $('#search-meta').textContent = 'Search is unavailable right now.';
      showError('search-error', 'Could not search the BSS Index', err);
    });
  }

  function initSearch() {
    var input = $('#search-input');
    var select = $('#category-filter');

    input.addEventListener('input', function () {
      searchState.q = input.value.trim();
      clearTimeout(searchState.timer);
      searchState.timer = setTimeout(function () { runSearch(true); }, 250);
    });

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        clearTimeout(searchState.timer);
        searchState.q = input.value.trim();
        runSearch(true);
      }
    });

    select.addEventListener('change', function () {
      searchState.category = select.value;
      runSearch(true);
    });

    $('#search-more').addEventListener('click', function () {
      searchState.offset += searchState.limit;
      runSearch(false);
    });

    runSearch(true);
  }

  function loadCategories() {
    api('/categories.json').then(function (cats) {
      var select = $('#category-filter');
      (cats || []).forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.slug;
        opt.textContent = c.name + ' (' + c.count + ')';
        select.appendChild(opt);
      });
    }).catch(function () {
      /* the filter is optional — search still works without it */
    });
  }

  /* -------------------------------------------------------- 2. market movers */

  function moverRow(item, index, kind) {
    var change = num(item.change7d);
    var chip = change === null
      ? '<span class="mover-change muted-inline">—</span>'
      : '<span class="mover-change ' + (change >= 0 ? 'up' : 'down') + '">' +
        (change >= 0 ? '▲ ' : '▼ ') + pctAbs(change) + '</span>';
    return '<li class="mover-item">' +
      '<span class="mover-rank">' + (index + 1) + '</span>' +
      '<span class="mover-name">' + esc(item.name) + '</span>' +
      '<span class="mover-value">' + stars(item.value) + ' ★</span>' +
      chip +
    '</li>';
  }

  function loadMovers() {
    api('/changes.json').then(function (data) {
      var gainers = $('#gainers-list');
      var losers = $('#losers-list');
      gainers.innerHTML = (data.gainers || []).map(function (it, i) { return moverRow(it, i); }).join('');
      losers.innerHTML = (data.losers || []).map(function (it, i) { return moverRow(it, i); }).join('');
      if (!gainers.children.length && !losers.children.length) {
        gainers.innerHTML = '<li class="mover-item"><span class="mover-name muted-inline">No movers reported right now.</span></li>';
      }
      $('#movers-updated').textContent = data.updated ? 'Updated ' + fmtDateTime(data.updated) + '.' : '';
      clearError('movers-error');
    }).catch(function (err) {
      showError('movers-error', 'Could not load market movers', err);
    });
  }

  /* ------------------------------------------------------ 3. trade calculator */

  var sideA = null;
  var sideB = null;
  var itemsPromise = null;

  /** /api/v1/items.json is fetched once and shared by the calculator and the widget. */
  function loadItems() {
    if (!itemsPromise) {
      itemsPromise = api('/items.json').catch(function (err) {
        itemsPromise = null;
        throw err;
      });
    }
    return itemsPromise;
  }

  function pickedCardHtml(item, sideLabel) {
    return '<div class="picked-card">' +
      thumbHtml(item) +
      '<div><div class="picked-name">' + esc(item.name) + '</div>' +
      '<div class="picked-meta">' + esc(sideLabel) + ' · ' + esc(item.category) + '</div></div>' +
      '<div class="picked-value"><strong>' + stars(item.value) + ' ★</strong>' +
      '<span>range ' + stars(item.valueLow) + '–' + stars(item.valueHigh) + '</span></div>' +
    '</div>';
  }

  function renderVerdict() {
    var card = $('#verdict-card');
    if (!sideA || !sideB) {
      card.innerHTML = '<p class="verdict-hint">Pick an item on both sides to see the spread.</p>';
      return;
    }

    var a = Number(sideA.value) || 0;
    var b = Number(sideB.value) || 0;
    var diff = a - b;
    var absDiff = Math.abs(diff);
    var even = Math.round(a * 100) === Math.round(b * 100);
    var verdict = even ? 'FAIR' : (diff > 0 ? 'WIN' : 'LOSS');
    var relPct = b !== 0 ? (diff / b) * 100 : null;
    var pctText = relPct === null ? '—' : pct(relPct);

    var explain;
    if (even) {
      explain = 'Both sides are worth the same right now — that is a fair trade.';
    } else if (diff > 0) {
      explain = 'Side A is worth <b>' + stars(absDiff) + ' ★</b> more than side B' +
        (relPct === null ? '' : ' (' + pct(relPct) + ' relative to side B)') + '. Side A wins the trade.';
    } else {
      explain = 'Side B is worth <b>' + stars(absDiff) + ' ★</b> more than side A' +
        (relPct === null ? '' : ' (' + pct(relPct) + ' relative to side B)') + '. Side A loses the trade.';
    }

    card.innerHTML =
      '<div class="verdict-top"><span class="verdict-label">Side A vs Side B</span>' +
      '<span class="verdict-badge ' + verdict.toLowerCase() + '">' + verdict + '</span></div>' +
      '<div class="verdict-diff">' + stars(absDiff) + ' <small>★ difference</small></div>' +
      '<p class="verdict-pct">' + pctText + ' <span class="muted-inline">relative to side B</span></p>' +
      '<div class="verdict-rows">' +
        '<div class="verdict-row"><span>A · ' + esc(sideA.name) + '</span><b>' + stars(a) + ' ★</b></div>' +
        '<div class="verdict-row"><span>B · ' + esc(sideB.name) + '</span><b>' + stars(b) + ' ★</b></div>' +
      '</div>' +
      '<p class="verdict-explain">' + explain + '</p>';
  }

  function initCalculator() {
    $('#picked-a').innerHTML = '';
    $('#picked-b').innerHTML = '';

    createPicker($('#picker-a'), function (item) {
      sideA = item;
      $('#picked-a').innerHTML = pickedCardHtml(item, 'Side A');
      decorateThumbs($('#picked-a'));
      renderVerdict();
    });

    createPicker($('#picker-b'), function (item) {
      sideB = item;
      $('#picked-b').innerHTML = pickedCardHtml(item, 'Side B');
      decorateThumbs($('#picked-b'));
      renderVerdict();
    });

    /* Pre-fill both sides with two real items pulled from /api/v1/items.json,
       so the calculator shows a meaningful verdict straight away. */
    loadItems().then(function (items) {
      if (!items || !items.length) return;
      var a = items[0];
      var b = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].categorySlug !== a.categorySlug && Number(items[i].value) > 0 && Number(items[i].value) < Number(a.value)) {
          b = items[i];
          break;
        }
      }
      if (!b) b = items[1] || items[0];
      sideA = a;
      sideB = b;
      $('#calc-input-a').value = a.name;
      $('#calc-input-b').value = b.name;
      $('#picked-a').innerHTML = pickedCardHtml(a, 'Side A');
      $('#picked-b').innerHTML = pickedCardHtml(b, 'Side B');
      decorateThumbs($('#picked-a'));
      decorateThumbs($('#picked-b'));
      renderVerdict();
      clearError('calc-error');
    }).catch(function (err) {
      showError('calc-error', 'Could not pre-load example items', err);
    });
  }

  /* --------------------------------------------------------- 4. the widget */

  var widgetItem = null;

  function widgetSrc(slug) { return WIDGET_BASE + encodeURIComponent(slug) + '/?embed=1'; }

  function widgetSnippet(slug, name) {
    return '<iframe src="' + widgetSrc(slug) + '" width="360" height="320" ' +
      'style="border:0;border-radius:16px;overflow:hidden" ' +
      'title="' + esc(name) + ' — BSS Index widget" loading="lazy"></iframe>';
  }

  function renderWidget() {
    if (!widgetItem) return;
    var frame = $('#widget-frame');
    frame.src = widgetSrc(widgetItem.slug);
    $('#widget-snippet').textContent = widgetSnippet(widgetItem.slug, widgetItem.name);
  }

  function initWidget() {
    createPicker($('#picker-w'), function (item) {
      widgetItem = item;
      renderWidget();
    });

    loadItems().then(function (items) {
      if (!items || !items.length) return;
      var pick = null;
      for (var i = 0; i < items.length; i++) {
        if (items[i].slug === 'auryn') { pick = items[i]; break; }
      }
      if (!pick) pick = items[0];
      widgetItem = pick;
      $('#widget-input').value = pick.name;
      renderWidget();
      clearError('widget-error');
    }).catch(function (err) {
      showError('widget-error', 'Could not load the widget item', err);
    });

    $('#copy-snippet').addEventListener('click', function () {
      var text = $('#widget-snippet').textContent;
      var hint = $('#copy-hint');
      hint.classList.remove('is-error');

      var done = function () {
        hint.textContent = 'Copied to clipboard ✓';
        var btn = $('#copy-snippet');
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = 'Copy'; }, 1600);
      };
      var failed = function () {
        hint.textContent = 'Copy failed — select the snippet and copy manually.';
        hint.classList.add('is-error');
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done, failed); });
      } else {
        fallbackCopy(text, done, failed);
      }
    });
  }

  function fallbackCopy(text, done, failed) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) done(); else failed();
    } catch (e) {
      failed();
    }
  }

  /* -------------------------------------------------- searchable item picker */

  function createPicker(root, onPick) {
    var input = $('.picker-input', root);
    var list = $('.picker-list', root);
    var results = [];
    var activeIndex = -1;
    var timer = null;
    var seq = 0;

    function close() {
      list.hidden = true;
      list.innerHTML = '';
      activeIndex = -1;
      input.setAttribute('aria-expanded', 'false');
    }

    function renderList(items) {
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<div class="picker-empty">No items match “' + esc(input.value.trim()) + '”</div>';
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        return;
      }
      items.forEach(function (item, i) {
        var opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'picker-opt' + (i === activeIndex ? ' is-active' : '');
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
        opt.innerHTML = thumbHtml(item) +
          '<span><span class="picker-name">' + esc(item.name) + '</span>' +
          '<span class="picker-meta">' + esc(item.category) + ' · ' + stars(item.value) + ' ★</span></span>';
        opt.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          pick(item);
        });
        list.appendChild(opt);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      decorateThumbs(list);
    }

    function query(q) {
      var id = ++seq;
      api('/search', [['q', q], ['limit', 8]]).then(function (data) {
        if (id !== seq) return;
        results = data.items || [];
        activeIndex = -1;
        renderList(results);
      }).catch(function (err) {
        if (id !== seq) return;
        list.innerHTML = '<div class="picker-empty">Search failed: ' + esc(err.message) + '</div>';
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
      });
    }

    function pick(item) {
      input.value = item.name;
      close();
      onPick(item);
    }

    input.addEventListener('focus', function () {
      input.value = '';
      clearTimeout(timer);
      timer = setTimeout(function () { query(''); }, 60);
    });

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { query(input.value.trim()); }, 250);
    });

    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!results.length) return;
        if (ev.key === 'ArrowDown') activeIndex = (activeIndex + 1) % results.length;
        else activeIndex = activeIndex <= 0 ? results.length - 1 : activeIndex - 1;
        renderList(results);
        var active = list.children[activeIndex];
        if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        if (activeIndex >= 0 && results[activeIndex]) {
          ev.preventDefault();
          pick(results[activeIndex]);
        }
      } else if (ev.key === 'Escape') {
        close();
      }
    });

    input.addEventListener('blur', function () {
      setTimeout(close, 120);
    });
  }

  /* ------------------------------------------------------------------ boot */

  function boot() {
    loadStats();
    loadCategories();
    loadMovers();
    initSearch();
    initCalculator();
    initWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
