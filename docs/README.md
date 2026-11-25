# flow-app

Next.js UI + GraphQL BFF (Apollo Server) для управления задачами REALT (`flow-core`).
Плюс векторный поиск по памяти задач — против «забывчивости»: всё, что задача помнит
(описание, журнал, решения, отчёты этапов), ищется по смыслу слов.

Быстрый старт:

```bash
npm install      # ставит оба пакета (workspaces: server, web)
npm run dev      # UI: http://localhost:17001 (api /graphql на :17100)
# или как в проде, двумя процессами:
npm run build && npm run serve   # UI http://localhost:17000, api :17100
```

`npm run dev` перезаписывает `web/.next` dev-сборкой — перед `npm run serve` нужен свежий
`npm run build`. Ядро `flow-core` в репозиторий не входит: это симлинк на отдельный проект
`~/orca/workspaces/docker-worktree/flow-core`, без него `server` не запустится.

Реестр берётся из `FLOW_HOME` (по умолчанию `~/orca/workspaces/all-projects`).

## Что умеет

- **Дерево задач**: Фича → задачи, цвета по типу (story/task/bug), статусы active/merged/closed,
  быстрые Старт/Закрыть на узле.
- **Панель задачи**: ссылки на текущую ветку и основу в GitLab, жизненный цикл
  (Старт / merge в Фичу / finish), этапы с наборами по режиму
  (worktree — 0–10; «просто ветка» — 1, 2, 8, 9, 10), логи этапа и job, апрувы, журнал/решения.
- **Создание задачи**: ссылка YouTrack → автозаполнение (ID, тип, название, описание, Фича
  из Subtask или Relates), режим worktree/«просто ветка», репозитории с автопарой ui→api
  (только worktree), основа ветки с автокомплитом и фолбэком на `stage`.
- **Старт как фоновой job**: живой лог `docker compose`, статус этапа крутится онлайн.
- **Векторный поиск**: `поиск по памяти задач` в шапке — записи памяти задач, ранжирование
  по косинусной близости, клик открывает задачу.

## Структура

```
package.json      npm workspaces (server, web) + скрипты dev/build/serve/typecheck
server/           Apollo BFF: schema.gql, <домен>/query-*|mutation-*, data-sources, server.ts
web/              Next.js: app, components, lib (apollo-клиент, graphql-документы, типы)
flow-core -> …    симлинк на ядро (не копия)
```

Доменная логика (реестр, этапы, git, docker, youtrack) не копируется — импортируется из
`flow-core/src` (симлинк на ядро в `~/orca/workspaces/docker-worktree/flow-core`);
мутации реестра идут только через `runCli`.

## Документация

- `architecture.md` — слои, данные, векторная база, режимы запуска.
- `api.md` — операции GraphQL.
- `../TASK.md` — ТЗ, по которому проект собран.
- `../AGENTS.md` — правила работы агента в этом проекте.
