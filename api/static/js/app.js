/* BankCore — interface guichet (FR / EN). Aucune règle métier ici : la base fait foi.
   Contrats API inchangés : GET /api/accounts, GET /api/accounts/<no>/statement, GET /api/accounts/<no>/balance,
   POST /api/deposit|withdraw|transfer, GET|POST /api/clients, POST /api/accounts, GET /api/audit.
   Les textes passent par t()/tp() (i18n.js). Les erreurs de l'API sont traduites grâce à leur champ "code". */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Formats (dépendent de la langue) ---------- */
const locale = () => (LANG === 'fr' ? 'fr-FR' : 'en-US');
const nfmt = (n) => new Intl.NumberFormat(locale()).format(n);
const num = (n) => (n < 0 ? '−' : '') + nfmt(Math.abs(n));
const when = (s) => (s || '').replace('T', ' ');
const TX_ICON = { DEPOT: 'arrow-down-to-line', RETRAIT: 'arrow-up-from-line', VIREMENT_DEBIT: 'arrow-left-right', VIREMENT_CREDIT: 'arrow-left-right' };
const TX_SIGN = { DEPOT: 1, VIREMENT_CREDIT: 1, RETRAIT: -1, VIREMENT_DEBIT: -1 };
const STATUS_KIND = { ACTIF: 'ok', BLOQUE: 'warn', CLOTURE: 'neutral' };
const label = (prefix, code) => { const k = prefix + '.' + code; return I18N[LANG][k] != null ? t(k) : code; };

/* ---------- Textes traduisibles (descripteurs) ----------
   Un descripteur est résolu au moment du rendu : {k, p} clé + paramètres, {err} erreur d'API, ou une chaîne brute. */
const K = (k, p) => ({ k, p });
function errText(err) {
  const key = 'err.' + err.code;
  if (err.code && I18N[LANG][key] != null) {
    const p = { ...(err.params || {}) };
    if (p.field) p.field = t('field.' + p.field);
    return t(key, p);
  }
  return err.message;
}
function tr(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (x.err) return errText(x.err);
  return t(x.k, x.p);
}

/* ---------- DOM helpers (textContent uniquement : aucune donnée injectée en HTML) ---------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function icon(name, cls = 'icon icon-sm') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', '#i-' + name);
  s.append(u);
  return s;
}
function moneyNode(v, cls = 'money') {
  const s = el('span', cls + (v < 0 ? ' neg' : ''));
  s.append(document.createTextNode(num(v)), el('span', 'u', 'FCFA'));
  return s;
}

/* ---------- API ---------- */
function apiError(code, message, status, params) {
  const e = new Error(message);
  e.code = code; e.status = status; e.params = params || {};
  return e;
}
async function api(path, opts) {
  let res;
  try { res = await fetch(path, opts); } catch (e) { throw apiError('network', 'Network error', 0); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw apiError(body.code || 'http', body.error || 'Erreur ' + res.status, res.status, body.code ? body.params : { status: res.status });
  }
  return body;
}

/* ---------- États (vide / erreur / chargement) ---------- */
function clearState(wrap) { $$('.state, .sk-rows', wrap).forEach((n) => n.remove()); }
/* opts : {ico, title, text, error, action: {label, onClick}} — title/text/label sont des descripteurs */
function showState(wrapSel, tableSel, opts) {
  const wrap = $(wrapSel);
  clearState(wrap);
  $(tableSel).replaceChildren();
  const s = el('div', 'state' + (opts.error ? ' err' : ''));
  const i = el('div', 'ico'); i.append(icon(opts.ico || 'inbox', 'icon'));
  s.append(i, el('h3', null, tr(opts.title)), el('p', null, tr(opts.text)));
  if (opts.action) {
    const b = el('button', 'btn btn-secondary', tr(opts.action.label));
    b.type = 'button';
    b.onclick = opts.action.onClick;
    s.append(b);
  }
  wrap.append(s);
}
function showSkeleton(wrapSel, tableSel, rows = 4) {
  const wrap = $(wrapSel);
  clearState(wrap);
  $(tableSel).replaceChildren();
  const box = el('div', 'sk-rows');
  box.setAttribute('aria-hidden', 'true');
  for (let r = 0; r < rows; r++) {
    const line = el('span', 'skeleton');
    line.style.width = (60 + ((r * 17) % 36)) + '%';
    box.append(line);
  }
  wrap.append(box);
}

