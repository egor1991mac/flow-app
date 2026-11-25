# flow-app

UI и GraphQL BFF для управления задачами REALT: дерево задач (Фича → задачи), панель задачи с
этапами и апрувами, создание из YouTrack, живой лог запуска и векторный поиск по памяти задач.

Два независимых пакета (npm workspaces): `server` — Apollo Server (`/graphql`), `web` — Next.js.
Доменная логика импортируется из `flow-core` (симлинк на отдельный проект, в репозиторий не входит).

```bash
npm install
npm run dev                        # UI http://localhost:17001, api /graphql на :17100
npm run build && npm run serve     # UI http://localhost:17000, api :17100
```

Документация: `docs/README.md` (обзор), `docs/architecture.md` (слои), `docs/api.md`
(операции GraphQL), `TASK.md` (ТЗ), `AGENTS.md` (правила для агентов).
