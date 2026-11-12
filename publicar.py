#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monta dist/ para o Firebase Hosting com ACESSO SÓ POR SENHA.
Os dados (receita, margem, markup, fornecedores, miniaturas das fotos) ficam num arquivo criptografado
(dist/dados.enc: PBKDF2-SHA256 + AES-256-GCM). O navegador só abre depois de digitar a senha; sem ela os
números não ficam legíveis nem no arquivo publicado. O código do app (HTML/JS/CSS) é público e não tem dado nenhum.

Senha: variável de ambiente RDEC_SENHA ou a linha "Senha:" de ACESSO-INICIAL.txt (arquivo fora do git e do deploy).
Se o arquivo não existir, gera uma senha forte e cria o arquivo.

Uso:  python gerar.py ...   (gera public/dados.js)   ->   python publicar.py   ->   firebase deploy --only hosting
"""
import base64, gzip, io, json, os, re, secrets, shutil, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

AQUI = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(AQUI, 'public')
DIST = os.path.join(AQUI, 'dist')
THUMBS = os.path.join(AQUI, 'dados', 'thumbs')
ACESSO = os.path.join(AQUI, 'ACESSO-INICIAL.txt')
TAM = 128
ITER = 300000


def ler(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def senha():
    if os.environ.get('RDEC_SENHA'):
        return os.environ['RDEC_SENHA']
    if os.path.exists(ACESSO):
        m = re.search(r'^Senha:\s*(.+)$', ler(ACESSO), re.M)
        if m:
            return m.group(1).strip()
    alfa = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    s = '-'.join(''.join(secrets.choice(alfa) for _ in range(4)) for _ in range(4))
    with open(ACESSO, 'w', encoding='utf-8') as f:
        f.write('Receita DEC - acesso\nSite: https://abra-receita-dec.web.app\nSenha: ' + s + '\n\n'
                'Para trocar a senha: edite a linha "Senha:" acima, rode "python publicar.py" e "firebase deploy --only hosting".\n'
                'Este arquivo NAO vai para o git nem para o site (.gitignore / firebase.json).\n')
    return s


def miniatura(cod, url):
    dest = os.path.join(THUMBS, cod + '.jpg')
    if os.path.exists(dest):
        return dest
    u = urllib.parse.quote(url, safe=":/%?=&")
    for _ in range(3):
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 ReceitaDecThumbs'})
            with urllib.request.urlopen(req, timeout=30) as r:
                im = Image.open(io.BytesIO(r.read()))
            im = im.convert('RGBA'); bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[3])
            bg.thumbnail((TAM, TAM)); os.makedirs(THUMBS, exist_ok=True); bg.save(dest, 'JPEG', quality=72, optimize=True)
            return dest
        except Exception:
            pass
    return None


LOCK_CSS = """
#lock{position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg)}
#lock form{width:min(380px,100%);background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:var(--sh2);padding:28px 26px;display:flex;flex-direction:column;gap:12px;text-align:center}
#lock img{width:64px;height:64px;border-radius:14px;margin:0 auto}
#lock h1{font-size:20px}
#lock input{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--surface);font-size:16px;text-align:center}
#lock button{border:0;border-radius:10px;padding:10px 12px;background:var(--accent);color:#fff;font-weight:600;font-size:15px;cursor:pointer}
#lock .err{color:var(--bad);min-height:20px;font-size:13px}
:root[data-theme="dark"] #lock button{color:#150F0D}
"""

LOCK_HTML = """
<div id="lock"><form id="lockf" autocomplete="off">
  <img src="logo-abra.svg" alt="Abra"><h1>Receita DEC</h1><div class="muted">INF DEC e ADT DEC · Abra Casa · Abra Cadabra</div>
  <input type="password" id="lockp" placeholder="Senha de acesso" autocomplete="current-password" autofocus required>
  <button type="submit" id="lockb">Entrar</button><div class="err" id="locke"></div>