/* ---------- Tableau générique ---------- */
function table(tableSel, cols, data, { onRow, isSel, stamp } = {}) {
  const tbl = $(tableSel);
  clearState(tbl.parentElement);
  tbl.replaceChildren();
  const head = el('thead');
  const hr = el('tr');
  cols.forEach((c) => {
    const th = el('th', [c.num ? 'num' : '', c.cls || ''].join(' ').trim(), c.label ? t(c.label) : '');
    th.scope = 'col';
    hr.append(th);
  });
  head.append(hr);
  const body = el('tbody');
  data.forEach((r) => {
    const tr_ = el('tr');
    cols.forEach((c) => {
      const td = el('td', [c.num ? 'num' : '', c.cls || ''].join(' ').trim());
      const v = r[c.key];
      const out = c.render ? c.render(r, v) : (c.fmt ? c.fmt(v) : (v ?? ''));
      if (out instanceof Node) td.append(out); else td.textContent = out;
      tr_.append(td);
    });
    if (onRow) {
      tr_.classList.add('pick');
      tr_.tabIndex = 0;
      tr_.onclick = () => onRow(r, tr_);
      tr_.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRow(r, tr_); } };
    }
    if (isSel && isSel(r)) { tr_.classList.add('sel'); tr_.setAttribute('aria-selected', 'true'); }
    if (stamp && stamp(r)) tr_.classList.add('stamped');
    body.append(tr_);
  });
  tbl.append(head, body);
}

/* ---------- Message d'opération ---------- */
let lastMsg = null; // {d: descripteur, ok}
function renderMsg() {
  const m = $('#msg');
  m.replaceChildren();
  if (!lastMsg) { m.className = ''; return; }
  m.className = lastMsg.ok ? 'ok' : 'err';
  m.append(icon(lastMsg.ok ? 'circle-check' : 'circle-x', 'icon'), el('span', null, tr(lastMsg.d)));
}
function say(d, ok) { lastMsg = d ? { d, ok } : null; renderMsg(); }

