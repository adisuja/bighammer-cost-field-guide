/* The Databricks Cost Field Guide: interactions. No dependencies, no tracking, nothing leaves the browser. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------------- toast ---------------- */
  var toastEl = $('#toast'), toastT;
  function toast(msg) {
    toastEl.querySelector('span').textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  /* ---------------- SQL highlighter ---------------- */
  var KW = ('select from where join left right inner outer full cross on and or not as with group by order having limit union all distinct case when then else end is null in like between exists over partition qualify rollup interval days day asc desc nulls last first true false lateral view except intersect using cast').split(' ');
  var KWS = {}; KW.forEach(function (k) { KWS[k] = 1; });
  var FN = ('sum count avg min max round coalesce nullif row_number lag lead percentile_approx date_trunc current_date concat_ws collect_set transform map_keys lower upper regexp_replace array array_contains arrays_overlap explode size bool_or max_by sha2 grouping').split(' ');
  var FNS = {}; FN.forEach(function (k) { FNS[k] = 1; });
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function highlight(src) {
    var out = '', i = 0, n = src.length, m;
    var re = {
      comment: /^--[^\n]*/,
      str: /^'(?:[^'\\]|\\.)*'/,
      bq: /^`[^`]*`/,
      num: /^\b\d+(?:\.\d+)?\b/,
      word: /^[A-Za-z_][A-Za-z0-9_]*/,
      op: /^(?:&lt;|&gt;|->|<=|>=|<>|!=|<|>|=|\*|\+|-|\/|\|\|)/
    };
    while (i < n) {
      var rest = src.slice(i);
      if ((m = re.comment.exec(rest))) { out += '<span class="tok-c">' + esc(m[0]) + '</span>'; }
      else if ((m = re.str.exec(rest))) { out += '<span class="tok-s">' + esc(m[0]) + '</span>'; }
      else if ((m = re.bq.exec(rest))) { out += '<span class="tok-t">' + esc(m[0]) + '</span>'; }
      else if ((m = re.num.exec(rest))) { out += '<span class="tok-n">' + m[0] + '</span>'; }
      else if ((m = re.word.exec(rest))) {
        var w = m[0], lw = w.toLowerCase(), next = src.charAt(i + w.length);
        if (KWS[lw]) out += '<span class="tok-k">' + w + '</span>';
        else if (FNS[lw] && next === '(') out += '<span class="tok-f">' + w + '</span>';
        else if (lw === 'system' && src.charAt(i + w.length) === '.') out += '<span class="tok-t">' + w + '</span>';
        else out += w;
      }
      else if ((m = re.op.exec(rest))) { out += '<span class="tok-o">' + esc(m[0]) + '</span>'; }
      else { m = [rest.charAt(0)]; out += esc(m[0]); }
      i += m[0].length;
    }
    return out;
  }

  /* ---------------- code blocks ---------------- */
  var copied = store.get('fg-copied', {});
  var TOTAL_Q = 13;
  function updateCopied() {
    var count = Object.keys(copied).filter(function (k) { return /^q\d\d$/.test(k); }).length;
    $$('.copied-count').forEach(function (e) { e.textContent = count; });
    $$('.copied-meter').forEach(function (e) { e.style.width = (100 * count / TOTAL_Q) + '%'; });
    $$('[data-q]').forEach(function (a) { if (a.tagName === 'A') a.classList.toggle('copied', !!copied[a.getAttribute('data-q')]); });
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  function renderCode(codeEl, text) {
    codeEl.setAttribute('data-raw', text);
    codeEl.innerHTML = highlight(text);
  }
  function enhanceCode(pre) {
    var code = pre.querySelector('code');
    var wrap = document.createElement('div');
    wrap.className = 'code';
    var file = code.getAttribute('data-file') || 'query.sql';
    wrap.innerHTML = '<div class="code-bar"><span class="fn"><i></i>' + esc(file) + '</span>' +
      '<button class="copy" type="button" aria-label="Copy ' + esc(file) + ' to clipboard"><svg aria-hidden="true"><use href="#i-copy"/></svg><span>Copy</span></button></div>';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    if (!code.hasAttribute('data-tpl')) renderCode(code, code.textContent.replace(/^\n/, ''));
    var btn = wrap.querySelector('.copy');
    btn.addEventListener('click', function () {
      copyText(code.getAttribute('data-raw')).then(function () {
        btn.classList.add('ok'); btn.querySelector('span').textContent = 'Copied';
        setTimeout(function () { btn.classList.remove('ok'); btn.querySelector('span').textContent = 'Copy'; }, 1600);
        var art = wrap.closest('[data-q]');
        if (art) { copied[art.getAttribute('data-q')] = 1; store.set('fg-copied', copied); updateCopied(); }
        toast('Copied ' + file + '. Paste it into a SQL editor.');
      }, function () { toast('Copy failed. Select the text and copy manually.'); });
    });
    var lines = code.getAttribute('data-raw') ? code.getAttribute('data-raw').split('\n').length : 0;
    if (lines > 34) {
      wrap.classList.add('collapsed');
      var ex = document.createElement('button');
      ex.type = 'button'; ex.className = 'expand';
      ex.textContent = 'Show all ' + lines + ' lines';
      ex.addEventListener('click', function () {
        var c = wrap.classList.toggle('collapsed');
        ex.textContent = c ? 'Show all ' + lines + ' lines' : 'Collapse';
      });
      wrap.appendChild(ex);
    }
  }
  $$('.hero-card code.hl').forEach(function (c) { c.innerHTML = highlight(c.textContent); });

  /* ---------------- parity generator ---------------- */
  function splitList(v) { return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function parts(name) {
    var p = name.split('.');
    while (p.length < 3) p.unshift(p.length === 2 ? 'main' : 'default');
    return { cat: p[0], sch: p[1], tbl: p.slice(2).join('.') };
  }
  function lit(s) { return "'" + s.replace(/'/g, "''") + "'"; }
  function buildParity() {
    var S = $('#pg-src').value.trim() || 'source_catalog.schema.table';
    var T = $('#pg-tgt').value.trim() || 'target_catalog.schema.table';
    var K = splitList($('#pg-key').value); if (!K.length) K = ['id'];
    var N = splitList($('#pg-num').value);
    var C = splitList($('#pg-cols').value); if (!C.length) C = K.slice();
    var nonKey = C.filter(function (c) { return K.indexOf(c) === -1; });
    var hashCols = nonKey.length ? nonKey : C;
    var sp = parts(S), tp = parts(T);
    var ind = function (arr, pad) { return arr.join(',\n' + pad); };
    var t = {};
    t.counts =
      '-- Q13 step 1a  Row counts and duplicate business keys  (read-only)\n' +
      "SELECT 'source' AS side, COUNT(*) AS row_count,\n" +
      '       COUNT(*) - COUNT(DISTINCT ' + K.join(', ') + ') AS duplicate_keys\n' +
      'FROM ' + S + '\nUNION ALL\n' +
      "SELECT 'target' AS side, COUNT(*) AS row_count,\n" +
      '       COUNT(*) - COUNT(DISTINCT ' + K.join(', ') + ') AS duplicate_keys\n' +
      'FROM ' + T + ';\n\n' +
      '-- Q13 step 1b  Column counts from Unity Catalog information_schema\n' +
      "SELECT concat_ws('.', table_catalog, table_schema, table_name) AS table_full_name,\n" +
      '       COUNT(*) AS column_count\n' +
      'FROM system.information_schema.columns\n' +
      "WHERE concat_ws('.', table_catalog, table_schema, table_name) IN (" + lit(sp.cat + '.' + sp.sch + '.' + sp.tbl) + ', ' + lit(tp.cat + '.' + tp.sch + '.' + tp.tbl) + ')\n' +
      'GROUP BY ALL;';
    t.schema =
      '-- Q13 step 2  Schema match: column names and data types  (read-only)\n' +
      'WITH s AS (\n' +
      '  SELECT lower(column_name) AS column_name, data_type\n' +
      '  FROM system.information_schema.columns\n' +
      '  WHERE table_catalog = ' + lit(sp.cat) + ' AND table_schema = ' + lit(sp.sch) + ' AND table_name = ' + lit(sp.tbl) + '\n' +
      '),\nt AS (\n' +
      '  SELECT lower(column_name) AS column_name, data_type\n' +
      '  FROM system.information_schema.columns\n' +
      '  WHERE table_catalog = ' + lit(tp.cat) + ' AND table_schema = ' + lit(tp.sch) + ' AND table_name = ' + lit(tp.tbl) + '\n' +
      ')\n' +
      'SELECT\n' +
      '  COALESCE(s.column_name, t.column_name) AS column_name,\n' +
      '  s.data_type                            AS source_type,\n' +
      '  t.data_type                            AS target_type,\n' +
      "  CASE WHEN s.column_name IS NULL THEN 'Only in target'\n" +
      "       WHEN t.column_name IS NULL THEN 'Only in source'\n" +
      "       WHEN s.data_type <> t.data_type THEN 'Type differs'\n" +
      "       ELSE 'Match' END                 AS status\n" +
      'FROM s FULL OUTER JOIN t ON s.column_name = t.column_name\n' +
      'ORDER BY status DESC, column_name;';
    var nullExpr = C.map(function (c) { return 'ROUND(100 * AVG(CASE WHEN ' + c + ' IS NULL THEN 1 ELSE 0 END), 3) AS ' + c.replace(/\W/g, '_') + '_null_pct'; });
    t.nulls =
      '-- Q13 step 3  Null rate per column, source vs target  (read-only)\n' +
      "SELECT 'source' AS side,\n       " + ind(nullExpr, '       ') + '\nFROM ' + S + '\nUNION ALL\n' +
      "SELECT 'target' AS side,\n       " + ind(nullExpr, '       ') + '\nFROM ' + T + ';';
    var nums = N.length ? N : ['/* add numeric columns above */ 0'];
    var aggExpr = [];
    nums.forEach(function (c) {
      var a = c.replace(/\W/g, '_');
      if (!N.length) { aggExpr.push('0 AS no_numeric_columns'); return; }
      aggExpr.push('SUM(' + c + ') AS ' + a + '_sum');
      aggExpr.push('MIN(' + c + ') AS ' + a + '_min');
      aggExpr.push('MAX(' + c + ') AS ' + a + '_max');
      aggExpr.push('ROUND(AVG(' + c + '), 6) AS ' + a + '_avg');
    });
    t.aggs =
      '-- Q13 step 4  Numeric aggregates, source vs target  (read-only)\n' +
      "SELECT 'source' AS side,\n       " + ind(aggExpr, '       ') + '\nFROM ' + S + '\nUNION ALL\n' +
      "SELECT 'target' AS side,\n       " + ind(aggExpr, '       ') + '\nFROM ' + T + ';';
    var colList = C.join(', ');
    t.except =
      '-- Q13 step 5a  Exact set comparison with EXCEPT ALL (same engine, same types)  (read-only)\n' +
      "SELECT 'in source, not in target' AS direction, COUNT(*) AS row_count\n" +
      'FROM (\n  SELECT ' + colList + ' FROM ' + S + '\n  EXCEPT ALL\n  SELECT ' + colList + ' FROM ' + T + '\n) a\n' +
      'UNION ALL\n' +
      "SELECT 'in target, not in source' AS direction, COUNT(*) AS row_count\n" +
      'FROM (\n  SELECT ' + colList + ' FROM ' + T + '\n  EXCEPT ALL\n  SELECT ' + colList + ' FROM ' + S + '\n) b;';
    var hashExpr = 'sha2(concat_ws(\'||\',\n           ' + hashCols.map(function (c) { return "COALESCE(CAST(" + c + " AS STRING), '<NULL>')"; }).join(',\n           ') + '), 256)';
    var keySel = K.join(', ');
    var join = K.map(function (k) { return 's.' + k + ' = t.' + k; }).join(' AND ');
    var k0 = K[0];
    var hashCte =
      'WITH s AS (\n  SELECT ' + keySel + ',\n         ' + hashExpr + ' AS row_hash\n  FROM ' + S + '\n),\n' +
      't AS (\n  SELECT ' + keySel + ',\n         ' + hashExpr + ' AS row_hash\n  FROM ' + T + '\n)\n';
    t.hash =
      '-- Q13 step 5b  Row-level hash comparison by business key  (read-only)\n' + hashCte +
      'SELECT\n' +
      '  SUM(CASE WHEN t.' + k0 + ' IS NULL THEN 1 ELSE 0 END)                   AS missing_in_target,\n' +
      '  SUM(CASE WHEN s.' + k0 + ' IS NULL THEN 1 ELSE 0 END)                   AS extra_in_target,\n' +
      '  SUM(CASE WHEN s.' + k0 + ' IS NOT NULL AND t.' + k0 + ' IS NOT NULL\n' +
      '            AND s.row_hash <> t.row_hash THEN 1 ELSE 0 END)     AS changed_rows,\n' +
      '  SUM(CASE WHEN s.row_hash = t.row_hash THEN 1 ELSE 0 END)       AS matching_rows\n' +
      'FROM s FULL OUTER JOIN t ON ' + join + ';';
    t.diffs =
      '-- Q13 step 5c  First 100 differing keys to inspect  (read-only)\n' + hashCte +
      'SELECT\n  ' + K.map(function (k) { return 'COALESCE(s.' + k + ', t.' + k + ') AS ' + k; }).join(',\n  ') + ',\n' +
      "  CASE WHEN t." + k0 + " IS NULL THEN 'missing in target'\n" +
      "       WHEN s." + k0 + " IS NULL THEN 'extra in target'\n" +
      "       ELSE 'values differ' END AS issue\n" +
      'FROM s FULL OUTER JOIN t ON ' + join + '\n' +
      'WHERE NOT (s.row_hash <=> t.row_hash)\n' +
      'LIMIT 100;';
    $$('code[data-tpl]').forEach(function (c) { renderCode(c, t[c.getAttribute('data-tpl')]); });
  }
  var pgSaved = store.get('fg-parity', null);
  if (pgSaved) Object.keys(pgSaved).forEach(function (id) { var el = document.getElementById(id); if (el) el.value = pgSaved[id]; });
  buildParity();
  $$('#parity-gen input').forEach(function (inp) {
    inp.addEventListener('input', function () {
      buildParity();
      var o = {}; $$('#parity-gen input').forEach(function (i) { o[i.id] = i.value; }); store.set('fg-parity', o);
    });
  });

  $$('.content pre').forEach(enhanceCode);
  updateCopied();

  /* ---------------- reading progress + scrollspy ---------------- */
  var readbar = $('#readbar');
  var sections = $$('[data-title]');
  var tocLinks = $$('#toc > li > a');
  var qLinks = $$('#toc ul a');
  var qs = $$('article[data-q]');
  var mN = $('#mbar-n'), mT = $('#mbar-t');
  var seen = store.get('fg-seen', {});
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    readbar.style.width = (max > 0 ? (100 * h.scrollTop / max) : 0) + '%';
    var y = h.scrollTop + window.innerHeight * 0.3;
    var cur = sections[0];
    sections.forEach(function (s) { if (s.offsetTop <= y) cur = s; });
    var id = cur.id;
    tocLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-sec') === id); });
    if (!seen[id]) { seen[id] = 1; store.set('fg-seen', seen); }
    tocLinks.forEach(function (a) { var s = a.getAttribute('data-sec'); a.classList.toggle('done', !!seen[s] && s !== id); });
    var curQ = null;
    qs.forEach(function (q) { var top = q.getBoundingClientRect().top + h.scrollTop; if (top <= y && cur.contains(q)) curQ = q; });
    qLinks.forEach(function (a) { a.classList.toggle('active', !!curQ && a.getAttribute('data-q') === curQ.getAttribute('data-q')); });
    if (mN) { mN.textContent = cur.getAttribute('data-n'); mT.textContent = cur.getAttribute('data-title'); }
  }
  var ticking = false;
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { onScroll(); ticking = false; }); } }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* mobile chapter menu */
  var mbar = $('#mbar');
  if (mbar) {
    var menu = $('#mbar-menu');
    var clone = $('#toc').cloneNode(true); clone.removeAttribute('id');
    menu.appendChild(clone);
    var btn = $('.mbar-btn', mbar);
    btn.addEventListener('click', function () { var o = mbar.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) { mbar.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); } });
    tocLinks = tocLinks.concat($$('ol > li > a', clone));
  }

  /* ---------------- keep-or-move scorer ---------------- */
  var SIGS = [['dbutils', 1], ['Databricks SDK', 1], ['Lakeflow pipelines (DLT)', 2], ['ML / MLflow', 2], ['Streaming', 2], ['Photon', 1], ['Serverless', 1], ['GPUs', 1]];
  var OUT = {
    keep: ['Keep on Databricks', 'o-keep'], migrate: ['Migrate', 'o-migrate'], optimise: ['Optimise then evaluate', 'o-optimise'],
    evaluate: ['Evaluate', 'o-evaluate'], defer: ['Defer', 'o-defer']
  };
  function outcome(cx, pts) {
    var dep = pts >= 4 ? 'High' : pts >= 2 ? 'Medium' : 'Low';
    if (dep === 'High') return 'keep';
    var m = { Medium: { Low: 'evaluate', Medium: 'optimise', High: 'defer' }, Low: { Low: 'migrate', Medium: 'evaluate', High: 'optimise' } };
    return m[dep][cx];
  }
  var scorerEl = $('#scorer-rows');
  var rows = store.get('fg-scorer', null) || [{ name: '', cost: '', cx: 'Low', sigs: [] }, { name: '', cost: '', cx: 'Medium', sigs: [] }, { name: '', cost: '', cx: 'High', sigs: [] }];
  function saveRows() { store.set('fg-scorer', rows); }
  function drawScorer() {
    scorerEl.innerHTML = '';
    rows.forEach(function (r, idx) {
      var pts = r.sigs.reduce(function (a, i) { return a + SIGS[i][1]; }, 0);
      var o = OUT[outcome(r.cx, pts)];
      var div = document.createElement('div');
      div.className = 'scorer-row';
      div.innerHTML =
        '<div class="sr-top">' +
          '<div class="field"><label for="sc-n' + idx + '">Workload ' + (idx + 1) + '</label><input id="sc-n' + idx + '" data-k="name" placeholder="Job name" value="' + esc(r.name) + '"></div>' +
          '<div class="field"><label for="sc-c' + idx + '">90-day cost</label><input id="sc-c' + idx + '" data-k="cost" inputmode="decimal" placeholder="From Q12" value="' + esc(r.cost) + '"></div>' +
          '<div class="field"><label for="sc-x' + idx + '">Complexity</label><select id="sc-x' + idx + '" data-k="cx">' +
            ['Low', 'Medium', 'High'].map(function (v) { return '<option' + (v === r.cx ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>' +
          '<div class="outcome ' + o[1] + '" aria-live="polite">' + o[0] + '</div>' +
        '</div>' +
        '<div class="sigs" role="group" aria-label="Databricks dependencies for workload ' + (idx + 1) + '">' +
          SIGS.map(function (s, i) { return '<label class="sig"><input type="checkbox" data-sig="' + i + '"' + (r.sigs.indexOf(i) > -1 ? ' checked' : '') + '>' + s[0] + ' <small>+' + s[1] + '</small></label>'; }).join('') +
          '<span class="note" style="margin-left:auto;align-self:center">Dependency: <b>' + pts + ' pts</b>' + (rows.length > 1 ? ' &middot; <button type="button" class="linkbtn danger" data-del="' + idx + '">Remove</button>' : '') + '</span>' +
        '</div>';
      scorerEl.appendChild(div);
    });
  }
  scorerEl.addEventListener('input', function (e) {
    var row = e.target.closest('.scorer-row'); var idx = Array.prototype.indexOf.call(scorerEl.children, row);
    var k = e.target.getAttribute('data-k');
    if (k === 'name' || k === 'cost') { rows[idx][k] = e.target.value; saveRows(); }
  });
  scorerEl.addEventListener('change', function (e) {
    var row = e.target.closest('.scorer-row'); var idx = Array.prototype.indexOf.call(scorerEl.children, row);
    if (e.target.getAttribute('data-k') === 'cx') rows[idx].cx = e.target.value;
    if (e.target.hasAttribute('data-sig')) {
      var s = +e.target.getAttribute('data-sig'), arr = rows[idx].sigs, at = arr.indexOf(s);
      if (e.target.checked && at === -1) arr.push(s); if (!e.target.checked && at > -1) arr.splice(at, 1);
    }
    saveRows(); drawScorer();
    var again = scorerEl.children[idx] && scorerEl.children[idx].querySelector(e.target.hasAttribute('data-sig') ? '[data-sig="' + e.target.getAttribute('data-sig') + '"]' : '[data-k="cx"]');
    if (again) again.focus();
  });
  scorerEl.addEventListener('click', function (e) {
    var d = e.target.getAttribute('data-del');
    if (d !== null) { rows.splice(+d, 1); saveRows(); drawScorer(); }
  });
  $('#add-row').addEventListener('click', function () { rows.push({ name: '', cost: '', cx: 'Low', sigs: [] }); saveRows(); drawScorer(); var last = scorerEl.lastElementChild; if (last) last.querySelector('input').focus(); });
  $('#clear-scorer').addEventListener('click', function () { if (!confirm('Clear all workloads from the scorer?')) return; rows = [{ name: '', cost: '', cx: 'Low', sigs: [] }]; saveRows(); drawScorer(); });
  drawScorer();

  /* ---------------- evidence sheet ---------------- */
  var sheet = $('#sheet');
  var NEXT = ['', 'Keep as is', 'Right-size compute', 'Fix failures', 'Move to jobs compute', 'Add tags and owner', 'Evaluate migration', 'Retire'];
  var OUTS = ['', 'Keep on Databricks', 'Migrate', 'Optimise then evaluate', 'Evaluate', 'Defer'];
  var jb = $('#jobs-tbl tbody'), kb = $('#keep-tbl tbody');
  for (var i = 1; i <= 10; i++) {
    jb.insertAdjacentHTML('beforeend', '<tr><td class="idx">' + i + '</td>' +
      '<td><input name="job' + i + '_name" aria-label="Job ' + i + ' name" placeholder="Job name"></td>' +
      '<td><input name="job' + i + '_owner" aria-label="Job ' + i + ' owner" placeholder="Owner"></td>' +
      '<td><div class="money" data-cur="$"><input name="job' + i + '_cost" aria-label="Job ' + i + ' 90-day list cost" inputmode="decimal" placeholder="0"></div></td>' +
      '<td><select name="job' + i + '_action" aria-label="Job ' + i + ' next action">' + NEXT.map(function (v) { return '<option value="' + v + '">' + (v || 'Choose') + '</option>'; }).join('') + '</select></td></tr>');
  }
  for (var j = 1; j <= 8; j++) {
    kb.insertAdjacentHTML('beforeend', '<tr><td class="idx">' + j + '</td>' +
      '<td><input name="keep' + j + '_name" aria-label="Workload ' + j + '" placeholder="Workload"></td>' +
      '<td><select name="keep' + j + '_out" aria-label="Workload ' + j + ' outcome">' + OUTS.map(function (v) { return '<option value="' + v + '">' + (v || 'Choose outcome') + '</option>'; }).join('') + '</select></td>' +
      '<td><input name="keep' + j + '_why" aria-label="Workload ' + j + ' reason" placeholder="Reason or evidence"></td></tr>');
  }
  var SHEET_KEY = 'fg-sheet';
  function num(v) { if (v == null) return NaN; v = String(v).replace(/[^0-9.\-]/g, ''); return v === '' ? NaN : parseFloat(v); }
  function cur() { return sheet.elements.currency.value || '$'; }
  function money(n) { return isNaN(n) ? '' : cur() + Math.round(n).toLocaleString('en-GB'); }
  function pct(n) { return isNaN(n) || !isFinite(n) ? '' : (Math.round(n * 10) / 10) + '%'; }
  function setV(id, txt) { $('#' + id).innerHTML = txt || '&nbsp;'; }
  function compute() {
    var c = cur();
    $$('.money', sheet).forEach(function (m) { m.setAttribute('data-cur', c); });
    var total = num(sheet.elements.total.value);
    var win = num(sheet.elements.window.value) || 90;
    setV('c-annual', isNaN(total) ? '' : money(total * 365 / win));
    var traced = num(sheet.elements.traced.value);
    setV('c-tracedpct', (!isNaN(total) && !isNaN(traced) && total > 0) ? pct(100 * traced / total) : '');
    setV('c-gap', (!isNaN(total) && !isNaN(traced)) ? money(Math.max(total - traced, 0)) : '');
    var top = 0, any = false;
    for (var i = 1; i <= 10; i++) { var v = num(sheet.elements['job' + i + '_cost'].value); if (!isNaN(v)) { top += v; any = true; } }
    setV('c-top10', any ? money(top) : '');
    setV('c-top10pct', any && total > 0 ? pct(100 * top / total) : '');
    var failed = num(sheet.elements.failed.value);
    setV('c-failedpct', !isNaN(failed) && total > 0 ? pct(100 * failed / total) : '');
  }
  function saveSheet() {
    var o = {};
    Array.prototype.forEach.call(sheet.elements, function (el) { if (el.name) o[el.name] = el.value; });
    store.set(SHEET_KEY, o);
    var note = $('#saved-note span'); note.textContent = 'Saved in this browser at ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function loadSheet() {
    var o = store.get(SHEET_KEY, null);
    if (o) Object.keys(o).forEach(function (k) { if (sheet.elements[k]) sheet.elements[k].value = o[k]; });
    if (!sheet.elements.pulled.value) sheet.elements.pulled.value = new Date().toISOString().slice(0, 10);
  }
  loadSheet(); compute();
  sheet.addEventListener('input', function () { compute(); saveSheet(); });
  sheet.addEventListener('change', function () { compute(); saveSheet(); });
  $('#clear-sheet').addEventListener('click', function () {
    if (!confirm('Clear every field on the Evidence Sheet? This cannot be undone.')) return;
    sheet.reset(); localStorage.removeItem(SHEET_KEY); loadSheet(); compute(); toast('Evidence Sheet cleared');
  });
  function autosize() { $$('textarea', sheet).forEach(function (t) { t.rows = Math.max(1, t.value.split('\n').length + Math.floor(t.value.length / 110)); }); }
  function markEmptyRows() {
    [jb, kb].forEach(function (body) {
      var trs = $$('tr', body), filled = trs.filter(function (tr) { return $$('input,select', tr).some(function (e) { return e.value; }); });
      trs.forEach(function (tr) { tr.classList.toggle('empty-row', filled.length > 0 && filled.indexOf(tr) === -1); });
    });
  }
  function preparePrint() {
    markEmptyRows(); autosize();
    $$('select, input[type=date]', sheet).forEach(function (e) { e.classList.toggle('blank', !e.value); });
    $$('.money', sheet).forEach(function (m) { var i = m.querySelector('input'); m.classList.toggle('blank-money', !i.value); });
  }
  window.fgPreparePrint = preparePrint;
  window.addEventListener('beforeprint', preparePrint);
  $('#print-sheet').addEventListener('click', function () {
    document.documentElement.classList.add('print-sheet');
    preparePrint();
    setTimeout(function () { window.print(); }, 50);
  });
  window.addEventListener('afterprint', function () { document.documentElement.classList.remove('print-sheet'); });

  /* scorer to sheet */
  $('#to-sheet').addEventListener('click', function () {
    var filled = rows.filter(function (r) { return r.name.trim(); });
    if (!filled.length) { toast('Name at least one workload first'); return; }
    filled.slice(0, 8).forEach(function (r, i) {
      var pts = r.sigs.reduce(function (a, k) { return a + SIGS[k][1]; }, 0);
      var o = OUT[outcome(r.cx, pts)][0];
      sheet.elements['keep' + (i + 1) + '_name'].value = r.name;
      sheet.elements['keep' + (i + 1) + '_out'].value = o;
      var why = r.cx + ' complexity, ' + pts + ' dependency pts' + (r.sigs.length ? ' (' + r.sigs.map(function (k) { return SIGS[k][0]; }).join(', ') + ')' : '') + (r.cost ? ', 90-day cost ' + r.cost : '');
      sheet.elements['keep' + (i + 1) + '_why'].value = why;
    });
    compute(); saveSheet();
    toast(Math.min(filled.length, 8) + ' workload' + (filled.length > 1 ? 's' : '') + ' added to the Evidence Sheet');
  });
})();
