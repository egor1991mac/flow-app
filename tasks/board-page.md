# Борда YouTrack — задачи

Проверено на живом инстансе 2026-11-25 (только чтение): `youtrack board list`,
`board sprint list --board 128-12`, `issue list/count`, `raw /api/agiles/...`.

## Факты (не перепроверять, они проверены)

- Борда: `Realt` = `128-12` (всего 6 борд, остальные — другие проекты).
- Спринт в задачах — кастомное поле **`Sprints`** (MultiVersion, `value` — массив).
  Запроса `Sprint:` не существует: он молча отдаёт мусор.
- Активный спринт на 2026-11-25: `129-169` «Спринт 15/2026 10.11 по 24.11»,
  фактически `start=1794268800000`, `finish=1796169599999` (01.12.2026). Даты в имени не парсить.
- `Sprints: {Спринт 15/2026 10.11 по 24.11}` → 180 задач (ровно как в API борды),
  `+ assignee: me` → 10, `+ #Unresolved` → 127.
- REALT всего 11797; `#Unresolved` 2888; `assignee: me` 740; `assignee: me #Unresolved` 529.
- `issue list --limit 300` отдаёт все 180; `--offset` есть. Один вызов CLI ≈ 0.46 с.
- Битый query: exit=1 и JSON `{error:{code,message}}` — текст нужно показывать в UI.
- State в спринте: Open, In Progress, Ready for Review, Ready for Testing, Testing on Dev,
  Testing on Staging, Deployed, Closed, Backlog, «Завершено», «Won't fix».
- `youtrack project field list REALT` → `[]`, для поиска полей не годится.

## Контракт (не менять без согласования)

### flow-core (`flow-core/src/adapters/youtrack.ts`, `ports.ts`)

```ts
export interface YtIssueRow {
  id: string; summary: string; state: string; assignee: string; assigneeLogin: string;
  priority: string; type: string; project: string; updated: number; url: string;
}
export interface YtSprintRow {
  id: string; name: string; start: number | null; finish: number | null; archived: boolean;
}
export interface YtIssuesResult { ok: boolean; error?: string; issues: YtIssueRow[] }
export interface YtSprintsResult { ok: boolean; error?: string; sprints: YtSprintRow[] }

// YouTrackPort
issues(query: string, limit: number): YtIssuesResult;
sprints(boardId: string): YtSprintsResult;

// утилита
export function pickCurrentSprint(sprints: YtSprintRow[], now?: number): YtSprintRow | null;
```

- `issues`: `youtrack issue list --query <q> --limit <n>
  -f idReadable,summary,updated,project(shortName),customFields(name,value(name,login))`.
- `sprints`: `youtrack board sprint list --board <id> -f id,name,start,finish,archived`.
- Ошибка CLI (`exit != 0` или в JSON есть `error`) → `{ok:false, error:<message>}`, не `null`.
- `pickCurrentSprint`: активный = `!archived && start<=now<=finish`; иначе последний
  неархивный по `start`; иначе `null`.
- `issueView`/`issueParents`/`issueSubtaskLinks` сохранить как есть.

### BFF (`server/src/graph/yt/...`)

```graphql
extend type Query {
  ytBoard(query: String!, limit: Int): YtBoard!
  ytSprints: YtSprints!
}
type YtIssue {
  id: String! summary: String! state: String! assignee: String assigneeLogin: String
  priority: String type: String project: String updated: Float url: String!
}
type YtBoard { ok: Boolean! error: String issues: [YtIssue!]! truncated: Boolean! }
type YtSprint { id: String! name: String! start: Float finish: Float current: Boolean! }
type YtSprints { ok: Boolean! error: String boardId: String! current: YtSprint sprints: [YtSprint!]! }
```

- `flowApi.ytBoard(query, limit=300)`: пустой/пробельный query → `#Unresolved`;
  `truncated = issues.length >= limit`.
- `flowApi.ytSprints()`: борда `process.env.FLOW_YT_BOARD ?? "128-12"`,
  `current = pickCurrentSprint(sprints)`, у элементов `current` — флаг.
- Доступ к YouTrack — только через `youtrackAdapter` из `flow-core` (не копировать CLI-вызовы).

### web

- `web/src/lib/types.ts`: `YtIssue`, `YtSprint`, `YtBoardData`, `YtSprintsData`.
- `web/src/lib/graphql/documents.ts`: `QUERY_YT_BOARD`, `QUERY_YT_SPRINTS`.
- Страница `/board`: чип «Мои» (`assignee: me`), селект спринта (по умолчанию active,
  «все спринты» = выкл), поле свободного запроса. Итог: части через пробел;
  пусто → `#Unresolved`.
- Колонки: известный порядок Open → In Progress → Ready for Review → Ready for Testing →
  Testing on Dev → Testing on Staging → Deployed → Closed, затем остальные по алфавиту;
  пустые колонки не рисуем.
- Карточка: ID, summary, assignee, priority, type, дата `updated`; ссылка
  `https://youtrack.realt.by/issue/<id>` (target=_blank). Без Detail/реестра (сокращено).
- Ссылка на `/board` в шапке `/`.

## Задачи

1. [x] core: `issues` + `sprints` + `pickCurrentSprint` в `flow-core` (правим только копию
   в `flow-app`, оригинал `docker-worktree` не трогаем — синк вручную позже).
2. [x] core: нормализация полей (массив/объект), текст ошибки CLI.
3. [x] BFF: операции `ytBoard`, `ytSprints` + `flow-api`.
4. [x] web: типы и документы запросов.
5. [x] web: страница `/board`, компоненты, стили, ссылка в шапке.
6. [x] проверка: `npm run typecheck`, `npm run build`, curl `ytBoard` (10/180/127).

Коммиты, тесты, браузер — только по отдельной команде пользователя.

## Результат (2026-11-25)

- `npm run typecheck` — чисто; `npm run build` — `/board` собрана.
- e2e против локального api: `ytSprints` → boardId 128-12, current 129-169, 46 спринтов;
  `ytBoard` спринт → 180, `+ assignee: me` → 10, `+ #Unresolved` → 127; битый query →
  `ok:false` + «HTTP 400: Can't parse search query»; пустой query → `#Unresolved`.
- Правки координатора: поиск по Enter (а не на каждый символ), `skip` запроса борды до
  загрузки спринтов, колонка «без статуса» для задач без State.
- Не проверено: браузер/верстка. Синк ядра в `docker-worktree` — вручную.
