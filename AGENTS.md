# AGENTS.md — flow-app

Next.js + GraphQL BFF (Apollo Server) — UI и API для `flow-core`. Ядро лежит в проекте папкой
`flow-core/` — это копия ядра orca-flow (оригинал в `~/orca/workspaces/docker-worktree/flow-core`),
версионируется вместе с проектом и импортируется напрямую из `flow-core/src`. Правится ядро в
оригинале, сюда копируется; отдельных git-веток у копии не заводят.

## Расположение

```
flow-app/
├─ AGENTS.md            этот файл
├─ TASK.md              техническое задание проекта
├─ docs/                README, architecture, api
├─ flow-core/           ядро orca-flow (копия, лежит в репозитории)
├─ package.json         npm workspaces (server, web) + общие скрипты
├─ server/              Apollo BFF, самостоятельный пакет
│  ├─ package.json      @apollo/server, express, graphql
│  ├─ tsconfig.json
│  └─ src/
│     ├─ server.ts      точка входа: createAppServer + listen
│     ├─ create-app-server.ts  Express + /graphql (Apollo)
│     ├─ graph/         schema.gql (типы, scalar JSON) + <домен>/query-*|mutation-*
│     │  └─ resolvers.ts  реестр операций
│     ├─ data-sources/  flow-api.ts (runCli, jobs, ветки), vector-api.ts, index.ts
│     ├─ types/core.ts  GQLContext (dataSources.flowApi)
│     └─ utils/apollo/  init-apollo-server.ts: typeDefs из *.gql + резолверы
└─ web/                 Next.js UI, самостоятельный пакет
   ├─ package.json      next, react, @apollo/client
   ├─ next.config.mjs   rewrite /graphql → 127.0.0.1:17100
   ├─ tsconfig.json
   └─ src/
      ├─ app/           layout, page, globals.css (Next App Router)
      ├─ components/    tree, detail, create-modal, search
      └─ lib/           apollo-клиент, graphql-документы, типы, описания этапов
```

## Запуск

```bash
npm install          # ставит оба пакета (workspaces)
npm run dev          # api :17100 (/graphql, --watch) + next dev :17001, UI на :17001
npm run build        # production-сборка web (server запускается из TS напрямую)
npm run serve        # два процесса: api :17100 + next start :17000
```

`npm run dev` перезаписывает `web/.next` dev-сборкой, поэтому перед `npm run serve`
нужен свежий `npm run build`.

Реестр берётся из `FLOW_HOME` (по умолчанию `~/orca/workspaces/all-projects`),
метаданные — `$FLOW_HOME/.orca-flow`. Векторный индекс — `.orca-flow/vector.jsonl`.

## Проверки (только по своим изменениям)

```bash
npm run typecheck    # tsc в server и web
npm run build
```

Полные линты чужих файлов и глобальные format-команды не запускать.

## Правила кода

- TypeScript strict, именованные экспорты, `"use client"` только там, где нужен интерактив.
- Комментарии в коде не писать; исключение — неочевидный инвариант или `shortcut: <предел>, <когда заменить>`
  (пример — локальный эмбеддер в `server/src/data-sources/vector-api.ts`).
- Новые зависимости не добавлять без явной просьбы пользователя.
- Логику домена (этапы, реестр, git, docker) НЕ копировать сюда: импортировать из
  `flow-core/src/*` (локальная копия ядра). Этот проект — только транспорт (GraphQL) и рендер.
- Мутации реестра идут только через `runCli` (см. `invoke` в `server/src/data-sources/flow-api.ts`).
- Новая операция — папка `server/src/graph/<домен>/<query|mutation>-<домен>-<поле>/` с `.gql` и
  `.resolver.ts`, регистрация в `server/src/graph/resolvers.ts`; общие типы — `server/src/graph/schema.gql`.

## Кодстайл

Источник — `~/Documents/work/docs/app/docs/codestyle` («Правила», «Структура», «Архитектура»).
Ниже только то, что применимо к стеку flow-app; неприменимое к www-инфраструктуре — в конце.

### Файлы и имена

