# AGENTS.md

Dashboard de horas por dia baseado em timelogs do GitLab. Leia o `README.md` para setup e variaveis de ambiente.

## Comandos

- `npm run dev` — dev server em http://localhost:3000
- `npm run typecheck` — TypeScript (rodar antes de finalizar mudancas)
- `npm run build` — build de producao (gera `src/routeTree.gen.ts` e `dist/`)

## Arquitetura (Feature-Sliced Design)

Camadas em `src/`, de baixo para cima. Regra unica: **uma camada so importa das camadas abaixo dela**.

| Camada | Conteudo |
| --- | --- |
| `shared/` | `ui/` (shadcn), `lib/` (cn, formatacao, datas), `api/` (cliente GraphQL), `config/` (env com zod) |
| `entities/timelog/` | Dominio: tipos, agregacao por dia, server function e query options |
| `features/` | Interacoes isoladas: `period-filter`, `user-filter`, `theme-toggle` |
| `widgets/` | Blocos de UI compostos: `period-summary`, `daily-hours-table` |
| `pages/` | Composicao das telas: `dashboard`, `day-detail` |
| `routes/` | Arquivos de rota do TanStack Start — finos, so `createFileRoute` + `validateSearch` delegando para `pages/` |

Cada slice expoe sua API publica em `index.ts`; importe do index (`@/entities/timelog`), nao de arquivos internos.

## Fluxo de dados

```
routes/index.tsx (?days=&user= validados por parseReportSearch)
  -> pages/dashboard -> useQuery(timelogReportQueryOptions)
    -> getTimelogReport (server function; token so existe aqui)
      -> readConfig (zod) -> fetchTimelogs (GraphQL Query.timelogs, cursor, max 20 paginas)
      -> aggregateTimelogs (bucket por dia no fuso, breakdown por item/usuario, filtro de username)
    <- TimelogReport { rows, totals, users, truncated }
```

Decisoes importantes (o porque esta em `openspec/changes/create-gitlab-dashboard/design.md`):

- O filtro de usuario e aplicado na **agregacao**, nao na query GraphQL — por isso aceita qualquer `@username`, inclusive digitado livre no combobox.
- `users` da resposta = membros do escopo (`fetchMembers`) ∪ autores de timelogs; se o GitLab negar a listagem de membros (token sem membresia direta), degrada silenciosamente para so os autores.
- A busca usa margem de 1 dia em cada ponta do intervalo: o GitLab filtra datas em UTC, o bucketing final usa `GITLAB_TIME_ZONE`.
- Codigo que le `process.env` ou chama o GitLab vive apenas atras da server function (`entities/timelog/api/`, `shared/api`, `shared/config`).

## Convencoes

- Strings de UI e comentarios em portugues **sem acentos** (ASCII); datas formatadas via `Intl` podem ter acentos.
- Componentes shadcn ficam em `src/shared/ui` (alias configurado em `components.json`).
- Sem lib de datas: usar `shared/lib/date.ts` (`Intl.DateTimeFormat` com time zone).
- Horas sempre derivadas de segundos com `secondsToHours` (2 casas).
- Planejamento de mudancas via OpenSpec (`openspec/`): proposta -> specs -> design -> tasks antes de implementar.
