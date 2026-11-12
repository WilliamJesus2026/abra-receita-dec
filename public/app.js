// Receita DEC (INF DEC e ADT DEC): classe > linha > produtos mais vendidos, com foto, vendas, markup, fornecedor e posição.
// Dados: dados.js (gerar.py). Cálculo: logica.js. Mk = (Receita - CMV) / CMV.
(function () {
  'use strict';
  const D = window.DEC, L = window.Logica.criar(D);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brl = v => v == null ? '–' : 'R$ ' + nf0.format(v);
  const brlc = v => { if (v == null) return '–'; const a = Math.abs(v); return a >= 1e6 ? 'R$ ' + nf2.format(v / 1e6) + ' mi' : a >= 1e4 ? 'R$ ' + nf0.format(v / 1e3) + ' mil' : brl(v); };
  const pct = v => v == null || !isFinite(v) ? '–' : (v * 100).toFixed(1).replace('.', ',') + '%';
  const varf = v => v == null ? '' : (v > 0 ? '+' : '') + pct(v);
  const mkf = v => v == null ? '–' : nf2.format(v);
  const cv = v => v == null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const MESES = L.MESES, tot = L.tot;
  const mesesComDado = [...new Set(D.fatos.map(x => x[1] % 100))].sort((a, b) => a - b);
  const MESES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const LOGO = { 'INF DEC': 'logo_abracadabra.png', 'ADT DEC': 'logo_abracasa.png' };
  const NOME = { 'INF DEC': 'INF DEC', 'ADT DEC': 'ADT DEC' };
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const curto = c => c.replace(/^(INF|ADT) DEC /, '');
  const LIM_LINHAS = 10, TOP = 5;

  const S = { uni: D.grupos.includes('INF DEC') ? 'INF DEC' : D.grupos[0], cls: null, mes: 0, q: '', abertas: new Set(), todasLinhas: false };
  try { let t = localStorage.getItem('rdec-tema'); if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'; if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  // ---------- dados do universo no período escolhido ----------
  function itens(uni, mes) {
    const f = { modo: 'ano', grupos: new Set([uni]), meses: mes ? new Set([mes]) : null };
    return [...L.consulta(f, it => it.i)].map(([i, acc]) => ({ it: L.itens[i], acc, a: tot(acc, 2026), b: tot(acc, 2025) })).filter(r => r.a.rec > 0 || r.b.rec > 0);
  }
  const somar = rows => { const acc = L.somarAcc(rows.map(r => r.acc)); return { a: tot(acc, 2026), b: tot(acc, 2025) }; };
  function agrupar(rows, chave) {
    const m = new Map();
    for (const r of rows) { const k = chave(r.it); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m].map(([k, rs]) => Object.assign({ k, rows: rs.filter(r => r.a.rec > 0).sort((x, y) => y.a.rec - x.a.rec) }, somar(rs))).filter(g => g.rows.length).sort((x, y) => y.a.rec - x.a.rec);
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

  function card(r, n, nav) {
    const it = r.it;
    return `<div class="card" data-i="${it.i}" data-nav="${nav}"><div class="ft">${foto(it)}${n ? `<span class="rk">${n}</span>` : ''}</div>
      <div class="tx"><div class="nm" title="${esc(it.nome)}">${esc(it.nome)}</div><div class="fo">${esc(it.fornecedor)}</div><div>${posicao(it)}</div>
      <div class="vl"><div><small>Vende ${esc(S.mes ? MESES[S.mes - 1] : 'no ano')}</small><b class="num">${brl(r.a.rec)}</b></div><div style="text-align:right"><small>Markup</small><b class="num">${mkf(r.a.mk)}</b></div></div></div></div>`;
  }

  // ---------- tela ----------
  let NAV = new Map();   // chave -> ids dos produtos, na ordem mostrada (para ‹ › no detalhe)
  function render() {
    document.body.dataset.uni = S.uni;
    $('#uni').innerHTML = ['INF DEC', 'ADT DEC'].filter(g => D.grupos.includes(g)).map(g => {
      const t = somar(itens(g, S.mes)); return `<button data-uni="${esc(g)}" class="${S.uni === g ? 'on' : ''}"><img src="${LOGO[g]}" alt=""><span>${esc(NOME[g])}<small>${brlc(t.a.rec)} · Mk ${mkf(t.a.mk)}</small></span></button>`;
    }).join('');
    const rows = itens(S.uni, S.mes); NAV = new Map();
    const q = norm(S.q.trim());
    if (q) return renderBusca(rows.filter(r => r.a.rec > 0), q);
    const classes = agrupar(rows, it => it.classe), all = somar(rows);
    if (S.cls && !classes.find(c => c.k === S.cls)) S.cls = null;
    const sel = S.cls ? classes.find(c => c.k === S.cls) : { k: null, rows: rows.filter(r => r.a.rec > 0), a: all.a, b: all.b };
    const linhas = agrupar(sel.rows, it => it.linha), vis = S.todasLinhas ? linhas : linhas.slice(0, LIM_LINHAS);
    const lista = `<aside class="classes">
      <button class="classe ${!S.cls ? 'on' : ''}" data-cls=""><b>Todas as classes</b><small>${brlc(all.a.rec)} · Mk ${mkf(all.a.mk)}</small></button>
      ${classes.map(c => `<button class="classe ${S.cls === c.k ? 'on' : ''}" data-cls="${esc(c.k)}"><b>${esc(curto(c.k))}</b><small>${brlc(c.a.rec)} · Mk ${mkf(c.a.mk)} · ${c.rows.length} itens</small></button>`).join('')}</aside>`;
    const cab = `<div class="cab"><h1>${esc(S.cls ? curto(S.cls) : 'Todas as classes')} <span class="muted" style="font-size:16px;font-weight:500">· ${esc(NOME[S.uni])}</span></h1>
      <div class="res"><span>Vende em ${esc(periodo())}: <b class="num">${brl(sel.a.rec)}</b> <span class="${cv(L.vari(sel.a.rec, sel.b.rec))}">${varf(L.vari(sel.a.rec, sel.b.rec))}</span> <span class="muted">${S.mes ? '' : 'vs 2025'}</span></span><span>Markup: <b class="num">${mkf(sel.a.mk)}</b></span><span>${linhas.length} linhas · ${sel.rows.length} produtos</span></div></div>`;
    const secoes = vis.map(l => {
      const aberta = S.abertas.has((S.cls || '') + '|' + l.k), mostra = aberta ? l.rows : l.rows.slice(0, TOP), key = 'l' + NAV.size;
      NAV.set(key, mostra.map(r => r.it.i));
      const fs = [...l.rows.reduce((m, r) => m.set(r.it.fornecedor, (m.get(r.it.fornecedor) || 0) + r.a.rec), new Map())].sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]).join(', ');
      return `<section class="linha"><div class="lh"><h2>${esc(l.k)}</h2><span class="meta">vende <b>${brl(l.a.rec)}</b> · markup <b>${mkf(l.a.mk)}</b> · ${esc(fs)}</span></div>
        <div class="cards">${mostra.map((r, n) => card(r, n + 1, key)).join('')}</div>
        ${l.rows.length > TOP ? `<button class="btn mais" data-linha="${esc((S.cls || '') + '|' + l.k)}">${aberta ? 'Mostrar só os 5 mais vendidos' : 'Ver todos os ' + l.rows.length + ' produtos desta linha'}</button>` : ''}</section>`;
    }).join('');
    $('#view').innerHTML = `<div class="grade">${lista}<div>${cab}${secoes || '<div class="vazio">Nenhum produto com venda neste período.</div>'}
      ${linhas.length > LIM_LINHAS ? `<button class="btn" data-todas="1">${S.todasLinhas ? 'Mostrar só as ' + LIM_LINHAS + ' maiores linhas' : 'Ver as outras ' + (linhas.length - LIM_LINHAS) + ' linhas'}</button>` : ''}
      <div class="nota">Mais vendidos pela receita de ${esc(periodo())}. Markup = (receita − custo) ÷ custo. Dados até ${m.dadosAte.split('-').reverse().join('/')}${S.mes === 11 || !S.mes ? ' (novembro até o dia ' + m.diaCorte + ', nos dois anos)' : ''}.</div></div></div>`;
  }
  function renderBusca(rows, q) {
    const res = rows.filter(r => norm(r.it.nome).includes(q) || r.it.cod.includes(q) || norm(r.it.fornecedor).includes(q) || norm(r.it.linha).includes(q)).sort((x, y) => y.a.rec - x.a.rec);
    NAV.set('busca', res.slice(0, 60).map(r => r.it.i));
    $('#view').innerHTML = `<div class="cab"><h1>Busca: “${esc(S.q)}”</h1><div class="res"><span>${res.length} produtos em ${esc(NOME[S.uni])} · ${esc(periodo())}</span></div></div>
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
    $('#modal').innerHTML = `<button class="x" data-fechar aria-label="Fechar">×</button>
      ${p >= 0 ? `<div class="nav"><button class="btn" data-nav="-1" ${p === 0 ? 'disabled' : ''}>‹ anterior</button><span class="muted">${p + 1} de ${CURNAV.length}</span><button class="btn" data-nav="1" ${p === CURNAV.length - 1 ? 'disabled' : ''}>próximo ›</button></div>` : ''}
      <div class="topo">${foto(it, 'big')}<div><h2>${esc(it.nome)}</h2><div class="muted" style="margin:4px 0 8px">${esc(it.cod)} · ${esc(curto(it.classe))} › ${esc(it.linha)}</div>
        <div><b>Fornecedor:</b> ${esc(it.fornecedor)}</div><div style="margin:8px 0">${posicao(it)}</div>
        <div class="muted" style="font-size:13px">${it.disp != null ? 'Disponível: <b>' + nf0.format(it.disp) + '</b> · ' : ''}${it.preco != null ? 'Preço: <b>R$ ' + nf2.format(it.preco) + '</b>' : ''}${it.custo != null ? ' · Custo: R$ ' + nf2.format(it.custo) : ''}</div>
        ${it.link ? `<div style="margin-top:6px"><a href="https://${esc(String(it.link).replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">ver no site ↗</a></div>` : ''}</div></div>
      <div class="num4"><div><small>Vende em 2026</small><b class="num">${brl(A.rec)}</b><br><span class="${cv(L.vari(A.rec, B.rec))}">${varf(L.vari(A.rec, B.rec))} vs 2025</span></div><div><small>Vendeu em 2025</small><b class="num">${brl(B.rec)}</b></div>
        <div><small>Markup 2026</small><b class="num">${mkf(A.mk)}</b></div><div><small>Markup 2025</small><b class="num">${mkf(B.mk)}</b></div></div>
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
    const u = t.closest('#uni [data-uni]'); if (u) { S.uni = u.dataset.uni; S.cls = null; S.abertas = new Set(); S.todasLinhas = false; return render(); }
    const k = t.closest('[data-cls]'); if (k) { S.cls = k.dataset.cls || null; S.todasLinhas = false; render(); return window.scrollTo(0, 0); }
    const l = t.closest('[data-linha]'); if (l) { const key = l.dataset.linha; S.abertas.has(key) ? S.abertas.delete(key) : S.abertas.add(key); const y = window.scrollY; render(); return window.scrollTo(0, y); }
    if (t.closest('[data-todas]')) { S.todasLinhas = !S.todasLinhas; return render(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); if ($('#modal').classList.contains('on')) { if (e.key === 'ArrowRight') vai(1); if (e.key === 'ArrowLeft') vai(-1); } });
  let tq; $('#busca').addEventListener('input', e => { clearTimeout(tq); tq = setTimeout(() => { S.q = e.target.value; render(); }, 250); });
  $('#mes').innerHTML = '<option value="0">Ano todo</option>' + mesesComDado.map(x => `<option value="${x}">${MESES_LONGO[x - 1]}</option>`).join('');
  $('#mes').addEventListener('change', e => { S.mes = +e.target.value; render(); });
  const rotulo = () => { $('#tema').textContent = document.documentElement.dataset.theme === 'dark' ? '☀ claro' : '☾ escuro'; };
  rotulo();
  $('#tema').addEventListener('click', () => { const d = document.documentElement, n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; try { localStorage.setItem('rdec-tema', n); } catch (e) {} rotulo(); });
  render();
})();