/* ---------- Compteur animé ---------- */
const shown = new WeakMap();
function tick(node, to, render) {
  const from = shown.get(node) ?? 0;
  shown.set(node, to);
  if (reduceMotion() || from === to) { render(node, to); return; }
  const t0 = performance.now(), dur = 600;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    render(node, Math.round(from + (to - from) * e));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const renderMoney = (n, v) => { n.replaceChildren(document.createTextNode(num(v)), el('span', 'unit', 'FCFA')); };
const renderInt = (n, v) => { n.textContent = String(v); };

/* ---------- État local ---------- */
let accounts = [];
let clients = [];
let selected = null;
let typeFilter = '';
let stampSet = new Set();
let auditLoaded = false;
/* Vues : état d'affichage de chaque panneau, pour pouvoir tout re-rendre quand la langue change. */
const view = {
  accounts: { s: 'loading' },        // loading | ok | error
  clients: { s: 'loading' },         // loading | ok | error
  statement: { s: 'none' },          // none | loading | ok | error  (+ data, err)
  audit: { s: 'idle' },              // idle | loading | ok | error   (+ data, err)
};
const byNo = (no) => accounts.find((a) => a.account_no === no);

/* ---------- Indicateurs ---------- */
function updateKpis() {
  if (view.accounts.s !== 'ok') return;
  const open = accounts.filter((a) => a.status !== 'CLOTURE');
  const active = accounts.filter((a) => a.status === 'ACTIF');
  const od = accounts.filter((a) => a.balance < 0);
  tick($('#kpi-total'), open.reduce((s, a) => s + a.balance, 0), renderMoney);
  $('#kpi-total-sub').textContent = tp('kpi.total.sub.count', open.length);
  tick($('#kpi-active'), active.length, renderInt);
  $('#kpi-active-sub').textContent = t('kpi.active.sub', { n: accounts.length });
  tick($('#kpi-od'), od.length, renderInt);
  const used = od.reduce((s, a) => s + -a.balance, 0);
  $('#kpi-od-sub').textContent = od.length ? t('kpi.od.sub', { amount: nfmt(used) }) : t('kpi.od.none');
  $('#kpi-od-box').classList.toggle('warn', od.length > 0);
  const dl = $('#acc-list');
  dl.replaceChildren(...accounts.map((a) => { const o = el('option'); o.value = a.account_no; o.label = a.client_name; return o; }));
}

/* ---------- Comptes ---------- */
function visibleAccounts() {
  const q = $('#q').value.trim().toLowerCase();
  return accounts.filter((a) => (!typeFilter || a.account_type === typeFilter) &&
    (!q || a.account_no.toLowerCase().includes(q) || (a.client_name || '').toLowerCase().includes(q)));
}

function renderAccounts() {
  const v = view.accounts;
  if (v.s === 'loading') { showSkeleton('#accounts-wrap', '#accounts', 4); return; }
  if (v.s === 'error') {
    showState('#accounts-wrap', '#accounts', {
      ico: 'triangle-alert', error: true, title: K('accounts.error.title'),
      text: { err: v.err }, action: { label: K('retry'), onClick: () => loadAccounts() },
    });
    return;
  }
  const data = visibleAccounts();
  if (!data.length) {
    showState('#accounts-wrap', '#accounts', accounts.length
      ? { title: K('accounts.empty.filter.title'), text: K('accounts.empty.filter.text') }
      : { title: K('accounts.empty.none.title'), text: K('accounts.empty.none.text') });
    return;
  }
  table('#accounts', [
    { key: 'account_no', label: 'col.account', render: (r) => el('span', 'mono', r.account_no) },
    { key: 'client_name', label: 'col.client' },
    { key: 'account_type', label: 'col.type', cls: 'hide-sm', fmt: (v2) => label('type', v2) },
    { key: 'balance', label: 'col.balance', num: true, render: (r) => moneyNode(r.balance, 'money amount') },
    { key: 'overdraft_limit', label: 'col.overdraft', num: true, cls: 'hide-sm', render: (r) => {
      const w = el('span', 'money');
      w.append(document.createTextNode(num(r.overdraft_limit)), el('span', 'u', 'FCFA'));
      if (r.overdraft_limit > 0) {
        const used = Math.min(1, Math.max(0, -r.balance / r.overdraft_limit));
        const m = el('span', 'meter' + (used > .8 ? ' hot' : ''));
        m.style.setProperty('--used', used);
        m.setAttribute('role', 'img');
        m.setAttribute('aria-label', t('meter.label', { pct: Math.round(used * 100) }));
        m.append(el('i'));
        w.append(m);
      }
      return w;
    } },
    { key: 'status', label: 'col.status', render: (r) => el('span', 'badge ' + (STATUS_KIND[r.status] || 'neutral'), label('status', r.status)) },
  ], data, {
    onRow: (r) => selectAccount(r.account_no),
    isSel: (r) => r.account_no === selected,
    stamp: (r) => stampSet.has(r.account_no),
  });
  stampSet = new Set();
}

function selectAccount(no) {
  selected = no;
  $('#acc').value = no;
  renderAccounts();
  refreshWho();
  refreshPreview();
  loadStatement(no);
}

async function loadAccounts() {
  if (view.accounts.s !== 'ok') { view.accounts = { s: 'loading' }; renderAccounts(); }
  try {
    accounts = await api('/api/accounts');
    view.accounts = { s: 'ok' };
    setLive('ok');
    updateKpis();
    renderAccounts();
    refreshWho();
    refreshPreview();
  } catch (err) {
    view.accounts = { s: 'error', err };
    setLive('err');
    renderAccounts();
    say({ err }, false);
  }
}

/* ---------- Relevé ---------- */
function updateStmtHeader() {
  const a = selected && byNo(selected);
  $('#stmt-title').textContent = selected ? t('stmt.title.account', { no: selected }) : t('stmt.title');
  $('#stmt-sub').textContent = a ? a.client_name + ' · ' + label('type', a.account_type) : t('stmt.sub.default');
}

function renderStatement() {
  updateStmtHeader();
  const v = view.statement;
  if (v.s === 'none') { showState('#statement-wrap', '#statement', { ico: 'scroll-text', title: K('stmt.none.title'), text: K('stmt.none.text') }); return; }
  if (v.s === 'loading') { showSkeleton('#statement-wrap', '#statement', 4); return; }
  if (v.s === 'error') { showState('#statement-wrap', '#statement', { ico: 'triangle-alert', error: true, title: K('stmt.error.title'), text: { err: v.err } }); return; }
  if (!v.data.length) { showState('#statement-wrap', '#statement', { ico: 'scroll-text', title: K('stmt.empty.title'), text: K('stmt.empty.text') }); return; }
  table('#statement', [
    { key: 'tx_date', label: 'col.date', fmt: when, cls: 'mono' },
    { key: 'tx_type', label: 'col.operation', render: (r) => {
      const w = el('span', 'op'); const i = el('span', 'ico'); i.append(icon(TX_ICON[r.tx_type] || 'circle-dot'));
      w.append(i, el('span', null, label('tx', r.tx_type))); return w; } },
    { key: 'counterpart', label: 'col.counterpart', render: (r) => (r.counterpart ? el('span', 'mono', r.counterpart) : el('span', null, '—')) },
    { key: 'amount', label: 'col.amount', num: true, cls: 'rule', render: (r) => {
      const s = TX_SIGN[r.tx_type] || 0;
      const n = el('span', 'amount ' + (s > 0 ? 'pos' : s < 0 ? 'neg' : ''));
      n.append(document.createTextNode((s > 0 ? '+' : s < 0 ? '−' : '') + nfmt(Math.abs(r.amount))), el('span', 'u', 'FCFA'));
      return n; } },
    { key: 'balance_after', label: 'col.balance_after', num: true, render: (r) => moneyNode(r.balance_after) },
  ], v.data);
}

async function loadStatement(no) {
  view.statement = { s: 'loading' };
  renderStatement();
  try {
    const data = await api('/api/accounts/' + encodeURIComponent(no) + '/statement');
    if (no !== selected) return; // une autre sélection a eu lieu entre-temps
    view.statement = { s: 'ok', data };
  } catch (err) {
    if (no !== selected) return;
    view.statement = { s: 'error', err };
  }
  renderStatement();
}

/* ---------- Formulaire d'opération ---------- */
const kindNow = () => $('#kind').value;

function setKind(k, focus) {
  $('#kind').value = k;
  $('#kind').dispatchEvent(new Event('change'));
  $$('#kind-seg button').forEach((b) => {
    const on = b.dataset.kind === k;
    b.setAttribute('aria-checked', on);
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
}

function refreshKindTexts() {
  const tr_ = kindNow() === 'transfer';
  $('#acc-label').textContent = t(tr_ ? 'field.source' : 'field.account');
  $('#submit-label').textContent = t('submit.' + kindNow());
}

$('#kind').addEventListener('change', () => {
  $('#to-wrap').hidden = kindNow() !== 'transfer';
  refreshKindTexts();
  refreshWho();
  refreshPreview();
});

$('#kind-seg').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-kind]');
  if (b) setKind(b.dataset.kind);
});
$('#kind-seg').addEventListener('keydown', (e) => {
  const order = ['deposit', 'withdraw', 'transfer'];
  const i = order.indexOf(kindNow());
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setKind(order[(i + 1) % 3], true); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setKind(order[(i + 2) % 3], true); }
});

