# ДОКУМЕНТ ВОССТАНОВЛЕНИЯ КОНТЕКСТА (RECOVERY.md)
> [!WARNING]
> **Снимок до этапа 1A, устарел.** Данный документ отражает состояние аудита до внедрения этапа 1A, устранения `any`, настройки CI на PostgreSQL, сида демо-стенда и реализации модуля CORE-1. Актуальное состояние см. в `docs/STATUS.md`.

*Дата исходного аудита: 2026-10-11*
*Режим: Чтение / Базовый аудит репозитория (исторический архив)*

---

## 1. Состояние Git и рабочая директория

- **Текущая ветка:** `feature/lms-upgrade`
- **Опережение origin:** ahead of 'origin/feature/lms-upgrade' by 32 commits
- **git status:**
  ```text
  On branch feature/lms-upgrade
  Your branch is ahead of 'origin/feature/lms-upgrade' by 32 commits.
    (use "git push" to publish your local commits)

  nothing to commit, working tree clean
  ```
- **Незакоммиченные изменения:** отсутствуют (working tree clean).
- **Отслеживаемый мусор в Git:**
  - `git ls-files .env scratch/ *.db build.log` -> **0 файлов** (отслеживаемого мусора в git нет).
- **Неотслеживаемые / игнорируемые файлы на диске:**
  - `prisma/check.db`, `prisma/dev.db`, `prisma/test_baseline.db` (локальные SQLite базы от старых этапов)
  - `.env` (локальные секреты в .gitignore); `transmitter/` удалена (P0-7)
  - `reports/build.log`, `reports/tsc.log`, `reports/lint.log`, `reports/vitest.log` (артефакты аудита)
  - Директория `scratch/`: отсутствует.

### Последние 40 коммитов (`git log --oneline -40`):
```text
50ed16e docs: update STATUS.md for TRUST-3d milestone
ce8454c feat(tenant): implement student archiving, inactive login block, and 409 deletion protection
6b0dbb6 feat(tenant): safely handle undefined membership in platform staff context across API routes
fbb307a test(audit): eliminate duplicate route test blocks by generating tests via it.each
7bfb690 fix(migration): preserve platform user memberships with real business data
2638187 feat(schema): restrict student record deletion and support ARCHIVED membership status
ab7ea0e feat(audit): document route exclusion reasons and restrict onboarding and invite acceptance for PLATFORM_SUPPORT
79f4ed6 test(platform): verify SUPERADMIN, DEVELOPER read access and PLATFORM_SUPPORT read/write rules on real database
459a130 feat(migration): transfer nullable platform user relations to SetNull and remove platform memberships
2231619 test(audit): restore individual route audit tests while retaining dynamic route scanning
72d4d41 docs(deploy): document mandatory proxy hops and verify composite key lockout isolation
c2c227b test(schema): audit and enforce Restrict and SetNull constraints on CenterMembership foreign keys
607c16c test(audit): dynamically scan all tenant route handlers for PLATFORM_SUPPORT 403 enforcement
d5a44a1 feat(tenant): enforce mandatory req parameter in requireTenantAccess and audit all route calls
9680f6d feat(tenant): remove centerMembership creation on platform access and clean orphaned memberships via migration
b79422d feat(security): auto-derive isWrite from HTTP method and document TRUSTED_PROXY_HOPS in deployment guide
1622cef docs: update STATUS.md reflecting TRUST-3 security enhancements and full test suite verification
c4ca4f3 test(vitest): ensure environment restoration and test isolation across consecutive runs
13eaa72 feat(tenant): encapsulate getTenantDb and audit tenant write routes for PLATFORM_SUPPORT 403
5f9bb28 fix(tenant): restrict platform tenant access strictly to impersonation roles
6718c90 test(tenant): bi-directional model verification and nullable centerId scoping
b5176a0 feat(tenant-db): dynamic foreign key validation via Prisma.dmmf and nested relation protection
451f24c feat(tenant-db): add aggregate and groupBy scoping with default-deny on tenant models
8cc0731 fix(schema): revert onDelete Cascade to Restrict for creator/teacher associations and fix test teardown order
ccba80a fix(security): default getClientIp to unknown with strict hops parsing and proxy headers gating
5eb8a8d fix(tenant): return 401 on revoked session or deactivated user in tenant routes
719621c docs: update STATUS.md reflecting PostgreSQL migration completion
92c980b feat(database): migrate to PostgreSQL baseline with docker-compose, CI postgres service, and test isolation
9712a94 fix(tenant): enforce 403 on write and read-only db for suspended learning centers
23f0d34 test(refactor): rename trust2 test files to descriptive names
0fc3ee3 fix(security): enforce intra-center group and record checks for teacher and parent
8f52b6b feat(security): enforce strict read-only mode in getTenantDb for PLATFORM_SUPPORT
4d23c6a test: configure TRUSTED_PROXY_HOPS in vitest environment
84c4658 docs: update STATUS.md with honest re-evaluated module statuses after TRUST-2
e732637 fix(attendance): enforce intra-center role scoping for attendance queries
3e21d8e fix(auth): make invite acceptance atomic, block suspended centers, log audit, and prevent role conflicts
23cedae fix(auth): make registration transactional with P2002 duplicate email handling
223576c feat(auth): send localized ru/uz email links for email confirmation and invite accept
ed19170 feat(permissions): validate membershipPermissions with Zod rejecting platform escalation
a6f63ba fix(permissions): remove wildcard access for SUPERADMIN and restrict technical infrastructure permissions
```

