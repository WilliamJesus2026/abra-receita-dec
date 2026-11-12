#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera public/dados.js do app "Receita DEC" (INF DEC + ADT DEC) a partir de:
  - planilha Comparativo Anual (.xlsm/.xlsx), aba "Dados" (vendas por dia/loja/recurso)
  - relatório Ritmo (.csv) -> posição de venda (coluna Situação), disponível, previsão, preço, custo
  - fotos: site público VTEX (somente leitura), com cache em dados/fotos.json

Uso:  python gerar.py --planilha "C:/.../Comparativo_Anual.xlsm" --ritmo "C:/.../Relatorio_Ritmo.csv" [--sem-fotos]

Regras (conferidas contra as tabelas dinâmicas da própria planilha):
  Receita = soma de "Rec";  Mg = soma de "Mg C";  Mk = (Rec - Cmv) / Cmv   (Cmv = |Cmv Zoho|)
  Linha = Marca do Ritmo; Classe = "Classe Rec" do Ritmo; Grupo = 7 primeiros caracteres da classe
  Flag "Excluir Ano" (col. W) = 'n'  -> período anual comparável (mês corrente só até o dia da planilha, nos dois anos)
  Flag "Excluir"     (col. V) = 'n'  -> mesmo período em todos os meses (dias 1..N de cada mês)
  Linhas de comprador "Produtos para Venda"/"Pré série" já vêm marcadas 's' nas duas flags (ficam fora).
