# timelog-report

## Purpose

Buscar timelogs do GitLab (via GraphQL) para um período configurável, agregá-los em um resumo diário com breakdowns por issue/MR e por usuário, e expor esses dados através de uma server function validada.

## Requirements

### Requirement: Buscar timelogs do GitLab por período

O sistema SHALL buscar timelogs via GraphQL `Query.timelogs` usando o token e o escopo (grupo ou projeto) configurados, limitados ao intervalo `[hoje - dias + 1, hoje]`, paginando por cursor até esgotar os resultados ou atingir o limite de segurança de páginas.

#### Scenario: Busca com múltiplas páginas

- **WHEN** o período contém mais timelogs que o tamanho da página (100)
- **THEN** o sistema segue `pageInfo.endCursor` até `hasNextPage = false` e retorna todos os timelogs do período

#### Scenario: Limite de segurança atingido

- **WHEN** a paginação atinge o limite máximo de páginas
- **THEN** o sistema retorna os dados obtidos com a flag `truncated: true`

#### Scenario: Token sem permissão ou inválido

- **WHEN** o GitLab responde com erro de autenticação/autorização
- **THEN** o sistema falha com mensagem clara indicando o problema de token/permissão, sem expor o token

### Requirement: Filtrar por usuário

O sistema SHALL aceitar um `username` opcional, aplicado durante a agregação no servidor. O filtro MUST funcionar para qualquer username (inclusive fora da lista `users`).

#### Scenario: Sem filtro de usuário

- **WHEN** nenhum username é informado
- **THEN** o resumo inclui timelogs de todos os usuários que o token pode ver no grupo/projeto

#### Scenario: Com filtro de usuário

- **WHEN** um username é informado
- **THEN** as linhas e totais contêm apenas timelogs desse usuário, e a lista `users` não é afetada pelo filtro

### Requirement: Listar usuários do escopo

A resposta SHALL incluir `users`: a união dos membros do grupo/projeto (via `groupMembers`/`projectMembers`, paginado, excluindo bots) com os autores de timelogs do período, ordenada por nome. Se o GitLab negar a listagem de membros (token sem membresia direta no escopo), o sistema MUST degradar silenciosamente para apenas os autores de timelogs.

#### Scenario: Token pode listar membros

- **WHEN** a query de membros é autorizada
- **THEN** `users` contém todos os membros do escopo, mesmo os sem registros no período

#### Scenario: Token sem permissão para listar membros

- **WHEN** a query de membros retorna erro de permissão
- **THEN** `users` contém apenas os autores de timelogs do período e o relatório é gerado normalmente

### Requirement: Agregar timelogs em resumo diário

O sistema SHALL agregar os timelogs em um resumo com: uma linha por dia (data no fuso configurado, total de horas, contagem de registros, breakdown por issue/MR e por usuário) e totais do período (horas, registros, itens distintos, usuários distintos). Dias sem registros MUST ser omitidos. A conversão segundos→horas MUST arredondar para 2 casas decimais.

#### Scenario: Timelogs em dias distintos

- **WHEN** existem timelogs com `spentAt` em dias diferentes (no fuso configurado)
- **THEN** cada dia vira uma linha com seus próprios totais e breakdowns, ordenada da data mais recente para a mais antiga

#### Scenario: Timelog na fronteira do dia

- **WHEN** um timelog tem `spentAt` 2026-07-10T01:00:00Z e o fuso é America/Sao_Paulo (UTC-3)
- **THEN** o timelog conta para o dia 2026-07-09

#### Scenario: Breakdown por item e por usuário

- **WHEN** um dia tem timelogs de N issues/MRs e M usuários
- **THEN** a linha do dia lista os N itens (com chave, título, URL, horas, tipo issue|mr) e os M usuários (com username, nome, horas), ambos ordenados por horas decrescentes

### Requirement: Validar configuração do ambiente

O sistema SHALL validar as variáveis de ambiente no servidor com zod: `GITLAB_TOKEN` obrigatório; exatamente um entre `GITLAB_GROUP_PATH` e `GITLAB_PROJECT_PATH`; `GITLAB_BASE_URL` e `GITLAB_TIME_ZONE` com defaults.

#### Scenario: Configuração ausente

- **WHEN** `GITLAB_TOKEN` não está definido ou nenhum escopo foi configurado
- **THEN** a server function falha com mensagem indicando quais variáveis configurar

### Requirement: Validar parâmetros da consulta

O sistema SHALL validar os parâmetros da server function: `days` inteiro entre 1 e 366 (default 7); `username` string opcional não vazia.

#### Scenario: Parâmetro days inválido

- **WHEN** o cliente envia `days` fora do intervalo permitido
- **THEN** a server function rejeita com erro de validação