</form></div>
<script>
(function () {
  var ITER = %(iter)d;
  function bytes(buf) { return new Uint8Array(buf); }
  async function chave(senha, salt) {
    var k = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: ITER, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }
  async function abrir(key, arq) {
    var d = bytes(arq), plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.slice(16, 28) }, key, d.slice(28));
    var txt = await new Response(new Blob([plano]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return JSON.parse(txt);
  }
  function carregar(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  async function iniciar(dec) {
    window.DEC = dec;
    await carregar('logica.js'); await carregar('app.js');
    var l = document.getElementById('lock'); if (l) l.remove();
  }
  async function arquivo() { var r = await fetch('dados.enc', { cache: 'no-cache' }); if (!r.ok) throw new Error('dados'); return r.arrayBuffer(); }
  // lembra a chave (não a senha) só nesta aba, para o F5 não pedir de novo
  (async function () {
    try {
      var k = sessionStorage.getItem('rdec-k'); if (!k) return;
      var key = await crypto.subtle.importKey('raw', Uint8Array.from(atob(k), function (c) { return c.charCodeAt(0); }), 'AES-GCM', false, ['decrypt']);
      await iniciar(await abrir(key, await arquivo()));
    } catch (e) { try { sessionStorage.removeItem('rdec-k'); } catch (e2) {} }
  })();
  document.getElementById('lockf').addEventListener('submit', async function (e) {
    e.preventDefault();
    var b = document.getElementById('lockb'), er = document.getElementById('locke'), p = document.getElementById('lockp');
    b.disabled = true; er.textContent = 'Verificando…';
    try {
      var arq = await arquivo(), salt = bytes(arq).slice(0, 16), key = await chave(p.value, salt), dec;
      try { dec = await abrir(key, arq); } catch (x) { await new Promise(function (r) { setTimeout(r, 1200); }); er.textContent = 'Senha incorreta.'; b.disabled = false; p.select(); return; }
      try { var raw = new Uint8Array(await crypto.subtle.exportKey('raw', key)); sessionStorage.setItem('rdec-k', btoa(String.fromCharCode.apply(null, raw))); } catch (x) {}
      p.value = ''; await iniciar(dec);
    } catch (x) { er.textContent = 'Não foi possível abrir os dados. Tente recarregar a página.'; b.disabled = false; }
  });
})();
</script>
"""


def main():
    dj = ler(os.path.join(PUB, 'dados.js'))
    D = json.loads(dj[len('window.DEC='):].rstrip().rstrip(';'))
    alvo = [(it[0], it[14]) for it in D['itens'] if it[14]]
    print('fotos a reduzir:', len(alvo), flush=True)
    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda x: (x[0], miniatura(*x)), alvo))
    ok = {c: p for c, p in res if p}
    print('miniaturas ok:', len(ok), 'falhas:', len(alvo) - len(ok), flush=True)
    for it in D['itens']:
        p = ok.get(it[0])
        it[14] = ('data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()) if p else ''

    # criptografa os dados (gzip -> AES-256-GCM, chave PBKDF2-SHA256 da senha)
    pw = senha()
    bruto = gzip.compress(json.dumps(D, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), 9)
    salt, iv = os.urandom(16), os.urandom(12)
    key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode('utf-8'))
    cifrado = AESGCM(key).encrypt(iv, bruto, None)

    os.makedirs(DIST, exist_ok=True)
    for n in os.listdir(DIST):   # limpa só os arquivos (a pasta pode estar em uso por um servidor/OneDrive)
        p = os.path.join(DIST, n)
        if os.path.isfile(p):
            os.remove(p)
    with open(os.path.join(DIST, 'dados.enc'), 'wb') as f:
        f.write(salt + iv + cifrado)
    for n in ('app.js', 'logica.js', 'app.css', 'logo-abra.svg'):
        shutil.copy(os.path.join(PUB, n), os.path.join(DIST, n))
    html = ler(os.path.join(PUB, 'index.html'))
    html = html.replace('<script src="dados.js" charset="utf-8"></script>\n', '')
    html = re.sub(r'<script src="logica.js"[^>]*></script>\n?', '', html)
    html = re.sub(r'<script src="app.js"[^>]*></script>\n?', '', html)
    html = html.replace('</head>', '<style>' + LOCK_CSS + '</style>\n</head>', 1)
    html = html.replace('</body>', LOCK_HTML % {'iter': ITER} + '</body>', 1)
    assert 'dados.js' not in html and 'app.js"' not in html.split('<div id="lock">')[0]
    with open(os.path.join(DIST, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print('dist pronto: dados.enc %.2f MB' % (os.path.getsize(os.path.join(DIST, 'dados.enc')) / 1e6), '| senha em', ACESSO)


if __name__ == '__main__':
    main()
