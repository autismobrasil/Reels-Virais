# Reels Virais

App open source para encontrar **notícias**, **assuntos em alta** e **vídeos virais** do Brasil em um só lugar.

- **Em alta:** o que o Brasil está buscando agora (Google Trends), com notícias relacionadas
- **Vídeos:** os vídeos em alta no YouTube Brasil, ordenados por uma pontuação de viralidade
- **Notícias:** manchetes do Google News por categoria (Brasil, Mundo, Economia, Tecnologia, Esportes…)
- **Busca** em todo o conteúdo, sem diferenciar acentos
- **Instalável no celular** (PWA) e funciona offline com a última coleta
- **Acessível:** sem autoplay, alto contraste, modo escuro automático e respeito a "reduzir movimento"

## Como funciona

```
GitHub Actions (a cada 2h)
  └─ collector/collect.mjs ── busca as fontes ── filtra (blocklist) ── public/data/feed.json
GitHub Pages
  └─ public/ (HTML + JS puro) ── lê feed.json ── mostra abas, filtros e busca
```

Não há servidor nem banco de dados: tudo roda de graça no GitHub. O projeto também não tem dependências npm.

### Fontes

| Fonte | O que traz | Precisa de chave? |
|---|---|---|
| Google Trends RSS | Assuntos em alta no Brasil | Não |
| Google News RSS | Notícias por categoria | Não |
| YouTube Data API v3 (`chart=mostPopular`) | Vídeos em alta no Brasil por categoria | Sim (gratuita) |

TikTok e Instagram não oferecem API aberta de busca, por isso não estão incluídos.

### Pontuação de viralidade

```
pontuação = (views + 10 × curtidas + 25 × comentários) / (horas desde a publicação + 2)^1.3
```

Assim, um vídeo novo que está ganhando muitas views por hora fica à frente de um vídeo antigo com muitas views acumuladas. Veja `collector/lib/util.mjs`.

## Rodando localmente

Requer Node.js 22 ou mais recente.

```bash
npm test
```

```bash
npm run collect
```

```bash
npm run dev
```

Depois, abra http://localhost:4173. Sem rodar a coleta, o app mostra dados de exemplo (`public/data/feed.sample.json`).

Para incluir vídeos, crie uma chave da YouTube Data API v3 no [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) e rode:

```bash
YOUTUBE_API_KEY=sua_chave npm run collect
```

A coleta usa cerca de 7 unidades de cota por execução, bem abaixo do limite gratuito de 10.000 por dia.

## Publicando no GitHub Pages

1. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions**, crie o secret `YOUTUBE_API_KEY` (opcional, para os vídeos).
3. O workflow `Coletar e publicar` roda a cada 2 horas e a cada push na `main`. Também dá para rodar manualmente na aba **Actions**.

## Moderação

- `collector/blocklist.json` lista termos, domínios e canais do YouTube que não entram no feed. Acentos e maiúsculas são ignorados.
- Cada item tem um link **Denunciar**, que abre uma issue com o modelo "Denunciar conteúdo".
- O app mostra apenas título, fonte e link. O conteúdo completo continua no site original, e os vídeos tocam pelo player oficial do YouTube.

## Estrutura

```
collector/
  collect.mjs          # ponto de entrada da coleta
  blocklist.json       # moderação
  lib/                 # parser XML, pontuação, moderação
  sources/             # googleNews, googleTrends, youtube
public/                # app web (index.html, app.js, styles.css, sw.js, manifest)
test/                  # testes (node --test)
.github/workflows/     # coleta + deploy, e testes em PRs
```

## Como contribuir

1. Faça um fork e crie um branch.
2. Rode `npm test` antes de abrir o Pull Request.
3. Ideias de contribuição: novas fontes em `collector/sources/` (Reddit, RSS de veículos, GDELT), novos filtros no app, melhorias de acessibilidade e tradução.

Para adicionar uma fonte, crie um módulo que exporte uma função `fetchAlgo({ fetchText })` retornando `{ items, warnings }`, com itens no formato dos existentes (`type: 'news' | 'video' | 'trend'`), e registre-a em `collector/collect.mjs`.

## Licença

[MIT](LICENSE)
