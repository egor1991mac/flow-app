# Parity-харнесс flow-core

Сверяет портативное ядро (TS) с bash-инструментом orca-flow на живых данных реестра.
Гейт G2: `node parity/run.mjs` → `PARITY PASS: diff = 0`.

Запуск (node ≥ 22, type-stripping):

```bash
node --experimental-strip-types parity/run.mjs
```

Что сверяется (одинаковый вход → одинаковый выход):
- `slugify` vs `of_slugify` — живые summary из state.json + edge-кейсы (стоп-слова, кириллица, лимит 45);
- `resolveRepos` vs `of_resolve_repos` — пары ui→api, порядок ключей конфига;
- `normalizeRef` vs `of_normalize_ref` — URL/tree/origin-префиксы;
- `renderCompose` vs `of_render_compose` — побайтово на реальном шаблоне, наборы репозиториев;
- `intakeId` vs `of_intake_id` — URL/plain/регистр;
- `writeEnv` vs живые `.env` задач (slot/repos/project);
- матрица переходов этапов vs contract-stages.md §1.

Не входит (требует git/docker/сети — адаптеры фазы 3): полный план `new --dry-run`,
аллокация слотов с lsof, preflight. Особенности bash сохранены как есть (contract-registry.md §5/§6).

Type-check ядра (offline, borrowed tsc 5.1.3 из www):

```bash
node ~/Documents/work/www/node_modules/typescript/bin/tsc -p tsconfig.check.json
```
