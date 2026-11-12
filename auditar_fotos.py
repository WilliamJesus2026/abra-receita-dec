#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Audita as fotos dos produtos (dados/fotos.json x public/dados.js) e grava dados/fotos_suspeitas.json.
Critérios (qualquer um marca a foto como suspeita; suspeita = fica SEM foto no app):
  1. o nome do produto no site (slug do link) não tem nenhuma palavra em comum com o nome do item;
  2. a mesma imagem aparece em itens de produtos diferentes (nomes sem palavra em comum);
  3. o link do site aponta para um produto de outra categoria (palavras-chave incompatíveis: mesa, cadeira, escrivaninha... num item de enxoval/decoração).
Uso: python auditar_fotos.py
"""
import json, os, re, sys, unicodedata, collections

sys.stdout.reconfigure(encoding='utf-8')
AQUI = os.path.dirname(os.path.abspath(__file__))
D = json.loads(open(os.path.join(AQUI, 'public', 'dados.js'), encoding='utf-8').read()[len('window.DEC='):].rstrip().rstrip(';'))
F = json.load(open(os.path.join(AQUI, 'dados', 'fotos.json'), encoding='utf-8'))
MOVEIS = {'mesa', 'cadeira', 'escrivaninha', 'poltrona', 'sofa', 'rack', 'estante', 'gaveteiro', 'banco', 'puff', 'buffet', 'aparador', 'guarda', 'comoda', 'cama', 'colchao', 'bercos', 'berco'}


def norm(s):
    s = unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().lower()
    return s


def toks(s):
    return {w for w in re.findall(r'[a-z]{4,}', norm(s))} - {'para', 'com', 'cor', 'tamanho', 'kit', 'branco', 'branca'}


def slug(link):
    p = [x for x in str(link or '').split('?')[0].split('/') if x]
    return p[-2] if len(p) >= 2 and p[-1] == 'p' else (p[-1] if p else '')


itens = {it[0]: it for it in D['itens']}
suspeitas = {}
por_url = collections.defaultdict(list)
for c, f in F.items():
    if f.get('url') and c in itens:
        por_url[f['url']].append(c)
for c, f in F.items():
    it = itens.get(c)
    if not it or not f.get('url'):
        continue
    nome, sl = it[1], slug(f.get('link'))
    a, b = toks(nome), toks(sl.replace('-', ' '))
    motivo = []
    if a and b and not (a & b):
        motivo.append('nome do item sem nenhuma palavra em comum com o produto do site (' + sl + ')')
    cats_site = (b & MOVEIS) - a
    if cats_site and not (a & MOVEIS):
        motivo.append('produto do site parece móvel (' + ','.join(sorted(cats_site)) + ') e o item não é')
    if len(por_url[f['url']]) > 1:
        outros = [x for x in por_url[f['url']] if x != c and not (toks(itens[x][1]) & a)]
        if outros:
            motivo.append('mesma imagem em itens de nomes diferentes: ' + ', '.join(outros[:3]))
    if motivo:
        suspeitas[c] = motivo
json.dump(suspeitas, open(os.path.join(AQUI, 'dados', 'fotos_suspeitas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
com = sum(1 for f in F.values() if f.get('url'))
print(f'fotos no cache: {com} | suspeitas: {len(suspeitas)}')
for c, m in list(suspeitas.items())[:60]:
    print(' ', c, '|', itens[c][1][:55], '|', ' ; '.join(m)[:150])
