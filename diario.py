#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rotina diária do Receita DEC (chamada pelo Agendador do Windows, atualizar-receita-diario.bat, ~09:20).
Só base real: vendas = planilha Comparativo mais nova; posições = Relatório Ritmo de HOJE.

  1) acha o Relatorio_Ritmo_Abra_AAAAMMDDHHMM.csv DE HOJE (../Ritmo_Diario ou Downloads); espera até --ate (padrão 11:30), tentando a cada 10 min;
     sem o Ritmo de hoje NÃO publica (não republica dado velho como se fosse novo);
  2) acha o Comparativo_Anual*.xlsm/.xlsx mais novo (../Comparativo_Diario ou Downloads) - é dele que vêm as vendas;
  3) gera os dados (gerar.py), confere (itens, totais, e que as vendas nunca voltem para trás), monta o dist (publicar.py) e publica no Firebase;
  4) grava dados/ultimo-status.json e o log. O app mostra "Vendas até DD/MM" e avisa em vermelho quando as vendas estão atrasadas.

Uso:  python diario.py [--ate=11:30] [--forcar]   (--forcar = não espera nem exige o Ritmo de hoje)
"""
import datetime, glob, json, os, re, subprocess, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
DADOS = os.path.join(AQUI, 'dados')
STATUS = os.path.join(DADOS, 'ultimo-status.json')
args = sys.argv[1:]
FORCAR = '--forcar' in args
ATE = next((a.split('=', 1)[1] for a in args if a.startswith('--ate=')), '11:30')
PROJETO, ALVO = 'abra-hub-campanhas', 'hosting:receita'


def agora():
    return datetime.datetime.utcnow() - datetime.timedelta(hours=3)   # Brasília


def log(*a):
    print(agora().strftime('%d/%m/%Y %H:%M:%S'), *a, flush=True)


def status(**kw):
    os.makedirs(DADOS, exist_ok=True)
    kw['em'] = agora().strftime('%Y-%m-%d %H:%M')
    with open(STATUS, 'w', encoding='utf-8') as f:
        json.dump(kw, f, ensure_ascii=False, indent=1)


def pastas(*nomes):
    return [os.path.join(AQUI, '..', n) for n in nomes] + [os.path.join(os.environ.get('USERPROFILE', ''), 'Downloads')]


def ritmo_mais_novo():
    achados = []
    for p in pastas('Ritmo_Diario'):
        for f in glob.glob(os.path.join(p, 'Relatorio_Ritmo_Abra_*.csv')):
            m = re.search(r'_(\d{12})\.csv$', f)
            if m: achados.append((m.group(1), f))
    return max(achados)[1] if achados else None


def comparativo_mais_novo():
    achados = []
    for p in pastas('Comparativo_Diario'):
        for ext in ('xlsm', 'xlsx'):
            for f in glob.glob(os.path.join(p, 'Comparativo_Anual*.' + ext)):
                achados.append((os.path.getmtime(f), f))
    return max(achados)[1] if achados else None


def dados_ate(arq='public/dados.js'):
    try:
        t = open(os.path.join(AQUI, arq), encoding='utf-8').read()
        return re.search(r'"dadosAte":"([\d-]+)"', t).group(1)
    except Exception:
        return ''


def main():
    hoje = agora().strftime('%Y%m%d')
    h, m = [int(x) for x in ATE.split(':')]
    limite = h * 60 + m
    rit = ritmo_mais_novo()
    while not FORCAR and not (rit and os.path.basename(rit).split('_')[-1].startswith(hoje)):
        a = agora()
        if a.hour * 60 + a.minute >= limite:
            log('Sem o Ritmo de hoje até', ATE, '- NÃO publica.')
            status(resultado='sem_ritmo', ritmo=os.path.basename(rit) if rit else '')
            return 2
        log('Aguardando o Ritmo de hoje (tenta de novo em 10 min)…'); time.sleep(600); rit = ritmo_mais_novo()
    comp = comparativo_mais_novo()
    if not rit or not comp:
        log('Faltam arquivos. Ritmo:', rit, '| Comparativo:', comp); status(resultado='falta_arquivo'); return 2
    antes = dados_ate()
    log('Ritmo:', os.path.basename(rit)); log('Comparativo:', os.path.basename(comp))
    r = subprocess.run([sys.executable, 'gerar.py', '--planilha', comp, '--ritmo', rit], cwd=AQUI, env=dict(os.environ, PYTHONIOENCODING='utf-8'))
    if r.returncode: status(resultado='erro_gerar'); return 1
    depois = dados_ate()
    if antes and depois and depois < antes:   # vendas nunca podem voltar no tempo
        log('Vendas voltaram de', antes, 'para', depois, '- NÃO publica (Comparativo mais antigo que o publicado).'); status(resultado='vendas_voltaram', antes=antes, depois=depois); return 2
    d = open(os.path.join(AQUI, 'public', 'dados.js'), encoding='utf-8').read()
    if d.count('"cod"') + d.count('[["') < 1 or '"conf":[[' not in d:
        log('Dados incompletos - NÃO publica.'); status(resultado='dados_incompletos'); return 1
    if subprocess.run([sys.executable, 'publicar.py'], cwd=AQUI, env=dict(os.environ, PYTHONIOENCODING='utf-8')).returncode:
        status(resultado='erro_publicar'); return 1
    r = subprocess.run(['firebase.cmd' if os.name == 'nt' else 'firebase', 'deploy', '--only', ALVO, '--project', PROJETO], cwd=AQUI)
    if r.returncode: status(resultado='erro_deploy'); return 1
    atraso = (agora().date() - datetime.date.fromisoformat(depois)).days if depois else None
    log('Publicado. Vendas até', depois, '(atraso de', atraso, 'dias).')
    status(resultado='ok', vendasAte=depois, atrasoDias=atraso, ritmo=os.path.basename(rit), comparativo=os.path.basename(comp))
    return 0


if __name__ == '__main__':
    sys.exit(main())
