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

  const S = { uni: D.grupos.includes('INF DEC') ? 'INF DEC' : D.grupos[0], cls: null, mes: 0, q: '', abertas: new Set(), todasLinhas: false, forn: null, cf: null, fg: '', qc: '', lin: null, pos: null, mk: null, tl: null, open: null, msq: {}, ord: 'rec' };   // filtros: null = todos; Set = só os marcados
  try { let t = localStorage.getItem('rdec-tema'); if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'; if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  // ---------- dados do universo no período escolhido ----------
  const modoF = () => S.uni === FORN;
  const chaveG = it => modoF() ? it.fornecedor : it.classe;           // o que a lista da esquerda agrupa
  const nomeCls = k => S.uni === ALL ? curto(k) + ' · ' + (k.startsWith('INF') ? 'INF' : 'ADT') : curto(k);   // no completão a classe leva o grupo (há nomes iguais nos dois)
  const nomeG = k => modoF() ? k : nomeCls(k);
  const totNome = () => modoF() ? (S.fg ? NOME[S.fg] : 'INF + ADT') : S.uni === ALL ? 'INF + ADT' : NOME[S.uni];
  // unidades e valor (Innovaro/Hub, 2026) do item no período escolhido
  const un12 = (it, mes) => { const x = it.un; if (!x) return [0, 0]; return mes ? [x[0][mes - 1] || 0, x[1][mes - 1] || 0] : [x[0].reduce((s, n) => s + n, 0), x[1].reduce((s, n) => s + n, 0)]; };
  function itens(uni, mes) {
    const f = { modo: 'ano', grupos: new Set(uni === ALL ? ['INF DEC', 'ADT DEC'].filter(g => D.grupos.includes(g)) : uni === FORN ? (S.fg ? [S.fg] : ['INF DEC', 'ADT DEC'].filter(g => D.grupos.includes(g))) : [uni]), meses: mes ? new Set([mes]) : null };
    return [...L.consulta(f, it => it.i)].map(([i, acc]) => { const [u, vh] = un12(L.itens[i], mes); return { it: L.itens[i], acc, a: tot(acc, 2026), b: tot(acc, 2025), u, vh }; }).filter(r => r.a.rec > 0 || r.b.rec > 0);
  }
  const somar = rows => {
    const acc = L.somarAcc(rows.map(r => r.acc)); let u = 0, vh = 0, pn = 0, pd = 0;
    rows.forEach(r => { u += r.u || 0; vh += r.vh || 0; if (r.it && r.it.preco && r.a && r.a.rec > 0) { pn += r.it.preco * r.a.rec; pd += r.a.rec; } });
    // pm = preço médio vendido (valor Innovaro ÷ unidades); pt = preço médio de tabela (ponderado pela venda)
    return { a: tot(acc, 2026), b: tot(acc, 2025), u, vh, pm: u > 0 ? vh / u : null, pt: pd > 0 ? pn / pd : null };
  };
  const precoHtml = g => { const p = []; if (g.pt != null) p.push('tabela R$ ' + nf2.format(g.pt)); if (g.pm != null) p.push('vendido R$ ' + nf2.format(g.pm)); if (g.u > 0) p.push(nf0.format(g.u) + ' un'); return p.length ? `<span class="muted" title="Preço de tabela: Ritmo, ponderado pela venda. Preço vendido e unidades: Innovaro (Hub), 2026, valor bruto.">preço médio: <b>${p.join(' · ')}</b></span>` : ''; };
  const precoCard = r => { const t = r.it.preco, pv = r.u > 0 ? r.vh / r.u : null; return (t != null || pv != null) ? `<div class="pr">${t != null ? 'Tabela <b>R$ ' + nf2.format(t) + '</b>' : ''}${pv != null ? ' · vendido <b>R$ ' + nf2.format(pv) + '</b> · ' + nf0.format(r.u) + ' un' : ''}</div>` : ''; };
  function agrupar(rows, chave) {
    const m = new Map();
    for (const r of rows) { const k = chave(r.it); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m].map(([k, rs]) => Object.assign({ k, rows: rs.filter(r => r.a.rec > 0).sort((x, y) => y.a.rec - x.a.rec) }, somar(rs))).filter(g => g.rows.length).sort((x, y) => y.a.rec - x.a.rec);
  }

  // ---------- filtros ----------
  // Posição: cada produto cai em UMA categoria (fora de linha tem prioridade), para dar para marcar "tudo, menos fora de linha".
  const POSCAT = ['Entrega imediata', 'Encomenda / prazo', 'Estoque loja', 'Venda suspensa', 'Sem posição', 'Fora de linha'];
  const catPos = it => it.fl ? 'Fora de linha' : it.posTipo === 'Imediata' ? 'Entrega imediata' : (it.posTipo === 'Encomenda' || it.posTipo === 'Prazo') ? 'Encomenda / prazo' : it.posTipo === 'Estoque loja' ? 'Estoque loja' : it.posTipo === 'Suspensa/Bloqueada' ? 'Venda suspensa' : 'Sem posição';
  const MKCAT = ['Negativo', 'Abaixo de 100%', 'De 100% a 200%', 'Acima de 200%', 'Sem markup'];
  const catMk = mk => mk == null ? 'Sem markup' : mk < 0 ? 'Negativo' : mk < 1 ? 'Abaixo de 100%' : mk <= 2 ? 'De 100% a 200%' : 'Acima de 200%';
  const TLCAT = ['Piso', 'Mesa', 'Parede', 'Outras'];
  const tipoLum = it => { if (!/Ilumin|Lumin/.test(it.classe)) return ''; const n = norm(it.nome); return /\bpiso\b|\bde pe\b/.test(n) ? 'Piso' : /\bmesa\b|abajur/.test(n) ? 'Mesa' : /parede|arandela/.test(n) ? 'Parede' : 'Outras'; };
  L.itens.forEach(it => { it.tl = tipoLum(it); });
  const ORD = { rec: 'Mais vendidos', mk: 'Maior markup', mkmenor: 'Menor markup', cresc: 'Mais cresceram (R$)', queda: 'Mais caíram (R$)' };
  const casaClasse = (classe, busca) => { const c = norm(classe), t = norm(busca.trim()); return c.includes(t) || (/lumin|ilumin|abajur/.test(t) && /lumin|ilumin/.test(c)); };
  const tem = (set, v) => !set || set.has(v);
  const passaX = (r, sem) => (!S.qc || casaClasse(r.it.classe, S.qc))
    && (modoF() || sem === 'forn' || tem(S.forn, r.it.fornecedor)) && (!modoF() || sem === 'cf' || tem(S.cf, r.it.classe))
    && (sem === 'lin' || tem(S.lin, r.it.linha)) && (sem === 'pos' || tem(S.pos, catPos(r.it))) && (sem === 'mk' || tem(S.mk, catMk(r.a.mk)))
    && (sem === 'tl' || !S.tl || (r.it.tl && S.tl.has(r.it.tl)));
  const passa = r => passaX(r);
  const nAtivos = () => [modoF() ? S.cf : S.forn, S.lin, S.pos, S.mk, S.tl].filter(x => x).length + (S.qc.trim() ? 1 : 0) + (S.ord !== 'rec' ? 1 : 0);
  const chaveOrd = r => S.ord === 'mk' ? (r.a.mk == null ? -1e9 : r.a.mk) : S.ord === 'mkmenor' ? (r.a.mk == null ? -1e9 : -r.a.mk) : S.ord === 'cresc' ? r.a.rec - r.b.rec : S.ord === 'queda' ? r.b.rec - r.a.rec : r.a.rec;
  const ordenar = rows => rows.slice().sort((x, y) => chaveOrd(y) - chaveOrd(x));
  // tipo de iluminação (piso / mesa) só aparece quando se olha iluminação
  const tipoVisivel = () => (!modoF() && S.cls && /Ilumin|Lumin/.test(S.cls)) || /lumin|ilumin|abajur/.test(norm(S.qc)) || (modoF() && S.cf && [...S.cf].some(c => /Ilumin|Lumin/.test(c)));

  // caixa de seleção múltipla (marcar várias opções de uma vez; tudo marcado = sem filtro)
  const OPS = {};
  function msList(key, ops) {
    const sel = S[key], q = norm(S.msq[key] || '');
    const l = ops.filter(o => !q || norm(o[1]).includes(q)).map(o => `<label><input type="checkbox" data-msv="${key}" value="${esc(o[0])}" ${!sel || sel.has(o[0]) ? 'checked' : ''}><span>${esc(o[1])}</span>${o[2] != null ? `<em>${brlc(o[2])}</em>` : ''}</label>`).join('');
    return l || '<div class="muted" style="padding:8px">nada encontrado</div>';
  }
  function msel(key, rotulo, ops) {
    OPS[key] = ops; const sel = S[key], n = sel ? ops.filter(o => sel.has(o[0])).length : ops.length;
    return `<div class="msel ${S.open === key ? 'open' : ''}"><button type="button" data-msopen="${key}" class="${sel ? 'ativo' : ''}">${esc(rotulo)}${sel ? ` (${n} de ${ops.length})` : ': todos'} ▾</button>
      <div class="pn"><div class="top"><button type="button" class="btn" data-msall="${key}">Todos</button><button type="button" class="btn" data-msnone="${key}">Nenhum</button></div>
      ${ops.length > 8 ? `<input type="search" data-msq="${key}" placeholder="buscar…" value="${esc(S.msq[key] || '')}">` : ''}<div class="lst" id="lst-${key}">${msList(key, ops)}</div></div></div>`;
  }
  function filtrosHtml(todos, rowsClasse) {
    const soma = (rs, k, sem) => { const m = new Map(); rs.filter(r => r.a.rec > 0 && passaX(r, sem)).forEach(r => { const v = k(r); m.set(v, (m.get(v) || 0) + r.a.rec); }); return m; };
    const ordenaM = m => [...m].sort((x, y) => y[1] - x[1]);
    const dos = (cats, m) => cats.map(c => [c, c, m.get(c) || 0]);
    const forns = ordenaM(soma(rowsClasse, r => r.it.fornecedor, 'forn')).map(([n, v]) => [n, n, v]);
    const clss = ordenaM(soma(rowsClasse, r => r.it.classe, 'cf')).map(([n, v]) => [n, curto(n), v]);
    const lins = ordenaM(soma(rowsClasse, r => r.it.linha, 'lin')).map(([n, v]) => [n, n, v]);
    const pos = dos(POSCAT, soma(rowsClasse, r => catPos(r.it), 'pos'));
    const mk = dos(MKCAT, soma(rowsClasse, r => catMk(r.a.mk), 'mk'));
    const tl = tipoVisivel() ? dos(TLCAT, soma(rowsClasse.filter(r => r.it.tl), r => r.it.tl, 'tl')).filter(o => o[2] > 0 || (S.tl && S.tl.has(o[0]))) : null;
    const buscaClasse = `<input type="search" id="qc" class="${S.qc.trim() ? 'ativo' : ''}" placeholder="Buscar classe… (ex.: almofada)" value="${esc(S.qc)}" aria-label="Buscar classe">`;
    return `<div class="filtros">${buscaClasse}${modoF() ? msel('cf', 'Classe', clss) : msel('forn', 'Fornecedor', forns)}${msel('lin', 'Linha', lins)}${tl ? msel('tl', 'Tipo de iluminação', tl) : ''}${msel('pos', 'Posição', pos)}${msel('mk', 'Markup', mk)}
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
      <div class="tx"><div class="nm" title="${esc(it.nome)}">${esc(it.nome)}</div><div class="fo">${esc(it.fornecedor)}</div><div class="pb">${posicao(it)}</div>${(CTX.cls.get(it.classe) || baseLinha) ? `<div class="peso2" title="Peso do produto nas vendas da classe inteira e da linha inteira">${pesoBarra(r.a.rec / (CTX.cls.get(it.classe) || baseLinha))}<small><b>${pct(r.a.rec / (CTX.cls.get(it.classe) || baseLinha))}</b> da classe${baseLinha ? ` · ${pct(r.a.rec / baseLinha)} da linha` : ''}</small></div>` : ''}
      ${precoCard(r)}<div class="vl"><div><small>Vende ${esc(S.mes ? MESES[S.mes - 1] : 'no ano')}</small><b class="num">${brl(r.a.rec)}</b><small class="${cv(L.vari(r.a.rec, r.b.rec))}" style="text-transform:none">${r.b.rec > 0 ? varf(L.vari(r.a.rec, r.b.rec)) + ' vs 2025' : 'sem venda em 2025'}</small></div><div style="text-align:right"><small>Markup</small><b class="num">${mkFmt(r.a.mk, (CLSMK.get(it.classe) || {a: {}}).a.mk)}</b><small style="text-transform:none" title="Markup 2025 − Markup 2026: ${esc(ppf(dpp(r.b.mk != null ? r.b.mk : (CLSMK.get(it.classe) || {b: {}}).b.mk, r.a.mk != null ? r.a.mk : (CLSMK.get(it.classe) || {a: {}}).a.mk)))}">2025: ${mkFmt(r.b.mk, (CLSMK.get(it.classe) || {b: {}}).b.mk)}</small></div></div></div></div>`;
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
    if (!tipoVisivel()) S.tl = null;
    const todos = itens(S.uni, S.mes), rows = todos.filter(passa); NAV = new Map();
    const porCls = new Map(); todos.forEach(r => { if (!porCls.has(r.it.classe)) porCls.set(r.it.classe, []); porCls.get(r.it.classe).push(r); });
    CLSMK = new Map([...porCls].map(([k, rs]) => [k, somar(rs)]));
    // Proporções SEMPRE sobre o total inteiro (classe toda, linha toda, universo todo), mesmo com filtros ligados.
    const vivos = todos.filter(r => r.a.rec > 0), soma = (mp, k, v) => mp.set(k, (mp.get(k) || 0) + v);
    CTX = { total: 0, cls: new Map(), lin: new Map(), forn: new Map(), item: new Map() };
    vivos.forEach(r => { CTX.total += r.a.rec; soma(CTX.cls, r.it.classe, r.a.rec); soma(CTX.lin, r.it.classe + '|' + r.it.linha, r.a.rec); soma(CTX.forn, r.it.fornecedor, r.a.rec); CTX.item.set(r.it.i, r.a.rec); });
    const totG = new Map(); vivos.forEach(r => soma(totG, chaveG(r.it), r.a.rec));   // total inteiro de cada item da lista da esquerda (classe ou fornecedor)
    const q = norm(S.q.trim());
    if (q) return renderBusca(rows.filter(r => r.a.rec > 0), q, subFornHtml() + filtrosHtml(todos, todos));
    const classes = agrupar(rows, chaveG), all = somar(rows);
    if (S.cls && !todos.some(r => chaveG(r.it) === S.cls)) S.cls = null;   // só some se a classe não existe; filtros que esvaziam a tela mantêm a classe
    const doClasse = S.cls ? todos.filter(r => chaveG(r.it) === S.cls) : todos;
    const selAll = S.cls ? rows.filter(r => chaveG(r.it) === S.cls) : rows;   // inclui itens só de 2025, para o markup de 2025 ficar completo
    if (S.lin) { const pres = new Set(doClasse.filter(r => r.a.rec > 0).map(r => r.it.linha)), nx = new Set([...S.lin].filter(x => pres.has(x))); if (nx.size !== S.lin.size) { S.lin = nx.size ? nx : null; return render(); } }
    const zero = { rec: 0, mg: 0, cmv: 0, mk: null, mgp: null };
    const sel = S.cls ? (classes.find(c => c.k === S.cls) || { k: S.cls, rows: [], a: zero, b: zero }) : { k: null, rows: rows.filter(r => r.a.rec > 0), a: all.a, b: all.b, u: all.u, vh: all.vh, pm: all.pm, pt: all.pt };
    const keyL = it => modoF() ? curto(it.classe) + ' › ' + it.linha : (S.uni === ALL && !S.cls ? (it.grupo.startsWith('INF') ? 'INF' : 'ADT') + ' › ' + it.linha : it.linha);
    const linhas = agrupar(selAll, keyL), vis = S.todasLinhas ? linhas : linhas.slice(0, LIM_LINHAS);
    const lista = `<aside class="classes">
      <button class="classe ${!S.cls ? 'on' : ''}" data-cls=""><b>${modoF() ? 'Todos os fornecedores' : 'Todas as classes'}</b><small>${brlc(all.a.rec)} · Mk ${mkf(all.a.mk)}</small></button>
      ${classes.map(c => `<button class="classe ${S.cls === c.k ? 'on' : ''}" data-cls="${esc(c.k)}"><b>${esc(nomeG(c.k))}</b><small>${brlc(c.a.rec)} · Mk ${mkf(c.a.mk)} · ${c.rows.length} itens</small>${pesoBarra(CTX.total ? c.a.rec / CTX.total : 0)}<small><b>${pct(CTX.total ? c.a.rec / CTX.total : null)}</b> do total ${esc(totNome())}</small></button>`).join('')}</aside>`;
    const cab = `<div class="cab"><h1>${esc(S.cls ? nomeG(S.cls) : (modoF() ? 'Todos os fornecedores' : 'Todas as classes'))} <span class="muted" style="font-size:16px;font-weight:500">· ${esc(totNome())}</span></h1>
      <div class="res"><span>Vende em ${esc(periodo())}: <b class="num">${brl(sel.a.rec)}</b> <span class="${cv(L.vari(sel.a.rec, sel.b.rec))}">${varf(L.vari(sel.a.rec, sel.b.rec))}</span> <span class="muted">${S.mes ? '' : 'vs 2025'}</span></span><span>Markup: <b class="num">${mkf(sel.a.mk)}</b> <span class="muted">(2025: ${mkf(sel.b.mk)} · 2025 − 2026: ${ppf(dpp(sel.b.mk, sel.a.mk))})</span></span>${S.cls ? `<span><b class="num">${pct(CTX.total ? sel.a.rec / CTX.total : null)}</b> do total de ${esc(totNome())}</span>` : ''}${precoHtml(sel)}<span>${linhas.length} ${linhas.length === 1 ? 'linha' : 'linhas'} · ${sel.rows.length} ${sel.rows.length === 1 ? 'produto' : 'produtos'}</span></div></div>`;
    // linha: base = a classe inteira (no Fornecedores, a classe da linha com todos os fornecedores); sem classe escolhida, o total
    const baseL = l => modoF() ? CTX.cls.get(l.rows[0].it.classe) : (S.cls ? CTX.cls.get(S.cls) : CTX.total);
    // item: base = a linha inteira (no Fornecedores, a linha da classe com todos os fornecedores)
    const LT = new Map(); vivos.filter(r => !S.cls || modoF() || r.it.classe === S.cls).forEach(r => soma(LT, keyL(r.it), r.a.rec));
    const baseI = l => modoF() ? CTX.lin.get(l.rows[0].it.classe + '|' + l.rows[0].it.linha) : LT.get(l.k);
    const cmL = l => { const c = modoF() ? (l.rows[0] && l.rows[0].it.classe) : S.cls; return (c && CLSMK.get(c)) || { a: {}, b: {} }; };
    const secoes = vis.map(l => {
      const aberta = S.abertas.has((S.cls || '') + '|' + l.k), ord = ordenar(l.rows), mostra = aberta ? ord : ord.slice(0, TOP), key = 'l' + NAV.size;
      NAV.set(key, mostra.map(r => r.it.i));
      const fs = [...l.rows.reduce((m, r) => m.set(r.it.fornecedor, (m.get(r.it.fornecedor) || 0) + r.a.rec), new Map())].sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]).join(', ');
      return `<section class="linha"><div class="lh"><h2>${esc(l.k)}</h2><span class="meta">vende <b>${brl(l.a.rec)}</b> · markup <b>${mkFmt(l.a.mk, cmL(l).a.mk)}</b> <span title="Markup 2025 − Markup 2026">(2025: ${mkFmt(l.b.mk, cmL(l).b.mk)} · 2025 − 2026: ${ppf(dpp(l.b.mk != null ? l.b.mk : cmL(l).b.mk, l.a.mk != null ? l.a.mk : cmL(l).a.mk))})</span> · ${precoHtml(l)}${modoF() ? '' : ' · ' + esc(fs)}</span><span class="peso" title="Sobre a classe inteira, sem filtros">${pesoBarra(baseL(l) ? l.a.rec / baseL(l) : 0)}<b>${pct(baseL(l) ? l.a.rec / baseL(l) : null)}</b> ${modoF() || S.cls ? 'da classe' : 'do total'}</span></div>
        <div class="cards">${mostra.map((r, n) => card(r, n + 1, key, baseI(l))).join('')}</div>
        ${l.rows.length > TOP ? `<button class="btn mais" data-linha="${esc((S.cls || '') + '|' + l.k)}">${aberta ? 'Mostrar só os 5 mais vendidos' : 'Ver todos os ' + l.rows.length + ' produtos desta linha'}</button>` : ''}</section>`;
    }).join('');
    $('#view').innerHTML = `${subFornHtml()}${filtrosHtml(todos, doClasse)}<div class="grade">${lista}<div>${cab}${secoes || '<div class="vazio">Nenhum produto com venda neste período.</div>'}
      ${linhas.length > LIM_LINHAS ? `<button class="btn" data-todas="1">${S.todasLinhas ? 'Mostrar só as ' + LIM_LINHAS + ' maiores linhas' : 'Ver as outras ' + (linhas.length - LIM_LINHAS) + ' linhas'}</button>` : ''}
      <div class="nota">Ordenado por: ${esc(ORD[S.ord].toLowerCase())} (${esc(periodo())}). Markup = (receita − custo) ÷ custo. Percentuais sempre sobre o total inteiro da classe, da linha e do universo, mesmo com filtros. Dados até ${m.dadosAte.split('-').reverse().join('/')}${S.mes === 11 || !S.mes ? ' (novembro até o dia ' + m.diaCorte + ', nos dois anos)' : ''}.</div></div></div>`;
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
  const dmy = iso => iso ? iso.split('-').reverse().join('/') : '';
  const diasDesde = iso => Math.max(0, Math.round((new Date(m.dadosAte) - new Date(iso)) / 864e5));
  function datasHtml(it) {
    const p = [];
    if (it.cad) p.push(`<span>Cadastro: <b>${dmy(it.cad)}</b></span>`);
    if (it.entrada) p.push(`<span title="Informada em complementos.csv">1ª entrada em loja: <b>${dmy(it.entrada)}</b> <span class="muted">(há ${diasDesde(it.entrada)} dias)</span></span>`);
    else if (it.vLoja) p.push(`<span title="Data da primeira venda nas lojas (RJ e SP), na base de vendas que começa em 01/01/2025. A data de 1ª entrada de estoque em loja ainda não está cadastrada.">1ª venda em loja: <b>${it.vLoja <= '2025-01-07' ? '01/01/2025 ou antes' : dmy(it.vLoja)}</b> ${it.vLoja <= '2025-01-07' ? '' : `<span class="muted">(há ${diasDesde(it.vLoja)} dias)</span>`}</span>`);
    else p.push('<span class="muted" title="Ainda sem venda em loja física na base (a partir de 01/01/2025)">sem venda em loja</span>');
    return `<div class="datas">${p.join('')}</div>`;
  }
  function abrir(i, navKey) {
    const it = L.itens[i]; CUR = i; if (navKey) CURNAV = NAV.get(navKey) || [];
    const acc = L.consulta({ modo: 'ano' }, x => x.i === i ? 'k' : null).get('k') || L.novoAcc(), A = tot(acc, 2026), B = tot(acc, 2025), p = CURNAV.indexOf(i);
    const cmA = somar([...L.consulta({ modo: 'ano', classes: new Set([it.classe]) }, x => x.i)].map(([k, ac]) => ({ acc: ac })));   // markup anual da classe do item
    $('#modal').innerHTML = `<button class="x" data-fechar aria-label="Fechar">×</button>
      ${p >= 0 ? `<div class="nav"><button class="btn" data-nav="-1" ${p === 0 ? 'disabled' : ''}>‹ anterior</button><span class="muted">${p + 1} de ${CURNAV.length}</span><button class="btn" data-nav="1" ${p === CURNAV.length - 1 ? 'disabled' : ''}>próximo ›</button></div>` : ''}
      <div class="topo">${foto(it, 'big')}<div><h2>${esc(it.nome)}</h2><div class="muted" style="margin:4px 0 8px">${esc(it.cod)} · ${esc(curto(it.classe))} › ${esc(it.linha)}</div>
        <div><b>Fornecedor:</b> ${esc(it.fornecedor)}</div>${datasHtml(it)}${it.classeOrig ? `<div class="muted" style="font-size:12.5px" title="O catálogo agrupa por tipo de produto; a classe original da planilha é mantida aqui">Classe na planilha: ${esc(it.classeOrig)}</div>` : ''}<div style="margin:8px 0">${posicao(it)}</div>
        <div class="muted" style="font-size:13px">${it.disp != null ? 'Disponível: <b>' + nf0.format(it.disp) + '</b> · ' : ''}${it.preco != null ? 'Preço: <b>R$ ' + nf2.format(it.preco) + '</b>' : ''}${it.custo != null ? ' · Custo: R$ ' + nf2.format(it.custo) : ''}</div>
        ${it.link ? `<div style="margin-top:6px"><a href="https://${esc(String(it.link).replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">ver no site ↗</a></div>` : ''}</div></div>
      <div class="num4"><div><small>Vende em 2026</small><b class="num">${brl(A.rec)}</b><br><span class="${cv(L.vari(A.rec, B.rec))}">${varf(L.vari(A.rec, B.rec))} vs 2025</span></div><div><small>Vendeu em 2025</small><b class="num">${brl(B.rec)}</b></div>
        <div><small>Markup 2026</small><b class="num">${mkFmt(A.mk, cmA.a.mk)}</b></div><div><small>Markup 2025</small><b class="num">${mkFmt(B.mk, cmA.b.mk)}</b></div><div><small>Mk 2025 − Mk 2026</small><b class="num">${ppf(dpp(B.mk != null ? B.mk : cmA.b.mk, A.mk != null ? A.mk : cmA.a.mk))}</b>${A.mk == null || B.mk == null ? '<br><span class="muted">usa o markup da classe onde o item não tem</span>' : ''}</div></div>
      ${(() => { const [u, vh] = un12(it, 0), pv = u > 0 ? vh / u : null; return (it.preco != null || pv != null) ? `<div class="num4"><div><small>Preço de tabela</small><b class="num">${it.preco != null ? 'R$ ' + nf2.format(it.preco) : '–'}</b><br><span class="muted">${it.custo != null ? 'custo R$ ' + nf2.format(it.custo) : ''}</span></div><div><small>Preço médio vendido</small><b class="num">${pv != null ? 'R$ ' + nf2.format(pv) : '–'}</b><br><span class="muted">${pv != null && it.preco ? pct(pv / it.preco - 1) + ' vs tabela' : 'sem unidades no Hub'}</span></div><div><small>Unidades em 2026</small><b class="num">${u > 0 ? nf0.format(u) : '–'}</b><br><span class="muted">Innovaro (Hub), valor bruto</span></div></div>` : ''; })()}
      ${CTX.item.has(i) ? `<div class="num4"><div><small>Na linha ${esc(it.linha)}</small><b class="num">${pct(CTX.lin.get(it.classe + '|' + it.linha) ? CTX.item.get(i) / CTX.lin.get(it.classe + '|' + it.linha) : null)}</b><br><span class="muted">da linha inteira nesta classe</span></div><div><small>Na classe ${esc(nomeCls(it.classe))}</small><b class="num">${pct(CTX.cls.get(it.classe) ? CTX.item.get(i) / CTX.cls.get(it.classe) : null)}</b><br><span class="muted">da classe inteira</span></div>${modoF() ? `<div><small>No fornecedor ${esc(it.fornecedor)}</small><b class="num">${pct(CTX.forn.get(it.fornecedor) ? CTX.item.get(i) / CTX.forn.get(it.fornecedor) : null)}</b><br><span class="muted">das vendas do fornecedor</span></div>` : ''}<div><small>No total ${esc(totNome())}</small><b class="num">${pct(CTX.total ? CTX.item.get(i) / CTX.total : null)}</b><br><span class="muted">das vendas de ${esc(periodo())}</span></div></div>` : ''}
      <div class="leg"><span><i style="background:var(--c25)"></i>2025</span><span><i style="background:var(--accent)"></i>2026</span><span>vendas mês a mês</span></div>${meses(acc)}`;
    $('#modal').classList.add('on'); $('#veil').classList.add('on');
  }
  const fechar = () => { $('#modal').classList.remove('on'); $('#veil').classList.remove('on'); };
  const vai = d => { const p = CURNAV.indexOf(CUR) + d; if (p >= 0 && p < CURNAV.length) abrir(CURNAV[p]); };

  // ---------- eventos ----------
  // caixas de seleção múltipla dos filtros
  const fechaMsel = () => { S.open = null; document.querySelectorAll('.msel.open').forEach(m => m.classList.remove('open')); };
  const reMsel = (key, foco) => { const l = document.getElementById('lst-' + key), top = l ? l.scrollTop : 0; S.open = key; const y = window.scrollY; render(); window.scrollTo(0, y); const n = document.getElementById('lst-' + key); if (n) n.scrollTop = top; if (foco) { const i = document.querySelector('[data-msq="' + key + '"]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } };
  document.addEventListener('click', e => {
    const t = e.target;
    if (!t.closest('.msel')) { if (S.open) fechaMsel(); }
    else {
      const ab = t.closest('[data-msopen]'); if (ab) { const k = ab.dataset.msopen, jaAberto = S.open === k; fechaMsel(); if (!jaAberto) { S.open = k; ab.closest('.msel').classList.add('open'); } return; }
      const todos = t.closest('[data-msall]'); if (todos) { S[todos.dataset.msall] = null; return reMsel(todos.dataset.msall); }
      const nenhum = t.closest('[data-msnone]'); if (nenhum) { S[nenhum.dataset.msnone] = new Set(); return reMsel(nenhum.dataset.msnone); }
      return;
    }
    const c = t.closest('[data-i]'); if (c) return abrir(+c.dataset.i, c.dataset.nav);
    if (t.closest('[data-fechar]') || t.id === 'veil') return fechar();
    const n = t.closest('[data-nav]'); if (n && n.tagName === 'BUTTON') return vai(+n.dataset.nav);
    const fg = t.closest('[data-fg]'); if (fg) { S.fg = fg.dataset.fg; S.cls = null; S.cf = null; S.lin = null; S.abertas = new Set(); return render(); }
    const u = t.closest('#uni [data-uni]'); if (u) { S.uni = u.dataset.uni; S.cls = null; S.cf = null; S.lin = null; S.tl = null; S.fg = ''; S.abertas = new Set(); S.todasLinhas = false; return render(); }
    const k = t.closest('[data-cls]'); if (k) { S.cls = k.dataset.cls || null; S.todasLinhas = false; render(); return window.scrollTo(0, 0); }
    const l = t.closest('[data-linha]'); if (l) { const key = l.dataset.linha; S.abertas.has(key) ? S.abertas.delete(key) : S.abertas.add(key); const y = window.scrollY; render(); return window.scrollTo(0, y); }
    if (t.closest('[data-limpar]')) { S.forn = null; S.cf = null; S.qc = ''; S.lin = null; S.pos = null; S.mk = null; S.tl = null; S.msq = {}; S.open = null; S.ord = 'rec'; return render(); }
    if (t.closest('[data-todas]')) { S.todasLinhas = !S.todasLinhas; return render(); }
  });
  document.addEventListener('change', e => {
    const t = e.target, d = t.dataset || {};
    if (d.msv) {   // marcar / desmarcar uma opção: tudo marcado volta a ser "sem filtro"
      const k = d.msv, todas = (OPS[k] || []).map(o => o[0]), s = S[k] ? new Set(S[k]) : new Set(todas);
      s.has(t.value) ? s.delete(t.value) : s.add(t.value);
      S[k] = (s.size >= todas.length && todas.every(x => s.has(x))) ? null : s; return reMsel(k);
    }
    if (!d.f) return; S[d.f] = t.value; render();
  });
  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.msq; if (!k) return; S.msq[k] = e.target.value;
    const l = document.getElementById('lst-' + k); if (l) l.innerHTML = msList(k, OPS[k] || []);
  });
  let tqc; document.addEventListener('input', e => {
    if (e.target.id !== 'qc') return; const v = e.target.value; clearTimeout(tqc);
    tqc = setTimeout(() => { S.qc = v; S.cls = null; S.lin = null; render(); const n = $('#qc'); if (n) { n.focus(); n.setSelectionRange(v.length, v.length); } }, 220);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { fechar(); fechaMsel(); } if ($('#modal').classList.contains('on')) { if (e.key === 'ArrowRight') vai(1); if (e.key === 'ArrowLeft') vai(-1); } });
  let tq; $('#busca').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.q = e.target.value; render(); }, 250); });
  $('#mes').innerHTML = '<option value="0">Ano todo</option>' + mesesComDado.map(x => `<option value="${x}">${MESES_LONGO[x - 1]}</option>`).join('');
  $('#mes').addEventListener('change', e => { S.mes = +e.target.value; render(); });
  const rotulo = () => { $('#tema').textContent = document.documentElement.dataset.theme === 'dark' ? '☀ claro' : '☾ escuro'; };
  rotulo();
  $('#tema').addEventListener('click', () => { const d = document.documentElement, n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; try { localStorage.setItem('rdec-tema', n); } catch (e) {} rotulo(); });
  render();
})();
