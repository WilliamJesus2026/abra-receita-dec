// App Receita DEC (INF DEC + ADT DEC): receita, margem e markup por mês/ano, item, classe e linha. Dados: dados.js (gerar.py).
(function () {
  'use strict';
  const D = window.DEC, L = window.Logica.criar(D);
  const $ = (s, r) => (r || document).querySelector(s);
  const SEP = '\u0001';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const brl = v => v == null ? '–' : 'R$ ' + nf0.format(v);
  const brlc = v => { if (v == null) return '–'; const a = Math.abs(v); return a >= 1e6 ? 'R$ ' + nf2.format(v / 1e6) + ' mi' : a >= 1e4 ? 'R$ ' + nf0.format(v / 1e3) + ' mil' : brl(v); };
  const pct = (v, d) => v == null || !isFinite(v) ? '–' : (v * 100).toFixed(d == null ? 1 : d).replace('.', ',') + '%';
  const mkf = v => v == null ? '–' : nf2.format(v);
  const varf = v => v == null ? '–' : (v > 0 ? '+' : '') + pct(v);
  const dmkf = v => v == null ? '–' : (v > 0 ? '+' : '') + nf2.format(v);
  const cv = v => v == null ? '' : v > 0 ? 'pos' : v < 0 ? 'neg' : '';
  const MESES = L.MESES;
  const mesesComDado = [...new Set(D.fatos.map(x => x[1] % 100))].sort((a, b) => a - b);
  const porCod = new Map(L.itens.map(it => [it.cod, it]));
  const classesDoGrupo = g => [...new Set(L.itens.filter(it => it.grupo === g).map(it => it.classe))];
  const ordPt = (a, b) => a.localeCompare(b, 'pt-BR');

  // ---------------- estado ----------------
  const S = {
    tab: 'compra', modo: 'ano', canais: null, grupos: null, classes: null, linhas: null, posicoes: null, fornecedores: null, foraLinha: 'todos', q: '', meses: null,
    bCls: null, bLin: null, bSort: 'rec', bTop: 40, fSort: 'rec', fSel: null, fTop: 40, fViz: 'rec', fN: 15,
    rVisaoMes: 'rec', rVisaoCls: 'rec', rTop: 12,
    aOrdem: 'cl', aSort: 'rec26', aAbertos: new Set(), aCols: 'full',
    mDim: 'classe', mMet: 'rec26', mSel: null, mTop: 40,
    iSort: 'rec26', iDir: -1, iPag: 0, iMin: 0, iSo26: true, iMkMin: '', iMkMax: '',
    tN: 5, tOrd: 'rec', tAll: false,
    xVis: 'matriz', xMat: 'linhaNaClasse', xCls: null, xLin: null, xTop: 30,
    open: null, msq: {}
  };
  try { let t = localStorage.getItem('rdec-tema'); if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark'; if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  const filtro = () => ({ modo: S.modo, canais: S.canais, grupos: S.grupos, classes: S.classes, linhas: S.linhas, posicoes: S.posicoes, fornecedores: S.fornecedores, compradores: S.compradores, foraLinha: S.foraLinha, q: S.q, meses: S.meses });
  const tot = (a, y) => L.tot(a, y);
  const um = (key, f) => { const r = L.consulta(f || filtro(), () => key).get(key); return r || L.novoAcc(); };

  // ---------------- helpers de tela ----------------
  function posBadge(it) {
    const t = it.posTipo; let cls = 'gray', txt = t;
    if (t === 'Imediata') { cls = 'ok'; txt = 'Imediata' + (it.disp != null ? ' · ' + nf0.format(it.disp) : ''); }
    else if (t === 'Encomenda' || t === 'Prazo') { cls = 'blue'; txt = t + (it.prazo ? ' ' + it.prazo + 'd' : ''); }
    else if (t === 'Estoque loja') cls = 'warn';
    else if (t === 'Suspensa/Bloqueada') { cls = 'bad'; txt = 'Suspensa'; }
    return `<span class="bdg ${cls}" title="${esc(it.sit)}">${esc(txt)}</span>` + (it.fl ? ' <span class="bdg fl" title="Fora de linha">FL</span>' : '');
  }
  const semVenda = it => it.posTipo === 'Suspensa/Bloqueada' || it.posTipo === 'Sem posição' || it.posTipo === 'Fora do Ritmo' || it.fl;
  function thumb(it, cls) {
    cls = cls || '';
    if (!it.foto) return `<img class="thumb semfoto ${cls}" src="logo-abra.svg" alt="Abra" title="sem foto no site">`;
    return `<img class="thumb ${cls}" src="${esc(it.foto)}" loading="lazy" referrerpolicy="no-referrer" alt="">`;
  }
  document.addEventListener('error', e => {
    const t = e.target; if (t && t.tagName === 'IMG' && t.classList.contains('thumb')) { t.onerror = null; t.src = 'logo-abra.svg'; t.classList.add('semfoto'); t.title = 'sem foto no site'; }
  }, true);
  const nomeItem = (it, extra) => `<div class="nm">${thumb(it)}<div><b>${esc(it.nome)}</b><small>${esc(it.cod)} · ${esc(it.linha)} · <i>${esc(it.fornecedor)}</i>${extra || ''}</small></div></div>`;
  function heat(v, lo, hi, div) {
    if (v == null || !isFinite(v)) return '';
    if (div) { const m = Math.max(Math.abs(lo), Math.abs(hi)) || 1; const t = Math.min(1, Math.abs(v) / m); return `background:rgba(${v >= 0 ? '47,125,79' : '166,3,47'},${(t * .55).toFixed(2)})`; }
    const t = hi > lo ? (v - lo) / (hi - lo) : 0; return `background:rgba(166,3,47,${(Math.max(0, Math.min(1, t)) * .5).toFixed(2)})`;
  }
  const charts = {};
  function mkChart(id, cfg) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    const el = document.getElementById(id); if (!el) return;
    if (!window.Chart) { el.parentNode.innerHTML = '<div class="empty">Biblioteca de gráficos indisponível (sem internet?).</div>'; return; }
    const cs = getComputedStyle(document.documentElement);
    Chart.defaults.color = cs.getPropertyValue('--text-muted').trim(); Chart.defaults.font.family = "Inter,system-ui,sans-serif";
    Chart.defaults.borderColor = cs.getPropertyValue('--border').trim();
    charts[id] = new Chart(el, cfg);
  }
  const cor = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const segHtml = (act, cur, opts) => `<div class="seg">${opts.map(([k, n]) => `<button data-a="${act}:${k}" class="${cur === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;

  // ---------------- métricas ----------------
  // a = total 2026, b = total 2025 ({rec,mg,cmv,mk,mgp})
  const MET = {
    rec26: { n: 'Receita 2026', v: (a, b) => a.rec, f: brl },
    rec25: { n: 'Receita 2025', v: (a, b) => b.rec, f: brl },
    var: { n: 'Var. receita %', v: (a, b) => L.vari(a.rec, b.rec), f: varf, div: 1 },
    mg26: { n: 'Margem R$ 2026', v: (a, b) => a.mg, f: brl },
    mgp26: { n: 'Margem % 2026', v: (a, b) => a.mgp, f: v => pct(v) },
    mk26: { n: 'Markup 2026', v: (a, b) => a.mk, f: mkf },
    mk25: { n: 'Markup 2025', v: (a, b) => b.mk, f: mkf },
    dmk: { n: 'Δ Markup vs 2025', v: (a, b) => a.mk != null && b.mk != null ? a.mk - b.mk : null, f: dmkf, div: 1 }
  };

  // ---------------- filtros ----------------
  function optsFiltro(k) {
    if (k === 'canais') return D.canais.slice().sort(ordPt);
    if (k === 'classes') { const gs = S.grupos ? [...S.grupos] : D.grupos; return [...new Set(L.itens.filter(it => gs.includes(it.grupo) && (!S.compradores || S.compradores.has(it.comprador))).map(it => it.classe))].sort(ordPt); }
    if (k === 'fornecedores') return D.fornecedores.slice().sort(ordPt);
    if (k === 'linhas') return D.linhas.slice().sort(ordPt);
    if (k === 'posicoes') return D.posicoes.slice();
  }
  function msel(k, rotulo) {
    const opts = optsFiltro(k), sel = S[k], q = (S.msq[k] || '').toLowerCase();
    const n = sel ? opts.filter(o => sel.has(o)).length : opts.length;
    const lst = opts.filter(o => !q || o.toLowerCase().includes(q)).map(o => `<label><input type="checkbox" data-ms="${k}" value="${esc(o)}" ${!sel || sel.has(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('');
    return `<div class="msel ${S.open === k ? 'open' : ''}"><button data-a="msopen:${k}" class="${sel ? 'on' : ''}">${rotulo}${sel ? ' (' + n + '/' + opts.length + ')' : ''} ▾</button>
      <div class="pn"><div class="top"><button class="btn" data-a="msall:${k}">Todos</button><button class="btn" data-a="msnone:${k}">Limpar</button></div>
      ${opts.length > 8 ? `<input type="search" data-msq="${k}" placeholder="buscar…" value="${esc(S.msq[k] || '')}" style="margin-top:6px">` : ''}<div class="lst" id="lst-${k}">${lst}</div></div></div>`;
  }
  function renderFiltros() {
    const m = mesesComDado.map(x => `<span class="chip ${!S.meses || S.meses.has(x) ? 'on' : ''}" data-a="mes:${x}">${MESES[x - 1]}</span>`).join('');
    const dc = D.meta.diaCorte;
    $('#filtros').innerHTML = `
      <div class="grp"><label>Período</label><div class="seg"><button data-a="modo:ano" class="${S.modo === 'ano' ? 'on' : ''}" title="Meses completos; o mês corrente só até o dia ${dc}, nos dois anos (regra 'Excluir Ano' da planilha)">Ano comparável</button><button data-a="modo:mesmo" class="${S.modo === 'mesmo' ? 'on' : ''}" title="Somente dias 1 a ${dc} de todos os meses (regra 'Excluir' da planilha)">Dias 1–${dc} de cada mês</button></div></div>
      <div class="grp">${msel('classes', 'Classe')}${msel('linhas', 'Linha')}${msel('fornecedores', 'Fornecedor')}${msel('canais', 'Canal')}${msel('posicoes', 'Posição')}</div>
      <div class="grp"><label>Fora de linha</label><select data-sel="foraLinha"><option value="todos" ${S.foraLinha === 'todos' ? 'selected' : ''}>todos</option><option value="sim" ${S.foraLinha === 'sim' ? 'selected' : ''}>só fora de linha</option><option value="nao" ${S.foraLinha === 'nao' ? 'selected' : ''}>só em linha</option></select></div>
      <div class="grp"><label>Meses</label>${m}</div>
      <div class="grp"><input type="search" id="busca" placeholder="código ou nome do item…" value="${esc(S.q)}"><button class="btn" data-a="limpar">Limpar filtros</button></div>
      <div class="ativos" id="ativos">${ativos()}</div>`;
  }

  // ---------------- gaveta (lista de itens) e modal do item ----------------
  const LS = { titulo: '', rows: [], sort: 'rec26', q: '', mes: 0 };
  function abrirLista(titulo, pred, opt) {
    opt = opt || {};
    const f = filtro();
    const res = L.consulta(f, it => pred(it) ? it.i : null, opt.mes ? ((x, it, ano, m) => m === opt.mes) : null);
    LS.rows = [...res].map(([i, acc]) => ({ it: L.itens[i], a: tot(acc, 2026), b: tot(acc, 2025) }));
    LS.titulo = titulo + (opt.mes ? ' · ' + MESES[opt.mes - 1] : ''); LS.sort = 'rec26'; LS.q = '';
    $('#dt').textContent = LS.titulo; renderLista();
    $('#drawer').classList.add('open'); $('#veil').classList.add('on');
  }
  function renderLista() {
    const q = LS.q.toLowerCase();
    let rows = LS.rows.filter(r => !q || r.it.nome.toLowerCase().includes(q) || r.it.cod.includes(q));
    const key = { rec26: r => r.a.rec, rec25: r => r.b.rec, mk26: r => r.a.mk == null ? -1e9 : r.a.mk, var: r => L.vari(r.a.rec, r.b.rec) == null ? -1e9 : L.vari(r.a.rec, r.b.rec) }[LS.sort];
    rows = rows.slice().sort((x, y) => key(y) - key(x));
    const ta = rows.reduce((s, r) => s + r.a.rec, 0), tb = rows.reduce((s, r) => s + r.b.rec, 0), tm = rows.reduce((s, r) => s + r.a.mg, 0), tc = rows.reduce((s, r) => s + r.a.cmv, 0);
    $('#db').innerHTML = `<div class="kv"><div><small>Itens</small><b>${nf0.format(rows.length)}</b></div><div><small>Receita 2026</small><b>${brl(ta)}</b></div><div><small>Receita 2025</small><b>${brl(tb)}</b></div><div><small>Var.</small><b class="${cv(L.vari(ta, tb))}">${varf(L.vari(ta, tb))}</b></div><div><small>Markup 2026</small><b>${mkf(L.mk(ta, tc))}</b></div></div>
      <div class="tools"><input type="search" id="lq" placeholder="buscar no resultado…" value="${esc(LS.q)}">${segHtml('lsort', LS.sort, [['rec26', 'Receita 26'], ['rec25', 'Receita 25'], ['var', 'Var. %'], ['mk26', 'Markup']])}</div>
      <div class="tw" style="max-height:none"><table><thead><tr><th class="l">Item</th><th>Posição</th><th>Rec 26</th><th>Rec 25</th><th>Var.</th><th>Mk 26</th></tr></thead><tbody>${rows.slice(0, 400).map(r => `<tr class="cl" data-a="item:${r.it.i}"><td class="l">${nomeItem(r.it)}</td><td class="l">${posBadge(r.it)}</td><td class="num">${brl(r.a.rec)}</td><td class="num">${brl(r.b.rec)}</td><td class="num ${cv(L.vari(r.a.rec, r.b.rec))}">${varf(L.vari(r.a.rec, r.b.rec))}</td><td class="num">${mkf(r.a.mk)}</td></tr>`).join('')}</tbody></table></div>${rows.length > 400 ? `<div class="nota">Mostrando 400 de ${rows.length}; refine pela busca.</div>` : ''}`;
    const el = $('#lq'); if (el) el.addEventListener('input', e => { LS.q = e.target.value; const pos = e.target.selectionStart; renderLista(); const n = $('#lq'); n.focus(); n.setSelectionRange(pos, pos); });
  }
  const fechar = () => { $('#drawer').classList.remove('open'); $('#veil').classList.remove('on'); $('#modal').classList.remove('on'); };
  function abrirItem(i) {
    const it = L.itens[i], f0 = filtro(); const f = { modo: f0.modo, canais: f0.canais, meses: f0.meses };
    const acc = L.consulta(f, x => x.i === i ? 'k' : null).get('k') || L.novoAcc();
    const a = tot(acc, 2026), b = tot(acc, 2025), ms = mesesComDado.filter(m => !S.meses || S.meses.has(m));
    const cm = L.consulta(Object.assign({}, f, { classes: new Set([it.classe]) }), x => x.i), cl = [...cm].map(([k, ac]) => ({ k, A: tot(ac, 2026) })).sort((x, y) => y.A.rec - x.A.rec), pos0 = cl.findIndex(x => x.k === i), ct = cl.reduce((s, x) => s + x.A.rec, 0), cMk = tot(L.somarAcc([...cm.values()]), 2026).mk;
    const rk = pos0 < 0 ? '–' : `#${pos0 + 1} de ${cl.length} · ${pct(ct ? a.rec / ct : null)} da classe · Mk classe ${mkf(cMk)}`;
    $('#modal').innerHTML = `<button class="x" style="float:right" data-a="fechar">×</button><img class="lgm" src="logo-abra.svg" alt="Abra" style="float:left;margin:0 12px 0 0">
      <div style="display:flex;gap:16px;align-items:center"><img class="thumb lg ${it.foto ? '' : 'semfoto'}" style="width:120px;height:120px" src="${esc(it.foto || 'logo-abra.svg')}" referrerpolicy="no-referrer" alt="">
      <div><h3>${esc(it.nome)}</h3><div class="muted">${esc(it.cod)} · ${esc(it.classe)} · ${esc(it.linha)}</div><div style="margin-top:6px">${posBadge(it)} <span class="muted" style="font-size:12px">${esc(it.sit)}</span></div>${it.link ? `<div style="margin-top:6px"><a href="https://${esc(String(it.link).replace(/^https?:\/\//, ''))}" target="_blank" rel="noopener">ver no site ↗</a></div>` : ''}</div></div>
      <div class="kv"><div><small>Receita 2026</small><b>${brl(a.rec)}</b></div><div><small>Receita 2025</small><b>${brl(b.rec)}</b></div><div><small>Var.</small><b class="${cv(L.vari(a.rec, b.rec))}">${varf(L.vari(a.rec, b.rec))}</b></div><div><small>Margem 2026</small><b>${brl(a.mg)} · ${pct(a.mgp)}</b></div><div><small>Markup 26 / 25</small><b>${mkf(a.mk)} / ${mkf(b.mk)}</b></div></div>
      <div class="kv"><div><small>Fornecedor</small><b style="font-size:14px">${esc(it.fornecedor)}</b></div><div><small>Fabricante (Ritmo)</small><b style="font-size:14px">${esc(it.fab || '–')}</b></div><div><small>Compradora</small><b style="font-size:14px">${esc(cap(it.comprador))}</b></div><div><small>Posição na classe</small><b style="font-size:14px">${rk}</b></div></div>
      <div class="kv"><div><small>Disponível</small><b>${it.disp == null ? '–' : nf0.format(it.disp)}</b></div><div><small>Previsão</small><b>${it.prev == null ? '–' : nf0.format(it.prev)}</b></div><div><small>Preço venda</small><b>${it.preco == null ? '–' : 'R$ ' + nf2.format(it.preco)}</b></div><div><small>Custo</small><b>${it.custo == null ? '–' : 'R$ ' + nf2.format(it.custo)}</b></div><div><small>Ritmo (venda/dia)</small><b>${it.ritmo == null ? '–' : nf2.format(it.ritmo)}</b></div></div>
      <div class="chartbox" style="height:260px"><canvas id="ch-item"></canvas></div><div class="nota">Posição, disponível, preço e custo vêm do relatório Ritmo (${esc(D.meta.ritmo)}).</div>`;
    $('#modal').classList.add('on'); $('#veil').classList.add('on');
    mkChart('ch-item', { type: 'bar', data: { labels: ms.map(m => MESES[m - 1]), datasets: [
      { label: 'Receita 2026', data: ms.map(m => acc.R[2026][m]), backgroundColor: cor('--c26'), order: 2 }, { label: 'Receita 2025', data: ms.map(m => acc.R[2025][m]), backgroundColor: cor('--c25'), order: 3 },
      { type: 'line', label: 'Markup 2026', data: ms.map(m => L.mk(acc.R[2026][m], acc.C[2026][m])), yAxisID: 'y2', borderColor: cor('--gold'), backgroundColor: cor('--gold'), tension: .25, order: 1, spanGaps: true }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => brlc(v) } }, y2: { position: 'right', grid: { drawOnChartArea: false } } }, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.dataset.yAxisID === 'y2' ? mkf(c.parsed.y) : brl(c.parsed.y)) } } } } });
  }

  // ---------------- aba: Resumo ----------------
  function vResumo() {
    const f = filtro(), acc = um('x', f), p = { a: tot(acc, 2026), b: tot(acc, 2025) };
    const nIt = L.consulta(f, it => it.i); let com26 = 0; for (const [, a] of nIt) if (tot(a, 2026).rec > 0) com26++;
    const kpi = (l, v, d, dc) => `<div class="card kpi" data-a="kpi"><div class="l">${l}</div><div class="v num">${v}</div><div class="d ${dc || ''}">${d}</div></div>`;
    const grp = [...L.consulta(f, it => it.grupo)].sort((x, y) => tot(y[1], 2026).rec - tot(x[1], 2026).rec);
    return `<div class="grid g4">
      ${kpi('Receita 2026', brlc(p.a.rec), `${varf(L.vari(p.a.rec, p.b.rec))} vs 2025 (${brlc(p.b.rec)})`, cv(L.vari(p.a.rec, p.b.rec)))}
      ${kpi('Margem 2026', brlc(p.a.mg), `${pct(p.a.mgp)} da receita · 2025: ${pct(p.b.mgp)}`, p.a.mgp != null && p.b.mgp != null ? cv(p.a.mgp - p.b.mgp) : '')}
      ${kpi('Markup 2026', mkf(p.a.mk), `2025: ${mkf(p.b.mk)} · Δ ${dmkf(p.a.mk != null && p.b.mk != null ? p.a.mk - p.b.mk : null)}`, p.a.mk != null && p.b.mk != null ? cv(p.a.mk - p.b.mk) : '')}
      ${kpi('Itens com venda em 2026', nf0.format(com26), `${nf0.format(nIt.size)} itens no filtro (2025 ou 2026)`)}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><div class="hd"><h3>Mês a mês · 2026 × 2025</h3><div class="sp"></div>${segHtml('rvm', S.rVisaoMes, [['rec', 'Receita'], ['mg', 'Margem R$'], ['mk', 'Markup'], ['mgp', 'Margem %'], ['var', 'Var. %']])}</div><div class="chartbox"><canvas id="ch-mes"></canvas></div><div class="nota">Clique numa barra para ver os itens do mês.</div></div>
      <div class="card"><div class="hd"><h3>Classes</h3><div class="sp"></div>${segHtml('rvc', S.rVisaoCls, [['rec', 'Receita 26'], ['var', 'Var. %'], ['mk', 'Markup'], ['part', 'Participação']])}<select data-sel="rTop">${[8, 12, 20, 30].map(n => `<option value="${n}" ${S.rTop === n ? 'selected' : ''}>top ${n}</option>`).join('')}</select></div><div class="chartbox"><canvas id="ch-cls"></canvas></div><div class="nota">Clique numa barra para abrir a classe em Classe × Linha × Recurso.</div></div></div>
    <div class="card" style="margin-top:16px"><div class="hd"><h3>INF DEC × ADT DEC</h3></div><div class="tw" style="max-height:none"><table><thead><tr><th class="l">Grupo</th><th>Rec 26</th><th>Rec 25</th><th>Var.</th><th>Mg 26</th><th>Mg % 26</th><th>Mk 26</th><th>Mk 25</th><th>% da receita</th></tr></thead><tbody>${grp.map(([g, a]) => { const A = tot(a, 2026), B = tot(a, 2025); return `<tr><td class="l"><b>${esc(g)}</b></td><td class="num cl" data-a="lista-g:${esc(g)}">${brl(A.rec)}</td><td class="num">${brl(B.rec)}</td><td class="num ${cv(L.vari(A.rec, B.rec))}">${varf(L.vari(A.rec, B.rec))}</td><td class="num">${brl(A.mg)}</td><td class="num">${pct(A.mgp)}</td><td class="num">${mkf(A.mk)}</td><td class="num">${mkf(B.mk)}</td><td class="num">${pct(p.a.rec ? A.rec / p.a.rec : null)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  }
  function posResumo() {
    const f = filtro(), ms = mesesComDado.filter(m => !S.meses || S.meses.has(m)), acc = um('x', f), v = S.rVisaoMes;
    const val = (y, m) => { const t = L.totMes(acc, y, m); return v === 'rec' ? t.rec : v === 'mg' ? t.mg : v === 'mk' ? t.mk : t.mgp; };
    const fm = v === 'rec' || v === 'mg' ? brl : v === 'mk' ? mkf : pct;
    const ds = v === 'var' ? [{ label: 'Var. receita % vs 2025', data: ms.map(m => L.vari(acc.R[2026][m], acc.R[2025][m])), backgroundColor: ms.map(m => (L.vari(acc.R[2026][m], acc.R[2025][m]) || 0) >= 0 ? cor('--ok') : cor('--bad')) }]
      : [{ label: '2026', data: ms.map(m => val(2026, m)), backgroundColor: cor('--c26') }, { label: '2025', data: ms.map(m => val(2025, m)), backgroundColor: cor('--c25') }];
    mkChart('ch-mes', { type: 'bar', data: { labels: ms.map(m => MESES[m - 1]), datasets: ds }, options: { responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (els.length) abrirLista('Itens', () => true, { mes: ms[els[0].index] }); }, scales: { y: { ticks: { callback: x => v === 'var' || v === 'mgp' ? pct(x, 0) : v === 'mk' ? mkf(x) : brlc(x) } } }, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (v === 'var' ? varf(c.parsed.y) : fm(c.parsed.y)) } } } } });
    const cls = [...L.consulta(f, it => it.classe)].map(([k, a]) => ({ k, A: tot(a, 2026), B: tot(a, 2025) })), tr = cls.reduce((s, c) => s + c.A.rec, 0), w = S.rVisaoCls;
    const vf = c => w === 'rec' ? c.A.rec : w === 'var' ? L.vari(c.A.rec, c.B.rec) : w === 'mk' ? c.A.mk : (tr ? c.A.rec / tr : null);
    let top = cls.filter(c => w === 'var' ? c.B.rec > 0 && c.A.rec > 0 : w === 'mk' ? c.A.mk != null : true).sort((x, y) => w === 'rec' || w === 'part' ? y.A.rec - x.A.rec : (vf(y) - vf(x)));
    if (w === 'var' || w === 'mk') top = cls.filter(c => c.A.rec > 0 && c.B.rec > 0 && vf(c) != null).sort((x, y) => (y.A.rec) - (x.A.rec)).slice(0, S.rTop).sort((x, y) => vf(y) - vf(x)); else top = top.slice(0, S.rTop);
    const ff = w === 'rec' ? brl : w === 'var' ? varf : w === 'mk' ? mkf : pct;
    mkChart('ch-cls', { type: 'bar', data: { labels: top.map(c => c.k), datasets: [{ data: top.map(vf), backgroundColor: top.map(c => cor('--c26')) }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (els.length) { S.xCls = top[els[0].index].k; S.xVis = 'recurso'; setTab('cxl'); } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ff(c.parsed.x) } } }, scales: { x: { ticks: { callback: x => w === 'rec' ? brlc(x) : w === 'mk' ? mkf(x) : pct(x, 0) } } } } });
  }

  // ---------------- aba: Anual (árvore) ----------------
  const ORD = { cl: ['grupo', 'classe', 'linha'], lc: ['grupo', 'linha', 'classe'], fc: ['fornecedor', 'classe', 'linha'], cf: ['grupo', 'classe', 'fornecedor'] };
  const NOMES_NIVEL = { grupo: 'Grupo', classe: 'Classe', linha: 'Linha', fornecedor: 'Fornecedor' };
  function vAnual() {
    const ord = ORD[S.aOrdem], f = filtro();
    const res = L.consulta(f, it => { const p = [it[ord[0]], it[ord[1]], it[ord[2]], it.cod]; const out = []; let k = ''; for (let n = 0; n < 4; n++) { k = n ? k + SEP + p[n] : p[0]; out.push(k); } return out; });
    const kids = new Map(); const roots = [];
    for (const k of res.keys()) { const i = k.lastIndexOf(SEP); if (i < 0) roots.push(k); else { const p = k.slice(0, i); if (!kids.has(p)) kids.set(p, []); kids.get(p).push(k); } }
    const sv = k => { const a = res.get(k), A = tot(a, 2026), B = tot(a, 2025), m = MET[S.aSort] || MET.rec26; const v = m.v(A, B); return v == null ? -1e12 : v; };
    const tc = res.size ? [...roots].reduce((s, k) => s + tot(res.get(k), 2026).rec, 0) : 0;
    const cols = S.aCols, show = { rec: 1, mg: cols !== 'mk' && cols !== 'rec', mk: cols !== 'rec' };
    let rows = '';
    const draw = (k, nv, paiRec) => {
      const a = res.get(k), A = tot(a, 2026), B = tot(a, 2025), seg = k.split(SEP).pop(), ab = S.aAbertos.has(k), temF = kids.has(k);
      const it = nv === 3 ? porCod.get(seg) : null;
      const nome = nv === 3 ? `<div class="nm" style="padding-left:${nv * 14}px">${thumb(it, 'sm')}<div><b>${esc(it.nome)}</b><small>${esc(it.cod)} · ${posBadge(it)}</small></div></div>`
        : `<span style="padding-left:${nv * 18}px"><span class="tg" data-a="tg:${esc(k)}">${temF ? (ab ? '▾' : '▸') : ''}</span><span data-a="tg:${esc(k)}" style="cursor:pointer">${esc(seg)}</span></span>`;
      rows += `<tr class="lv${nv}"><td class="l">${nome}</td>
        <td class="num cl" data-a="ln:${esc(k)}">${brl(A.rec)}</td><td class="num">${brl(B.rec)}</td><td class="num ${cv(L.vari(A.rec, B.rec))}">${varf(L.vari(A.rec, B.rec))}</td>
        ${show.mg ? `<td class="num">${brl(A.mg)}</td><td class="num">${pct(A.mgp)}</td>` : ''}
        ${show.mk ? `<td class="num">${mkf(A.mk)}</td><td class="num">${mkf(B.mk)}</td><td class="num ${cv(A.mk != null && B.mk != null ? A.mk - B.mk : null)}">${dmkf(A.mk != null && B.mk != null ? A.mk - B.mk : null)}</td>` : ''}
        <td class="num"><div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">${pct(paiRec ? A.rec / paiRec : null)}<div class="bar" style="width:46px"><i style="width:${Math.min(100, paiRec ? 100 * A.rec / paiRec : 0)}%"></i></div></div></td></tr>`;
      if (ab && temF) kids.get(k).sort((x, y) => sv(y) - sv(x)).forEach(c => draw(c, nv + 1, A.rec));
    };
    roots.sort((x, y) => sv(y) - sv(x)).forEach(k => draw(k, 0, tc));
    const th = (m, n) => `<th class="${S.aSort === m ? 'on' : ''}" data-a="asort:${m}">${n}${S.aSort === m ? ' ▼' : ''}</th>`;
    return `<div class="card"><div class="hd"><h3>Anual · ${NOMES_NIVEL[ord[1]]} › ${NOMES_NIVEL[ord[2]]} › Item</h3><div class="sp"></div>
      ${segHtml('aord', S.aOrdem, [['cl', 'Classe › Linha'], ['lc', 'Linha › Classe'], ['cf', 'Classe › Fornecedor'], ['fc', 'Fornecedor › Classe']])}${segHtml('acols', S.aCols, [['full', 'Tudo'], ['rec', 'Só receita'], ['mk', 'Receita + markup']])}
      <button class="btn" data-a="aexp">Expandir 1 nível</button><button class="btn" data-a="acol">Recolher</button></div>
      <div class="tw"><table><thead><tr><th class="l">${NOMES_NIVEL[ord[0]]} / ${NOMES_NIVEL[ord[1]]} / ${NOMES_NIVEL[ord[2]]} / Item</th>${th('rec26', 'Receita 26')}${th('rec25', 'Receita 25')}${th('var', 'Var.')}${show.mg ? th('mg26', 'Margem 26') + th('mgp26', 'Mg %') : ''}${show.mk ? th('mk26', 'Mk 26') + th('mk25', 'Mk 25') + th('dmk', 'Δ Mk') : ''}<th>% do nível acima</th></tr></thead><tbody>${rows || '<tr><td class="empty" colspan="12">Sem dados para o filtro.</td></tr>'}</tbody></table></div>
      <div class="nota">Mk = (Receita − CMV) ÷ CMV, igual à planilha. Clique na seta/nome para abrir o nível; clique na receita para ver os itens que compõem o número; clique num item para o detalhe.</div></div>`;
  }
  const predDe = (k, ord) => { const p = k.split(SEP); return it => { for (let n = 0; n < p.length; n++) { const v = n < 3 ? it[ord[n]] : it.cod; if (v !== p[n]) return false; } return true; }; };

  // ---------------- aba: Mensal ----------------
  function vMensal() {
    const f = filtro(), dim = S.mDim, ms = mesesComDado.filter(m => !S.meses || S.meses.has(m));
    const res = L.consulta(f, it => dim === 'item' ? it.cod : it[dim]);
    const totAll = L.somarAcc([...res.values()]);
    let rows = [...res].map(([k, a]) => ({ k, a, t: tot(a, 2026).rec })).sort((x, y) => y.t - x.t);
    const nTot = rows.length; if (rows.length > S.mTop) rows = rows.slice(0, S.mTop);
    const met = MET[S.mMet];
    const cell = (acc, m, tot_) => { const a = m ? L.totMes(acc, 2026, m) : tot(acc, 2026), b = m ? L.totMes(acc, 2025, m) : tot(acc, 2025); return met.v(a, b); };
    const vals = []; rows.forEach(r => ms.forEach(m => { const v = cell(r.a, m); if (v != null && isFinite(v)) vals.push(v); }));
    let lo = Math.min(...vals), hi = Math.max(...vals); if (met.div) { lo = -1; hi = 1; }
    const linha = (k, a, rotulo, cls) => `<tr class="${cls || ''}"><td class="l" ${k != null ? `data-a="msel:${esc(k)}" style="cursor:pointer"` : ''}>${rotulo}</td>${ms.map(m => { const v = cell(a, m); return `<td class="num v" style="${heat(v, lo, hi, met.div)}" data-a="mcel:${esc(k == null ? '' : k)}:${m}">${v == null ? '–' : met.f(v)}</td>`; }).join('')}<td class="num v" style="font-weight:700" data-a="mcel:${esc(k == null ? '' : k)}:0">${(() => { const v = cell(a, 0); return v == null ? '–' : met.f(v); })()}</td></tr>`;
    const nomeDe = k => dim === 'item' ? (porCod.get(k) ? porCod.get(k).nome + ' (' + k + ')' : k) : k;
    const sel = S.mSel != null && res.has(S.mSel) ? S.mSel : null;
    const metOpts = Object.keys(MET).map(k => `<option value="${k}" ${S.mMet === k ? 'selected' : ''}>${MET[k].n}</option>`).join('');
    return `<div class="card"><div class="hd"><h3>Mensal · ${esc(sel ? nomeDe(sel) : 'total do filtro')}</h3><div class="sp"></div>${sel ? '<button class="btn" data-a="msel:">ver total</button>' : ''}</div><div class="chartbox" style="height:260px"><canvas id="ch-mensal"></canvas></div></div>
      <div class="card" style="margin-top:16px"><div class="hd"><h3>Mapa mês a mês</h3><div class="sp"></div>${segHtml('mdim', dim, [['grupo', 'Grupo'], ['classe', 'Classe'], ['linha', 'Linha'], ['fornecedor', 'Fornecedor'], ['item', 'Item']])}<select data-sel="mMet">${metOpts}</select><select data-sel="mTop">${[20, 40, 80, 200].map(n => `<option value="${n}" ${S.mTop === n ? 'selected' : ''}>top ${n}</option>`).join('')}</select></div>
      <div class="tw"><table class="hm"><thead><tr><th class="l">${{ grupo: 'Grupo', classe: 'Classe', linha: 'Linha', fornecedor: 'Fornecedor', item: 'Item' }[dim]}</th>${ms.map(m => `<th>${MESES[m - 1]}</th>`).join('')}<th>Total</th></tr></thead><tbody>${linha(null, totAll, '<b>Total do filtro</b>', 'lv0')}${rows.map(r => linha(r.k, r.a, esc(nomeDe(r.k)))).join('')}</tbody></table></div>
      <div class="nota">${nTot > rows.length ? `Mostrando ${rows.length} de ${nTot}. ` : ''}Verde/vermelho = variação vs. 2025; clique numa célula para abrir os itens (mês ou total); clique no nome da linha para ver o gráfico dela.</div></div>`;
  }
  function posMensal() {
    const f = filtro(), dim = S.mDim, ms = mesesComDado.filter(m => !S.meses || S.meses.has(m));
    const res = L.consulta(f, it => dim === 'item' ? it.cod : it[dim]);
    const acc = S.mSel != null && res.has(S.mSel) ? res.get(S.mSel) : L.somarAcc([...res.values()]);
    mkChart('ch-mensal', { type: 'bar', data: { labels: ms.map(m => MESES[m - 1]), datasets: [
      { label: 'Receita 2026', data: ms.map(m => acc.R[2026][m]), backgroundColor: cor('--c26'), order: 2 }, { label: 'Receita 2025', data: ms.map(m => acc.R[2025][m]), backgroundColor: cor('--c25'), order: 3 },
      { type: 'line', label: 'Markup 2026', data: ms.map(m => L.mk(acc.R[2026][m], acc.C[2026][m])), yAxisID: 'y2', borderColor: cor('--gold'), backgroundColor: cor('--gold'), tension: .25, order: 1, spanGaps: true },
      { type: 'line', label: 'Markup 2025', data: ms.map(m => L.mk(acc.R[2025][m], acc.C[2025][m])), yAxisID: 'y2', borderColor: cor('--blue'), backgroundColor: cor('--blue'), borderDash: [5, 4], tension: .25, order: 1, spanGaps: true }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { callback: v => brlc(v) } }, y2: { position: 'right', grid: { drawOnChartArea: false } } }, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + (c.dataset.yAxisID === 'y2' ? mkf(c.parsed.y) : brl(c.parsed.y)) } } } } });
  }

  // ---------------- aba: Itens (markup por item) ----------------
  const COLS_IT = [['rec26', 'Rec 26', r => r.a.rec], ['rec25', 'Rec 25', r => r.b.rec], ['var', 'Var.', r => L.vari(r.a.rec, r.b.rec)], ['mg26', 'Mg 26', r => r.a.mg], ['mgp', 'Mg %', r => r.a.mgp], ['mk26', 'Mk 26', r => r.a.mk], ['mk25', 'Mk 25', r => r.b.mk], ['dmk', 'Δ Mk', r => r.a.mk != null && r.b.mk != null ? r.a.mk - r.b.mk : null], ['share', '% na classe', r => r.share]];
  function itensRows() {
    const f = filtro(), res = L.consulta(f, it => it.i), cls = L.consulta(f, it => it.classe);
    const ct = new Map([...cls].map(([k, a]) => [k, tot(a, 2026).rec]));
    let rows = [...res].map(([i, acc]) => { const it = L.itens[i], a = tot(acc, 2026), b = tot(acc, 2025); return { it, a, b, share: ct.get(it.classe) ? a.rec / ct.get(it.classe) : null }; });
    rows = rows.filter(r => (!S.iSo26 || r.a.rec > 0) && r.a.rec >= (S.iMin || 0) && (S.iMkMin === '' || (r.a.mk != null && r.a.mk >= +S.iMkMin)) && (S.iMkMax === '' || (r.a.mk != null && r.a.mk <= +S.iMkMax)));
    const g = (COLS_IT.find(c => c[0] === S.iSort) || COLS_IT[0])[2];
    rows.sort((x, y) => { const a = g(x), b = g(y); return (a == null ? -1e12 : a) < (b == null ? -1e12 : b) ? -S.iDir : (a == null ? -1e12 : a) > (b == null ? -1e12 : b) ? S.iDir : 0; });
    return rows;
  }
  function vItens() {
    const rows = itensRows(), pg = 100, np = Math.max(1, Math.ceil(rows.length / pg)); if (S.iPag >= np) S.iPag = np - 1;
    const sl = rows.slice(S.iPag * pg, (S.iPag + 1) * pg);
    const fmts = { rec26: brl, rec25: brl, var: varf, mg26: brl, mgp: pct, mk26: mkf, mk25: mkf, dmk: dmkf, share: pct };
    return `<div class="card"><div class="hd"><h3>Itens · receita, margem e markup</h3><span class="muted">${nf0.format(rows.length)} itens</span><div class="sp"></div>
      <label class="muted" style="font-size:12px">Receita 26 ≥ <input type="number" data-num="iMin" value="${S.iMin || ''}" placeholder="0" style="width:90px"></label>
      <label class="muted" style="font-size:12px">Mk de <input type="number" step="0.1" data-num="iMkMin" value="${S.iMkMin}" style="width:70px"> até <input type="number" step="0.1" data-num="iMkMax" value="${S.iMkMax}" style="width:70px"></label>
      <span class="chip ${S.iSo26 ? 'on' : ''}" data-a="iso26">só com venda em 2026</span><button class="btn" data-a="icsv">Baixar CSV</button></div>
      <div class="tw"><table><thead><tr><th class="l">Item</th><th class="l">Posição</th>${COLS_IT.map(c => `<th class="${S.iSort === c[0] ? 'on' : ''}" data-a="isort:${c[0]}">${c[1]}${S.iSort === c[0] ? (S.iDir < 0 ? ' ▼' : ' ▲') : ''}</th>`).join('')}</tr></thead><tbody>
      ${sl.map(r => `<tr class="cl" data-a="item:${r.it.i}"><td class="l">${nomeItem(r.it, ' · ' + esc(r.it.classe))}</td><td class="l">${posBadge(r.it)}</td>${COLS_IT.map(c => { const v = c[2](r); return `<td class="num ${['var', 'dmk'].includes(c[0]) ? cv(v) : ''}">${fmts[c[0]](v)}</td>`; }).join('')}</tr>`).join('') || '<tr><td colspan="12" class="empty">Nenhum item.</td></tr>'}</tbody></table></div>
      <div class="pager"><button class="btn" data-a="ipag:-1">‹</button><span>página ${S.iPag + 1} de ${np}</span><button class="btn" data-a="ipag:1">›</button></div></div>`;
  }
  function baixarCsv() {
    const rows = itensRows(), q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"', n = v => v == null ? '' : String(v).replace('.', ',');
    const h = ['Código', 'Produto', 'Grupo', 'Classe', 'Linha', 'Fornecedor', 'Compradora', 'Posição', 'Situação Ritmo', 'Fora de linha', 'Disponível', 'Receita 2026', 'Receita 2025', 'Var %', 'Margem 2026', 'Mg %', 'Markup 2026', 'Markup 2025', '% na classe'];
    const csv = [h.map(q).join(';')].concat(rows.map(r => [r.it.cod, r.it.nome, r.it.grupo, r.it.classe, r.it.linha, r.it.fornecedor, r.it.comprador, r.it.posTipo, r.it.sit, r.it.fl ? 'sim' : 'não', n(r.it.disp), n(r.a.rec.toFixed(2)), n(r.b.rec.toFixed(2)), n(L.vari(r.a.rec, r.b.rec)), n(r.a.mg.toFixed(2)), n(r.a.mgp), n(r.a.mk), n(r.b.mk), n(r.share)].map((v, i) => i < 11 ? q(v) : v).join(';'))).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = 'receita_dec_itens.csv'; a.click();
  }

  // ---------------- aba: Top por linha ----------------
  function vTop() {
    const f = filtro(), itens = L.consulta(f, it => it.i), lin = L.consulta(f, it => it.linha);
    const key = { rec: r => r.a.rec, mg: r => r.a.mg, cresc: r => r.a.rec - r.b.rec }[S.tOrd];
    const por = new Map();
    for (const [i, acc] of itens) { const it = L.itens[i]; if (!por.has(it.linha)) por.set(it.linha, []); por.get(it.linha).push({ it, a: tot(acc, 2026), b: tot(acc, 2025) }); }
    let linhas = [...lin].map(([k, a]) => ({ k, A: tot(a, 2026), B: tot(a, 2025) })).filter(x => x.A.rec > 0 || x.B.rec > 0).sort((x, y) => y.A.rec - x.A.rec);
    const total = linhas.length; if (!S.tAll) linhas = linhas.slice(0, 24);
    let alertas = [];
    const cards = linhas.map(l => {
      const tp = (por.get(l.k) || []).filter(r => S.tOrd !== 'cresc' || true).sort((x, y) => key(y) - key(x)).slice(0, S.tN);
      tp.forEach(r => { if (semVenda(r.it) && r.a.rec > 0) alertas.push(r.it.i); });
      return `<div class="card lcard"><div class="lh" data-a="lin:${esc(l.k)}"><h4>${esc(l.k)}</h4><span class="num"><b>${brlc(l.A.rec)}</b></span></div><div class="muted" style="font-size:12px;margin-bottom:6px">${varf(L.vari(l.A.rec, l.B.rec))} vs 2025 · Mk ${mkf(l.A.mk)} · Mg ${pct(l.A.mgp)}</div>
        ${tp.map((r, n) => `<div class="top1" data-a="item:${r.it.i}"><span class="rk">${n + 1}</span>${thumb(r.it)}<div class="nm"><div><b>${esc(r.it.nome)}</b><small>${esc(r.it.cod)} · ${esc(r.it.classe.replace(/^(INF|ADT) DEC /, ''))} · <i>${esc(r.it.fornecedor)}</i></small><br>${posBadge(r.it)}</div></div><div class="vl"><b>${brl(r.a.rec)}</b><br><span class="${cv(L.vari(r.a.rec, r.b.rec))}">${varf(L.vari(r.a.rec, r.b.rec))}</span> · Mk ${mkf(r.a.mk)}</div></div>`).join('') || '<div class="muted">Sem itens.</div>'}</div>`;
    }).join('');
    alertas = [...new Set(alertas)];
    window.__alertas = alertas;
    return `<div class="card" style="margin-bottom:16px"><div class="hd"><h3>Mais vendidos de cada linha</h3><div class="sp"></div><span class="muted" style="font-size:12px">ordenar por</span>${segHtml('tord', S.tOrd, [['rec', 'Receita 26'], ['mg', 'Margem R$'], ['cresc', 'Crescimento R$']])}<select data-sel="tN">${[3, 5, 10].map(n => `<option value="${n}" ${S.tN === n ? 'selected' : ''}>top ${n}</option>`).join('')}</select></div>
      ${alertas.length ? `<div class="alerta" data-a="alertas">⚠ ${alertas.length} dos itens listados estão com venda suspensa, sem posição ou fora de linha. Clique para ver a lista.</div>` : '<div class="muted">Nenhum dos itens listados está suspenso ou fora de linha.</div>'}
      <div class="lines">${cards}</div>${total > linhas.length ? `<div class="pager"><button class="btn" data-a="tall">Mostrar as ${total} linhas</button></div>` : ''}
      <div class="nota">A etiqueta de posição vem do relatório Ritmo: Imediata (com saldo), Encomenda/Prazo (dias), Estoque loja, Suspensa; "FL" = fora de linha. Clique no item para detalhe, no nome da linha para ver a linha na árvore anual.</div></div>`;
  }

  // ---------------- aba: Classe × Linha × Recurso ----------------
  function vCxL() {
    const sub = segHtml('xvis', S.xVis, [['matriz', 'Matriz Classe × Linha'], ['recurso', 'Recurso dentro da classe']]);
    return S.xVis === 'matriz' ? vMatriz(sub) : vRecurso(sub);
  }
  function vMatriz(sub) {
    const f = filtro(), res = L.consulta(f, it => it.classe + SEP + it.linha), cls = L.consulta(f, it => it.classe), lin = L.consulta(f, it => it.linha);
    const topL = [...lin].sort((x, y) => tot(y[1], 2026).rec - tot(x[1], 2026).rec).slice(0, 14).map(x => x[0]), lset = new Set(topL);
    const classes = [...cls].sort((x, y) => tot(y[1], 2026).rec - tot(x[1], 2026).rec).map(x => x[0]);
    const w = S.xMat, tl = new Map([...lin].map(([k, a]) => [k, tot(a, 2026).rec])), tcl = new Map([...cls].map(([k, a]) => [k, tot(a, 2026).rec]));
    const val = (c, l) => { const a = res.get(c + SEP + l); if (!a) return null; const A = tot(a, 2026), B = tot(a, 2025); return w === 'linhaNaClasse' ? (tcl.get(c) ? A.rec / tcl.get(c) : null) : w === 'classeNaLinha' ? (tl.get(l) ? A.rec / tl.get(l) : null) : w === 'rec' ? A.rec : w === 'mk' ? A.mk : L.vari(A.rec, B.rec); };
    const fm = w === 'rec' ? brlc : w === 'mk' ? mkf : w === 'var' ? varf : (v => pct(v, 0));
    const vs = []; classes.forEach(c => topL.forEach(l => { const v = val(c, l); if (v != null && isFinite(v)) vs.push(v); }));
    let lo = Math.min(...vs), hi = Math.max(...vs), div = w === 'var'; if (div) { lo = -1; hi = 1; }
    return `<div class="card"><div class="hd"><h3>Classe × Linha</h3><div class="sp"></div>${sub}
      <select data-sel="xMat">${[['linhaNaClasse', '% da linha dentro da classe'], ['classeNaLinha', '% da classe dentro da linha'], ['rec', 'Receita 2026 (R$)'], ['mk', 'Markup 2026'], ['var', 'Var. receita vs 2025']].map(([k, n]) => `<option value="${k}" ${w === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="tw"><table class="hm"><thead><tr><th class="l">Classe \\ Linha (top 14 por receita)</th>${topL.map(l => `<th title="${esc(l)}" style="max-width:110px;overflow:hidden;text-overflow:ellipsis">${esc(l)}</th>`).join('')}<th>Demais linhas</th><th>Classe (R$)</th></tr></thead><tbody>
      ${classes.map(c => { const dem = [...res].filter(([k]) => k.startsWith(c + SEP) && !lset.has(k.split(SEP)[1])); const demRec = dem.reduce((s, [, a]) => s + tot(a, 2026).rec, 0); const demV = w === 'linhaNaClasse' ? (tcl.get(c) ? demRec / tcl.get(c) : null) : w === 'rec' ? demRec : null;
        return `<tr><td class="l cl" data-a="xcls:${esc(c)}"><b>${esc(c)}</b></td>${topL.map(l => { const v = val(c, l); return `<td class="num v" style="${heat(v, lo, hi, div)}" data-a="xcel:${esc(c)}${SEP}${esc(l)}">${v == null ? '' : fm(v)}</td>`; }).join('')}<td class="num v" data-a="xcel:${esc(c)}${SEP}*">${demV == null ? '' : fm(demV)}</td><td class="num"><b>${brl(tcl.get(c))}</b></td></tr>`; }).join('')}</tbody></table></div>
      <div class="nota">${w === 'linhaNaClasse' ? 'Cada linha da tabela soma 100% da classe (considerando também as demais linhas).' : w === 'classeNaLinha' ? 'Cada coluna soma 100% da linha.' : ''} Clique numa célula para ver os itens; clique no nome da classe para abrir os recursos dela.</div></div>`;
  }
  function vRecurso(sub) {
    const f = filtro(), clsAll = [...L.consulta(f, it => it.classe)].sort((x, y) => tot(y[1], 2026).rec - tot(x[1], 2026).rec);
    if (!clsAll.length) return `<div class="card"><div class="hd"><h3>Recurso dentro da classe</h3><div class="sp"></div>${sub}</div><div class="empty">Sem dados no filtro.</div></div>`;
    if (!S.xCls || !clsAll.find(x => x[0] === S.xCls)) S.xCls = clsAll[0][0];
    const cname = S.xCls, f2 = Object.assign({}, f, { classes: new Set([cname]) });
    const linhasC = [...L.consulta(f2, it => it.linha)].sort((x, y) => tot(y[1], 2026).rec - tot(x[1], 2026).rec);
    const fl = S.xLin && linhasC.find(x => x[0] === S.xLin) ? S.xLin : null; S.xLin = fl;
    const res = L.consulta(f2, it => it.i, fl ? (x, it) => it.linha === fl : null);
    const clsT = tot(L.somarAcc([...L.consulta(f2, it => it.i).values()]), 2026), clsT25 = tot(L.somarAcc([...L.consulta(f2, it => it.i).values()]), 2025);
    const grpT = tot(um('g', Object.assign({}, f, { classes: null, grupos: new Set([D.grupos.find(g => cname.startsWith(g)) || cname.slice(0, 7)]) })), 2026);
    const rows = [...res].map(([i, acc]) => ({ it: L.itens[i], a: tot(acc, 2026), b: tot(acc, 2025) })).filter(r => r.a.rec > 0 || r.b.rec > 0).sort((x, y) => y.a.rec - x.a.rec);
    const base = rows.reduce((s, r) => s + r.a.rec, 0), base25 = rows.reduce((s, r) => s + r.b.rec, 0), linT = new Map(); rows.forEach(r => linT.set(r.it.linha, (linT.get(r.it.linha) || 0) + r.a.rec));
    let ac = 0; rows.forEach(r => { ac += r.a.rec; r.ac = base ? ac / base : null; r.abc = r.ac == null ? '' : (r.ac - r.a.rec / base) < .8 ? 'A' : (r.ac - r.a.rec / base) < .95 ? 'B' : 'C'; r.sh = base ? r.a.rec / base : null; r.sh25 = base25 ? r.b.rec / base25 : null; });
    window.__recRows = rows;
    const nA = rows.filter(r => r.abc === 'A').length;
    return `<div class="card"><div class="hd"><h3>Recurso dentro da classe</h3><div class="sp"></div>${sub}
      <select data-sel="xCls">${clsAll.map(([k]) => `<option ${k === cname ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>
      <select data-sel="xLin"><option value="">todas as linhas</option>${linhasC.map(([k]) => `<option ${k === fl ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
      <div class="kv"><div><small>Receita da classe 2026</small><b>${brl(clsT.rec)}</b></div><div><small>Var. vs 2025</small><b class="${cv(L.vari(clsT.rec, clsT25.rec))}">${varf(L.vari(clsT.rec, clsT25.rec))}</b></div><div><small>% do grupo</small><b>${pct(grpT.rec ? clsT.rec / grpT.rec : null)}</b></div><div><small>Markup 26 / 25</small><b>${mkf(clsT.mk)} / ${mkf(clsT25.mk)}</b></div><div><small>Itens com venda</small><b>${rows.filter(r => r.a.rec > 0).length}</b></div><div><small>Itens classe A (80%)</small><b>${nA}</b></div></div>
      <div class="grid g2"><div class="card"><div class="hd"><h3>Mix da classe por linha</h3></div><div class="chartbox" style="height:300px"><canvas id="ch-mix"></canvas></div></div>
      <div class="card"><div class="hd"><h3>Pareto dos recursos</h3></div><div class="chartbox" style="height:300px"><canvas id="ch-par"></canvas></div></div></div>
      <div class="tw" style="margin-top:14px"><table><thead><tr><th class="l">#  Recurso</th><th class="l">Posição</th><th>Rec 26</th><th>% na classe</th><th>% acum.</th><th>ABC</th><th>% na linha</th><th>% na classe 2025</th><th>Δ part. (pp)</th><th>Var.</th><th>Mk 26</th></tr></thead><tbody>
      ${rows.slice(0, S.xTop).map((r, n) => `<tr class="cl" data-a="item:${r.it.i}"><td class="l">${nomeItem(r.it, '').replace('<div class="nm">', `<div class="nm"><span class="muted" style="width:22px">${n + 1}</span>`)}</td><td class="l">${posBadge(r.it)}</td><td class="num">${brl(r.a.rec)}</td><td class="num">${pct(r.sh)}</td><td class="num">${pct(r.ac)}</td><td class="num"><span class="bdg ${r.abc === 'A' ? 'ok' : r.abc === 'B' ? 'warn' : 'gray'}">${r.abc}</span></td><td class="num">${pct(linT.get(r.it.linha) ? r.a.rec / linT.get(r.it.linha) : null)}</td><td class="num">${pct(r.sh25)}</td><td class="num ${cv(r.sh25 != null && r.sh != null ? r.sh - r.sh25 : null)}">${r.sh != null && r.sh25 != null ? ((r.sh - r.sh25) * 100 > 0 ? '+' : '') + ((r.sh - r.sh25) * 100).toFixed(1).replace('.', ',') : '–'}</td><td class="num ${cv(L.vari(r.a.rec, r.b.rec))}">${varf(L.vari(r.a.rec, r.b.rec))}</td><td class="num">${mkf(r.a.mk)}</td></tr>`).join('')}</tbody></table></div>
      ${rows.length > S.xTop ? `<div class="pager"><span class="muted">${S.xTop} de ${rows.length} recursos</span><button class="btn" data-a="xmais">Mostrar mais 50</button></div>` : ''}
      <div class="nota">% na classe = receita do recurso ÷ receita da classe (no filtro). ABC por receita acumulada (A até 80%, B até 95%). "% na linha" = peso do recurso dentro da própria linha, nesta classe.</div></div>`;
  }
  function posRecurso() {
    if (S.xVis !== 'recurso') return; const rows = window.__recRows || []; if (!rows.length) return;
    const f = filtro(), f2 = Object.assign({}, f, { classes: new Set([S.xCls]) });
    const lin = [...L.consulta(f2, it => it.linha)].map(([k, a]) => ({ k, A: tot(a, 2026).rec, B: tot(a, 2025).rec })).sort((x, y) => y.A - x.A).slice(0, 12);
    const tA = [...L.consulta(f2, it => it.linha)].reduce((s, [, a]) => s + tot(a, 2026).rec, 0), tB = [...L.consulta(f2, it => it.linha)].reduce((s, [, a]) => s + tot(a, 2025).rec, 0);
    mkChart('ch-mix', { type: 'bar', data: { labels: lin.map(l => l.k), datasets: [{ label: '2026', data: lin.map(l => tA ? l.A / tA : 0), backgroundColor: cor('--c26') }, { label: '2025', data: lin.map(l => tB ? l.B / tB : 0), backgroundColor: cor('--c25') }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (els.length) { S.xLin = lin[els[0].index].k; render(); } }, scales: { x: { ticks: { callback: v => pct(v, 0) } } }, plugins: { tooltip: { callbacks: { label: c => c.dataset.label + ': ' + pct(c.parsed.x) } } } } });
    const t = rows.slice(0, 30);
    mkChart('ch-par', { type: 'bar', data: { labels: t.map((r, n) => String(n + 1)), datasets: [{ type: 'line', label: '% acumulado', data: t.map(r => r.ac), yAxisID: 'y2', borderColor: cor('--gold'), backgroundColor: cor('--gold'), tension: .2, order: 1 }, { label: 'Receita 2026', data: t.map(r => r.a.rec), backgroundColor: t.map(r => r.abc === 'A' ? cor('--c26') : r.abc === 'B' ? cor('--gold') : cor('--c25')), order: 2 }] }, options: { responsive: true, maintainAspectRatio: false, onClick: (e, els) => { const el = els.find(x => x.datasetIndex === 1); if (el) abrirItem(t[el.index].it.i); }, scales: { y: { ticks: { callback: v => brlc(v) } }, y2: { position: 'right', min: 0, max: 1, grid: { drawOnChartArea: false }, ticks: { callback: v => pct(v, 0) } } }, plugins: { tooltip: { callbacks: { title: c => t[c[0].dataIndex].it.nome, label: c => c.dataset.label + ': ' + (c.dataset.yAxisID === 'y2' ? pct(c.parsed.y) : brl(c.parsed.y)) } } } } });
  }

  // ---------------- universo (INF DEC / ADT DEC em abas separadas) e filtros ativos ----------------
  const uniAtual = () => !S.grupos ? 'geral' : S.grupos.size === 1 ? [...S.grupos][0] : 'geral';
  function uniNav() {
    const cur = uniAtual(), f = filtro();
    const item = (k, nome) => {
      const ff = Object.assign({}, f, { grupos: k === 'geral' ? null : new Set([k]), classes: null });
      const a = um('x', ff), A = tot(a, 2026), B = tot(a, 2025);
      return `<button data-a="uni:${esc(k)}" class="${cur === k ? 'on' : ''}" data-u="${esc(k)}"><img src="logo-abra.svg" alt=""><span><b>${esc(nome)}</b><small>${brlc(A.rec)} · ${varf(L.vari(A.rec, B.rec))} · Mk ${mkf(A.mk)}</small></span></button>`;
    };
    return item('INF DEC', 'INF DEC · Infantil') + item('ADT DEC', 'ADT DEC · Adulto') + item('geral', 'Visão geral');
  }
  function ativos() {
    const nomes = { classes: 'Classe', linhas: 'Linha', fornecedores: 'Fornecedor', canais: 'Canal', posicoes: 'Posição', meses: 'Meses' };
    const ch = [];
    for (const k of Object.keys(nomes)) {
      const s = S[k]; if (!s) continue;
      const arr = [...s].map(x => k === 'meses' ? MESES[x - 1] : x);
      ch.push(`<span class="chip on" data-a="rm:${k}" title="remover">${nomes[k]}: ${esc(arr.length > 2 ? arr.slice(0, 2).join(', ') + ' +' + (arr.length - 2) : arr.join(', ') || 'nenhum')} ×</span>`);
    }
    if (S.foraLinha !== 'todos') ch.push(`<span class="chip on" data-a="rm:foraLinha">${S.foraLinha === 'sim' ? 'só fora de linha' : 'só em linha'} ×</span>`);
    if (S.q) ch.push(`<span class="chip on" data-a="rm:q">busca: ${esc(S.q)} ×</span>`);
    return ch.length ? '<span class="muted" style="font-size:12px">Filtros ativos:</span> ' + ch.join('') : '';
  }
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  function spark(acc) {
    const ms = mesesComDado, w = ms.length * 8, h = 24, v26 = ms.map(m => acc.R[2026][m]), v25 = ms.map(m => acc.R[2025][m]), mx = Math.max(1, ...v26, ...v25);
    const bars = v26.map((v, n) => { const hh = Math.max(0, v) / mx * h; return `<rect x="${n * 8 + 1}" y="${(h - hh).toFixed(1)}" width="5" height="${hh.toFixed(1)}" fill="var(--c26)"/>`; }).join('');
    const line = v25.map((v, n) => `${n * 8 + 3.5},${(h - Math.max(0, v) / mx * h).toFixed(1)}`).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="receita mensal"><polyline points="${line}" fill="none" stroke="var(--text-muted)" stroke-width="1.2"/>${bars}</svg>`;
  }
  const mkBadge = (mk, ref) => mk == null ? '–' : `<span class="${ref != null && mk >= ref + .1 ? 'pos' : ref != null && mk <= ref - .1 ? 'neg' : ''}" style="font-weight:600">${mkf(mk)}</span>`;
  const SORTS = { rec: ['Receita', (A, B) => A.rec], mk: ['Markup', (A, B) => A.mk == null ? -1e9 : A.mk], var: ['Var. %', (A, B) => L.vari(A.rec, B.rec) == null ? -1e9 : L.vari(A.rec, B.rec)], mg: ['Margem R$', (A, B) => A.mg] };

  // ---------------- aba: Compradora (Classe › Linha › Item) ----------------
  function vCompra() {
    const f = filtro(), base = um('x', f), A = tot(base, 2026), B = tot(base, 2025), sk = SORTS[S.bSort][1];
    const itAcc = L.consulta(f, it => it.i);
    const todos = [...itAcc].map(([i, acc]) => ({ it: L.itens[i], acc, a: tot(acc, 2026), b: tot(acc, 2025) }));
    const clsM = new Map(); for (const r of todos) { const c = clsM.get(r.it.classe) || { k: r.it.classe, acc: L.novoAcc(), it: 0, lin: new Set(), forn: new Set() }; clsM.set(r.it.classe, c); c.acc = L.somarAcc([c.acc, r.acc]); if (r.a.rec > 0) { c.it++; c.lin.add(r.it.linha); c.forn.add(r.it.fornecedor); } }
    const classes = [...clsM.values()].map(c => Object.assign(c, { A: tot(c.acc, 2026), B: tot(c.acc, 2025) })).filter(c => c.A.rec > 0 || c.B.rec > 0).sort((x, y) => sk(y.A, y.B) - sk(x.A, x.B));
    if (S.bCls && !clsM.has(S.bCls)) S.bCls = null;
    const selC = todos.filter(r => !S.bCls || r.it.classe === S.bCls);
    const linM = new Map();
    for (const r of selC) { const l = linM.get(r.it.linha) || { k: r.it.linha, acc: L.novoAcc(), it: 0, forn: new Map() }; linM.set(r.it.linha, l); l.acc = L.somarAcc([l.acc, r.acc]); if (r.a.rec > 0) { l.it++; l.forn.set(r.it.fornecedor, (l.forn.get(r.it.fornecedor) || 0) + r.a.rec); } }
    const linhas = [...linM.values()].map(l => Object.assign(l, { A: tot(l.acc, 2026), B: tot(l.acc, 2025) })).filter(l => l.A.rec > 0 || l.B.rec > 0).sort((x, y) => sk(y.A, y.B) - sk(x.A, x.B));
    if (S.bLin && !linM.has(S.bLin)) S.bLin = null;
    const baseLin = S.bCls ? selC.reduce((s, r) => s + r.a.rec, 0) : A.rec, mkLin = S.bCls ? tot(L.somarAcc(selC.map(r => r.acc)), 2026).mk : A.mk;
    const sel = selC.filter(r => !S.bLin || r.it.linha === S.bLin);
    const selAcc = L.somarAcc(sel.map(r => r.acc)), SA = tot(selAcc, 2026), SB = tot(selAcc, 2025);
    const itens = sel.filter(r => r.a.rec > 0 || r.b.rec > 0).sort((x, y) => sk(y.a, y.b) - sk(x.a, x.b));
    // ABC pela receita 2026 dentro da seleção
    const ord = sel.filter(r => r.a.rec > 0).sort((x, y) => y.a.rec - x.a.rec); let ac = 0; const abc = new Map();
    ord.forEach(r => { const ant = ac; ac += r.a.rec; abc.set(r.it.i, SA.rec ? (ant / SA.rec < .8 ? 'A' : ant / SA.rec < .95 ? 'B' : 'C') : 'C'); });
    // fornecedores da seleção
    const fm = new Map(); sel.forEach(r => fm.set(r.it.fornecedor, (fm.get(r.it.fornecedor) || 0) + r.a.rec));
    const forns = [...fm].filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]);
    // pontos de atenção
    const att = { susp: [], mkbaixo: [], neg: [], queda: [] };
    ord.forEach(r => { if (abc.get(r.it.i) === 'A' && semVenda(r.it)) att.susp.push(r.it.i); if (abc.get(r.it.i) === 'A' && r.a.mk != null && SA.mk != null && r.a.mk < SA.mk - .25) att.mkbaixo.push(r.it.i); if (r.a.mk != null && r.a.mk < 0) att.neg.push(r.it.i); if (r.b.rec >= 1500 && L.vari(r.a.rec, r.b.rec) < -.3) att.queda.push(r.it.i); });
    window.__att = att;
    const top1 = forns[0], conc = top1 && SA.rec ? top1[1] / SA.rec : 0;
    const lt = (k, n, cls) => att[k].length ? `<div class="att ${cls}" data-a="att:${k}"><b>${att[k].length}</b> ${n}</div>` : '';
    const attHtml = lt('susp', 'itens classe A (80% da receita) com venda suspensa, sem posição ou fora de linha', 'bad') + lt('mkbaixo', 'itens classe A com markup bem abaixo do markup da seleção', 'warn') + lt('neg', 'itens vendidos abaixo do custo (Mk negativo)', 'bad') + lt('queda', 'itens que caíram mais de 30% vs 2025 (base ≥ R$ 1.500)', 'warn')
      + (conc > .5 && fm.size > 1 ? `<div class="att warn" data-a="forn:${esc(top1[0])}">Concentração: <b>${esc(top1[0])}</b> responde por ${pct(conc, 0)} da receita desta seleção</div>` : '');
    const nLin = new Set(sel.filter(r => r.a.rec > 0).map(r => r.it.linha)).size;
    const kp = (l, v, d) => `<div class="card kpi" data-a="bkpi"><div class="l">${l}</div><div class="v num">${v}</div><div class="d">${d || '&nbsp;'}</div></div>`;
    const sortSeg = segHtml('bsort', S.bSort, Object.keys(SORTS).map(k => [k, SORTS[k][0]]));
    const nomeSel = S.bCls ? (S.bLin ? S.bCls + ' › ' + S.bLin : S.bCls) : 'todas as classes';
    return `<div class="card hero"><div class="hd"><h3>O que você vai comprar</h3><span class="muted">${esc(nomeSel)}</span><div class="sp"></div>${sortSeg}</div>
      <div class="grid g4">${kp('Classes', nf0.format(classes.length), S.bCls ? 'selecionada: 1' : 'no filtro')}${kp('Linhas', nf0.format(linhas.filter(l => l.A.rec > 0).length), 'com venda em 2026')}${kp('Fornecedores', nf0.format(forns.length), top1 ? 'maior: ' + esc(top1[0]) : '')}${kp('Itens com venda', nf0.format(ord.length), 'em 2026')}
      ${kp('Vende (2026)', brlc(SA.rec), varf(L.vari(SA.rec, SB.rec)) + ' vs 2025 (' + brlc(SB.rec) + ')')}${kp('Markup', mkf(SA.mk), '2025: ' + mkf(SB.mk) + ' · Mg ' + pct(SA.mgp))}${kp('Margem R$', brlc(SA.mg), '2025: ' + brlc(SB.mg))}${kp('Itens classe A', nf0.format([...abc.values()].filter(x => x === 'A').length), '80% da receita')}</div>
      ${attHtml ? `<div class="attbox"><div class="muted" style="font-size:12px;margin-bottom:6px">PONTOS DE ATENÇÃO (clique para ver os itens)</div>${attHtml}</div>` : ''}</div>
    <div class="grid g2 cols2" style="margin-top:16px">
      <div class="card"><div class="hd"><h3>1 · Classes</h3><span class="muted">${classes.length}</span><div class="sp"></div>${S.bCls ? '<button class="btn" data-a="bcls:">todas</button>' : ''}</div><div class="lista-sel">
        ${classes.map(c => `<div class="selrow ${S.bCls === c.k ? 'on' : ''}" data-a="bcls:${esc(c.k)}"><div class="r1"><b>${esc(c.k)}</b><span class="num">${brlc(c.A.rec)}</span></div><div class="bar"><i style="width:${A.rec ? Math.min(100, 100 * c.A.rec / A.rec) : 0}%"></i></div><div class="r2 muted"><span>${pct(A.rec ? c.A.rec / A.rec : null)} do total</span><span class="${cv(L.vari(c.A.rec, c.B.rec))}">${varf(L.vari(c.A.rec, c.B.rec))}</span><span>Mk ${mkBadge(c.A.mk, A.mk)}</span><span>${c.lin.size} linhas · ${c.it} itens · ${c.forn.size} forn.</span></div></div>`).join('') || '<div class="empty">Sem classes no filtro.</div>'}</div></div>
      <div class="card"><div class="hd"><h3>2 · Linhas ${S.bCls ? 'de ' + esc(S.bCls) : ''}</h3><span class="muted">${linhas.length}</span><div class="sp"></div>${S.bLin ? '<button class="btn" data-a="blin:">todas</button>' : ''}</div><div class="lista-sel">
        ${linhas.map(l => { const fs = [...l.forn].sort((x, y) => y[1] - x[1]).slice(0, 2).map(x => x[0]).join(', '); return `<div class="selrow ${S.bLin === l.k ? 'on' : ''}" data-a="blin:${esc(l.k)}"><div class="r1"><b>${esc(l.k)}</b><span class="num">${brlc(l.A.rec)}</span></div><div class="bar"><i style="width:${baseLin ? Math.min(100, 100 * l.A.rec / baseLin) : 0}%"></i></div><div class="r2 muted"><span>${pct(baseLin ? l.A.rec / baseLin : null)} ${S.bCls ? 'da classe' : 'do total'}</span><span class="${cv(L.vari(l.A.rec, l.B.rec))}">${varf(L.vari(l.A.rec, l.B.rec))}</span><span>Mk ${mkBadge(l.A.mk, mkLin)}</span><span>${l.it} itens</span></div><div class="r2 muted" style="margin-top:2px">${esc(fs)}</div></div>`; }).join('') || '<div class="empty">Sem linhas.</div>'}</div></div></div>
    ${forns.length ? `<div class="card" style="margin-top:16px"><div class="hd"><h3>Fornecedores desta seleção</h3><span class="muted">clique para filtrar o app por fornecedor</span></div><div class="chips">${forns.slice(0, 14).map(([n, v]) => `<span class="chip" data-a="forn:${esc(n)}" title="${brl(v)}">${esc(n)} · ${pct(SA.rec ? v / SA.rec : null, 0)}</span>`).join('')}</div></div>` : ''}
    <div class="card" style="margin-top:16px"><div class="hd"><h3>3 · Itens ${S.bLin ? 'da linha ' + esc(S.bLin) : S.bCls ? 'da classe' : ''}</h3><span class="muted">${itens.length} itens</span><div class="sp"></div><span class="muted" style="font-size:12px">barras = 2026 mês a mês · linha cinza = 2025</span></div>
      <div class="tw"><table><thead><tr><th class="l">#  Item · fornecedor</th><th class="l">Posição</th><th>Rec 26</th><th>% na seleção</th><th>ABC</th><th>Var.</th><th>Mk 26</th><th>Mk 25</th><th>Mg 26</th><th class="l">Mês a mês</th></tr></thead><tbody>
      ${itens.slice(0, S.bTop).map((r, n) => `<tr class="cl" data-a="item:${r.it.i}"><td class="l">${nomeItem(r.it, '').replace('<div class="nm">', `<div class="nm"><span class="muted" style="width:24px">${n + 1}</span>`)}</td><td class="l">${posBadge(r.it)}</td><td class="num">${brl(r.a.rec)}</td><td class="num">${pct(SA.rec ? r.a.rec / SA.rec : null)}</td><td class="num">${abc.has(r.it.i) ? `<span class="bdg ${abc.get(r.it.i) === 'A' ? 'ok' : abc.get(r.it.i) === 'B' ? 'warn' : 'gray'}">${abc.get(r.it.i)}</span>` : '–'}</td><td class="num ${cv(L.vari(r.a.rec, r.b.rec))}">${varf(L.vari(r.a.rec, r.b.rec))}</td><td class="num">${mkBadge(r.a.mk, SA.mk)}</td><td class="num">${mkf(r.b.mk)}</td><td class="num">${brl(r.a.mg)}</td><td class="l">${spark(r.acc)}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">Sem itens.</td></tr>'}</tbody></table></div>
      ${itens.length > S.bTop ? `<div class="pager"><span class="muted">${S.bTop} de ${itens.length}</span><button class="btn" data-a="bmais">Mostrar mais 40</button></div>` : ''}
      <div class="nota">Mk verde/vermelho = 0,10 acima/abaixo do markup da seleção. ABC = receita acumulada 2026 (A até 80%, B até 95%). Clique numa classe ou linha para descer um nível; clique no item para o detalhe.</div></div>`;
  }

  // ---------------- aba: Fornecedores ----------------
  function vForn() {
    const f = filtro(), res = L.consulta(f, it => it.fornecedor), itAcc = L.consulta(f, it => it.i);
    const info = new Map();
    for (const [i, acc] of itAcc) { const it = L.itens[i], a = tot(acc, 2026); const o = info.get(it.fornecedor) || { it: 0, cls: new Map(), lin: new Set(), comp: new Map() }; info.set(it.fornecedor, o); if (a.rec > 0) { o.it++; o.lin.add(it.linha); } o.cls.set(it.classe, (o.cls.get(it.classe) || 0) + a.rec); o.comp.set(it.comprador, (o.comp.get(it.comprador) || 0) + a.rec); }
    const sk = SORTS[S.fSort] ? SORTS[S.fSort][1] : SORTS.rec[1];
    const rows = [...res].map(([k, acc]) => ({ k, A: tot(acc, 2026), B: tot(acc, 2025), o: info.get(k) })).filter(r => r.A.rec > 0 || r.B.rec > 0).sort((x, y) => sk(y.A, y.B) - sk(x.A, x.B));
    const totA = rows.reduce((s, r) => s + r.A.rec, 0);
    if (S.fSel && !rows.find(r => r.k === S.fSel)) S.fSel = null;
    const sel = S.fSel ? rows.find(r => r.k === S.fSel) : null; let det = '';
    if (sel) {
      const f2 = Object.assign({}, f, { fornecedores: new Set([sel.k]) }), cl = [...L.consulta(f2, it => it.classe + SEP + it.linha)].map(([k, a]) => ({ k, A: tot(a, 2026), B: tot(a, 2025) })).filter(x => x.A.rec > 0 || x.B.rec > 0).sort((x, y) => y.A.rec - x.A.rec);
      const al = D.aliases[sel.k];
      det = `<div class="card" style="margin-top:16px"><div class="hd"><h3>${esc(sel.k)}</h3><span class="muted">${nf0.format(sel.o.it)} itens com venda · ${sel.o.cls.size} classes · ${sel.o.lin.size} linhas · compradora: ${esc([...sel.o.comp].sort((x, y) => y[1] - x[1])[0][0])}</span><div class="sp"></div><button class="btn" data-a="flist:${esc(sel.k)}">Ver itens</button><button class="btn pri" data-a="ffil:${esc(sel.k)}">Filtrar o app por este fornecedor</button></div>
        ${al ? `<div class="nota" style="margin:0 0 8px">Nomes unificados na planilha: ${al.map(esc).join(' · ')}</div>` : ''}
        <div class="tw" style="max-height:320px"><table><thead><tr><th class="l">Classe › Linha</th><th>Rec 26</th><th>Rec 25</th><th>Var.</th><th>Mk 26</th><th>Mk 25</th></tr></thead><tbody>${cl.map(x => `<tr class="cl" data-a="fcl:${esc(sel.k)}${SEP}${esc(x.k)}"><td class="l">${esc(x.k.split(SEP).join(' › '))}</td><td class="num">${brl(x.A.rec)}</td><td class="num">${brl(x.B.rec)}</td><td class="num ${cv(L.vari(x.A.rec, x.B.rec))}">${varf(L.vari(x.A.rec, x.B.rec))}</td><td class="num">${mkf(x.A.mk)}</td><td class="num">${mkf(x.B.mk)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    const th = (k, n) => `<th class="${S.fSort === k ? 'on' : ''}" data-a="fsort:${k}">${n}${S.fSort === k ? ' ▼' : ''}</th>`;
    return `<div class="card"><div class="hd"><h3>Fornecedores · quanto vendem e a que markup</h3><span class="muted">${rows.length} fornecedores</span><div class="sp"></div>${segHtml('fviz', S.fViz, [['rec', 'Receita 26'], ['mk', 'Markup 26'], ['var', 'Var. vs 2025'], ['part', 'Participação']])}<select data-sel="fN">${[10, 15, 25, 40].map(n => `<option value="${n}" ${S.fN === n ? 'selected' : ''}>top ${n}</option>`).join('')}</select></div><div class="chartbox" style="height:${Math.max(260, 26 * Math.min(S.fN, rows.length) + 60)}px"><canvas id="ch-forn"></canvas></div><div class="nota">Clique numa barra para abrir o fornecedor.</div></div>
      <div class="card" style="margin-top:16px"><div class="hd"><h3>Ranking</h3><div class="sp"></div>${segHtml('fsortseg', S.fSort, Object.keys(SORTS).map(k => [k, SORTS[k][0]]))}</div>
      <div class="tw"><table><thead><tr><th class="l">Fornecedor</th>${th('rec', 'Rec 26')}<th>Rec 25</th>${th('var', 'Var.')}<th>% total</th>${th('mk', 'Mk 26')}<th>Mk 25</th>${th('mg', 'Margem R$')}<th>Itens</th><th>Classes</th><th class="l">Classe principal</th></tr></thead><tbody>
      ${rows.slice(0, S.fTop).map(r => { const cp = [...r.o.cls].sort((x, y) => y[1] - x[1])[0]; return `<tr class="cl ${S.fSel === r.k ? 'sel' : ''}" data-a="fsel:${esc(r.k)}"><td class="l"><b>${esc(r.k)}</b></td><td class="num">${brl(r.A.rec)}</td><td class="num">${brl(r.B.rec)}</td><td class="num ${cv(L.vari(r.A.rec, r.B.rec))}">${varf(L.vari(r.A.rec, r.B.rec))}</td><td class="num">${pct(totA ? r.A.rec / totA : null)}</td><td class="num">${mkf(r.A.mk)}</td><td class="num">${mkf(r.B.mk)}</td><td class="num">${brl(r.A.mg)}</td><td class="num">${r.o.it}</td><td class="num">${r.o.cls.size}</td><td class="l">${esc(cp ? cp[0] : '')}</td></tr>`; }).join('')}</tbody></table></div>
      ${rows.length > S.fTop ? `<div class="pager"><button class="btn" data-a="fmais">Mostrar todos (${rows.length})</button></div>` : ''}</div>${det}`;
  }
  function posForn() {
    const f = filtro(), res = L.consulta(f, it => it.fornecedor), w = S.fViz;
    let pts = [...res].map(([k, a]) => ({ k, A: tot(a, 2026), B: tot(a, 2025) })).filter(p => p.A.rec > 0);
    const tr = pts.reduce((x, p) => x + p.A.rec, 0);
    const val = p => w === 'rec' ? p.A.rec : w === 'mk' ? p.A.mk : w === 'var' ? L.vari(p.A.rec, p.B.rec) : (tr ? p.A.rec / tr : null);
    pts = pts.sort((x, y) => y.A.rec - x.A.rec).slice(0, S.fN).filter(p => val(p) != null);
    if (w !== 'rec' && w !== 'part') pts.sort((x, y) => val(y) - val(x));
    const ff = w === 'rec' ? brl : w === 'mk' ? mkf : w === 'var' ? varf : (v => pct(v));
    const cores = pts.map(p => p.k === S.fSel ? cor('--gold') : (w === 'var' || w === 'mk') && val(p) < (w === 'mk' ? 0 : 0) ? cor('--bad') : cor('--c26'));
    mkChart('ch-forn', { type: 'bar', data: { labels: pts.map(p => p.k), datasets: [{ data: pts.map(val), backgroundColor: cores, borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, onClick: (e, els) => { if (els.length) { S.fSel = pts[els[0].index].k; render(); } },
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ff(c.parsed.x) + ' · ' + brl(pts[c.dataIndex].A.rec) + ' · Mk ' + mkf(pts[c.dataIndex].A.mk) } } },
        scales: { x: { ticks: { callback: v => w === 'rec' ? brlc(v) : w === 'mk' ? mkf(v) : pct(v, 0) } }, y: { ticks: { autoSkip: false } } } } });
  }

  // ---------------- aba: Qualidade dos dados ----------------
  function vQual() {
    const u = S.grupos, f0 = { modo: S.modo, grupos: u }, itAcc = L.consulta(f0, it => it.i);
    const rows = [...itAcc].map(([i, acc]) => ({ it: L.itens[i], a: tot(acc, 2026), b: tot(acc, 2025) }));
    const com = rows.filter(r => r.a.rec > 0), totRec = com.reduce((s, r) => s + r.a.rec, 0);
    const chk = [
      ['semfoto', 'Itens vendidos em 2026 sem foto', com.filter(r => !r.it.foto), 'Não estão no site público (suspensos, fora do ar ou sem imagem). Aparecem com o símbolo da Abra.'],
      ['sempos', 'Sem posição de venda (Ritmo)', com.filter(r => r.it.posTipo === 'Sem posição' || r.it.posTipo === 'Fora do Ritmo'), 'Itens com venda mas sem situação no relatório Ritmo.'],
      ['susp', 'Vendeu em 2026 e hoje está suspenso / fora de linha', com.filter(r => r.it.posTipo === 'Suspensa/Bloqueada' || r.it.fl), 'Decisão de compra: reposição, substituto ou saída.'],
      ['generica', 'Linha genérica (Outros / Sem Marca / Sem Linha)', com.filter(r => ['Outros', 'Sem Marca', 'Sem Linha'].includes(r.it.linha)), 'A Linha vem da Marca do Ritmo; nestes itens ela não foi preenchida.'],
      ['mkneg', 'Markup negativo (vendeu abaixo do custo)', com.filter(r => r.a.mk != null && r.a.mk < 0), 'Verificar preço promocional ou custo desatualizado.'],
      ['mkalto', 'Markup acima de 5 (custo possivelmente defasado)', com.filter(r => r.a.mk != null && r.a.mk > 5), 'Verificar custo no cadastro antes de usar como referência.'],
      ['recneg', 'Receita líquida negativa no período', rows.filter(r => r.a.rec < 0 || r.b.rec < 0), 'Devoluções maiores que as vendas.'],
      ['multif', 'Item com mais de um fornecedor na planilha', rows.filter(r => r.it.nForn > 1), 'O app atribui o fornecedor de maior receita.']
    ];
    window.__qual = Object.fromEntries(chk.map(c => [c[0], c[2].map(r => r.it.i)]));
    // fornecedores com nomes parecidos
    const nm = D.fornecedores.map(n => ({ n, k: n.toLowerCase().replace(/[^a-z0-9]/g, '') })), par = [];
    for (let i = 0; i < nm.length; i++) for (let j = i + 1; j < nm.length; j++) { const a = nm[i].k, b = nm[j].k; if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) par.push([nm[i].n, nm[j].n]); }
    const unif = Object.entries(D.aliases);
    // conferência com a planilha
    const conf = []; for (const modo of ['ano', 'mesmo']) for (const g of D.grupos) for (const y of [2026, 2025]) {
      const c = D.conf.find(x => x[0] === modo && x[1] === g && x[2] === y); if (!c) continue;
      const a = tot(L.consulta({ modo, grupos: new Set([g]) }, () => 'x').get('x') || L.novoAcc(), y);
      conf.push({ modo, g, y, c, a, ok: Math.abs(a.rec - c[3]) < .05 && Math.abs(a.mg - c[4]) < .05 && Math.abs(a.cmv - c[5]) < .05 });
    }
    const allOk = conf.every(x => x.ok);
    return `<div class="card"><div class="hd"><h3>Conferência com a planilha</h3><span class="bdg ${allOk ? 'ok' : 'bad'}">${allOk ? '✔ tudo confere' : '✖ há diferenças'}</span></div>
      <div class="tw" style="max-height:none"><table><thead><tr><th class="l">Período</th><th class="l">Grupo</th><th>Ano</th><th>Receita planilha</th><th>Receita app</th><th>Margem planilha</th><th>Margem app</th><th>CMV planilha</th><th>CMV app</th><th>Status</th></tr></thead><tbody>${conf.map(x => `<tr><td class="l">${x.modo === 'ano' ? 'Ano comparável' : 'Dias 1–' + D.meta.diaCorte}</td><td class="l">${esc(x.g)}</td><td>${x.y}</td><td class="num">${nf2.format(x.c[3])}</td><td class="num">${nf2.format(x.a.rec)}</td><td class="num">${nf2.format(x.c[4])}</td><td class="num">${nf2.format(x.a.mg)}</td><td class="num">${nf2.format(x.c[5])}</td><td class="num">${nf2.format(x.a.cmv)}</td><td><span class="bdg ${x.ok ? 'ok' : 'bad'}">${x.ok ? 'confere' : 'diferença'}</span></td></tr>`).join('')}</tbody></table></div>
      <div class="nota">"Planilha" = soma direta da aba Dados do Comparativo Anual (${esc(D.meta.planilha)}), com as mesmas flags Excluir / Excluir Ano; "app" = soma dos dados que alimentam as telas.</div></div>
    <div class="card" style="margin-top:16px"><div class="hd"><h3>Verificações de qualidade</h3><span class="muted">${S.grupos ? esc([...S.grupos][0]) : 'INF DEC + ADT DEC'} · clique para ver os itens</span></div><div class="grid g4">
      ${chk.map(([k, n, arr, dsc]) => { const rec = arr.reduce((s, r) => s + Math.max(0, r.a.rec), 0); return `<div class="card kpi qc ${arr.length ? 'tem' : 'ok'}" data-a="qual:${k}"><div class="l">${n}</div><div class="v num">${nf0.format(arr.length)}</div><div class="d">${arr.length ? brlc(rec) + ' (' + pct(totRec ? rec / totRec : null, 1) + ' da receita 2026)' : 'nenhum'}</div><div class="nota" style="margin-top:6px">${dsc}</div></div>`; }).join('')}</div></div>
    <div class="card" style="margin-top:16px"><div class="hd"><h3>Fornecedores: nomes</h3></div>
      <div><b>Unificados automaticamente</b> (sufixos S/A, Filial, (SP2) removidos): ${unif.length ? unif.map(([k, v]) => `<span class="chip">${esc(k)} ← ${v.map(esc).join(' / ')}</span>`).join(' ') : 'nenhum'}</div>
      <div style="margin-top:8px"><b>Nomes parecidos que NÃO foram unificados</b> (confirmar se são o mesmo fornecedor): ${par.length ? par.map(p => `<span class="chip" data-a="forn:${esc(p[0])}">${esc(p[0])} ≈ ${esc(p[1])}</span>`).join(' ') : 'nenhum'}</div></div>`;
  }

  // ---------------- roteamento / render ----------------
  const TABS = [['compra', 'Compradora · Classe › Linha › Item'], ['resumo', 'Resumo'], ['anual', 'Anual'], ['mensal', 'Mensal'], ['itens', 'Itens · Markup'], ['top', 'Top por linha'], ['forn', 'Fornecedores'], ['cxl', 'Classe × Linha × Recurso'], ['qual', 'Qualidade dos dados']];
  const VIEWS = { compra: [vCompra], forn: [vForn, posForn], qual: [vQual], resumo: [vResumo, posResumo], anual: [vAnual], mensal: [vMensal, posMensal], itens: [vItens], top: [vTop], cxl: [vCxL, posRecurso] };
  function setTab(t) { S.tab = t; render(); window.scrollTo(0, 0); }
  function render() {
    document.body.dataset.uni = uniAtual(); $('#uni').innerHTML = uniNav();
    $('#tabs').innerHTML = TABS.map(([k, n]) => `<button data-a="tab:${k}" class="${S.tab === k ? 'on' : ''}">${n}</button>`).join('');
    renderFiltros();
    const v = VIEWS[S.tab]; $('#view').innerHTML = v[0](); if (v[1]) v[1]();
    salvaHash();
  }
  const reRender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

  // ---------------- eventos ----------------
  const toggleSet = (key, val, all) => { const s = S[key] ? new Set(S[key]) : new Set(all); s.has(val) ? s.delete(val) : s.add(val); S[key] = s.size === all.length ? null : s; };
  document.addEventListener('click', e => {
    const open = $('.msel.open'); if (open && !e.target.closest('.msel')) { S.open = null; open.classList.remove('open'); }
    const t = e.target.closest('[data-a]'); if (!t) return;
    const [a, ...r] = t.dataset.a.split(':'), v = r.join(':');
    switch (a) {
      case 'tab': return setTab(v);
      case 'uni': S.grupos = v === 'geral' ? null : new Set([v]); S.classes = null; S.bCls = null; S.bLin = null; S.xCls = null; S.xLin = null; S.aAbertos = new Set(); return reRender();
      case 'comp': S.compradores = v ? new Set([v]) : null; S.classes = null; S.bCls = null; S.bLin = null; return reRender();
      case 'rm': if (v === 'foraLinha') S.foraLinha = 'todos'; else if (v === 'q') S.q = ''; else S[v] = null; return reRender();
      case 'bcls': S.bCls = v || null; S.bLin = null; S.bTop = 40; return reRender();
      case 'blin': S.bLin = v || null; S.bTop = 40; return reRender();
      case 'bsort': S.bSort = v; return reRender();
      case 'bmais': S.bTop += 40; return reRender();
      case 'bkpi': return abrirLista('Itens da seleção', it => (!S.bCls || it.classe === S.bCls) && (!S.bLin || it.linha === S.bLin));
      case 'att': return abrirLista({ susp: 'Classe A suspensos / fora de linha', mkbaixo: 'Classe A com markup baixo', neg: 'Vendidos abaixo do custo', queda: 'Queda > 30% vs 2025' }[v], it => (window.__att[v] || []).includes(it.i));
      case 'forn': S.fornecedores = new Set([v]); S.fSel = v; return setTab('forn');
      case 'fsel': S.fSel = S.fSel === v ? null : v; return reRender();
      case 'fsort': case 'fsortseg': S.fSort = v; return reRender();
      case 'fviz': S.fViz = v; return reRender();
      case 'fmais': S.fTop = 999; return reRender();
      case 'flist': return abrirLista('Fornecedor · ' + v, it => it.fornecedor === v);
      case 'ffil': S.fornecedores = new Set([v]); return reRender();
      case 'fcl': { const [fo, c, l] = v.split(SEP); return abrirLista(fo + ' › ' + c + ' › ' + l, it => it.fornecedor === fo && it.classe === c && it.linha === l); }
      case 'qual': { const nm = { semfoto: 'Sem foto', sempos: 'Sem posição', susp: 'Suspensos / fora de linha com venda em 2026', generica: 'Linha genérica', mkneg: 'Markup negativo', mkalto: 'Markup acima de 5', recneg: 'Receita negativa', multif: 'Mais de um fornecedor' }; return abrirLista('Qualidade · ' + nm[v], it => (window.__qual[v] || []).includes(it.i)); }
      case 'modo': S.modo = v; return reRender();
      case 'grupo': toggleSet('grupos', v, D.grupos); S.classes = null; return reRender();
      case 'mes': toggleSet('meses', +v, mesesComDado); return reRender();
      case 'msopen': S.open = S.open === v ? null : v; return renderFiltros();
      case 'msall': S[v] = null; return reRender();
      case 'msnone': S[v] = new Set(); return reRender();
      case 'limpar': Object.assign(S, { canais: null, classes: null, linhas: null, posicoes: null, fornecedores: null, foraLinha: 'todos', q: '', meses: null, open: null, msq: {}, bCls: null, bLin: null }); return reRender();
      case 'fechar': return fechar();
      case 'item': return abrirItem(+v);
      case 'lsort': LS.sort = v; return renderLista();
      case 'rvm': S.rVisaoMes = v; return reRender();
      case 'rvc': S.rVisaoCls = v; return reRender();
      case 'kpi': return abrirLista('Itens do filtro', () => true);
      case 'lista-g': return abrirLista('Itens · ' + v, it => it.grupo === v);
      case 'aord': S.aOrdem = v; S.aAbertos = new Set(); return reRender();
      case 'acols': S.aCols = v; return reRender();
      case 'asort': S.aSort = v; return reRender();
      case 'tg': S.aAbertos.has(v) ? S.aAbertos.delete(v) : S.aAbertos.add(v); return reRender();
      case 'aexp': { const ord = ORD[S.aOrdem]; const f = filtro(); for (const k of L.consulta(f, it => it.grupo).keys()) S.aAbertos.add(k); const cl = L.consulta(f, it => it.grupo + SEP + it[ord[1]]); for (const k of cl.keys()) S.aAbertos.add(k); return reRender(); }
      case 'acol': S.aAbertos = new Set(); return reRender();
      case 'ln': { const ord = ORD[S.aOrdem], n = v.split(SEP).length; if (n === 4) return abrirItem(porCod.get(v.split(SEP)[3]).i); return abrirLista(v.split(SEP).join(' › '), predDe(v, ord)); }
      case 'mdim': S.mDim = v; S.mSel = null; return reRender();
      case 'msel': S.mSel = v || null; return reRender();
      case 'mcel': { const [k, m] = [v.slice(0, v.lastIndexOf(':')), +v.slice(v.lastIndexOf(':') + 1)]; const dim = S.mDim; return abrirLista(k ? (dim === 'item' ? 'Item ' + k : k) : 'Total do filtro', k ? (dim === 'item' ? it => it.cod === k : it => it[dim] === k) : () => true, { mes: m || 0 }); }
      case 'isort': if (S.iSort === v) S.iDir = -S.iDir; else { S.iSort = v; S.iDir = -1; } S.iPag = 0; return reRender();
      case 'iso26': S.iSo26 = !S.iSo26; S.iPag = 0; return reRender();
      case 'ipag': S.iPag = Math.max(0, S.iPag + +v); return reRender();
      case 'icsv': return baixarCsv();
      case 'tord': S.tOrd = v; return reRender();
      case 'tall': S.tAll = true; return reRender();
      case 'lin': S.linhas = new Set([v]); S.aOrdem = 'lc'; return setTab('anual');
      case 'alertas': return abrirLista('Top vendidos suspensos / fora de linha', it => (window.__alertas || []).includes(it.i));
      case 'xvis': S.xVis = v; return reRender();
      case 'xcls': S.xCls = v; S.xVis = 'recurso'; S.xLin = null; return reRender();
      case 'xcel': { const [c, l] = v.split(SEP); return abrirLista(c + (l === '*' ? ' · demais linhas' : ' › ' + l), l === '*' ? it => it.classe === c : it => it.classe === c && it.linha === l); }
      case 'xmais': S.xTop += 50; return reRender();
    }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ms) { const k = t.dataset.ms, opts = optsFiltro(k); toggleSet(k, t.value, opts); if (['classes', 'linhas', 'canais', 'posicoes', 'fornecedores'].includes(k)) { const y = window.scrollY; const keep = S.open; render(); S.open = keep; renderFiltros(); window.scrollTo(0, y); } return; }
    if (t.dataset.sel) { const k = t.dataset.sel; S[k] = ['tN', 'rTop', 'mTop', 'fN'].includes(k) ? +t.value : k === 'xLin' ? (t.value || null) : t.value; if (k === 'xCls') S.xLin = null; return reRender(); }
    if (t.dataset.num) { const k = t.dataset.num; S[k] = t.value === '' ? (k === 'iMin' ? 0 : '') : +t.value; S.iPag = 0; return reRender(); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'busca') { clearTimeout(S._qt); S._qt = setTimeout(() => { S.q = t.value; const p = t.selectionStart; const v = VIEWS[S.tab]; $('#view').innerHTML = v[0](); if (v[1]) v[1](); }, 280); }
    if (t.dataset.msq) { S.msq[t.dataset.msq] = t.value; const k = t.dataset.msq, opts = optsFiltro(k), sel = S[k], q = t.value.toLowerCase(); $('#lst-' + k).innerHTML = opts.filter(o => !q || o.toLowerCase().includes(q)).map(o => `<label><input type="checkbox" data-ms="${k}" value="${esc(o)}" ${!sel || sel.has(o) ? 'checked' : ''}> ${esc(o)}</label>`).join(''); }
  });
  $('#veil').addEventListener('click', fechar); $('#dx').addEventListener('click', fechar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
  const rotuloTema = () => { $('#tema').textContent = document.documentElement.dataset.theme === 'dark' ? '☀ claro' : '☾ escuro'; };
  rotuloTema();
  $('#tema').addEventListener('click', () => { const d = document.documentElement; const n = d.dataset.theme === 'dark' ? 'light' : 'dark'; d.dataset.theme = n; try { localStorage.setItem('rdec-tema', n); } catch (e) {} rotuloTema(); render(); });

  // ---------------- link compartilhável (estado na URL) ----------------
  const HK = ['modo', 'grupos', 'classes', 'linhas', 'posicoes', 'fornecedores', 'compradores', 'canais', 'foraLinha', 'q', 'meses', 'bCls', 'bLin', 'xCls', 'xLin', 'xVis', 'aOrdem', 'bSort', 'fSel'];
  function salvaHash() {
    try { const o = {}; HK.forEach(k => { const x = S[k]; o[k] = x instanceof Set ? [...x] : x; }); history.replaceState(null, '', '#' + S.tab + '~' + btoa(unescape(encodeURIComponent(JSON.stringify(o))))); } catch (e) {}
  }
  function lerHash() {
    const [t, b] = (location.hash || '').slice(1).split('~'); if (VIEWS[t]) S.tab = t;
    if (b) try { const o = JSON.parse(decodeURIComponent(escape(atob(b)))); HK.forEach(k => { if (o[k] !== undefined) S[k] = Array.isArray(o[k]) ? new Set(o[k]) : o[k]; }); } catch (e) {}
  }
  // ---------------- início ----------------
  const m = D.meta;
  $('#sub').textContent = `Dados até ${m.dadosAte.split('-').reverse().join('/')} · ${m.planilha} · posição: ${m.ritmo} · gerado em ${m.geradoEm}`;
  lerHash();
  window.__app = { S, L, render };
  render();
})();
