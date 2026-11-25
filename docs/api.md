# GraphQL API (Apollo Server, эндпоинт `/graphql`)

Схема собирается из `server/src/graph/**/*.gql`. Общие типы — `server/src/graph/schema.gql`.
Карты (`ports`, `endpoints`, `bases`, `repos` конфига, `details` журнала) отдаются скаляром
`JSON`; остальное — типизированные поля.

## Запросы

| Поле | Аргументы | Назначение |
|---|---|---|
| `health` | — | `{ok, home}` |
| `tasks` | — | список задач реестра |
| `task` | `id: String!` | задача |
| `taskStages` | `taskId: String!` | `StagesFile` (0–10, статусы, runs, апрувы) |
| `taskJournal` | `taskId: String!` | хвост `journal.jsonl` + `decisions.jsonl` (по 50) |
| `taskBranches` | `taskId: String!` | ветка и основа по репозиториям со ссылками GitLab |
| `config` | — | конфиг `.orca-flow/config.json` |
| `branchNames` | — | имена веток основных клонов (heads + origin) |
| `intake` | `input: String!` | превью задачи из YouTrack (ссылка или ID) |
| `globalStages` | — | глобальный этап 0 |
| `job` | `id: String!` | `{log, done, code}` фоновой job |
| `search` | `q: String!` | память задач: `{ok, indexed, results[]}`, топ-8 по косинусу |

## Мутации

| Поле | Аргументы | Назначение |
|---|---|---|
| `createTask` | `input: CreateTaskInput!` | создать задачу (worktree), при необходимости авто-Фича; возвращает `autoFeature` |
| `switchTask` | `input: SwitchTaskInput!` | «просто ветка»: ветка в основном клоне + запись `mode:"simple"` |
| `setStage` | `input: StageInput!` | статус этапа running/passed/failed (`{id, n, status, report}`) |
| `approveStage` | `input: ApproveStageInput!` | апрув фразой «этап N ок» (только после passed) |
| `startTask` | `id: String!, start: Boolean` | без `start` — план; со `start` — фоновая job, возвращает `jobId` |
| `mergeTask` | `id: String!, yes: Boolean` | merge ветки задачи в Фичу |
| `finishTask` | `id: String!, yes: Boolean, dryRun: Boolean` | закрытие; `dryRun` — список гейтов |

## Форматы ответов

- Мутации возвращают `InvokeResult {ok, output[], error?, err?}` — результат `runCli`.
- `startTask` со `start: true` возвращает `{ok, jobId}`; логи — опрос `job(id)`.
- `search`: `{ok, indexed, results: [{taskId, kind, snippet, score, ts}]}`,
  `kind ∈ task | journal | decision | stage`, отсортировано по `score` (косинус), топ-8.
- `taskBranches`: `[{repo, branch, url, base, baseUrl}]` — ссылки на
  `https://gitlab.realt.by/<группа>/<репо>/-/tree/<ref>`; если remote не похож на URL —
  поля `url`/`baseUrl` пустые, UI показывает текстом.

## Клиент

`web/src/lib/apollo/client.tsx` — `ApolloClient` на `/graphql`; документы операций —
`web/src/lib/graphql/documents.ts`; компоненты ходят через `useQuery`/`useMutation`/`useLazyQuery`.
