/* Budget Tracker - vanilla JS, no dependencies, no build step.
   All data lives in localStorage under STORAGE_KEY. */
'use strict';

const STORAGE_KEY = 'budget-tracker:v1';
const VIEWS = ['dashboard', 'transactions', 'year', 'setup'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'JPY', 'INR', 'MXN', 'BRL', 'PHP', 'SGD', 'ZAR'];

/* ---------- tiny helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const uid = prefix => prefix + Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const monthKeyOf = (y, m) => `${y}-${pad2(m)}`; // m is 1-12
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const thisMonth = () => todayStr().slice(0, 7);
const monthKey = dateStr => dateStr.slice(0, 7);
const sum = (arr, fn) => arr.reduce((s, x) => s + fn(x), 0);
const num = v => Math.max(0, parseFloat(v) || 0);

/* ---------- state ---------- */
const defaultState = () => ({
  currency: 'USD',
  income: [
    { id: uid('i_'), name: 'Paycheck', expected: 3500 },
    { id: uid('i_'), name: 'Side income', expected: 300 },
  ],
  // kind: 'expense' | 'savings'  (placeholder budgets - replace with your own)
  categories: [
    ['Rent / Mortgage', 1200], ['Utilities', 150], ['Groceries', 400], ['Dining out', 150],
    ['Transport', 200], ['Insurance', 120], ['Subscriptions', 50], ['Health', 80],
    ['Entertainment', 100], ['Shopping', 150], ['Debt payments', 200],
  ].map(([name, budget]) => ({ id: uid('c_'), name, budget, kind: 'expense' }))
    .concat([{ id: uid('c_'), name: 'Savings', budget: 300, kind: 'savings' }]),
  transactions: [],
});

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidState(s)) return s;
  } catch (e) { console.warn('Could not read saved data', e); }
  return defaultState();
}
const isValidState = s => !!s && Array.isArray(s.income) && Array.isArray(s.categories) && Array.isArray(s.transactions);

let state = loadState();
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { toast('Could not save - browser storage may be full or disabled.'); }
}

const ui = { month: thisMonth(), year: new Date().getFullYear(), txMonth: thisMonth(), search: '', editingId: null };