---

## 2. Результаты верификации (tsc, lint, vitest, build)

Все команды запущены и сохранены в `reports/*.log`:

| Команда | Код возврата (Exit Code) | MD5 дайджест лога | Итог проверки |
|---|---|---|---|
| `npx tsc --noEmit` | **0** | `058725b31947b81a29ab7b8fb3656dac` | Успешно (0 ошибок типов) |
| `npm run lint` | **1** | `ca55e41cb67df027c7f96d7ca6d60179` | **FAIL** (217 строк, ошибки `@typescript-eslint/no-explicit-any` в UI-страницах и API catch-блоках) |
| `npx vitest run` | **0** | `2f8c6ae60188bd7063f6067780366ba7` | **PASS** (60 файлов, 319 тестов, 0 failed, 0 skipped) |
| `npm run build` | **1** | `8f95e72c8615570c44abdc99f1efb4a9` | **FAIL** (Next.js прерывает сборку из-за непрошедшего ESLint) |

---

## 3. Таблица тестов («файл → количество», сумма = vitest)

Общее количество тестовых файлов: **60**.
Общее количество пройденных тестов: **319** (0 failed, 0 skipped).

| № | Тестовый файл | Количество тестов |
|---|---|---|
| 1 | `tests/lockout.test.ts` | 9 |
| 2 | `tests/password.test.ts` | 8 |
| 3 | `tests/pending-limits.test.ts` | 2 |
| 4 | `tests/register-limits.test.ts` | 2 |
| 5 | `tests/migration.test.ts` | 1 |
| 6 | `tests/security-ip-proxy.test.ts` | 8 |
| 7 | `tests/register.test.ts` | 8 |
| 8 | `tests/auth-register-transaction.test.ts` | 2 |
| 9 | `tests/login.test.ts` | 3 |
| 10 | `tests/e2e-journey.test.ts` | 9 |
| 11 | `tests/tenant-support-route-audit.test.ts` | 40 |
| 12 | `tests/platform-organizations.test.ts` | 12 |
| 13 | `tests/pending-invite.test.ts` | 6 |
| 14 | `tests/email-verified.test.ts` | 3 |
| 15 | `tests/platform-membership-undefined.test.ts` | 9 |
| 16 | `tests/attendance-race.test.ts` | 2 |
| 17 | `tests/tenant-session-revocation.test.ts` | 6 |
| 18 | `tests/platform-roles-real-routes.test.ts` | 3 |
| 19 | `tests/invites.test.ts` | 4 |
| 20 | `tests/idor.test.ts` | 10 |
| 21 | `tests/auth.test.ts` | 10 |
| 22 | `tests/student-archive-business-logic.test.ts` | 7 |
| 23 | `tests/auth-invite-atomic-accept.test.ts` | 3 |
| 24 | `tests/auth-email-localization.test.ts` | 2 |
| 25 | `tests/notifications.test.ts` | 6 |
| 26 | `tests/tenant-ondelete-restrict.test.ts` | 1 |
| 27 | `tests/platform-organizations-suspension.test.ts` | 2 |
| 28 | `tests/tickets.test.ts` | 5 |
| 29 | `tests/student-archive-restrict.test.ts` | 2 |
| 30 | `tests/tenant-ops-matrix.test.ts` | 4 |
| 31 | `tests/platform-impersonation.test.ts` | 7 |
| 32 | `tests/platform-access.test.ts` | 6 |
| 33 | `tests/tenant-immutable-centerid.test.ts` | 2 |
| 34 | `tests/tenant-isolation.test.ts` | 9 |
| 35 | `tests/tenant-intercept-ops.test.ts` | 4 |
| 36 | `tests/tenant-foreign-relations.test.ts` | 5 |
| 37 | `tests/tenant-suspended-status.test.ts` | 5 |
| 38 | `tests/sessions.test.ts` | 9 |
| 39 | `tests/migration-platform-memberships.test.ts` | 2 |
| 40 | `tests/tenant-foreign-dmmf.test.ts` | 6 |
| 41 | `tests/intra-center-permissions.test.ts` | 9 |
| 42 | `tests/platform-centers-roles.unit.test.ts` | 6 |
| 43 | `tests/tenant-support-readonly.test.ts` | 4 |
| 44 | `tests/developer-access.test.ts` | 3 |
| 45 | `tests/limits-trial.test.ts` | 2 |
| 46 | `tests/email-confirm.test.ts` | 5 |
| 47 | `tests/dev-login.test.ts` | 4 |
| 48 | `tests/audit-log.test.ts` | 1 |
| 49 | `tests/tenant-readonly-db.test.ts` | 1 |
| 50 | `tests/tenant-require-request.test.ts` | 1 |
| 51 | `tests/platform-centers.unit.test.ts` | 9 |
| 52 | `tests/api-response.test.ts` | 4 |
| 53 | `tests/security-invite-passwords.test.ts` | 5 |
| 54 | `tests/permissions-membership-zod.test.ts` | 4 |
| 55 | `tests/rate-limiter.test.ts` | 4 |
| 56 | `tests/tenant-empty-id.test.ts` | 3 |
| 57 | `tests/tenant-models.test.ts` | 3 |
| 58 | `tests/schema-cascades-audit.test.ts` | 3 |
| 59 | `tests/permissions-superadmin-wildcard.test.ts` | 3 |
| 60 | `tests/i18n.test.ts` | 1 |
| **ИТОГО** | **60 файлов** | **319 тестов** |

