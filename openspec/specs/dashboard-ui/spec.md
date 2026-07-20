# dashboard-ui

## Purpose

Interface web do dashboard de horas do GitLab: visão diária das horas registradas com filtros de período e usuário, página de detalhe por dia, estados de carregamento/erro e suporte a tema claro/escuro.

## Requirements

### Requirement: Dashboard de horas por dia

A rota `/` SHALL exibir: cards de totais do período (horas, registros, itens, usuários), seletor de período (7/15/30/60/90 dias), filtro de usuário e tabela ordenável com uma linha por dia (data, horas com barra de progresso proporcional a 8h, registros, itens, maiores itens do dia). Clicar em uma linha MUST navegar para o detalhe do dia.

#### Scenario: Carregamento com dados

- **WHEN** a consulta retorna dias com registros
- **THEN** a tabela lista os dias (mais recente primeiro) e os cards mostram os totais do período

#### Scenario: Período alterado

- **WHEN** o usuário seleciona outro período
- **THEN** os dados são rebuscados para o novo intervalo e a seleção é refletida na URL

#### Scenario: Sem registros no período

- **WHEN** a consulta retorna zero timelogs
- **THEN** a tabela exibe estado vazio orientando a verificar período/filtro

### Requirement: Filtro de usuário

O dashboard SHALL oferecer um combobox pesquisável com "Todos os usuários" e a lista `users` do relatório (membros do escopo + autores de timelogs). A pesquisa MUST filtrar por nome ou username e MUST permitir aplicar um `@username` digitado que não esteja na lista. A seleção MUST ser aplicada via server function (refetch) e refletida na URL.

#### Scenario: Selecionar um usuário da lista

- **WHEN** o usuário escolhe um username no combobox
- **THEN** tabela e totais passam a refletir apenas as horas desse usuário e a URL contém o filtro

#### Scenario: Pesquisar um usuário

- **WHEN** o usuário digita no campo de pesquisa
- **THEN** a lista é filtrada por nome ou username

#### Scenario: Username fora da lista

- **WHEN** o texto pesquisado não corresponde a ninguém da lista
- **THEN** o combobox oferece aplicar o filtro com o username digitado

### Requirement: Detalhe do dia

A rota `/dias/$date` SHALL exibir o breakdown do dia: total de horas, lista de issues/MRs (chave, título com link para o GitLab, horas, registros) e horas por usuário. MUST haver navegação de volta ao dashboard preservando período e filtro.

#### Scenario: Abrir detalhe de um dia

- **WHEN** o usuário clica na linha do dia no dashboard
- **THEN** a página do dia mostra itens e usuários daquele dia ordenados por horas decrescentes

#### Scenario: Dia sem dados na URL

- **WHEN** o usuário acessa `/dias/$date` para uma data sem registros no período
- **THEN** a página informa que não há registros e oferece link de volta ao dashboard

### Requirement: Estados de carregamento e erro

As páginas SHALL exibir skeletons durante o carregamento e, em caso de falha da server function, um alerta com a mensagem de erro e ação de tentar novamente.

#### Scenario: Falha na consulta

- **WHEN** a server function falha (config, permissão ou rede)
- **THEN** a UI exibe alerta com a mensagem retornada e botão de refetch

### Requirement: Tema claro/escuro

A interface SHALL suportar tema claro e escuro com toggle persistido, sem flash de tema incorreto no carregamento (SSR-safe).

#### Scenario: Alternar tema

- **WHEN** o usuário alterna o tema
- **THEN** a preferência é aplicada imediatamente e persiste entre visitas