/* ---------- formatting ---------- */
const money = (n, digits = 2) => new Intl.NumberFormat(undefined, { style: 'currency', currency: state.currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const money0 = n => money(n, 0);
const compact = n => new Intl.NumberFormat(undefined, { style: 'currency', currency: state.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
const pct = n => `${Math.round(n * 100)}%`;
const monthLabel = key => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };
const shortMonth = m => new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

/* ---------- calculations ---------- */
const isIncome = t => state.income.some(i => i.id === t.catId);
const categoryOf = t => state.categories.find(c => c.id === t.catId);
// 'income' | 'expense' | 'savings' | 'unknown' (category was deleted)
const typeOf = t => isIncome(t) ? 'income' : (categoryOf(t)?.kind ?? 'unknown');
const catName = t => state.income.find(i => i.id === t.catId)?.name ?? categoryOf(t)?.name ?? 'Uncategorized';

function totals(txs) {
  const r = { income: 0, expense: 0, savings: 0, unknown: 0 };
  txs.forEach(t => { r[typeOf(t)] += t.amount; });
  const spent = r.expense + r.unknown; // uncategorized counts as spending so nothing silently disappears
  return { income: r.income, spent, saved: r.savings, left: r.income - spent - r.savings, rate: r.income > 0 ? r.savings / r.income : 0 };
}

function statusOf(row) {
  if (row.kind === 'savings') return row.spent >= row.budget && row.budget > 0 ? ['ok', 'Goal met'] : ['neutral', 'In progress'];
  const used = row.budget > 0 ? row.spent / row.budget : (row.spent > 0 ? Infinity : 0);
  if (used > 1) return ['over', 'Over budget'];
  if (used >= 0.85) return ['near', 'Near limit'];
  return ['ok', 'On track'];
}

/* ---------- navigation ---------- */
function showView(name) {
  if (!VIEWS.includes(name)) name = 'dashboard';
  VIEWS.forEach(v => { $('#view-' + v).hidden = v !== name; });
  $$('nav button').forEach(b => b.setAttribute('aria-current', b.dataset.view === name ? 'page' : 'false'));
  if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  ({ dashboard: renderDashboard, transactions: renderTransactions, year: renderYear, setup: renderSetup })[name]();
}
const currentView = () => VIEWS.find(v => !$('#view-' + v).hidden) ?? 'dashboard';
const rerender = () => showView(currentView());

/* ---------- dashboard ---------- */
function renderDashboard() {
  $('#dash-month').value = ui.month;
  const txs = state.transactions.filter(t => monthKey(t.date) === ui.month);
  const t = totals(txs);
  const kpi = (label, value, cls = '') => `<div class="kpi"><div class="label">${label}</div><div class="value ${cls}">${value}</div></div>`;
  $('#kpis').innerHTML =
    kpi('Income', money0(t.income)) + kpi('Spent', money0(t.spent)) + kpi('Saved', money0(t.saved)) +
    kpi('Left over', money0(t.left), t.left < 0 ? 'neg' : 'pos') + kpi('Savings rate', pct(t.rate));

  const rows = state.categories.map(c => ({ name: c.name, kind: c.kind, budget: c.budget, spent: sum(txs.filter(x => x.catId === c.id), x => x.amount) }));
  const orphan = sum(txs.filter(x => typeOf(x) === 'unknown'), x => x.amount);
  if (orphan > 0) rows.push({ name: 'Uncategorized', kind: 'expense', budget: 0, spent: orphan });

  const body = rows.map(r => {
    const [cls, label] = statusOf(r);
    const used = r.budget > 0 ? r.spent / r.budget : (r.spent > 0 ? 1 : 0);
    return `<tr>
      <td>${esc(r.name)}${r.kind === 'savings' ? ' <span class="muted small">(savings)</span>' : ''}</td>
      <td><div class="bar ${cls}"><span style="width:${Math.min(100, used * 100)}%"></span></div></td>
      <td class="num">${money0(r.spent)}</td><td class="num">${money0(r.budget)}</td>
      <td class="num ${r.budget - r.spent < 0 && r.kind !== 'savings' ? 'neg' : ''}">${money0(r.budget - r.spent)}</td>
      <td><span class="badge ${cls}">${label}</span></td></tr>`;
  }).join('');
  const tb = sum(rows, r => r.budget), ts = sum(rows, r => r.spent);
  $('#cat-table').innerHTML = `<thead><tr><th>Category</th><th>Progress</th><th class="num">Actual</th><th class="num">Budget</th><th class="num">Remaining</th><th>Status</th></tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td>Total</td><td></td><td class="num">${money0(ts)}</td><td class="num">${money0(tb)}</td><td class="num">${money0(tb - ts)}</td><td></td></tr></tfoot>`;
  $('#dash-empty').hidden = txs.length > 0;
}

/* ---------- transactions ---------- */
function categoryOptions(selected) {
  const opt = (id, name) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(name)}</option>`;
  return `<optgroup label="Income">${state.income.map(i => opt(i.id, i.name)).join('')}</optgroup>
          <optgroup label="Spending &amp; savings">${state.categories.map(c => opt(c.id, c.name)).join('')}</optgroup>`;
}

function renderTransactions() {
  // keep the user's in-progress selections when re-rendering
  const keepCat = $('#tx-cat').value;
  $('#tx-cat').innerHTML = categoryOptions(keepCat);
  if (!$('#tx-date').value) $('#tx-date').value = todayStr();

  // month filter: every month with data, plus the current one
  const months = [...new Set(state.transactions.map(t => monthKey(t.date)).concat(thisMonth()))].sort().reverse();
  if (ui.txMonth && !months.includes(ui.txMonth)) months.push(ui.txMonth);
  $('#tx-filter-month').innerHTML = `<option value="">All time</option>` + months.map(m => `<option value="${m}" ${m === ui.txMonth ? 'selected' : ''}>${monthLabel(m)}</option>`).join('');
  $('#tx-search').value = ui.search;

  const q = ui.search.trim().toLowerCase();
  const list = state.transactions
    .filter(t => !ui.txMonth || monthKey(t.date) === ui.txMonth)
    .filter(t => !q || t.desc.toLowerCase().includes(q) || catName(t).toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const typeBadge = { income: ['ok', 'Income'], expense: ['neutral', 'Expense'], savings: ['near', 'Savings'], unknown: ['over', 'Check category'] };
  $('#tx-table').innerHTML = list.length ? `<thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th class="num">Amount</th><th></th></tr></thead><tbody>${
    list.map(t => { const [cls, label] = typeBadge[typeOf(t)]; return `<tr>
      <td>${esc(t.date)}</td><td>${esc(t.desc)}</td><td>${esc(catName(t))}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td class="num ${typeOf(t) === 'income' ? 'pos' : ''}">${typeOf(t) === 'income' ? '+' : ''}${money(t.amount)}</td>
      <td><button class="icon" data-act="edit" data-id="${t.id}">Edit</button> <button class="icon danger" data-act="del" data-id="${t.id}">Delete</button></td></tr>`; }).join('')
  }</tbody>` : '';
  $('#tx-empty').hidden = list.length > 0;
}

function resetTxForm() {
  ui.editingId = null;
  $('#tx-desc').value = ''; $('#tx-amount').value = '';
  $('#tx-form-title').textContent = 'Add a transaction';
  $('#tx-submit').textContent = 'Add'; $('#tx-cancel').hidden = true;
}

function onTxSubmit(e) {
  e.preventDefault();
  const amount = parseFloat($('#tx-amount').value);
  const rec = { date: $('#tx-date').value, desc: $('#tx-desc').value.trim() || '(no description)', catId: $('#tx-cat').value, amount: Math.round(amount * 100) / 100 };
  if (!rec.date || !rec.catId || !(amount > 0)) return toast('Enter a date, category, and an amount above zero.');
  if (ui.editingId) {
    Object.assign(state.transactions.find(t => t.id === ui.editingId), rec);
    toast('Transaction updated');
  } else {
    state.transactions.push({ id: uid('t_'), ...rec });
    toast('Transaction added');
  }
  save(); resetTxForm(); renderTransactions();
}

function onTxTableClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const tx = state.transactions.find(t => t.id === btn.dataset.id);
  if (!tx) return;
  if (btn.dataset.act === 'del') {
    if (!confirm(`Delete "${tx.desc}" (${money(tx.amount)})?`)) return;
    state.transactions = state.transactions.filter(t => t.id !== tx.id);
    save(); renderTransactions(); toast('Deleted');
  } else {
    ui.editingId = tx.id;
    $('#tx-date').value = tx.date; $('#tx-desc').value = tx.desc; $('#tx-amount').value = tx.amount;
    $('#tx-cat').innerHTML = categoryOptions(tx.catId);
    $('#tx-form-title').textContent = 'Edit transaction';
    $('#tx-submit').textContent = 'Save'; $('#tx-cancel').hidden = false;
    $('#tx-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ---------- year view ---------- */
function renderYear() {
  $('#year-input').value = ui.year;
  const data = Array.from({ length: 12 }, (_, i) => {
    const key = monthKeyOf(ui.year, i + 1);
    return { label: shortMonth(i + 1), ...totals(state.transactions.filter(t => monthKey(t.date) === key)) };
  });
  const tot = totals(state.transactions.filter(t => t.date.startsWith(ui.year + '-')));
  $('#year-chart').innerHTML = yearChartSvg(data);
  $('#year-table').innerHTML = `<thead><tr><th>Month</th><th class="num">Income</th><th class="num">Spent</th><th class="num">Saved</th><th class="num">Left over</th><th class="num">Savings rate</th></tr></thead><tbody>${
    data.map(d => `<tr><td>${d.label}</td><td class="num">${money0(d.income)}</td><td class="num">${money0(d.spent)}</td><td class="num">${money0(d.saved)}</td><td class="num ${d.left < 0 ? 'neg' : ''}">${money0(d.left)}</td><td class="num">${pct(d.rate)}</td></tr>`).join('')
  }</tbody><tfoot><tr><td>Total</td><td class="num">${money0(tot.income)}</td><td class="num">${money0(tot.spent)}</td><td class="num">${money0(tot.saved)}</td><td class="num ${tot.left < 0 ? 'neg' : ''}">${money0(tot.left)}</td><td class="num">${pct(tot.rate)}</td></tr></tfoot>`;
}

// Grouped bar chart as inline SVG (crisp at any size, themed via CSS classes)
function yearChartSvg(data) {
  const W = 720, H = 260, m = { l: 56, r: 10, t: 10, b: 26 };
  const max = Math.max(1, ...data.flatMap(d => [d.income, d.spent]));
  const p = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / p) * p; // "nice" axis maximum
  const iw = W - m.l - m.r, ih = H - m.t - m.b, slot = iw / 12, bw = Math.min(16, slot / 2 - 3);
  const y = v => m.t + ih - (v / top) * ih;
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${compact(v)}</text>`;
  }
  data.forEach((d, i) => {
    const cx = m.l + slot * i + slot / 2;
    g += `<rect class="bar-income" x="${cx - bw - 1}" y="${y(d.income)}" width="${bw}" height="${Math.max(0, m.t + ih - y(d.income))}" rx="2"><title>${d.label} income: ${money0(d.income)}</title></rect>`;
    g += `<rect class="bar-spent" x="${cx + 1}" y="${y(d.spent)}" width="${bw}" height="${Math.max(0, m.t + ih - y(d.spent))}" rx="2"><title>${d.label} spent: ${money0(d.spent)}</title></rect>`;
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Income versus spending by month">${g}</svg>`;
}

/* ---------- setup ---------- */
function renderSetup() {
  $('#currency').innerHTML = CURRENCIES.map(c => `<option ${c === state.currency ? 'selected' : ''}>${c}</option>`).join('');
  const inp = (kind, id, field, val, type = 'text') => `<input type="${type}" data-kind="${kind}" data-id="${id}" data-field="${field}" value="${esc(val)}" ${type === 'number' ? 'min="0" step="1" inputmode="decimal"' : 'maxlength="40"'}>`;
  const del = (kind, id) => `<button class="icon danger" data-act="remove-${kind}" data-id="${id}" aria-label="Remove">✕</button>`;
  $('#income-table').innerHTML = `<thead><tr><th>Source</th><th class="num">Expected / month</th><th></th></tr></thead><tbody>${
    state.income.map(i => `<tr><td>${inp('income', i.id, 'name', i.name)}</td><td>${inp('income', i.id, 'expected', i.expected, 'number')}</td><td>${del('income', i.id)}</td></tr>`).join('')}</tbody>`;
  $('#cat-setup-table').innerHTML = `<thead><tr><th>Category</th><th class="num">Monthly budget</th><th>Kind</th><th></th></tr></thead><tbody>${
    state.categories.map(c => `<tr><td>${inp('cat', c.id, 'name', c.name)}</td><td>${inp('cat', c.id, 'budget', c.budget, 'number')}</td>
      <td><select data-kind="cat" data-id="${c.id}" data-field="kind"><option value="expense" ${c.kind === 'expense' ? 'selected' : ''}>Expense</option><option value="savings" ${c.kind === 'savings' ? 'selected' : ''}>Savings</option></select></td>
      <td>${del('cat', c.id)}</td></tr>`).join('')}</tbody>`;
}

function onSetupChange(e) {
  const el = e.target.closest('[data-kind]');
  if (!el) return;
  const list = el.dataset.kind === 'income' ? state.income : state.categories;
  const item = list.find(x => x.id === el.dataset.id);
  if (!item) return;
  const f = el.dataset.field;
  item[f] = (f === 'expected' || f === 'budget') ? num(el.value) : (f === 'name' ? (el.value.trim() || item[f]) : el.value);
  save();
  if (f === 'name') el.value = item.name; // restore if the user blanked it
}

function onSetupClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const [, kind] = btn.dataset.act.split('-');
  const used = state.transactions.filter(t => t.catId === btn.dataset.id).length;
  if (used && !confirm(`${used} transaction(s) use this. They'll show as "Uncategorized" if you remove it. Continue?`)) return;
  if (kind === 'income') state.income = state.income.filter(i => i.id !== btn.dataset.id);
  else state.categories = state.categories.filter(c => c.id !== btn.dataset.id);
  save(); renderSetup();
}

/* ---------- import / export ---------- */
function download(filename, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = v => `"${String(v).replace(/"/g, '""')}"`;

function exportCsv() {
  const rows = [['Date', 'Description', 'Category', 'Type', 'Amount']].concat(
    [...state.transactions].sort((a, b) => a.date.localeCompare(b.date)).map(t => [t.date, t.desc, catName(t), typeOf(t), t.amount.toFixed(2)]));
  download(`transactions-${todayStr()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!isValidState(s)) throw new Error('bad shape');
      if (!confirm('Replace ALL current data with this backup?')) return;
      state = { currency: 'USD', ...s };
      save(); rerender(); toast('Backup imported');
    } catch (err) { toast("That file isn't a valid backup."); }
  };
  reader.readAsText(file);
}

// Demo data: a few months of realistic sample transactions relative to today
function demoData() {
  const cat = name => state.categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.id ?? state.categories[0]?.id;
  const inc = i => state.income[i]?.id ?? state.income[0]?.id;
  const out = [];
  const now = new Date();
  for (let back = 0; back < 3; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = monthKeyOf(d.getFullYear(), d.getMonth() + 1);
    const lastDay = back === 0 ? Math.max(1, now.getDate()) : 28;
    const day = n => `${key}-${pad2(Math.min(n, lastDay))}`;
    [
      [1, 'Paycheck', inc(0), 3500], [1, 'Rent', cat('Rent / Mortgage'), 1200], [3, 'Electric & water', cat('Utilities'), 142.3],
      [4, 'Grocery run', cat('Groceries'), 96.4], [9, 'Grocery run', cat('Groceries'), 88.15], [16, 'Grocery run', cat('Groceries'), 112.7],
      [6, 'Gas', cat('Transport'), 48.2], [7, 'Pizza night', cat('Dining out'), 42.5], [12, 'Streaming', cat('Subscriptions'), 15.99],
      [14, 'Pharmacy', cat('Health'), 23.4], [15, 'Freelance gig', inc(1), 300], [18, 'Movie tickets', cat('Entertainment'), 36],
      [20, 'Savings transfer', cat('Savings'), 300], [22, 'New sneakers', cat('Shopping'), 89.99],
    ].forEach(([n, desc, catId, amount]) => { if (n <= lastDay) out.push({ id: uid('t_'), date: day(n), desc, catId, amount }); });
  }
  return out;
}

/* ---------- wire up ---------- */
function init() {
  $$('nav button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));

  $('#dash-month').addEventListener('change', e => { ui.month = e.target.value || thisMonth(); renderDashboard(); });
  $('#year-input').addEventListener('change', e => { ui.year = parseInt(e.target.value, 10) || ui.year; renderYear(); });

  $('#tx-form').addEventListener('submit', onTxSubmit);
  $('#tx-cancel').addEventListener('click', () => { resetTxForm(); renderTransactions(); });
  $('#tx-table').addEventListener('click', onTxTableClick);
  $('#tx-filter-month').addEventListener('change', e => { ui.txMonth = e.target.value; renderTransactions(); });
  $('#tx-search').addEventListener('input', e => { ui.search = e.target.value; renderTransactions(); $('#tx-search').focus(); });

  const setup = $('#view-setup');
  setup.addEventListener('change', onSetupChange);
  setup.addEventListener('click', onSetupClick);
  $('#add-income').addEventListener('click', () => { state.income.push({ id: uid('i_'), name: 'New income', expected: 0 }); save(); renderSetup(); });
  $('#add-cat').addEventListener('click', () => { state.categories.push({ id: uid('c_'), name: 'New category', budget: 0, kind: 'expense' }); save(); renderSetup(); });
  $('#currency').addEventListener('change', e => { state.currency = e.target.value; save(); toast('Currency updated'); });

  $('#export-json').addEventListener('click', () => download(`budget-backup-${todayStr()}.json`, JSON.stringify(state, null, 2), 'application/json'));
  $('#export-csv').addEventListener('click', exportCsv);
  $('#import-json').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
  $('#load-demo').addEventListener('click', () => {
    if (state.transactions.length && !confirm('Add demo transactions to your existing data?')) return;
    state.transactions.push(...demoData()); save(); toast('Demo data loaded - see the Dashboard');
  });
  $('#reset').addEventListener('click', () => {
    if (!confirm('Erase ALL budgets and transactions from this browser? This cannot be undone.')) return;
    state = defaultState(); save(); rerender(); toast('Everything erased');
  });

  showView(location.hash.slice(1) || 'dashboard');
}
init();