$$('.chip[data-amt]').forEach((c) => c.addEventListener('click', () => {
  $('#amount').value = c.dataset.amt;
  refreshPreview();
}));

function who(inputSel, outSel) {
  const out = $(outSel), v = $(inputSel).value.trim().toUpperCase();
  out.replaceChildren();
  out.classList.remove('bad');
  if (!v) return;
  const a = byNo(v);
  if (a) {
    out.append(icon('circle-check'), el('b', null, a.client_name), document.createTextNode(' · ' + label('type', a.account_type)));
    if (a.status !== 'ACTIF') out.append(el('span', 'badge ' + (STATUS_KIND[a.status] || 'neutral'), label('status', a.status)));
  } else if (accounts.length && /^BJ\d{10}$/.test(v)) {
    out.classList.add('bad');
    out.append(icon('circle-x'), document.createTextNode(t('who.unknown')));
  }
}
function refreshWho() { who('#acc', '#acc-who'); who('#to', '#to-who'); }

/* Aperçu avant / après : indicatif, la base reste seule juge. */
function refreshPreview() {
  const box = $('#preview');
  box.replaceChildren();
  const title = el('div', 'preview-title');
  title.append(icon('scroll-text'), document.createTextNode(t('preview.title')));
  box.append(title);
  const kind = kindNow();
  const src = byNo($('#acc').value.trim().toUpperCase());
  const dst = kind === 'transfer' ? byNo($('#to').value.trim().toUpperCase()) : null;
  const amt = Number($('#amount').value);
  if (!src || !(amt > 0) || (kind === 'transfer' && !dst)) {
    box.append(el('p', 'preview-empty', t(kind === 'transfer' ? 'preview.empty.transfer' : 'preview.empty.single')));
    return;
  }
  const line = (a, delta) => {
    const after = a.balance + delta;
    const bad = after < -a.overdraft_limit;
    const row = el('div', 'preview-line');
    const k = el('span', 'k mono', a.account_no); k.title = a.client_name; row.append(k);
    const v = el('span', 'v' + (bad ? ' bad' : ''));
    v.append(document.createTextNode(num(a.balance)), el('span', 'arrow', '→'), document.createTextNode(num(after) + ' FCFA'));
    row.append(v);
    box.append(row);
    return bad;
  };
  let over = false;
  if (kind === 'deposit') over = line(src, amt);
  else if (kind === 'withdraw') over = line(src, -amt);
  else { over = line(src, -amt); line(dst, amt); }
  if (over) {
    const n = el('div', 'preview-note');
    n.append(icon('triangle-alert'), el('span', null, t('preview.over')));
    box.append(n);
  }
}
['#acc', '#to', '#amount'].forEach((s) => $(s).addEventListener('input', () => { refreshWho(); refreshPreview(); }));

