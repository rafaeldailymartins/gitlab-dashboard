# GitLab Dashboard

Dashboard de horas trabalhadas por dia, calculadas a partir do time tracking (`/spend`) de issues e merge requests do GitLab. Mostra as horas de todos os usuarios do grupo/projeto ou de um usuario especifico.

## Stack

- React 19 + TypeScript
- TanStack Start (full-stack, server functions), Router, Query e Table
- Tailwind CSS v4 + componentes shadcn/ui
- Estrutura de pastas [Feature-Sliced Design](https://feature-sliced.design/)

## Configuracao

Crie um `.env` na raiz usando `.env.example` como base:

```env
GITLAB_BASE_URL=https://gitlab.com
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
GITLAB_GROUP_PATH=meu-grupo
# ou, em vez do grupo:
# GITLAB_PROJECT_PATH=meu-grupo/meu-projeto
GITLAB_TIME_ZONE=America/Sao_Paulo
```

- `GITLAB_TOKEN`: Personal Access Token com escopo `read_api`. O token nunca chega ao navegador — as chamadas ao GitLab acontecem em server functions.
- Escopo: configure **exatamente um** entre `GITLAB_GROUP_PATH` (recomendado, cobre todos os projetos do grupo) e `GITLAB_PROJECT_PATH`.
- Para ver timelogs de outros usuarios, o token precisa de acesso Reporter+ no grupo/projeto. Sem isso, o relatorio mostra apenas o que o token pode ver.
- O seletor de usuarios lista todos os membros do escopo. O GitLab so permite listar membros para quem e **membro direto** do grupo configurado; quando nega, o seletor lista apenas quem registrou tempo no periodo — a pesquisa por `@username` livre funciona em qualquer caso.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

Outros comandos: `npm run build` (produção), `npm run start` (serve o build), `npm run typecheck`.

## Como funciona

A rota `/` chama a server function `getTimelogReport`, que consulta a API GraphQL do GitLab (`Query.timelogs`, paginada por cursor), agrega os registros por dia no fuso configurado e devolve o resumo pronto: linhas por dia com breakdown por issue/MR e por usuario, mais os totais do periodo. Clicar em um dia abre `/dias/:date` com o detalhe. Periodo (`?days=`) e usuario (`?user=`) ficam na URL.