---

## 4. Чеклист по этапам

### A. Фундамент
1. **Tenant-изоляция:**
   - `getTenantDb` инкапсулирован в `tenantCtx`: **СДЕЛАНО** (`13eaa72`, тест: `tests/tenant-isolation.test.ts`).
   - `TENANT_MODELS` по dmmf (двунаправленная сверка моделей со схемой): **СДЕЛАНО** (`6718c90`, тест: `tests/tenant-models.test.ts`).
   - `aggregate` и `groupBy` скоупинг: **СДЕЛАНО** (`451f24c`, тест: `tests/tenant-ops-matrix.test.ts`).
   - `default-deny` на операции в db-tenant: **СДЕЛАНО** (`451f24c`, тест: `tests/tenant-ops-matrix.test.ts`).
   - Foreign-key проверки связей через Prisma.dmmf: **СДЕЛАНО** (`b5176a0`, тест: `tests/tenant-foreign-dmmf.test.ts`).
   - Запрет смены `centerId` при update/upsert: **СДЕЛАНО** (`b55cc9e`, тест: `tests/tenant-immutable-centerid.test.ts`).
   - Read-only режим для `PLATFORM_SUPPORT`: **СДЕЛАНО** (`8f52b6b`, `607c16c`, тесты: `tests/tenant-support-readonly.test.ts`, `tests/tenant-support-route-audit.test.ts`).
