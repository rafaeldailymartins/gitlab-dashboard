# Design: create-gitlab-dashboard

## Context

Projeto novo (repo vazio). Referência: jira-dashboard (Vite SPA + proxy Express que consulta worklogs do Jira e agrega horas por dia). Aqui a fonte de dados é a API GraphQL do GitLab, que tem uma query dedicada — `Query.timelogs(startDate, endDate, username, groupId, projectId)` — retornando entradas com `spentAt`, `timeSpent` (segundos), `summary`, `user`, `issue`, `mergeRequest` e `project`. Diferente do Jira (buscar issues → buscar worklogs por issue), uma única query paginada resolve tudo, incluindo timelogs de outros usuários.

## Goals / Non-Goals

**Goals:**

- Relatório de horas por dia a partir de timelogs do GitLab, com filtro de usuário (todos ou um específico).
- Token do GitLab exclusivamente no servidor (server functions do TanStack Start).
- Estrutura FSD navegável por agentes de IA; documentação mínima e suficiente.

**Non-Goals:**

- Registrar/editar timelogs (somente leitura).
- Autenticação de múltiplos usuários no app (single-tenant, um token via `.env`).
- Persistência/banco de dados (dados sempre buscados da API do GitLab).
- Gráficos complexos (a tabela com barras cobre a necessidade).

## Decisions

### 1. TanStack Start em vez de SPA + proxy Express

O jira-dashboard precisa de um servidor Express separado para esconder o token. TanStack Start elimina esse processo extra: `createServerFn` roda no servidor, lê `process.env.GITLAB_TOKEN` e devolve dados já agregados ao cliente. Menos código, um único processo, type-safety ponta a ponta.

### 2. Agregação no servidor

A server function devolve o `DailySummary` pronto (linhas por dia + totais), não timelogs crus. O cliente só renderiza. Racional: a agregação é regra de negócio testável e independente de UI; o payload fica pequeno; o detalhe do dia reutiliza a mesma resposta (sem segunda chamada — os dados do período já contêm o breakdown por dia).

### 3. GraphQL `Query.timelogs` com paginação por cursor

Uma única query cobre issues e MRs, qualquer usuário e intervalo de datas — sem o fan-out issue-por-issue do Jira. Escopo via `fullPath` do grupo ou projeto (resolvido para ID GraphQL), filtro opcional `username`. Paginação `first: 100` + `after` até `hasNextPage = false`.

Alternativa considerada: REST API — descartada, exige iterar issues/MRs e não filtra timelog por data.

### 4. FSD adaptado ao roteamento do TanStack Start

TanStack Start exige `src/routes/` (file-based routing). Rotas ficam finas (só `createFileRoute` + wiring) e delegam para `pages/` do FSD:

```
src/
  routes/                  # TanStack Start (gerado + arquivos de rota finos)
    __root.tsx
    index.tsx              # → pages/dashboard
    day.$date.tsx          # → pages/day-detail
  app/                     # estilos globais, providers, router
  pages/                   # dashboard, day-detail (composição das telas)
  widgets/                 # daily-hours-table, period-summary (blocos de UI)
  features/                # period-filter, user-filter (interação)
  entities/timelog/        # tipos de domínio, agregação, server function, queries
  shared/                  # ui (shadcn), lib (utils, formatação), config
```

Regra de import FSD: camada só importa de camadas abaixo (`shared` ← `entities` ← `features` ← `widgets` ← `pages`). `entities/timelog` concentra o domínio: tipos, `aggregateTimelogs`, `getTimelogReport` (server fn), `timelogReportQueryOptions`.

### 5. Filtro de usuário aplicado na agregação (servidor)

A server function sempre busca os timelogs do escopo inteiro (grupo/projeto) e aplica o filtro de usuário durante a agregação. Como o filtro é pós-busca, funciona para qualquer username — inclusive digitado livremente na UI.

A lista `users` da resposta é a união dos **membros do escopo** (query `groupMembers`/`projectMembers`) com os **autores de timelogs do período**. Listar membros exige que o dono do token seja membro direto do grupo configurado; quando o GitLab nega (comum quando a membresia é só em subgrupos), o servidor degrada silenciosamente para apenas os autores de timelogs. Por isso a UI usa um combobox pesquisável que também aceita `@username` livre — o filtro não depende da lista.

Alternativa considerada: passar `username` como argumento do GraphQL — busca menos dados, mas a resposta filtrada não traria os demais usuários para o seletor, exigindo segunda query ou cache frágil no cliente.

### 6. Config via `.env` validada com zod

`GITLAB_BASE_URL` (default `https://gitlab.com`), `GITLAB_TOKEN` (obrigatório), `GITLAB_GROUP_PATH` **ou** `GITLAB_PROJECT_PATH` (exatamente um), `GITLAB_TIME_ZONE` (default `America/Sao_Paulo`). Validação com zod no servidor; erro de config vira mensagem clara na UI.

### 7. UI: shadcn/ui + TanStack Table, datas com `Intl`

Mesmo trio do projeto de referência (Table para ordenação, badges para breakdown, skeleton para loading). Sem lib de datas — `Intl.DateTimeFormat` com time zone resolve formatação e bucketing por dia. Estado do período/usuário na URL (search params do TanStack Router) para links compartilháveis.

## Risks / Trade-offs

- [Permissão insuficiente para ver timelogs de terceiros] → A query retorna apenas o que o token pode ver; a UI mostra normalmente o subconjunto visível. README documenta a exigência de Reporter+.
- [Períodos longos com muitos timelogs] → paginação por cursor com limite de segurança (ex.: 20 páginas ≈ 2000 timelogs); se atingido, resposta sinaliza truncamento e UI avisa.
- [`spentAt` chega em UTC; o dia "real" depende do fuso] → bucketing por dia usa `GITLAB_TIME_ZONE` via `Intl.DateTimeFormat`, igual à solução do jira-dashboard.
- [TanStack Start ainda evolui a API (v1 recente)] → fixar versões no package.json; boilerplate mínimo seguindo docs oficiais atuais.
