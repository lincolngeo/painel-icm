# Painel ICM — Indicador de Capacidade Municipal

Geovisualizador interativo dedicado ao **ICM** (SEDEC/MIDR): traduz o indicador
em mapa navegável por UF e município, com todas as 20 variáveis, as três
dimensões, faixas A–D, perfil de risco e a metodologia oficial — com referência
geográfica e imagem de satélite, o que não existe hoje em termos de ICM.

## Funcionalidades

- **Mapa Brasil → UF → município** (clique ou busca nominal), sobre satélite
  (Esri), fundo claro, ruas ou branco (offline), com escala, norte, coordenadas
  do cursor e tela cheia. O panorama nacional tem duas visões: **Municípios**
  (padrão — todos os municípios do país coloridos pela faixa do ICM) e
  **Estados** (agregado por UF, faixa predominante), alternáveis por botão.
- **Visualizar por**: Faixa ICM · Pontuação (0–20) · Perfil de risco; filtro por
  faixa A/B/C/D.
- **Hover** na UF: distribuição por faixa (nº e %), predominante, média
  municipal, prioritários. Hover no município: faixa, pontos, dimensões, porte,
  perfil, população.
- **Ficha do município** (clique ou busca), com rolagem e três abas:
  *Resumo* (todas as colunas do ICM) · *20 variáveis* (nome completo, Sim/Não,
  por dimensão) · *Como avançar* (o que falta, por dimensão, para a próxima
  faixa — Tabela 4 da Nota Técnica).
- **Painel lateral**: busca, cards (nº de municípios, média, distribuição por
  faixa, comparativo C+D UF × região × Brasil), gráfico de faixas com número e
  percentual, prioritários × não prioritários, lista rolável ranqueada.
- **Menu "As 20 variáveis"**: catálogo clicável com a explicação de cada
  variável (conforme a metodologia) e o % de municípios brasileiros que a
  possuem. **Menu "Metodologia"**: faixas, dimensões, requisitos por grupo e
  links para a página oficial e o PDF das Notas Técnicas.

## Narrativa automática e exportações

- **Síntese textual** (cartão no painel esquerdo): texto gerado por
  regras a partir dos dados carregados — panorama nacional sem seleção,
  destaques da UF ao entrar num estado, observações do município ao clicar.
  Determinístico e offline (não usa IA).
- **Municípios sem apuração no ICM** (3 casos, ex.: Boa Esperança do Norte/MT)
  aparecem em cinza, identificados como “sem informação no ICM”.
- **População** é a estimativa IBGE de 1º/jul/2025 (POP2025), por município e
  somada por UF.
- **Exportar** (caixinha no mapa, logo abaixo do controle de camadas; abre no
  hover): do recorte atual (Brasil / UF / município) — **Relatório (PDF)** via
  impressão do navegador (com narrativa, tabela de faixas e gráficos, quebra de
  página cuidada), **CSV**, **GeoJSON** e **KMZ** (Google Earth; a etiqueta de
  cada município traz toda a ficha-resumo do ICM). Tudo no navegador, sem
  servidor.
- **GPKG e Shapefile** (formatos binários) não são gerados no navegador; use o
  script `scripts/etl/exportar_icm_gpkg_shp.py` (GDAL), que grava em
  `dados/processados/gpkg/` e `.../shp/` no padrão do projeto (EPSG:4674).

## Semântica dos agregados por UF

A metodologia oficial atribui faixa e pontuação (0–20) **apenas a municípios**.
Os valores por UF exibidos no painel são **leituras derivadas**: *faixa
predominante* = a mais frequente entre os municípios do estado; *média* =
pontuação média municipal. Isso está sinalizado na interface.

## Dados e metodologia

Gerados por `scripts/etl/etl_icm.py` a partir de
`dados/brutos/icm/ICM_20260428.xlsx` (4 abas = faixas) + malha municipal IBGE
2025 (junção por `cd_mun`, 0 órfãos). O enquadramento reproduz a **Tabela 4 da
Nota Técnica nº 1/2023** (mínimos por dimensão, conforme porte × perfil de
risco) em 99,95% dos 5.570 municípios; 2.086 prioritários (NT nº 004/2026).
Divergências conhecidas da fonte: Cambé/PR, Leme/SP e Trindade/GO constam como
D, mas atenderiam aos requisitos da faixa C.

- `dados/uf.geojson` · `dados/mun/<UF>.geojson` (drill detalhado) ·
  `dados/mun_brasil.geojson` (nacional, todos os municípios, precisão reduzida
  para a visão Brasil–Municípios) · `dados/municipios_icm.csv`
- `dados/meta.json` — variáveis, dimensões, faixas, requisitos, adoção nacional
- `dados/busca.json` — índice da busca nominal

## Identidade visual

Manual de Uso de Marca — Defesa Civil Brasil: **marca quadrada (variação
preferencial)** no cabeçalho, azul `#272F68`, laranja `#F4A44C`; fonte Mukta
(livre, substituta da Museo Sans licenciada), tudo vendorizado.

## Como abrir / publicar

- Local: duplo-clique em **`abrir_painel.bat`** (servidor em
  `http://127.0.0.1:8766/`). Não abra o index.html direto (file:// bloqueia os
  dados).
- Web: subir a pasta para GitHub Pages — 100% estático; satélite/ruas exigem
  internet (a base "Branco (offline)" cobre o uso sem rede).

Elaboração: Lincoln Duques de Barros. Analista de Infraestrutura. SEDEC/MIDR.

## Licença e autoria

© 2026 Lincoln Duques de Barros. Este trabalho está licenciado sob
**Creative Commons Attribution 4.0 International (CC BY 4.0)** — veja o arquivo
[`LICENSE`](LICENSE).

Você pode copiar, redistribuir e adaptar este material para qualquer finalidade,
inclusive institucional, **desde que mantenha a atribuição ao autor**, indique se
houve modificações e referencie a licença.

**Intenção de migração:** este é um protótipo em avaliação, elaborado no âmbito da
SEDEC/MIDR, e destina-se à eventual incorporação institucional pela própria
SEDEC/MIDR. A CC BY 4.0 permite essa migração preservando o crédito de autoria.

Os dados do ICM são públicos (SEDEC/MIDR) e a malha municipal é do IBGE; a licença
deste repositório recai sobre o painel (código, organização e textos), não sobre
os dados oficiais de origem.
