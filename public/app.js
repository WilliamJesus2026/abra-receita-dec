// Receita DEC (INF DEC e ADT DEC): classe > linha > produtos mais vendidos, com foto, vendas, markup, fornecedor e posição.
// Dados: dados.js (gerar.py). Cálculo: logica.js. Mk = (Receita - CMV) / CMV.
(function () {
  'use strict';
  if (window.__RDEC_APP) return;   // segunda carga do script duplicaria os ouvintes de clique e quebraria a navegação
  window.__RDEC_APP = true;
  const D = window.DEC, L = window.Logica.criar(D);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brl = v => v == null ? '–' : 'R$ ' + nf0.format(v);
  const brlc = v => { if (v == null) return '–'; const a = Math.abs(v); return a >= 1e6 ? 'R$ ' + nf2.format(v / 1e6) + ' mi' : a >= 1e4 ? 'R$ ' + nf0.format(v / 1e3) + ' mil' : brl(v); };
  const pct = v => v == null || !isFinite(v) ? '–' : (v * 100).toFixed(1).replace('.', ',') + '%';
  const varf = v => v == null ? '' : (v > 0 ? '+' : '') + pct(v);
  const mkf = v => v == null ? '–' : nf2.format(v * 100) + '%';   // igual à coluna Mk da dinâmica (ex.: 137,89%)
  // item sem markup (ex.: sem venda no ano anterior): mostra o da classe, marcado como "(classe)"
  const mkFmt = (v, fb) => v != null ? mkf(v) : (fb != null ? `<span class="mkc" title="Este item não tem markup neste período: mostrando o markup da classe">${mkf(fb)} <em>(classe)</em></span>` : '–');
  const dpp = (b, a) => b == null || a == null ? null : (b - a) * 100;   // Mk 2025 − Mk 2026, em pontos percentuais
  const ppf = v => v == null ? '–' : (v > 0 ? '+' : '') + nf2.format(v) + ' pp';
  const cv = v => v == null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const MESES = L.MESES, tot = L.tot;
  const mesesComDado = [...new Set(D.fatos.map(x => x[1] % 100))].sort((a, b) => a - b);
  const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const FORN = 'FORN', ALL = 'ALL';   // ALL = "completão": INF DEC + ADT DEC juntos
  const LOGO = { 'INF DEC': 'logo_abracadabra.png', 'ADT DEC': 'logo_abracasa.png', ALL: 'logo-abra.svg', FORN: 'logo-abra.svg' };
  const NOME = { 'INF DEC': 'INF DEC', 'ADT DEC': 'ADT DEC', ALL: 'Completo', FORN: 'Fornecedores' };
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const curto = c => c.replace(/^(INF|ADT) DEC /, '');
  const LIM_LINHAS = 10, TOP = 5;

  const S = { uni: D.grupos.includes('INF DEC') ? 'INF DEC' : D.grupos[0], cls: null, mes: 0, q: '', abertas: new Set(), todasLinhas: false, forn: '', cf: '', fg: '', lin: '', pos: '', mk: '', ord: 'rec' };
  try { let t = localStorage.getItem('rdec-tema'); if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'; if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  // ---------- dados do universo no período escolhido ----------
  const modoF = () => S.uni === FORN;
  const chaveG = it => modoF() ? it.fornecedor : it.classe;           // o que a lista da esquerda agrupa
  const nomeCls = k => S.uni === ALL ? curto(k) + ' · ' + (k.startsWith('INF') ? 'INF' : 'ADT') : curto(k);   // no completão a classe leva o grupo (há nomes iguais nos dois)
  const nomeG = k => modoF() ? k : nomeCls(k);
  const totNome = () => modoF() ? (S.fg ? NOME[S.fg] : 'INF + ADT') : S.uni === ALL ? 'INF + ADT' : NOME[S.uni];
  function itens(uni, mes) {
    const f = { modo: 'ano', grupos: new Set(uni === ALL ? ['INF DEC', 'ADT DEC'].filter(g => D.grupos.includes(g)) : uni === FORN ? (S.fg ? [S.fg] : ['INF DEC', 'ADT DEC'].filter(g => D.grupos.includes(g))) : [uni]), meses: mes ? new Set([mes]) : null };
    return [...L.consulta(f, it => it.i)].map(([i, acc]) => ({ it: L.itens[i], acc, a: tot(acc, 2026), b: tot(acc, 2025) })).filter(r => r.a.rec > 0 || r.b.rec > 0);
  }
  const somar = rows => { const acc = L.somarAcc(rows.map(r => r.acc)); return { a: tot(acc, 2026), b: tot(acc, 2025) }; };
  function agrupar(rows, chave) {
    const m = new Map();
    for (const r of rows) { const k = chave(r.it); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m].map(([k, rs]) => Object.assign({ k, rows: rs.filter(r => r.a.rec > 0).sort((x, y) => y.a.rec - x.a.rec) }, somar(rs))).filter(g => g.rows.length).sort((x, y) => y.a.rec - x.a.rec);
  }

  // ---------- filtros ----------
  const POS = { '': 'Posição: todas', venda: 'À venda (imediata, encomenda, prazo, loja)', imediata: 'Entrega imediata', encomenda: 'Encomenda / prazo', loja: 'Estoque loja', suspensa: 'Venda suspensa', fl: 'Fora de linha' };
  const MK = { '': 'Markup: todos', neg: 'Negativo (abaixo do custo)', baixo: 'Abaixo de 100%', medio: 'De 100% a 200%', alto: 'Acima de 200%' };
  const ORD = { rec: 'Mais vendidos', mk: 'Maior markup', mkmenor: 'Menor markup', cresc: 'Mais cresceram (R$)', queda: 'Mais caíram (R$)' };
  const passaPos = (it, p) => p === 'venda' ? (['Imediata', 'Encomenda', 'Prazo', 'Estoque loja'].includes(it.posTipo) && !it.fl) : p === 'imediata' ? it.posTipo === 'Imediata' : p === 'encomenda' ? (it.posTipo === 'Encomenda' || it.posTipo === 'Prazo') : p === 'loja' ? it.posTipo === 'Estoque loja' : p === 'suspensa' ? it.posTipo === 'Suspensa/Bloqueada' : p === 'fl' ? it.fl : true;
  const passaMk = (mk, k) => !k || (mk != null && (k === 'neg' ? mk < 0 : k === 'baixo' ? mk >= 0 && mk < 1 : k === 'medio' ? mk >= 1 && mk <= 2 : mk > 2));
  const passaX = (r, sem) => (modoF() || sem === 'forn' || !S.forn || r.it.fornecedor === S.forn) && (!modoF() || sem === 'cf' || !S.cf || r.it.classe === S.cf) && (sem === 'lin' || !S.lin || r.it.linha === S.lin) && passaPos(r.it, S.pos) && passaMk(r.a.mk, S.mk);
  const passa = r => passaX(r);
  const nAtivos = () => [modoF() ? S.cf : S.forn, S.lin, S.pos, S.mk].filter(Boolean).length + (S.ord !== 'rec' ? 1 : 0);
  const chaveOrd = r => S.ord === 'mk' ? (r.a.mk == null ? -1e9 : r.a.mk) : S.ord === 'mkmenor' ? (r.a.mk == null ? -1e9 : -r.a.mk) : S.ord === 'cresc' ? r.a.rec - r.b.rec : S.ord === 'queda' ? r.b.rec - r.a.rec : r.a.rec;
  const ordenar = rows => rows.slice().sort((x, y) => chaveOrd(y) - chaveOrd(x));
  function filtrosHtml(todos, rowsClasse) {
    const fm = new Map(); rowsClasse.filter(r => r.a.rec > 0 && passaX(r, 'forn')).forEach(r => fm.set(r.it.fornecedor, (fm.get(r.it.fornecedor) || 0) + r.a.rec));
    const forns = [...fm].sort((x, y) => y[1] - x[1]);
    const lm = new Map(); rowsClasse.filter(r => r.a.rec > 0 && passaX(r, 'lin')).forEach(r => lm.set(r.it.linha, (lm.get(r.it.linha) || 0) + r.a.rec));
    const lins = [...lm].sort((x, y) => y[1] - x[1]);
    const sel = (id, atual, ops, vazio) => `<select data-f="${id}" class="${atual ? 'ativo' : ''}" aria-label="${esc(vazio)}"><option value="">${esc(vazio)}</option>${ops.map(([v, n]) => `<option value="${esc(v)}" ${v === atual ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
    const cm = new Map(); rowsClasse.filter(r => r.a.rec > 0 && passaX(r, 'cf')).forEach(r => cm.set(r.it.classe, (cm.get(r.it.classe) || 0) + r.a.rec));
    const clss = [...cm].sort((x, y) => y[1] - x[1]);
    const primeiro = modoF() ? sel('cf', S.cf, clss.map(([n, v]) => [n, curto(n) + ' · ' + brlc(v)]), 'Classe: todas') : sel('forn', S.forn, forns.map(([n, v]) => [n, n + ' · ' + brlc(v)]), 'Fornecedor: todos');
    return `<div class="filtros">${primeiro}${sel('lin', S.lin, lins.map(([n, v]) => [n, n + ' · ' + brlc(v)]), 'Linha: todas')}${sel('pos', S.pos, Object.entries(POS).filter(x => x[0]).map(x => x), 'Posição: todas')}${sel('mk', S.mk, Object.entries(MK).filter(x => x[0]), 'Markup: todos')}
      <select data-f="ord" class="${S.ord !== 'rec' ? 'ativo' : ''}" aria-label="Ordenar">${Object.entries(ORD).map(([v, n]) => `<option value="${v}" ${S.ord === v ? 'selected' : ''}>Ordenar: ${esc(n)}</option>`).join('')}</select>
      ${nAtivos() ? `<button class="btn" data-limpar>Limpar filtros (${nAtivos()})</button>` : ''}</div>`;
  }

  // ---------- peças de tela ----------
  function posicao(it) {
    const t = it.posTipo; let cls = 'gray', txt = t;
    if (t === 'Imediata') { cls = 'ok'; txt = 'Entrega imediata' + (it.disp != null ? ' · ' + nf0.format(it.disp) : ''); }
    else if (t === 'Encomenda' || t === 'Prazo') { cls = 'blue'; txt = (t === 'Encomenda' ? 'Encomenda' : 'Prazo') + (it.prazo ? ' ' + it.prazo + ' dias' : ''); }
    else if (t === 'Estoque loja') { cls = 'warn'; txt = 'Estoque loja'; }
    else if (t === 'Suspensa/Bloqueada') { cls = 'bad'; txt = 'Venda suspensa'; }
    else if (t === 'Fora do Ritmo') txt = 'Sem posição';
    return `<span class="bdg ${cls}" title="${esc(it.sit)}">${esc(txt)}</span>` + (it.fl ? ' <span class="bdg fl" title="Fora de linha">Fora de linha</span>' : '');
  }
  const foto = (it, cls) => `<img class="${cls || ''} ${it.foto ? '' : 'semfoto'}" src="${esc(it.foto || 'logo-abra.svg')}" loading="lazy" referrerpolicy="no-referrer" alt="">`;
  document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && !t.classList.contains('semfoto')) { t.classList.add('semfoto'); t.src = 'logo-abra.svg'; } }, true);
  const periodo = () => S.mes ? MESES_LONGO[S.mes - 1] + '/2026' : '2026';

  function card(r, n, nav, baseLinha) {
    const it = r.it;
    return `<div class="card" data-i="${it.i}" data-nav="${nav}"><div class="ft">${foto(it)}${n ? `<span class="rk">${n}</span>` : ''}</div>
      <div class="tx"><div class="nm" title="${esc(it.nome)}">${esc(it.nome)}</div><div class="fo">${esc(it.fornecedor)}</div><div class="pb">${posicao(it)}</div>${baseLinha ? `<div class="peso2">${pesoBarra(r.a.rec / baseLinha)}<small><b>${pct(r.a.rec / baseLinha)}</b> da linha</small></div>` : ''}
      <div class="vl"><div><small>Vende ${esc(S.mes ? MESES[S.mes - 1] : 'no ano')}</small><b class="num">${brl(r.a.rec)}</b><small class="${cv(L.vari(r.a.rec, r.b.rec))}" style="text-transform:none">${r.b.rec > 0 ? varf(L.vari(r.a.rec, r.b.rec)) + ' vs 2025' : 'sem venda em 2025'}</small></div><div style="text-align:right"><small>Markup</small><b class="num">${mkFmt(r.a.mk, (CLSMK.get(it.classe) || {a: {}}).a.mk)}</b><small style="text-transform:none" title="Markup 2025 − Markup 2026: ${esc(ppf(dpp(r.b.mk != null ? r.b.mk : (CLSMK.get(it.classe) || {b: {}}).b.mk, r.a.mk != null ? r.a.mk : (CLSMK.get(it.classe) || {a: {}}).a.mk)))}">2025: ${mkFmt(r.b.mk, (CLSMK.get(it.classe) || {b: {}}).b.mk)}</small></div></div></div></div>`;
  }

  // ---------- tela ----------
  let CLSMK = new Map();   // classe -> {a: markup 2026, b: markup 2025} no período (para o item sem markup)
  let CTX = { total: 0, cls: new Map(), lin: new Map(), item: new Map() };
  const pesoBarra = f => `<span class="pbar"><i style="width:${Math.max(0, Math.min(100, (f || 0) * 100)).toFixed(1)}%"></i></span>`;
  let NAV = new Map();   // chave -> ids dos produtos, na ordem mostrada (para ‹ › no detalhe)
  function render() {
    document.body.dataset.uni = S.uni;
    const atual = S.uni;
    $('#uni').innerHTML = ['INF DEC', 'ADT DEC', ALL, FORN].filter(g => g === FORN || g === ALL || D.grupos.includes(g)).map(g => {
      S.uni = g; const rs = itens(g, S.mes).filter(passa), t = somar(rs); S.uni = atual;
      const sub = g === FORN ? agrupar(rs, it => it.fornecedor).length + ' · ' + brlc(t.a.rec) : brlc(t.a.rec) + ' · Mk ' + mkf(t.a.mk);
      return `<button data-uni="${esc(g)}" class="${S.uni === g ? 'on' : ''}"><img src="${LOGO[g]}" alt=""><span>${esc(NOME[g])}<small>${sub}</small></span></button>`;
    }).join('');
    const todos = itens(S.uni, S.mes), rows = todos.filter(passa); NAV = new Map();
    const porCls = new Map(); todos.forEach(r => { if (!porCls.has(r.it.classe)) porCls.set(r.it.classe, []); porCls.get(r.it.classe).push(r); });
    CLSMK = new Map([...porCls].map(([k, rs]) => [k, somar(rs)]));
    CTX = { total: 0, cls: new Map(), lin: new Map(), item: new Map() };
    rows.filter(r => r.a.rec > 0).forEach(r => { CTX.total += r.a.rec; CTX.cls.set(chaveG(r.it), (CTX.cls.get(chaveG(r.it)) || 0) + r.a.rec); const k = chaveG(r.it) + '|' + r.it.classe + '|' + r.it.linha; CTX.lin.set(k, (CTX.lin.get(k) || 0) + r.a.rec); CTX.item.set(r.it.i, r.a.rec); });
    const q = norm(S.q.trim());
    if (q) return renderBusca(rows.filter(r => r.a.rec > 0), q, subFornHtml() + filtrosHtml(todos, todos));
    const classes = agrupar(rows, chaveG), all = somar(rows);
    if (S.cls && !classes.find(c => c.k === S.cls)) S.cls = null;
    const doClasse = S.cls ? todos.filter(r => chaveG(r.it) === S.cls) : todos;
    const selAll = S.cls ? rows.filter(r => chaveG(r.it) === S.cls) : rows;   // inclui itens só de 2025, para o markup de 2025 ficar completo
    if (S.lin && !doClasse.some(r => r.it.linha === S.lin && r.a.rec > 0)) { S.lin = ''; return render(); }
    const sel = S.cls ? classes.find(c => c.k === S.cls) : { k: null, rows: rows.filter(r => r.a.rec > 0), a: all.a, b: all.b };
    const linhas = agrupar(selAll, it => modoF() ? curto(it.classe) + ' › ' + it.linha : (S.uni === ALL && !S.cls ? (it.grupo.startsWith('INF') ? 'INF' : 'ADT') + ' › ' + it.linha : it.linha)), vis = S.todasLinhas ? linhas : linhas.slice(0, LIM_LINHAS);
    const lista = `<aside class="classes">
      <button class="classe ${!S.cls ? 'on' : ''}" data-cls=""><b>${modoF() ? 'Todos os fornecedores' : 'Todas as classes'}</b><small>${brlc(all.a.rec)} · Mk ${mkf(all.a.mk)}</small></button>
      ${classes.map(c => `<button class="classe ${S.cls === c.k ? 'on' : ''}" data-cls="${esc(c.k)}"><b>${esc(nomeG(c.k))}</b><small>${brlc(c.a.rec)} · Mk ${mkf(c.a.mk)} · ${c.rows.length} itens</small>${pesoBarra(all.a.rec ? c.a.rec / all.a.rec : 0)}<small><b>${pct(all.a.rec ? c.a.rec / all.a.rec : null)}</b> do total ${esc(totNome())}</small></button>`).join('')}</aside>`;
    const cab = `<div class="cab"><h1>${esc(S.cls ? nomeG(S.cls) : (modoF() ? 'Todos os fornecedores' : 'Todas as classes'))} <span class="muted" style="font-size:16px;font-weight:500">· ${esc(totNome())}</span></h1>
      <div class="res"><span>Vende em ${esc(periodo())}: <b class="num">${brl(sel.a.rec)}</b> <span class="${cv(L.vari(sel.a.rec, sel.b.rec))}">${varf(L.vari(sel.a.rec, sel.b.rec))}</span> <span class="muted">${S.mes ? '' : 'vs 2025'}</span></span><span>Markup: <b class="num">${mkf(sel.a.mk)}</b> <span class="muted">(2025: ${mkf(sel.b.mk)} · 2025 − 2026: ${ppf(dpp(sel.b.mk, sel.a.mk))})</span></span>${S.cls ? `<span><b class="num">${pct(all.a.rec ? sel.a.rec / all.a.rec : null)}</b> do total de ${esc(totNome())}</span>` : ''}<span>${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'} · ${sel.rows.length} ${sel.rows.length === 1 ? 'produto' : 'produtos'}</span></div></div>`;
    const baseL = S.cls ? sel.a.rec : all.a.rec;
    const cmL = l => { const c = modoF() ? (l.rows[0] && l.rows[0].it.classe) : S.cls; return (c && CLSMK.get(c)) || { a: {}, b: {} }; };
    const secoes = vis.map(l => {
      const aberta = S.abertas.has((S.cls || '') + '|' + l.k), ord = ordenar(l.rows), mostra = aberta ? ord : ord.slice(0, TOP), key = 'l' + NAV.size;
      NAV.set(key, mostra.map(r => r.it.i));
      const fs = [...l.rows.reduce((m, r) => m.set(r.it.fornecedor, (m.get(r.it.fornecedor) || 0) + r.a.rec), new Map())].sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]).join(', ');
      return `<section class="linha"><div class="lh"><h2>${esc(l.k)}</h2><span class="meta">vende <b>${brl(l.a.rec)}</b> · markup <b>${mkFmt(l.a.mk, cmL(l).a.mk)}</b> <span title="Markup 2025 − Markup 2026">(2025: ${mkFmt(l.b.mk, cmL(l).b.mk)} · 2025 − 2026: ${ppf(dpp(l.b.mk != null ? l.b.mk : cmL(l).b.mk, l.a.mk != null ? l.a.mk : cmL(l).a.mk))})</span>${modoF() ? '' : ' · ' + esc(fs)}</span><span class="peso">${pesoBarra(baseL ? l.a.rec / baseL : 0)}<b>${pct(baseL ? l.a.rec / baseL : null)}</b> ${S.cls ? (modoF() ? 'do fornecedor' : 'da classe') : 'do total'}</span></div>
        <div class="cards">${mostra.map((r, n) => card(r, n + 1, key, l.a.rec)).join('')}</div>
        ${l.rows.length > TOP ? `<button class="btn mais" data-linha="${esc((S.cls || '') + '|' + l.k)}">${aberta ? 'Mostrar só os 5 mais vendidos' : 'Ver todos os ' + l.rows.length + ' produtos desta linha'}</button>` : ''}</section>`;
    }).join('');
    $('#view').innerHTML = `${subFornHtml()}${filtrosHtml(todos, doClasse)}<div class="grade">${lista}<div>${cab}${secoes || '<div class="vazio">Nenhum produto com venda neste período.</div>'}
      ${linhas.length > LIM_LINHAS ? `<button class="btn" data-todas="1">${S.todasLinhas ? 'Mostrar só as ' + LIM_LINHAS + ' maiores linhas' : 'Ver as outras ' + (linhas.length - LIM_LINHAS) + ' linhas'}</button>` : ''}
      <div class="nota">Ordenado por: ${esc(ORD[S.ord].toLowerCase())} (${esc(periodo())}). Markup = (receita − custo) ÷ custo. Dados até ${m.dadosAte.split('-').reverse().join('/')}${S.mes === 11 || !S.mes ? ' (novembro até o dia ' + m.diaCorte + ', nos dois anos)' : ''}.</div></div></div>`;
  }
  // dentro de Fornecedores: ver os fornecedores do INF DEC, do ADT DEC ou dos dois
  function subFornHtml() {
    if (!modoF()) return '';
    const opc = [['', 'INF + ADT', 'logo-abra.svg'], ['INF DEC', 'INF DEC', LOGO['INF DEC']], ['ADT DEC', 'ADT DEC', LOGO['ADT DEC']]], antes = S.fg;
    const bt = opc.map(([v, n, lg]) => {
      S.fg = v; const rs = itens(FORN, S.mes).filter(passa), t = somar(rs); S.fg = antes;
      return `<button data-fg="${esc(v)}" class="${antes === v ? 'on' : ''}"><img src="${lg}" alt=""><span>${esc(n)}<small>${agrupar(rs, it => it.fornecedor).length} fornecedores · ${brlc(t.a.rec)}</small></span></button>`;
    }).join('');
    return `<div class="subuni">${bt}</div>`;
  }
  function renderBusca(rows, q, filtros) {
    const res = ordenar(rows.filter(r => norm(r.it.nome).includes(q) || r.it.cod.includes(q) || norm(r.it.fornecedor).includes(q) || norm(r.it.linha).includes(q)));
    NAV.set('busca', res.slice(0, 60).map(r => r.it.i));
    $('#view').innerHTML = `${filtros || ''}<div class="cab"><h1>Busca: “${esc(S.q)}”</h1><div class="res"><span>${res.length} produtos em ${esc(totNome())} · ${esc(periodo())}</span></div></div>
      ${res.length ? `<div class="cards">${res.slice(0, 60).map((r, n) => card(r, 0, 'busca')).join('')}</div>` : '<div class="vazio">Nenhum produto encontrado.</div>'}`;
  }
  const m = D.meta;

  // ---------- detalhe do produto ----------
  let CUR = null, CURNAV = [];
  function meses(acc) {
    const ms = mesesComDado, W = 620, H = 170, pad = 26, bw = (W - pad) / ms.length, mx = Math.max(1, ...ms.flatMap(x => [acc.R[2026][x], acc.R[2025][x]]));
    const bar = (v, x, w, cor, tit) => { const h = Math.max(0, v) / mx * (H - 34); return `<rect x="${x.toFixed(1)}" y="${(H - 20 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${cor}"><title>${esc(tit)}</title></rect>`; };
    return `<svg class="meses" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas mês a mês">${ms.map((x, n) => { const x0 = pad / 2 + n * bw;
      return bar(acc.R[2025][x], x0 + bw * .1, bw * .38, 'var(--c25)', MESES[x - 1] + '/2025: ' + brl(acc.R[2025][x])) + bar(acc.R[2026][x], x0 + bw * .5, bw * .38, 'var(--accent)', MESES[x - 1] + '/2026: ' + brl(acc.R[2026][x]))
        + `<text x="${(x0 + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${MESES[x - 1]}</text>`; }).join('')}</svg>`;
  }
  function abrir(i, navKey) {
    const it = L.itens[i]; CUR = i; if (navKey) CURNAV = NAV.get(navKey) || [];
    const acc = L.consulta({ modo: 'ano' }, x => x.i === i ? 'k' : null).get('k') || L.novoAcc(), A = tot(acc, 2026), B = tot(acc, 2025), p = CURNAV.indexOf(i);
    const cmA = somar([...L.consulta({ modo: 'ano', classes: new Set([it.classe]) }, x => x.i)].map(([k, ac]) => ({ acc: ac })));   // markup anual da classe do item
    $('#modal').innerHTML = `<button class="x" data-fechar aria-label="Fechar">×</button>
      ${p >= 0 ? `<div class="nav"><button class="btn" data-nav="-1" ${p === 0 ? 'disabled' : ''}>‹ anterior</button><span class="muted">${p + 1} de ${CURNAV.length}</span><button class="btn" data-nav="1" ${p === CURNAV.length - 1 ? 'disabled' : ''}>próximo ›</button></div>` : ''}
      <div class="topo">${foto(it, 'big')}<div><h2>${esc(it.nome)}</h2><div class="muted" style="margin:4px 0 8px">${esc(it.cod)} · ${esc(curto(it.classe))} › ${esc(it.linha)}</div>
        <div><b>Fornecedor:</b> ${esc(it.fornecedor)}</div><div style="margin:8px 0">${posicao(it)}</div>
        <div class="muted" style="font-size:13px">${it.disp != null ? 'Disponível: <b>' + nf0.format(it.disp) + '</b> · ' : ''}${it.preco != null ? 'Preço: <b>R$ ' + nf2.format(it.preco) + '</b>' : ''}${it.custo != null ? ' · Custo: R$ ' + nf2.format(it.custo) : ''}</div>
        ${it.link ? `<div style="margin-top:6px"><a href="https://${esc(String(it.link).replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">ver no site ↗</a></div>` : ''}</div></div>
      <div class="num4"><div><small>Vende em 2026</small><b class="num">${brl(A.rec)}</b><br><span class="${cv(L.vari(A.rec, B.rec))}">${varf(L.vari(A.rec, B.rec))} vs 2025</span></div><div><small>Vendeu em 2025</small><b class="num">${brl(B.rec)}</b></div>
        <div><small>Markup 2026</small><b class="num">${mkFmt(A.mk, cmA.a.mk)}</b></div><div><small>Markup 2025</small><b class="num">${mkFmt(B.mk, cmA.b.mk)}</b></div><div><small>Mk 2025 − Mk 2026</small><b class="num">${ppf(dpp(B.mk != null ? B.mk : cmA.b.mk, A.mk != null ? A.mk : cmA.a.mk))}</b>${A.mk == null || B.mk == null ? '<br><span class="muted">usa o markup da classe onde o item não tem</span>' : ''}</div></div>
      ${CTX.item.has(i) ? `<div class="num4"><div><small>Na linha ${esc(it.linha)}</small><b class="num">${pct(CTX.lin.get(chaveG(it) + '|' + it.classe + '|' + it.linha) ? CTX.item.get(i) / CTX.lin.get(chaveG(it) + '|' + it.classe + '|' + it.linha) : null)}</b><br><span class="muted">das vendas da linha ${modoF() ? 'deste fornecedor' : 'na classe'}</span></div><div><small>${modoF() ? 'No fornecedor ' + esc(it.fornecedor) : 'Na classe ' + esc(nomeCls(it.classe))}</small><b class="num">${pct(CTX.cls.get(chaveG(it)) ? CTX.item.get(i) / CTX.cls.get(chaveG(it)) : null)}</b><br><span class="muted">das vendas ${modoF() ? 'do fornecedor' : 'da classe'}</span></div><div><small>No total ${esc(totNome())}</small><b class="num">${pct(CTX.total ? CTX.item.get(i) / CTX.total : null)}</b><br><span class="muted">das vendas de ${esc(periodo())}</span></div></div>` : ''}
      <div class="leg"><span><i style="background:var(--c25)"></i>2025</span><span><i style="background:var(--accent)"></i>2026</span><span>vendas mês a mês</span></div>${meses(acc)}`;
    $('#modal').classList.add('on'); $('#veil').classList.add('on');
  }
  const fechar = () => { $('#modal').classList.remove('on'); $('#veil').classList.remove('on'); };
  const vai = d => { const p = CURNAV.indexOf(CUR) + d; if (p >= 0 && p < CURNAV.length) abrir(CURNAV[p]); };

  // ---------- eventos ----------
  document.addEventListener('click', e => {
    const t = e.target;
    const c = t.closest('[data-i]'); if (c) return abrir(+c.dataset.i, c.dataset.nav);
    if (t.closest('[data-fechar]') || t.id === 'veil') return fechar();
    const n = t.closest('[data-nav]'); if (n && n.tagName === 'BUTTON') return vai(+n.dataset.nav);
    const fg = t.closest('[data-fg]'); if (fg) { S.fg = fg.dataset.fg; S.cls = null; S.cf = ''; S.lin = ''; S.abertas = new Set(); return render(); }
    const u = t.closest('#uni [data-uni]'); if (u) { S.uni = u.dataset.uni; S.cls = null; S.cf = ''; S.lin = ''; S.fg = ''; S.abertas = new Set(); S.todasLinhas = false; return render(); }
    const k = t.closest('[data-cls]'); if (k) { S.cls = k.dataset.cls || null; S.todasLinhas = false; render(); return window.scrollTo(0, 0); }
    const l = t.closest('[data-linha]'); if (l) { const key = l.dataset.linha; S.abertas.has(key) ? S.abertas.delete(key) : S.abertas.add(key); const y = window.scrollY; render(); return window.scrollTo(0, y); }
    if (t.closest('[data-limpar]')) { S.forn = ''; S.cf = ''; S.lin = ''; S.pos = ''; S.mk = ''; S.ord = 'rec'; return render(); }
    if (t.closest('[data-todas]')) { S.todasLinhas = !S.todasLinhas; return render(); }
  });
  document.addEventListener('change', e => { const f = e.target.dataset && e.target.dataset.f; if (!f) return; S[f] = e.target.value; render(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); if ($('#modal').classList.contains('on')) { if (e.key === 'ArrowRight') vai(1); if (e.key === 'ArrowLeft') vai(-1); } });
  let tq; $('#busca').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.q = e.target.value; render(); }, 250); });
  $('#mes').innerHTML = '<option value="0">Ano todo</option>' + mesesComDado.map(x => `<option value="${x}">${MESES_LONGO[x - 1]}</option>`).join('');
  $('#mes').addEventListener('change', e => { S.mes = +e.target.value; render(); });
  const rotulo = () => { $('#tema').textContent = document.documentElement.dataset.theme === 'dark' ? '☀ claro' : '☾ escuro'; };
  rotulo();
  $('#tema').addEventListener('click', () => { const d = document.documentElement, n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; try { localStorage.setItem('rdec-tema', n); } catch (e) {} rotulo(); });
  render();
})();
