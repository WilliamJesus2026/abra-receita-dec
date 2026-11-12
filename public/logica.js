// Motor de cálculo do app Receita DEC (sem DOM; roda no navegador e no Node para teste).
// Receita = Rec · Mg = Mg C · Mk = (Rec − Cmv) ÷ Cmv   (mesmas definições das dinâmicas da planilha Comparativo Anual)
(function (root) {
  'use strict';
  const ANOS = [2026, 2025];
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  function criar(D) {
    const itens = D.itens.map((a, i) => ({
      i, cod: a[0], nome: a[1], g: a[2], c: a[3], l: a[4], pos: a[5], sit: a[6], prazo: a[7], fl: !!a[8],
      disp: a[9], prev: a[10], preco: a[11], custo: a[12], ritmo: a[13], foto: a[14], link: a[15],
      f: a[16], cp: a[17], fab: a[18] || '', nForn: a[19] || 1, fornecedor: D.fornecedores[a[16]], comprador: D.compradores[a[17]],
      grupo: D.grupos[a[2]], classe: D.classes[a[3]], linha: D.linhas[a[4]], posTipo: D.posicoes[a[5]]
    }));
    const fatos = D.fatos;   // [item, aaaamm, canal, f, rec, mg, cmv]

    // filtro: { modo:'ano'|'mesmo', canais:Set|null, grupos:Set|null, classes:Set|null, linhas:Set|null, posicoes:Set|null,
    //           foraLinha:'todos'|'sim'|'nao', q:'', meses:Set|null (1..12) }
    function itemOk(f) {
      const q = (f.q || '').trim().toLowerCase();
      return itens.map(it =>
        (!f.grupos || f.grupos.has(it.grupo)) && (!f.classes || f.classes.has(it.classe)) && (!f.linhas || f.linhas.has(it.linha)) &&
        (!f.posicoes || f.posicoes.has(it.posTipo)) && (!f.fornecedores || f.fornecedores.has(it.fornecedor)) && (!f.compradores || f.compradores.has(it.comprador)) &&
        (!f.foraLinha || f.foraLinha === 'todos' || (f.foraLinha === 'sim') === it.fl) &&
        (!q || it.cod.indexOf(q) >= 0 || it.nome.toLowerCase().indexOf(q) >= 0));
    }
    const novoAcc = () => ({ R: { 2026: new Array(13).fill(0), 2025: new Array(13).fill(0) }, M: { 2026: new Array(13).fill(0), 2025: new Array(13).fill(0) }, C: { 2026: new Array(13).fill(0), 2025: new Array(13).fill(0) } });

    // consulta(f, chave(item)) -> Map(chave -> acc). chave pode devolver string, ou array de strings (item em várias chaves).
    // extra(fato, item) -> false para descartar o fato.
    function consulta(f, chave, extra) {
      const ok = itemOk(f), res = new Map();
      const canalOk = f.canais ? D.canais.map(c => f.canais.has(c)) : null;
      const fmin = f.modo === 'mesmo' ? 2 : 1;
      for (let n = 0; n < fatos.length; n++) {
        const x = fatos[n];
        if (x[3] < fmin || !ok[x[0]]) continue;
        if (canalOk && !canalOk[x[2]]) continue;
        const ano = Math.floor(x[1] / 100), mes = x[1] % 100;
        if (f.meses && !f.meses.has(mes)) continue;
        const it = itens[x[0]];
        if (extra && extra(x, it, ano, mes) === false) continue;
        let k = chave(it); if (k == null) continue; if (!Array.isArray(k)) k = [k];
        for (const kk of k) {
          let a = res.get(kk); if (!a) { a = novoAcc(); res.set(kk, a); }
          a.R[ano][mes] += x[4]; a.M[ano][mes] += x[5]; a.C[ano][mes] += x[6];
        }
      }
      return res;
    }
    const soma = (arr) => { let s = 0; for (let m = 1; m <= 12; m++) s += arr[m]; return s; };
    // totais de um acc para um ano: {rec,mg,cmv,mk,mgp}
    function tot(a, ano) {
      const rec = soma(a.R[ano]), mg = soma(a.M[ano]), cmv = soma(a.C[ano]);
      return { rec, mg, cmv, mk: mk(rec, cmv), mgp: rec ? mg / rec : null };
    }
    function totMes(a, ano, m) { const rec = a.R[ano][m], mg = a.M[ano][m], cmv = a.C[ano][m]; return { rec, mg, cmv, mk: mk(rec, cmv), mgp: rec ? mg / rec : null }; }
    function mk(rec, cmv) { return cmv > 0 ? (rec - cmv) / cmv : null; }
    const vari = (a, b) => (b && b > 0) ? a / b - 1 : null;   // variação % (base positiva)

    // resumo { t26, t25 } de um acc
    function par(a) { return { a: tot(a, 2026), b: tot(a, 2025) }; }

    function somarAcc(accs) { const s = novoAcc(); for (const a of accs) for (const k of ['R', 'M', 'C']) for (const y of ANOS) for (let m = 1; m <= 12; m++) s[k][y][m] += a[k][y][m]; return s; }

    return { D, itens, consulta, itemOk, tot, totMes, mk, vari, par, somarAcc, novoAcc, MESES, ANOS };
  }

  const API = { criar, MESES, ANOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Logica = API;
})(typeof window !== 'undefined' ? window : globalThis);
