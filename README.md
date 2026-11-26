# Receita DEC (INF DEC + ADT DEC)

Web app estático que substitui a leitura manual do Comparativo Anual para os grupos **INF DEC** e **ADT DEC**.

## O que é
Quatro abas no topo: **INF DEC**, **ADT DEC**, **Completo** (todo mundo: INF + ADT juntos, todas as classes e linhas numa lista só; classes iguais nos dois grupos levam "· INF" / "· ADT") e **Fornecedores** (mesma tela, mas a lista da esquerda é de fornecedores, somando INF + ADT; dentro de cada fornecedor aparecem as linhas por classe, com os 5 mais vendidos em foto). Dentro de Fornecedores há os botões **INF + ADT / INF DEC / ADT DEC** para ver os fornecedores de cada universo. Onde o item não tem markup (ex.: não vendeu no ano anterior), aparece o **markup da classe**, marcado como "(classe)". O **Markup** aparece em percentual, como na coluna Mk da dinâmica (ex.: 137,89%), com o de 2025 e a diferença **Mk 2025 − Mk 2026** em pontos percentuais.

App simples para **mostrar os produtos** a quem vai comprar: escolhe **INF DEC** ou **ADT DEC**, uma **classe**, e vê cada **linha** com os 5 produtos mais vendidos em foto (ver todos com um clique). Cada produto mostra quanto vende, markup, fornecedor e posição de venda. **Peso de cada nível no de cima:** a classe mostra quanto é do total do INF/ADT, a linha quanto é da classe e o produto quanto é da linha (com barrinha; no detalhe aparecem os três); o detalhe traz 2026 × 2025 e as vendas mês a mês, com ‹ › para passar de produto em produto. Um seletor de mês (ano todo ou um mês), uma busca (nome, código, fornecedor ou linha) e filtros com **caixas de marcar (várias opções de uma vez)**: **Fornecedor, Linha, Posição (imediata, encomenda, loja, suspensa, fora de linha), Markup (negativo, abaixo de 1, 1 a 2, acima de 2) e Ordenar por** (mais vendidos, maior/menor markup, mais cresceram/caíram). Os filtros mexem em tudo ao mesmo tempo: abas, classes, linhas e cartões. Modo claro/escuro e o símbolo da Abra sempre visível.

## Classe do catálogo (≠ classe da planilha em 109 itens)
O catálogo agrupa por tipo de produto: **o que é almofada fica em Almofadas, o que é luminária fica em Iluminação/Luminárias**. As regras ficam em `gerar.py` (`classe_catalogo`, `FUSOES`) e valem só **dentro do mesmo grupo** (INF DEC ou ADT DEC), então os totais por grupo não mudam; por classe eles diferem das dinâmicas da planilha. A classe original aparece no detalhe do produto ("Classe na planilha").
- Almofadas: nome começando com Almofada / Capa de (ou p/) Almofada / Kit de almofadas → "INF DEC Almofadas" ou "ADT DEC Almofadas e Enchimentos" (inclui as almofadas de amamentação que estavam em Enxoval).
- Fusões: ADT "Garden Almofadas e Enchimen" → Almofadas e Enchimentos; INF "Abajour e Luminárias" → Luminárias; INF "PELUCIA" → Bonecos e Pelúcia; ADT "Cachepot e Vaso" → Vasos.
- ADT: **Iluminação Piso, Iluminação Mesa e a genérica Iluminação viram uma classe só, "Iluminação"** (41 itens; luminária é luminária). Mantas infantis (em Enxoval) e quadros (em Adornos) ficam como na planilha.
- **Buscar classe**: campo "Buscar classe…" em todas as abas (INF, ADT, Completo e Fornecedores); "luminária" também acha as classes "Iluminação".

## Filtros (caixas de marcar)
Fornecedor, Linha, Posição, Markup e (em Iluminação) Tipo de iluminação são caixas de seleção múltipla: tudo marcado = sem filtro; desmarcar uma opção = "tudo, menos essa". Posição: cada produto cai numa categoria só — Entrega imediata, Encomenda / prazo, Estoque loja, Venda suspensa, Sem posição e **Fora de linha** (tem prioridade sobre as outras), então dá para ver "tudo menos fora de linha". Markup: Negativo, Abaixo de 100%, De 100% a 200%, Acima de 200%, Sem markup. Tipo de iluminação (Piso / Mesa / Parede / Outras, pelo nome do produto) aparece só ao olhar a classe Iluminação/Luminárias ou buscar "luminária".