$('#op').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#submit');
  if (btn.getAttribute('aria-busy') === 'true') return;
  const kind = $('#kind').value;
  const acc = $('#acc').value.trim().toUpperCase();
  const to = $('#to').value.trim().toUpperCase();
  const body = kind === 'transfer'
    ? { from: acc, to, amount: $('#amount').value }
    : { account_no: acc, amount: $('#amount').value };
  btn.setAttribute('aria-busy', 'true'); btn.disabled = true;
  say(null);
  try {
    await api('/api/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    say(K('op.success'), true);
    stampSet = new Set(kind === 'transfer' ? [acc, to] : [acc]);
    selected = acc;
    $('#amount').value = '';
    await loadAccounts();
    await loadStatement(acc);
  } catch (err) {
    say({ err }, false);
  } finally {
    btn.removeAttribute('aria-busy'); btn.disabled = false;
    refreshPreview();
  }
});

/* ---------- Recherche / filtre ---------- */
$('#q').addEventListener('input', renderAccounts);
$('#type-filter').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-type]');
  if (!b) return;
  typeFilter = b.dataset.type;
  $$('#type-filter button').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderAccounts();
});

/* ---------- Clients ---------- */
function renderClients() {
  const v = view.clients;
  if (v.s === 'loading') { showSkeleton('#clients-wrap', '#clients', 3); return; }
  if (v.s === 'error') {
    showState('#clients-wrap', '#clients', { ico: 'triangle-alert', error: true, title: K('clients.error.title'), text: { err: v.err }, action: { label: K('retry'), onClick: () => loadClients() } });
    return;
  }
  if (!clients.length) {
    showState('#clients-wrap', '#clients', { ico: 'users', title: K('clients.empty.title'), text: K('clients.empty.text'), action: { label: K('clients.empty.action'), onClick: () => openClientDialog() } });
    return;
  }
  table('#clients', [
    { key: 'full_name', label: 'col.client', render: (r) => { const w = el('span'); w.append(document.createTextNode(r.full_name), el('span', 'sub', r.email)); return w; } },
    { key: 'phone', label: 'col.phone', cls: 'hide-sm', render: (r) => (r.phone ? el('span', 'mono', r.phone) : '—') },
    { key: 'account_count', label: 'col.accounts', num: true },
    { key: 'created_at', label: 'col.since', cls: 'hide-sm', fmt: (v2) => (v2 || '').slice(0, 10) },
    { key: 'client_id', label: '', num: true, render: (r) => {
      const b = el('button', 'btn btn-secondary btn-link', t('open_account'));
      b.type = 'button';
      b.setAttribute('aria-label', t('clients.open_for', { name: r.full_name }));
      b.onclick = () => openAccountDialog(r.client_id);
      return b; } },
  ], clients);
}

