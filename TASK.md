# TASK.md — ТЗ на flow-app

## Откуда

Переписывание `flow-ui` (node:http + статика без фреймворка) на полноценный стек:
Next.js — фронтенд, GraphQL BFF на Apollo Server — API, плюс векторная база по памяти задач.
Проект лежит в `~/Documents/work/flow-app`; ядро — папка `flow-core/` внутри проекта
(копия ядра orca-flow в `~/orca/workspaces/docker-worktree/flow-core`, лежит в репозитории).

## Требования

1. **Стек**: Next.js (App Router, React) для UI; GraphQL BFF на Apollo Server для API;
   TypeScript strict. Два независимых пакета (`web`, `server`) в npm-workspaces, связь только
   по HTTP. В production `npm run serve` — два процесса: `next start` на `:17000` и api на
   `:17100`; в dev (`npm run dev`) — web `:17001` и api `:17100`, `/graphql` проксируется
   реврайтом.
2. **Паритет с flow-ui**: дерево задач (Фича → задачи, цвета по типу, статусы), панель задачи
   (мета, ссылки на текущую ветку и основу в GitLab, жизненный цикл Старт/merge/finish,
   этапы с наборами по режиму — worktree 0–10, simple 1,2,8,9,10, логи этапа, апрувы,
   журнал/решения), модалка создания с автозаполнением из YouTrack (Subtask → Relates),
   чекбоксы репозиториев с парой ui→api только в worktree-режиме, основа ветки с автокомплитом,
   фоновые job «Старт» с живыми логами.
3. **Векторная база**: индексируются записи памяти задач (описание, `journal.jsonl`,
   `decisions.jsonl`, отчёты прогонов этапов); поиск по запросу пользователя — косинусная
   близость, топ-8; клик по результату открывает задачу.
4. **Ядро не дублировать**: вся доменная логика — импорты из `flow-core/src`
   (реестр, этапы, git, docker, youtrack); мутации только через `runCli`.
5. **Состав проекта**: `server/` (Apollo BFF: `src/graph`, `src/data-sources`) и `web/`
   (Next.js: `src/app`, `src/components`, `src/lib`) — самостоятельные пакеты в npm-workspaces;
   `AGENTS.md` (правила для агентов), `docs/` (README, architecture, api), `TASK.md` (этот файл).

## Критерии приёмки

- `npm run typecheck` — 0 ошибок в обоих пакетах; `npm run build` собирает web.
- `npm run serve` поднимает web на `:17000` и api на `:17100`; `/graphql` на web проксируется
  в api и отдаёт все операции (`tasks`, `task`, `taskStages`, `taskJournal`, `taskBranches`,
  `config`, `branchNames`, `intake`, `job`, `search`, `globalStages`; мутации `createTask|
  switchTask|setStage|approveStage|startTask|mergeTask|finishTask`).
- Векторный поиск по памяти реально ранжирует: запрос «размер шрифта» находит задачу про
  шрифт выше остальных; клик открывает задачу.
- Создание задачи через модалку (оба режима) работает и дерево обновляется.
- Данные читаются из `FLOW_HOME` (`~/orca/workspaces/all-projects`), ничего в flow-core не меняется.

## Не входит

- Удаление/замена прежнего `flow-ui` (решение за пользователем).
- Внешние эмбеддинги (OpenAI и т.п.) — задел есть, провайдер не подключался.
- Auth, деплой, тесты (не просили).