- Файлы и папки — kebab-case: `create-modal.tsx`, `flow-api.ts`, не `CreateModal.tsx`.
- Компонент — в папке своего имени: `components/<имя>/<имя>.tsx`, имя папки = имя файла.
  Нынешние плоские `web/src/components/*.tsx` — легаси, переносить по мере правки файла.
- Компонент — константа-стрелка: `export const <Имя>: FC<<Имя>Props> = ({ … }) => …`; пропсы —
  `interface <Имя>Props` (без префикса `I`), деструктуризация в сигнатуре; без `import React`
  и без spread-props (`{...props}`). Существующие `export function <Имя>` — легаси, переводить
  по мере правки файла.
- Хуки — `use<Имя>` в `use-<имя>.ts`; константы — `UPPER_SNAKE_CASE`; типы/енумы — PascalCase.
- Документы операций на клиенте — `QUERY_<ДОМЕН>_<ПОЛЕ>` / `MUTATION_…` в
  `web/src/lib/graphql/documents.ts`; на сервере — `server/src/graph/<домен>/<query|mutation>-<домен>-<поле>/`.

### Импорты и типы

- `web`: абсолютные от `src/` через алиас `@/…`. `server`: относительные с расширением `.ts`
  (`node --experimental-strip-types` требует явный путь).
- Порядок в блоке: внешние пакеты → локальные модули (`@/…`, `../../…`) → `import type` последней группой.
- Объектные типы — `interface`, не `type`. Типы импортировать только через `import type`.
- `@ts-ignore` — с описанием (минимум 3 символа); лучше не использовать вовсе.

### Код

- Вложенные тернарники не писать — именованная функция с ранними `return`.
- Функцию с одним потребителем не выносить в `utils/` — объявлять рядом с потребителем.
- Константы-данные внутри компонента — ленивый `useState(() => …)`; производные от пропсов и
  стейта — `useMemo`. Константы вне компонента — обычный `const UPPER_SNAKE_CASE`.
- Стилизованные классы, заголовки и тексты держать по месту рендера, а не над компонентом.
- Дублирующийся JSX — в общий компонент; общий компонент принимает простые пропсы или `children`,
  а не готовые списки-словари.
- Перед использованием или сравнением поля данных проверять его наличие (`?.`, `in`,
  `'value' in settled`); `as`-каст по догадке запрещён.
- Хосты и URL не инлайнить в компонентах: клиент ходит относительным `/graphql` (rewrite),
  адрес api — `FLOW_API_URL` в `web/next.config.mjs`.

### Логи и ошибки

- `console.log` не использовать; только `console.warn` / `console.error`.
- Ошибку не глотать: вернуть `{ ok: false, error }` на сервере и показать текст в UI.

### Тесты

- Тестового раннера в проекте нет. Тесты — только по прямой просьбе пользователя, рядом с
  исходником, имя `<имя>.test.ts`.

### Из docs не применяем

- Tailwind и `@realt-by/web-sdk-*` (Text/Link/Button/Checkbox): в flow-app свой CSS в
  `web/src/app/globals.css`.
- Page Router, `getServerSideProps`, `createApolloQuery`, `createLocalStore`, codegen типов,
  правила `isMobile`/SSR, словари локализации, аналитика — такой инфраструктуры в проекте нет.
- git-cz/commitlint не настроены: коммит — `type: subject` до 64 символов.

## Векторная база

- `server/src/data-sources/vector-api.ts`: записи памяти задач (описание, журнал, решения, отчёты этапов)
  хешируются в 256-мерные вектора и складываются в `vector.jsonl`; поиск — косинусная близость.
- Эмбеддер локальный (хеш n-грамм, без модели): находит по словам и парам слов, не по смыслу.
  Замена на внешний эмбеддер — когда понадобится настоящая семантика.
- Индекс пересобирается лениво на каждом `search(q)`: новые записи добавляются, исчезнувшие
  выкидываются.

## Жёсткие правила сессии

- Коммит, пуш, MR — только по явной команде пользователя; MR никогда не мержить.
- Браузер (orca) — только по команде «проверь».
- Серверы проекта можно поднимать/гасить самому (это не bff/www из рабочих репозиториев).
- Не трогать прежний node:http UI `~/orca/workspaces/docker-worktree/flow-ui` и чужие worktree `.thinkrail/*`.