async function loadClients() {
  if (view.clients.s !== 'ok') { view.clients = { s: 'loading' }; renderClients(); }
  try {
    clients = await api('/api/clients');
    view.clients = { s: 'ok' };
  } catch (err) {
    view.clients = { s: 'error', err };
  }
  renderClients();
}

/* ---------- Dialogues ---------- */
let dlgErr = { client: null, account: null };
function dlgError(which, err) {
  dlgErr[which] = err;
  const m = $(which === 'client' ? '#client-msg' : '#account-msg');
  m.replaceChildren();
  if (err) m.append(icon('circle-x', 'icon'), el('span', null, errText(err)));
}
function busy(btn, on) { btn.disabled = on; if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy'); }
$$('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  $$('[data-close]', d).forEach((b) => b.addEventListener('click', () => d.close()));
});

function openClientDialog() {
  $('#client-form').reset();
  dlgError('client', null);
  $('#dlg-client').showModal();
  $('#cf-first').focus();
}
$('#new-client').addEventListener('click', openClientDialog);

$('#client-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#client-submit');
  if (btn.disabled) return;
  const body = {
    first_name: $('#cf-first').value.trim(), last_name: $('#cf-last').value.trim(),
    email: $('#cf-email').value.trim(), phone: $('#cf-phone').value.trim(),
  };
  busy(btn, true); dlgError('client', null);
  try {
    const res = await api('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    $('#dlg-client').close();
    await loadClients();
    say(K('dc.success', { name: body.first_name + ' ' + body.last_name }), true);
    openAccountDialog(res.client_id);
  } catch (err) {
    dlgError('client', err);
  } finally {
    busy(btn, false);
  }
});

let acType = 'COURANT';
function setAcType(ty) {
  acType = ty;
  $$('#ac-type button').forEach((b) => { const on = b.dataset.type === ty; b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
  const od = $('#ac-overdraft');
  od.disabled = ty === 'EPARGNE';
  if (ty === 'EPARGNE') od.value = '0';
}
$('#ac-type').addEventListener('click', (e) => { const b = e.target.closest('button[data-type]'); if (b) setAcType(b.dataset.type); });
$('#ac-type').addEventListener('keydown', (e) => {
  if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
    const ty = acType === 'COURANT' ? 'EPARGNE' : 'COURANT';
    setAcType(ty);
    $(`#ac-type button[data-type="${ty}"]`).focus();
  }
});

function fillClientOptions(preferred) {
  const sel = $('#ac-client');
  const keep = preferred != null ? String(preferred) : sel.value;
  sel.replaceChildren();
  const none = !clients.length;
  if (none) {
    const o = el('option', null, t('da.no_client')); o.value = ''; sel.append(o);
  } else {
    clients.forEach((c) => {
      const o = el('option', null, tp('da.client_option', c.account_count, { name: c.full_name, email: c.email }));
      o.value = c.client_id; sel.append(o);
    });
    if (keep) sel.value = keep;
  }
  sel.disabled = none;
  $('#account-submit').disabled = none;
  return none;
}

function openAccountDialog(clientId) {
  $('#account-form').reset();
  setAcType('COURANT');
  dlgError('account', null);
  const none = fillClientOptions(clientId);
  $('#dlg-account').showModal();
  (none ? $('#dlg-account [data-close]') : $('#ac-client')).focus();
}
$('#open-account').addEventListener('click', () => {
  const a = selected && byNo(selected);
  openAccountDialog(a ? clients.find((c) => c.email === a.email)?.client_id : null);
});

$('#account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#account-submit');
  if (btn.disabled) return;
  const body = {
    client_id: Number($('#ac-client').value), account_type: acType,
    overdraft_limit: acType === 'EPARGNE' ? '0' : ($('#ac-overdraft').value || '0'),
    initial_deposit: $('#ac-initial').value || '0',
  };
  busy(btn, true); dlgError('account', null);
  try {
    const res = await api('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    $('#dlg-account').close();
    stampSet = new Set([res.account_no]);
    await Promise.all([loadAccounts(), loadClients()]);
    say(K('da.success', { no: res.account_no }), true);
    selectAccount(res.account_no);
  } catch (err) {
    dlgError('account', err);
  } finally {
    busy(btn, false);
  }
});

