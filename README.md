# Receita DEC (INF DEC + ADT DEC)

Web app estático que substitui a leitura manual do Comparativo Anual para os grupos **INF DEC** e **ADT DEC**.

## Estrutura
- **Abas de universo no topo: INF DEC · ADT DEC · Visão geral** (cada uma com sua cor); o símbolo da Abra fica sempre visível (cabeçalho, abas, canto da tela, gaveta, detalhe do item e no lugar das fotos que faltam).
- Modo claro/escuro (segue o tema do sistema; botão no cabeçalho).
- O link da barra de endereço guarda filtros e seleção: dá para mandar a visão pronta para outra pessoa.
- Filtros ativos aparecem como etiquetas removíveis.

## Abas
- **Compradora · Classe › Linha › Item** – visão guiada para quem vai comprar: o que vende, markup, fornecedores e pontos de atenção; clique na classe, depois na linha, e chega aos itens (foto, fornecedor, posição, ABC, Mk vs. seleção, mês a mês).
- **Fornecedores** – ranking (barras com 4 visões) e tabela; detalhe por classe/linha; nomes unificados.
- **Qualidade dos dados** – conferência com a planilha (receita, margem e CMV por grupo/ano) e verificações clicáveis (sem foto, sem posição, suspensos com venda, linha genérica, Mk negativo/alto, receita negativa, mais de um fornecedor, nomes de fornecedor parecidos).
- **Resumo** – KPIs (receita, margem, markup, itens com venda), mês a mês 2026 × 2025 (5 visões), classes (4 visões), INF × ADT.
- **Anual · Classe › Linha › Item** – árvore expansível (ou Linha › Classe › Item) com Rec 26/25, var., Mg, Mg %, Mk 26/25, Δ Mk e % do nível acima.
- **Mensal** – mapa de calor mês a mês por Grupo/Classe/Linha/Item, 8 métricas, gráfico do recorte clicado.
- **Itens · Markup** – todos os itens com foto, posição, receita, margem e markup; filtros, ordenação, CSV.
- **Top por linha** – mais vendidos de cada linha (foto + posição), alerta de top vendido suspenso/fora de linha.
- **Classe × Linha × Recurso** – matriz (% da linha na classe, % da classe na linha, R$, Mk, var.) e, por classe, recurso em proporção do que vende (% na classe, acumulado, ABC, % na linha, variação de participação) + mix por linha + Pareto.

Todo número é clicável (gaveta com os itens que o compõem; clique no item abre o detalhe).

## Regras (conferidas contra as dinâmicas da planilha)
- Receita = `Rec` · Margem = `Mg C` · **Mk = (Rec − Cmv) ÷ Cmv**.
- Classe = "Classe Rec" do Ritmo · **Linha = Marca do Ritmo** (nos ADT DEC a "Linha" é o material).
- **Ano comparável** = flag `Excluir Ano` = n (meses completos; mês corrente só até o dia da planilha, nos dois anos).
  **Dias 1–N de cada mês** = flag `Excluir` = n.
- Fornecedor = coluna Fornecedor da aba Dados, com nomes padronizados (sufixos S/A, Filial, (SP2) removidos); item com mais de um fornecedor fica com o de maior receita.
- Item = código (9 primeiros caracteres do Recurso): a dinâmica separa o mesmo código por nome antigo/novo; o app une.
- Posição = coluna Situação do relatório Ritmo (Imediata/Encomenda/Prazo/Estoque loja/Suspensa/Sem posição; "FL" = fora de linha).

## Atualizar
```
python gerar.py --planilha "C:/.../Comparativo_Anual_....xlsm" --ritmo "C:/.../Relatorio_Ritmo_Abra_AAAAMMDDHHMM.csv"
```
Gera `public/dados.js` (usa/atualiza o cache `dados/fotos.json`; `--sem-fotos` pula a busca). Requer `openpyxl`.
Teste local: `node serve-local.js` e abrir http://localhost:8821/ (ou abrir `public/index.html` direto; as fotos precisam de internet).

## Publicar (Firebase Hosting, acesso só por senha)
```
python gerar.py ...            # gera public/dados.js (fica fora do git)
python publicar.py             # criptografa os dados com a senha e monta dist/
firebase deploy --only hosting:receita
```
- Site: https://abra-receita-dec.web.app (site no projeto `abra-hub-campanhas`, só hospedagem, sem Firestore).
- A senha fica em `ACESSO-INICIAL.txt` (fora do git e do deploy); para trocar, edite a linha `Senha:` e rode os dois comandos acima.
- Os dados vão **criptografados** (`dist/dados.enc`, AES-256-GCM, chave PBKDF2-SHA256 da senha): sem a senha os números não ficam legíveis nem no arquivo publicado. Quem tem a senha vê tudo; o código do app é público e não contém dados.

## Pendente
- Fotos: busca só na VTEX pública (itens suspensos/fora do ar ficam sem foto).
