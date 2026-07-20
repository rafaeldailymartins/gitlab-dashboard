# Tasks: create-gitlab-dashboard

## 1. Scaffold do projeto

- [x] 1.1 Criar projeto TanStack Start (package.json, vite.config.ts, tsconfig, src/routes/__root.tsx, src/router.tsx) com React 19 e TypeScript
- [x] 1.2 Configurar Tailwind CSS v4 + shadcn/ui (components.json, estilos globais em src/app/styles.css, tema com CSS variables)
- [x] 1.3 Criar estrutura FSD (app, pages, widgets, features, entities, shared) com aliases no tsconfig
- [x] 1.4 Adicionar componentes shadcn/ui necessários: button, badge, table, skeleton, alert, select, card

## 2. Entidade timelog (domínio + dados)

- [x] 2.1 Definir tipos do domínio em entities/timelog (Timelog, DailySummary, DayRow, ItemBreakdown, UserBreakdown)
- [x] 2.2 Implementar cliente GraphQL do GitLab em shared/api (fetch com token, tratamento de erros) e config zod do ambiente em shared/config
- [x] 2.3 Implementar busca paginada de timelogs (query GraphQL com startDate/endDate/username/escopo, cursor, limite de páginas)
- [x] 2.4 Implementar aggregateTimelogs (bucketing por dia no fuso configurado, breakdown por item e usuário, totais, arredondamento de horas)
- [x] 2.5 Expor createServerFn getTimelogReport (validação zod de days/username) + timelogReportQueryOptions (TanStack Query)

## 3. UI compartilhada e features

- [x] 3.1 Criar shared/lib de formatação (formatHours, formatDateLabel, formatInteger) e cn
- [x] 3.2 Feature period-filter (seletor 7/15/30/60/90 dias sincronizado com URL)
- [x] 3.3 Feature user-filter (select de usuários derivado do resumo, sincronizado com URL)
- [x] 3.4 Feature theme-toggle (claro/escuro persistido, SSR-safe)

## 4. Páginas e widgets

- [x] 4.1 Widget period-summary (cards de totais: horas, registros, itens, usuários)
- [x] 4.2 Widget daily-hours-table (TanStack Table ordenável, barra de horas, maiores itens, clique → detalhe, estados vazio/skeleton)
- [x] 4.3 Página dashboard (pages/dashboard) compondo header, filtros, cards e tabela; rota / com search params validados
- [x] 4.4 Página day-detail (pages/day-detail): breakdown de itens e usuários do dia, link de volta; rota /dias/$date
- [x] 4.5 Estados de erro com alerta + retry nas duas páginas

## 5. Documentação e verificação

- [x] 5.1 Escrever README.md (setup, .env.example, permissões GitLab, comandos) e AGENTS.md (arquitetura FSD, convenções, fluxo de dados)
- [x] 5.2 Criar .env.example e .gitignore
- [x] 5.3 Verificar: typecheck + build passam; dev server sobe; rotas respondem

## 6. Filtro de usuário: membros do escopo + pesquisa

- [x] 6.1 Buscar membros do grupo/projeto no servidor (paginado, sem bots, fallback silencioso p/ autores de timelogs) e mesclar em users
- [x] 6.2 Trocar Select por Combobox pesquisável (shadcn Command + Popover) com opção de username livre
- [x] 6.3 Verificar: typecheck + build; atualizar README/AGENTS sobre permissão de membros