/* ---------- Audit ---------- */
function renderAudit() {
  $('#load-audit-label').textContent = t(auditLoaded ? 'audit.refresh' : 'audit.load');
  const v = view.audit;
  if (v.s === 'idle') { showState('#audit-wrap', '#audit', { ico: 'history', title: K('audit.idle.title'), text: K('audit.idle.text') }); return; }
  if (v.s === 'loading') { showSkeleton('#audit-wrap', '#audit', 5); return; }
  if (v.s === 'error') {
    showState('#audit-wrap', '#audit', { ico: 'triangle-alert', error: true, title: K('audit.error.title'), text: { err: v.err }, action: { label: K('retry'), onClick: () => $('#load-audit').click() } });
    return;
  }
  if (!v.data.length) { showState('#audit-wrap', '#audit', { title: K('audit.empty.title'), text: K('audit.empty.text') }); return; }
  const val = (k) => (r) => { const x = r[k]; if (x == null || x === '') return '—'; const s = el('span', 'mono trunc', String(x)); s.title = String(x); return s; };
  table('#audit', [
    { key: 'changed_at', label: 'col.date', fmt: when, cls: 'mono' },
    { key: 'db_user', label: 'col.user' },
    { key: 'table_name', label: 'col.table', cls: 'mono' },
    { key: 'operation', label: 'col.action', render: (r) => el('span', 'action ' + r.operation, r.operation) },
    { key: 'old_value', label: 'col.before', render: val('old_value') },
    { key: 'new_value', label: 'col.after', render: val('new_value') },
  ], v.data);
}

$('#load-audit').addEventListener('click', async () => {
  const btn = $('#load-audit');
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  view.audit = { s: 'loading' };
  renderAudit();
  try {
    view.audit = { s: 'ok', data: await api('/api/audit') };
    auditLoaded = true;
  } catch (err) {
    view.audit = { s: 'error', err };
  } finally {
    btn.disabled = false; btn.removeAttribute('aria-busy');
    renderAudit();
  }
});

/* ---------- Statut de connexion ---------- */
let liveState = 'idle';
function setLive(state) {
  liveState = state;
  $('#live').dataset.state = state;
  $('#live-text').textContent = t(state === 'ok' ? 'live.ok' : state === 'err' ? 'live.err' : 'live.connecting');
}

/* ---------- Thème ---------- */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(pref) {
  const eff = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = eff;
  $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.themeSet === pref));
}
function storedTheme() { try { return localStorage.getItem('bankcore-theme') || 'system'; } catch (e) { return 'system'; } }
$$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => {
  try { localStorage.setItem('bankcore-theme', b.dataset.themeSet); } catch (e) { /* stockage indisponible */ }
  applyTheme(b.dataset.themeSet);
}));
mq.addEventListener('change', () => { if (storedTheme() === 'system') applyTheme('system'); });
applyTheme(storedTheme());

/* ---------- Langue ---------- */
function rerenderAll() {
  applyStaticI18n();
  $$('[data-lang-set]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.langSet === LANG));
  setLive(liveState);
  refreshKindTexts();
  updateKpis();
  renderAccounts();
  renderStatement();
  renderClients();
  renderAudit();
  renderMsg();
  refreshWho();
  refreshPreview();
  if ($('#dlg-account').open) fillClientOptions();
  dlgError('client', dlgErr.client);
  dlgError('account', dlgErr.account);
}
$$('[data-lang-set]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.langSet); rerenderAll(); }));

/* ---------- Démarrage ---------- */
setKind('deposit');
rerenderAll();
loadAccounts();
loadClients();

/* Bandeau « démo » : seul le serveur de démonstration répond à /api/meta */
fetch('/api/meta').then((r) => (r.ok ? r.json() : null)).then((m) => {
  if (m && m.demo) $('#demo-banner').hidden = false;
}).catch(() => { /* API réelle : pas de bandeau */ });
