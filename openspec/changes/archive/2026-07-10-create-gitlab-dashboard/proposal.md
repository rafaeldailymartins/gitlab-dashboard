# Proposal: create-gitlab-dashboard

## Why

O time registra horas via time tracking (`/spend`) em issues e merge requests do GitLab, mas o GitLab não oferece uma visão consolidada de "horas por dia". Já existe um projeto equivalente para o Jira (jira-dashboard); este projeto entrega o mesmo relatório para o GitLab, com um diferencial: visualizar as horas de **qualquer usuário** do grupo/projeto, não apenas do usuário autenticado.

## What Changes

- Cria o projeto do zero: app full-stack com React + TanStack Start (server functions substituem o proxy Express do jira-dashboard — o token nunca chega ao navegador).
- Server function que consulta a API GraphQL do GitLab (`Query.timelogs`) e agrega os timelogs por dia, por issue/MR e por usuário.
- Página de dashboard: totais do período, seletor de período (7/15/30/60/90 dias), filtro de usuário e tabela de horas por dia com barra de progresso.
- Página de detalhe do dia: breakdown por issue/MR e por usuário.
- Estrutura de pastas FSD (`shared` → `entities` → `features` → `widgets` → `pages` → `app`), com `src/routes/` como camada fina de roteamento do TanStack Start.
- Documentação enxuta orientada a agentes de IA: `README.md` (setup/uso) e `AGENTS.md` (arquitetura e convenções).

## Capabilities

### New Capabilities

- `timelog-report`: consulta timelogs no GitLab (GraphQL) num intervalo de datas, com escopo por grupo/projeto e filtro opcional de usuário; agrega em resumo diário (horas, registros, issues/MRs, usuários).
- `dashboard-ui`: interface do relatório — dashboard com totais/tabela por dia e página de detalhe do dia, com estados de loading/erro/vazio, tema claro/escuro.

### Modified Capabilities

_Nenhuma (projeto novo)._

## Impact

- Código: projeto inteiro é novo; nenhum código existente afetado.
- Dependências: React 19, TanStack Start/Router/Query/Table, Tailwind CSS v4, shadcn/ui, zod, lucide-react.
- Configuração: requer `GITLAB_TOKEN` (PAT com escopo `read_api`) e escopo de busca (`GITLAB_GROUP_PATH` ou `GITLAB_PROJECT_PATH`) via `.env`.
- Permissões: ver timelogs de outros usuários exige acesso de Reporter+ ao grupo/projeto no GitLab; sem isso, o relatório funciona filtrado ao próprio usuário.
