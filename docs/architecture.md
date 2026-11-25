# Архитектура

## Приложения

```
web/ (Next.js, src/app, src/components)  — UI, Apollo → /graphql
        │  GraphQL по HTTP (dev: rewrite → :17100)
server/ (Apollo Server, src/graph)       — схема, резолверы, контекст dataSources
        │
server/src/data-sources/index.ts         — flowApi: deps для runCli, jobs, ветки, память
        │
flow-core (flow-core/src, симлинк)       — реестр, этапы, naming, git/docker/youtrack адаптеры
        │
server/src/data-sources/vector-api.ts    — векторная база памяти (embed + store + search)
```

Два независимых пакета в npm-workspaces: `server` и `web` не импортируют друг друга, связь —
только HTTP. Доменная логика одна — в `flow-core`; сервер транспортирует: аргументы операции →
argv `runCli`, результат → объект GraphQL. UI не содержит бизнес-правил, только рендер и
подтверждения.

## Операции

Схема собирается из всех `*.gql` каталога `server/src/graph`: общие типы и `scalar JSON` —
`schema.gql`, операции — `server/src/graph/<домен>/<query|mutation>-<домен>-<поле>/`. Резолвер
операции лежит рядом и регистрируется в `server/src/graph/resolvers.ts`; данные он берёт из
`context.dataSources.flowApi`, контекст создаётся в `server/src/create-app-server.ts`.

## Режимы запуска

- **dev**: `npm run dev` — api `:17100` (`node --experimental-strip-types --watch`, эндпоинт
  `/graphql`), web `:17001` (`next dev`); `web/next.config.mjs` проксирует `/graphql` на api.
- **production**: `npm run build` (сборка web) + `npm run serve` — два процесса: api `:17100`,
  `next start` `:17000`; rewrite в собранном Next работает так же.

## Фоновые job

`up --start` запускает контейнеры надолго и блокирует — поэтому сервер стартует дочерний
процесс `flow-core/bin/flow.mjs` (`startJob`, путь — симлинк внутри проекта), пишет его вывод в
память (`jobs: Map`), а UI опрашивает `job(id)` каждые 700 мс вместе с `taskStages(taskId)`,
чтобы статусы этапов красились онлайн.

## Векторная база

`server/src/data-sources/vector-api.ts`, хранилище — `$FLOW_HOME/.orca-flow/vector.jsonl`.

- **Записи**: описание задачи (`task`), события `journal.jsonl` (`journal`), решения
  `decisions.jsonl` (`decision`), отчёты прогонов этапов из `stages.json` (`stage`).
- **ID записи** — `taskId:kind:fnv1a(текст)`: текст изменился → новая запись, старая
  вылетает при пересборке (задачи в реестре — источник истины).
- **Вектор**: 256 измерений, хеш слов и пар слов (fnv1a → индекс), L2-нормализация.
- **Поиск**: косинусная близость, порог 0.02, топ-8.
- **Синк**: лениво на каждой операции `search` — новые записи добавляются, исчезнувшие
  (`task.closed`, папка `.flow` удалена) выкидываются; файл пишется только при изменениях.

`shortcut:` в коде отмечен предел: эмбеддер лексический, не семантический (без модели).
Слой изолирован одной функцией `embed()` — замена на внешний эмбеддер не трогает остальное.

## Ветки → GitLab

`getTaskBranches(taskId)`: ветка из реестра; если её нет в клоне (переименована) — единственная
локальная ветка, содержащая ID задачи. Основа: `task.bases[repo]` (пишется при создании),
иначе reflog `branch: Created from`. URL — из remote origin клонов (`git@…` → `https://…`).