## Venda por loja e por estado
- Filtros **Loja** (21 lojas, com o canal: RJ, SP, E-Commerce, MarketPlace…) e **Estado** (25 UFs), de marcar. Valem para tudo (abas, classes, linhas, cartões, totais); os percentuais passam a ser **dentro** da loja/estado escolhidos.
- Com loja ou estado escolhido, unidades e preço vendido (Hub) não aparecem, porque o Hub não está nesse recorte; fica o preço de tabela.
- No detalhe do produto: tabelas **Venda por loja** e **Venda por estado** (2026, % e 2025).
- Origem: colunas Loja e Estado da aba Dados do Comparativo (Estado = UF da venda; no E-Commerce é o destino).

## Preço médio e unidades
- **Preço de tabela**: Ritmo (Preço Venda); no cabeçalho de classe/linha é a média ponderada pela venda.
- **Preço médio vendido e unidades (2026)**: vendas do Innovaro no Hub (`../abra-novos-produtos/dados/vendas_loja.json`, lido pelo `gerar.py --hub`), valor ÷ unidades, até o mesmo dia da planilha e respeitando o mês escolhido. Cobre 859 dos 1.247 itens (97% da receita), só 2026. O valor do Hub é bruto (~11% acima da receita da planilha), por isso o preço vendido nunca é misturado com a receita da planilha.
- **Ticket médio por pedido não existe** nos dados (sem número de pedido).

## Proporções (peso de cada nível)
Sempre sobre o **total inteiro**, mesmo com filtros ligados: classe ÷ total do universo, linha ÷ **classe inteira**, produto ÷ **classe inteira** (é o número principal do cartão: item de R$ 210 mil numa classe de R$ 653 mil = 32,3%) e, ao lado, produto ÷ **linha inteira**. Com um filtro, o percentual mostra a fatia que sobrou dentro do todo (ex.: Realtha = 72,7% do Enxoval). No Fornecedores, a linha é % da classe inteira (todos os fornecedores) e o produto % da linha inteira; o detalhe também mostra o peso no fornecedor.

## Datas por produto (detalhe)
- **Cadastro** (Ritmo).
- **1ª venda em loja** (lojas físicas RJ e SP, base de vendas a partir de 01/01/2025; "01/01/2025 ou antes" quando cai na primeira semana da base).
- **1ª entrada em loja**: o campo existe no Análise de Lançamentos mas está **vazio** (aguardando o arquivo). Se existir `dados/complementos.csv` (colunas `Recurso;Primeira entrada;Publicacao`, datas dd/mm/aaaa), o app passa a mostrar a 1ª entrada no lugar da 1ª venda.

## Regras (conferidas contra as dinâmicas da planilha)
- Receita = `Rec` · Margem = `Mg C` · **Mk = (Rec − Cmv) ÷ Cmv**.
- Classe = "Classe Rec" do Ritmo · **Linha = Marca do Ritmo** (nos ADT DEC a "Linha" é o material).
- **Ano comparável** = flag `Excluir Ano` = n (meses completos; mês corrente só até o dia da planilha, nos dois anos).
  **Dias 1–N de cada mês** = flag `Excluir` = n.
- Fornecedor = coluna Fornecedor da aba Dados, com nomes padronizados (sufixos S/A, Filial, (SP2) removidos); item com mais de um fornecedor fica com o de maior receita.
- Item = código (9 primeiros caracteres do Recurso): a dinâmica separa o mesmo código por nome antigo/novo; o app une.
- Posição = coluna Situação do relatório Ritmo (Imediata/Encomenda/Prazo/Estoque loja/Suspensa/Sem posição; "FL" = fora de linha).

## Rotina diária (só base real)
`diario.py` (chamado por `atualizar-receita-diario.bat`, Agendador do Windows ~09:20): espera o Ritmo **de hoje** (`../Ritmo_Diario` ou Downloads, até 11:30; sem ele **não publica**), usa o `Comparativo_Anual*.xlsm/.xlsx` mais novo (`../Comparativo_Diario` ou Downloads) para as vendas, roda `gerar.py`, confere que as vendas nunca voltam no tempo, monta o `dist` e publica no Firebase. Resultado em `dados/ultimo-status.json` e `atualizar-receita.log`. O app mostra "Vendas até DD/MM · posições do Ritmo de DD/MM" e fica **vermelho** quando as vendas estão atrasadas (> 3 dias). **Para as vendas ficarem em dia, salve o Comparativo atualizado em `../Comparativo_Diario`.**
Agendar (uma vez): `schtasks /Create /TN "Receita DEC - diario" /TR "<pasta>bra-receita-dectualizar-receita-diario.bat" /SC DAILY /ST 09:20`

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
- Fotos: busca na VTEX pública das **duas lojas** (Abra Casa e Abra Cadabra). Só vale a foto do SKU cuja referência no site é exatamente o código do item (sem plano B por ID do Ritmo, que trazia foto de outro produto); sem foto confirmada, aparece o símbolo da Abra. `python auditar_fotos.py` confere o nome do item contra o produto do site e imagens repetidas.