"""
import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request, collections
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
GRUPOS = ('INF DEC', 'ADT DEC')


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def posicao(sit, classe=''):
    """mesma regra do app Produtos Novos (montar.js)"""
    s = str(sit or '')
    m = re.search(r'(\d+)\s*dias', s, re.I)
    prazo = int(m.group(1)) if m else None
    fl = bool(re.search(r'fora de linha', s, re.I))
    tipo = 'Outros'
    if re.match(r'^entrega imediata', s, re.I): tipo = 'Imediata'
    elif re.match(r'^encomenda em', s, re.I): tipo = 'Encomenda'
    elif re.match(r'^entrega em', s, re.I): tipo = 'Prazo'
    elif re.match(r'^venda estoque loja', s, re.I): tipo = 'Estoque loja'
    elif re.match(r'^venda (suspensa|bloqueada)', s, re.I): tipo = 'Suspensa/Bloqueada'
    elif re.match(r'^sem posi', s, re.I):
        tipo = 'Pré-série' if re.search(r'pr[eé]-?s[eé]rie', s, re.I) else 'Sem posição'
    return tipo, prazo, fl


def limpa_forn(s):
    """padroniza o nome do fornecedor (a mesma empresa aparece como 'Moveis Seiva' e 'Moveis Seiva S/A', 'Baby Art Filial'...)"""
    s = re.sub(r'\s*\(SP\d+\)', '', str(s or '').strip())
    s = re.sub(r'\s+Filial(\s+[IVX\d]+)?$', '', s, flags=re.I)
    s = re.sub(r'\s+S/A$', '', s, flags=re.I)
    return s.strip() or 'Sem fornecedor'


def num_br(x):
    x = (x or '').strip()
    if not x: return None
    try: return float(x.replace('.', '').replace(',', '.'))
    except ValueError: return None


def ler_ritmo(path):
    with open(path, encoding='cp1252', newline='') as f:
        rd = csv.reader(f, delimiter=';')
        h = next(rd)
        ix = {n: i for i, n in enumerate(h)}
        col = lambda *ks: next(ix[k] for k in ks if k in ix)
        iK, iR = col('Kit'), col('Recurso')
        iSit = next(i for n, i in ix.items() if n.startswith('Situa'))
        iDisp, iPrev, iPreco = col('Disponivel'), col('Previsao'), next(i for n, i in ix.items() if n.startswith('Pre') and 'Venda' in n)
        iCusto, iVtex, iNome, iCls = col('Custo'), col('Vtex'), col('Nome'), col('Classe Rec')
        iR1, iQ1 = col('Ritmo 1'), col('Qtd Vendas 1')
        iFab = ix.get('Fabricante')
        iDT = next((i for n, i in ix.items() if n.startswith('Dispon') and 'Total' in n), None)
        out = {}
        for r in rd:
            if len(r) <= iCls: continue
            cod = r[iR].strip().lower()
            if not cod: continue
            standalone = (r[iK].strip() == '' or r[iK].strip().lower() == cod)
            if cod in out and not (standalone and not out[cod]['_sa']): continue
            tipo, prazo, fl = posicao(r[iSit], r[iCls])
            out[cod] = dict(_sa=standalone, sit=r[iSit].strip(), tipo=tipo, prazo=prazo, fl=fl,
                            disp=num_br(r[iDisp]), prev=num_br(r[iPrev]), preco=num_br(r[iPreco]), custo=num_br(r[iCusto]),
                            vtex=r[iVtex].strip() if r[iVtex].strip().isdigit() else '', ritmo=num_br(r[iR1]), nome=r[iNome].strip(),
                            fab=(r[iFab].strip() if iFab is not None and len(r) > iFab else ''))
    return out


def txt_cod(r):
    return str(r['rec_nome'] or '')[:9].lower()


def ler_dados(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb['Dados']
    it = ws.iter_rows(values_only=True)
    h = [str(c) for c in next(it)]
    ix = {n: i for i, n in enumerate(h)}
    # colunas por posição (cabeçalhos têm acento)
    I = dict(emi=0, forn=1, rec_nome=2, loja=3, uf=4, rec=5, mg=6, cmv=8, ano=11, linha=12, classe=14, grupo=15, tipoloja=16,
             comprador=20, excl=21, exclano=22, exclusivo=23, premium=24)
    assert h[I['rec']] == 'Rec' and h[I['mg']] == 'Mg C' and h[I['cmv']] == 'Cmv' and h[I['ano']] == 'Ano' and h[I['linha']] == 'Linha' \
        and h[I['classe']] == 'Classe' and h[I['grupo']] == 'Grupo' and h[I['comprador']] == 'Comprador', h
    rows = []
    for r in it:
        if r[0] is None: continue
        if r[I['grupo']] in GRUPOS:
            rows.append({k: r[v] for k, v in I.items()})
    return rows


# ---------------- fotos (VTEX pública) ----------------
LOJAS = ['www.abracasa.com.br', 'www.abracadabra.com.br']


def busca(loja, q):
    for i in range(3):
        try:
            req = urllib.request.Request(f'https://{loja}/api/catalog_system/pub/products/search?fq={q}',
                                         headers={'User-Agent': 'Mozilla/5.0 ReceitaDecSync'})
            with urllib.request.urlopen(req, timeout=25) as r:
                j = json.loads(r.read().decode('utf-8'))
            return j[0] if isinstance(j, list) and j else None
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504): time.sleep(1.5 * (i + 1)); continue
            return None
        except Exception:
            time.sleep(1 + i)
    return False  # falhou


def foto_de(cod, vtex):
    consultas = [(l, 'alternateIds_RefId:' + urllib.parse.quote(cod)) for l in LOJAS]
    if vtex: consultas += [(l, 'skuId:' + vtex) for l in LOJAS]
    falhou = False
    hoje = time.strftime('%Y-%m-%d')
    for loja, q in consultas:
        p = busca(loja, q)
        if p is False: falhou = True; continue
        if not p: continue
        # só vale a foto do SKU cuja referência no site é exatamente este código (evita foto de outro produto:
        # o ID do Ritmo às vezes aponta para um produto diferente no site)
        it = next((i for i in p.get('items', []) if any(str(r.get('Value', '')).strip().lower()[:9] == cod for r in (i.get('referenceId') or []))), None)
        if not it: continue
        img = it['images'][0]['imageUrl'] if it.get('images') else ''
        return dict(url=re.sub(r'\?v=.*$', '', img), loja=loja.replace('www.', ''), link=p.get('link', ''), at=hoje)
    return None if falhou else dict(url='', loja='', link='', at=hoje)


def fotos(codigos, ritmo):
    f = os.path.join(AQUI, 'dados', 'fotos.json')
    cache = {}
    if os.path.exists(f):
        with open(f, encoding='utf-8') as fh: cache = json.load(fh)
    limite = time.strftime('%Y-%m-%d', time.localtime(time.time() - 7 * 86400))
    falta = [c for c in codigos if c not in cache or (not cache[c].get('url') and cache[c].get('at', '') < limite)]
    log(f'Fotos: {len(codigos) - len(falta)} em cache, consultando {len(falta)}…')
    feito = [0]

    def um(c):
        r = foto_de(c, (ritmo.get(c) or {}).get('vtex', ''))
        feito[0] += 1
        if feito[0] % 100 == 0: log(f'  fotos {feito[0]}/{len(falta)}')
        return c, r
    with ThreadPoolExecutor(8) as ex:
        for c, r in ex.map(um, falta):
            if r is not None: cache[c] = r
    os.makedirs(os.path.dirname(f), exist_ok=True)
    with open(f, 'w', encoding='utf-8') as fh: json.dump(cache, fh, ensure_ascii=False)
    log(f'Fotos: {sum(1 for c in codigos if cache.get(c, {}).get("url"))}/{len(codigos)} com foto.')
    return cache


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--planilha', required=True); ap.add_argument('--ritmo', required=True)
    ap.add_argument('--sem-fotos', action='store_true')
    a = ap.parse_args()
    log('Lendo planilha (aba Dados)…')
    rows = ler_dados(a.planilha)
    log(f'{len(rows)} linhas de INF DEC / ADT DEC')
    log('Lendo Ritmo…')
    ritmo = ler_ritmo(a.ritmo)
    log(f'{len(ritmo)} recursos no Ritmo')

    dims = {k: [] for k in ('grupo', 'classe', 'linha', 'canal', 'forn', 'comp')}
    pos = {k: {} for k in dims}
    def di(k, v):
        v = '' if v is None else str(v)
        if v not in pos[k]: pos[k][v] = len(dims[k]); dims[k].append(v)
        return pos[k][v]

    itens, ipos, nomes = [], {}, {}
    forn_rec = collections.defaultdict(lambda: collections.defaultdict(float))   # código -> fornecedor limpo -> receita
    aliases = collections.defaultdict(set)                                       # fornecedor limpo -> nomes originais
    conf = collections.defaultdict(lambda: [0.0, 0.0, 0.0])                       # conferência direto da planilha
    fatos = collections.defaultdict(lambda: [0.0, 0.0, 0.0])
    ult = {}
    ultima = max(r['emi'] for r in rows)
    for r in rows:
        txt = str(r['rec_nome'] or '')
        cod = txt[:9].lower()
        if r['exclano'] != 'n' and r['excl'] != 'n': continue   # fora das duas visões
        fl = limpa_forn(r['forn']); aliases[fl].add(str(r['forn']).strip())
        forn_rec[txt_cod(r)][fl] += r['rec'] or 0
        for modo, ok in (('ano', r['exclano'] == 'n'), ('mesmo', r['excl'] == 'n')):
            if ok:
                c = conf[(modo, r['grupo'], r['emi'].year)]; c[0] += r['rec'] or 0; c[1] += r['mg'] or 0; c[2] += abs(r['cmv'] or 0)
        nome = txt[12:] if txt[9:12] == ' - ' else txt[9:].lstrip(' -')
        if cod not in ipos or r['emi'] >= ult[cod]:
            ult[cod] = r['emi']; nomes[cod] = nome
            if cod not in ipos:
                ipos[cod] = len(itens); itens.append(dict(cod=cod))
            itens[ipos[cod]].update(g=di('grupo', r['grupo']), c=di('classe', r['classe']), l=di('linha', r['linha']), cp=di('comp', r['comprador']))
        ym = r['emi'].year * 100 + r['emi'].month
        f = 2 if r['excl'] == 'n' else 1
        k = (ipos[cod], ym, di('canal', r['tipoloja']), f)
        v = fatos[k]; v[0] += r['rec'] or 0; v[1] += r['mg'] or 0; v[2] += abs(r['cmv'] or 0)
    cods = [i['cod'] for i in itens]
    cache = fotos(cods, ritmo) if not a.sem_fotos else (json.load(open(os.path.join(AQUI, 'dados', 'fotos.json'), encoding='utf-8')) if os.path.exists(os.path.join(AQUI, 'dados', 'fotos.json')) else {})

    postipos = []
    def pt(t):
        if t not in postipos: postipos.append(t)
        return postipos.index(t)
    out_itens = []
    for i in itens:
        c = i['cod']; rt = ritmo.get(c); ft = cache.get(c) or {}
        if rt:
            p = [pt(rt['tipo']), rt['sit'], rt['prazo'], 1 if rt['fl'] else 0, rt['disp'], rt['prev'], rt['preco'], rt['custo'], rt['ritmo']]
        else:
            p = [pt('Fora do Ritmo'), 'Não consta no relatório Ritmo', None, 0, None, None, None, None, None]
        fr = forn_rec[c]; fprin = max(fr, key=fr.get) if fr else 'Sem fornecedor'
        out_itens.append([c, nomes[c], i['g'], i['c'], i['l']] + p + [ft.get('url', ''), ft.get('link', ''), di('forn', fprin), i['cp'], (rt or {}).get('fab', ''), len(fr)])
    fatos_l = [[k[0], k[1], k[2], k[3], round(v[0], 2), round(v[1], 2), round(v[2], 2)] for k, v in sorted(fatos.items())]
    dados = dict(
        meta=dict(geradoEm=time.strftime('%Y-%m-%d %H:%M'), dadosAte=ultima.strftime('%Y-%m-%d'), diaCorte=ultima.day,
                  planilha=os.path.basename(a.planilha), ritmo=os.path.basename(a.ritmo)),
        grupos=dims['grupo'], classes=dims['classe'], linhas=dims['linha'], canais=dims['canal'], posicoes=postipos,
        fornecedores=dims['forn'], compradores=dims['comp'],
        aliases={k: sorted(v) for k, v in aliases.items() if len(v) > 1},
        conf=[[k[0], k[1], k[2], round(v[0], 2), round(v[1], 2), round(v[2], 2)] for k, v in sorted(conf.items())],
        # item: [cod, nome, grupo, classe, linha, posTipo, situação, prazo, foraLinha, disp, prev, preco, custo, ritmo, foto, link, fornecedor, comprador, fabricante, nºFornecedores]
        itens=out_itens,
        # fato: [item, aaaamm, canal, f(2=mesmo período, 1=só ano completo), rec, mg, cmv]
        fatos=fatos_l)
    os.makedirs(os.path.join(AQUI, 'public'), exist_ok=True)
    dest = os.path.join(AQUI, 'public', 'dados.js')
    with open(dest, 'w', encoding='utf-8') as fh:
        fh.write('window.DEC=' + json.dumps(dados, ensure_ascii=False, separators=(',', ':')) + ';')
    log(f'Gerado {dest}: {len(out_itens)} itens, {len(fatos_l)} fatos, {os.path.getsize(dest)/1e6:.2f} MB')


if __name__ == '__main__':
    main()