2. **Сессии и jti в `requireTenantAccess`:** **СДЕЛАНО** (`5eb8a8d`, тест: `tests/tenant-session-revocation.test.ts`).
3. **`getClientIp` с `TRUSTED_PROXY_HOPS=0` по умолчанию:** **СДЕЛАНО** (`ccba80a`, тест: `tests/security-ip-proxy.test.ts`).
4. **`onDelete Restrict/SetNull` для связей с преподавателями:** **СДЕЛАНО** (`8cc0731`, тесты: `tests/tenant-ondelete-restrict.test.ts`, `tests/schema-cascades-audit.test.ts`).
5. **`Restrict` для платежей/оценок/посещаемости студента и статус `ARCHIVED`:** **СДЕЛАНО** (`2638187`, `ce8454c`, тесты: `tests/student-archive-restrict.test.ts`, `tests/student-archive-business-logic.test.ts`).
6. **Prisma на PostgreSQL, миграции применяются на чистой БД, CI на Postgres:** **СДЕЛАНО** (`92c980b`, тест: `tests/migration.test.ts`).

### B. Auth
1. **Логин:** **СДЕЛАНО** (`582c2ee`, тест: `tests/login.test.ts`).
2. **Lockout (по паре аккаунт+IP и global):** **СДЕЛАНО** (`72d4d41`, тест: `tests/lockout.test.ts`).
3. **Регистрация по инвайту (транзакционная):** **СДЕЛАНО** (`23cedae`, тест: `tests/register.test.ts`, `tests/auth-register-transaction.test.ts`).
4. **`PendingInvite` и атомарный `accept`:** **СДЕЛАНО** (`3e21d8e`, тесты: `tests/pending-invite.test.ts`, `tests/auth-invite-atomic-accept.test.ts`).
5. **Подтверждение email со ссылками (ru/uz):** **СДЕЛАНО** (`223576c`, тесты: `tests/email-confirm.test.ts`, `tests/auth-email-localization.test.ts`).
6. **Сброс и смена пароля:** **СДЕЛАНО** (`582c2ee`, тест: `tests/password.test.ts`).
7. **Сессии и «мои устройства»:** **СДЕЛАНО** (`582c2ee`, тест: `tests/sessions.test.ts`).
8. **Криптостойкие инвайт-коды (>=12 симв.):** **СДЕЛАНО** (`ccb3146`, тест: `tests/security-invite-passwords.test.ts`).
9. **Политика пароля (>=10 симв., запрет совпадения с email):** **СДЕЛАНО** (`ccb3146`, тест: `tests/security-invite-passwords.test.ts`).

### C. Платформа
1. **Организации (список, создание мастером, карточка, смена директора, pause/block/resume):** **СДЕЛАНО** (`b28f539`, `9712a94`, тесты: `tests/platform-organizations.test.ts`, `tests/platform-organizations-suspension.test.ts`).
2. **Имперсонация без записи членства в БД:** **СДЕЛАНО** (`9680f6d`, тест: `tests/platform-impersonation.test.ts`).
3. **Матрица ролей (Zod-валидация прав, ограничение SUPERADMIN от инфраструктуры):** **СДЕЛАНО** (`ed19170`, `a6f63ba`, тесты: `tests/permissions-membership-zod.test.ts`, `tests/permissions-superadmin-wildcard.test.ts`).
4. **Dev-login защищён (404 на production):** **СДЕЛАНО** (`f47925f`, `236fe09`, тест: `tests/dev-login.test.ts`).

### D. TRUST-3c/3d
1. **Миграция удаления платформенных членств с корректным условием:** **СДЕЛАНО** (`7bfb690`, тест: `tests/migration-platform-memberships.test.ts`).
2. **Удалены дубли тестов (генерация через `it.each`):** **СДЕЛАНО** (`fbb307a`, тест: `tests/tenant-support-route-audit.test.ts`).
3. **Таблица/обработка обращений к `ctx.membership` (защита от undefined при имперсонации):** **СДЕЛАНО** (`6b0dbb6`, тест: `tests/platform-membership-undefined.test.ts`).
4. **Архивация студентов (409 вместо 500, кнопка в UI, ru/uz):** **СДЕЛАНО** (`ce8454c`, тесты: `tests/student-archive-restrict.test.ts`, `tests/student-archive-business-logic.test.ts`, `src/components/StaffManager.tsx`).

### E. Не начато / В процессе
1. **Rate limiter и lockout в БД (2b):** **НЕ СДЕЛАНО** (в `src/lib/rate-limit.ts` используется in-memory Map; отсутствует таблица БД для общих лимитов).
2. **Реальная почта (2c):** **НЕ СДЕЛАНО** (в `src/lib/email.ts` логирование в консоль/лог; нет Resend/SMTP и таблицы очередей с ретраями в БД).
3. **Dockerfile и DEPLOY.md (2d):** **ЧАСТИЧНО** (`docker-compose.yml` есть только для dev Postgres, нет `Dockerfile`, нет `docker-compose.prod.yml`, нет `docs/DEPLOY.md` со скриптом бэкапа базы).
4. **Ядро центра (студенты и группы, расписание, посещаемость, оценки, домашние задания, кабинеты ролей):** **ЧАСТИЧНО** (базовые CRUD API и схемы есть, но нет полноценных кабинетов ролей, интерфейса перевода между группами, отчисления, интерактивного календаря расписания с коллизиями, пагинации, поиска).
5. **Редизайн и главная e-darischi:** **НЕ СДЕЛАНО** (лендинг содержит базовый заполнитель без маркетинговой структуры для владельцев центров).
6. **Вынос хардкода русского и узбекского в ru.json и uz-Latn.json:** **ЧАСТИЧНО / НЕ СДЕЛАНО** (базовый словарь в `src/lib/i18n.ts` есть, но сотни строк захардкожены в TSX страницах и API роутах).

---

## 5. Расхождения (обещанное vs реальность)

1. **`lint` и `build` падают с exit code 1:**
   - В предыдущих отчетах заявлялось, что кодовая база чиста от `any` (`14a6f4c refactor: eliminate any types and configure @typescript-eslint/no-explicit-any error rule`).
   - По факту: в `package.json` lint запускает `next lint && eslint tests --ext .ts,.tsx`.
   - В коде `src/app/**` и `src/components/**` обнаружено более 35 мест с явным `err: any` и `props: any`.
   - Из-за этого `npm run lint` завершается с кодом **1**, и `npm run build` завершается с кодом **1**.
2. **In-memory Rate Limiting вместо БД:**
   - `src/lib/rate-limit.ts` использует `globalForRateLimit.rateLimits = new Map()`. При перезапуске сервера или при работе нескольких инстансов лимиты не разделяются.
3. **Отсутствие Production Dockerfile и deploy-манифестов:**
   - В корне проекта нет `Dockerfile` и `docker-compose.prod.yml`.
4. **Неполная i18n интернационализация:**
   - Несмотря на заявленную поддержку ru/uz, файлы `ru.json` и `uz-Latn.json` как отдельные JSON-ресурсы отсутствуют (переводы зашиты в TypeScript-объекты `src/lib/i18n.ts` и фрагментарно в компоненты).

---

## 6. Список известных рисков безопасности

1. **`src/lib/auth.ts` — Небезопасный fallback для JWT_SECRET:**
   - В строке 6: `const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-prod";`.
   - Если переменная не выставлена на проде, сервер стартует с общеизвестным статическим ключом, что делает возможной подделку токенов.
2. **`src/lib/rate-limit.ts` — Состояние rate limiter в памяти:**
   - Сброс счетчиков при перезапусках процессов и неэффективность в кластерных/serverless средах.
3. **`src/lib/ip.ts` — Блокировка всех клиентов за прокси при `TRUSTED_PROXY_HOPS=0`:**
   - При нулевых хопах все внешние запросы получают IP `"unknown"`. Rate limiter по IP объединяет всех пользователей в один пул `"unknown_register"`.
4. **`src/app/api/auth/register/route.ts` — Создание активного членства до верификации email:**
   - При регистрации нового пользователя создается `CenterMembership` со статусом `ACTIVE`. Хотя финансовые операции требуют `emailVerified`, доступ к чтению данных тенанта открывается сразу.
5. **`src/app/api/auth/login/route.ts` — Отсутствие проверки подтверждения email при логине:**
   - Логин проверяет только `user.isActive`, но игнорирует `user.emailVerified`. Пользователь может авторизоваться сразу после создания аккаунта без подтверждения владения почтой.
6. **`src/lib/tenant.ts` — Платформенные роли игнорируют статус блокировки центра:**
   - DEVELOPER и SUPERADMIN могут обращаться к центрам со статусом `BLOCKED` и `CANCELLED` без предупреждения и ограничений.
7. **`src/lib/db-tenant.ts` — N+1 запросов при валидации связей:**
   - Метод `validateForeignRelations` проверяет внешние ключи последовательными одиночными запросами `delegate.findFirst`.
