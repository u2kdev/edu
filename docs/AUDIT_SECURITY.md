# Аудит безопасности проекта `e-darschi` (Read-Only)

**Дата аудита:** 2026-11-12  
**Репозиторий:** `D:\AZIZ PROJECT` (`Next.js 14.2.35`, `Prisma 5.22.0`, `PostgreSQL`, `Zod 4.6.5`, `Expo/React Native` в `mobile/`)  
**Режим:** только чтение (исходный код, схема БД и конфигурации не изменялись).  
**Уровни критичности:** `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`  
**Оценка трудоёмкости исправления:** `S` (до 2 часов), `M` (0.5–2 дня), `L` (от 3 дней / архитектурные изменения).  
**Ограничение:** там, где конкретные файлы или поведение не проверялись напрямую, явно указано **`НЕ ПРОВЕРЕНО`**.

---

## Результаты базовых проверок (`tsc`, `lint`, `build`, `npm audit`)

| Проверка | Команда | Результат | Примечания |
| :--- | :--- | :--- | :--- |
| TypeScript | `npx tsc --noEmit` | **Пройдено** (код 0) | Ошибок типов нет |
| ESLint | `npm run lint` | **Пройдено** (код 0) | Предупреждения: `@next/next/no-img-element`, `react-hooks/exhaustive-deps`, `@next/next/no-page-custom-font` |
| Production Build | `npm run build` | **Пройдено** (код 0) | Собраны 200 статических/динамических маршрутов Next.js `14.2.35` |
| Production-зависимости | `npm audit --omit=dev` | **4 уязвимости** (`1 critical`, `3 high`) | `next` (critical), `postcss` (high), `source-map-js` (high), `zod` (high) |
| Все зависимости | `npm audit` | **21 уязвимость** (`1 critical`, `9 high`, `11 moderate`) | Дополнительно dev-зависимости (`vite`, `vitest`/`@vitest/mocker`, `glob`, `js-yaml`, `brace-expansion`, `minimatch`, `postcss-selector-parser`) |

---

## 1. СЕКРЕТЫ

### 1.1 Отслеживание в Git (`git ls-files` и `git log --all`)
- **`git ls-files`:** среди отслеживаемых файлов найдены `.env.example`, `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`, `.dockerignore`, `vercel.json`, `tests/jwt-secret.test.ts` (совпадение по имени `secret`), а также SQL-миграции. Боевые файлы `.env`, `mobile/.env`, `transmitter/.env` в git **не отслеживаются**.
- **`git log --all` (MEDIUM):** в истории коммитов присутствуют файлы локальных SQLite-баз данных и `.env.example`:
  - `prisma/check.db`
  - `prisma/dev.db`
  - `prisma/test.db`
  - `prisma/test_baseline.db`
  - `.env.example`
  - **Механизм риска:** при наличии в старых дампах `*.db` тестовых/учётных записей или токенов любой с доступом к git-истории может их извлечь. **Затронутые данные:** исторические записи dev/test БД. **Оценка:** `S` (проверить содержимое и при необходимости очистить историю через `git filter-repo`).
- **`.gitignore`** (`L32-33`, `L42`, `L53`, `L59`): игнорирует `.env`, `.env*.local`, `*.db`, `transmitter/`, `.env*`.
- **Локальные env-файлы на диске (не в git):** присутствуют `.env` (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL` с dev-значениями), `mobile/.env` (`EXPO_PUBLIC_API_URL`) и `transmitter/.env` (`TELEGRAM_BOT_TOKEN` длиной 46 символов — не dev-токен, `ALLOWED_USERNAME`). Значения не выгружались.

### 1.2 Содержимое `.env.example` и `mobile/.env.example`
- `.env.example`:
  - `L2, L4`: `DATABASE_URL` и `DIRECT_URL` используют слабый учебный пароль `password` (`postgresql://postgres:password@localhost:5432/lms?schema=public`).
  - `L7`: `JWT_SECRET="replace-with-a-secure-random-32-char-secret-key!"`.
  - `L10-11`: `DEV_LOGIN=false`, `DEV_EMAIL_LOG=false`.
  - `L17`: `TRUSTED_PROXY_HOPS=0` (опасное значение по умолчанию в сочетании с `src/lib/ip.ts` — см. раздел 2).
  - `L24-26`: `APP_URL`, `NEXT_PUBLIC_URL`, `NEXT_PUBLIC_APP_URL` = `"http://localhost:3000"`.
  - `L30-32`: `EMAIL_PROVIDER="memory"`, `RESEND_API_KEY=""`, `EMAIL_FROM="e-darschi LMS <noreply@example.com>"`.
  - `L35`: `CRON_SECRET="replace-with-a-random-16-char-secret"`.
  - `L38-45`: `FEATURE_UPLOADS="false"`, `STORAGE_PROVIDER=""`, `STORAGE_BUCKET=""`, `STORAGE_ENDPOINT=""`, `STORAGE_PUBLIC_DOMAIN=""`, `# NEXT_PUBLIC_CDN_URL=""`.
- `mobile/.env.example` (`L1-3`): `EXPO_PUBLIC_API_URL=http://localhost:3000`.

### 1.3 Зашитые секреты, fallback-значения и dev-учётки
- **Положительный контроль (Fail-closed runtime JWT):**
  - `src/lib/auth.ts:7-19, 31-36`: `validateJwtSecret` требует непустой `JWT_SECRET` длиной `>= 32`; `getJwtSecret()` падает с исключением, без fallback-ключа.
  - `src/instrumentation.ts:1-6` + `src/lib/startup-checks.ts:1-104`: проверяет обязательные production-переменные при старте сервера (пропуская этап `phase-production-build`).
- **Найдены fallback-секреты и захардкоженные пароли в скриптах, тестах и dev-коде:**
  - **[LOW] `scripts/take-screenshots.mjs:95`:** fallback `process.env.JWT_SECRET || "super-secret-jwt-key-for-aziz-lms-platform-2026"`. Если скрипт запустят против staging/prod без `JWT_SECRET`, используется предсказуемый ключ. **Оценка:** `S`.
  - **[LOW] `scripts/create-test-db.js:7`:** захардкожена строка подключения `"postgresql://postgres:admin@localhost:5432/postgres?schema=public"`. **Оценка:** `S`.
  - **[LOW] `prisma/seed.ts:73-81, 85`:** блокирует запуск в `NODE_ENV=production` (`process.exit(1)`), но содержит fallback `process.env.DEV_SEED_PASSWORD || "Password123!"`. **Оценка:** `S`.
  - **[LOW] `tests/sessions.test.ts:156` и `tests/superadmin-instructions-e2e.test.ts:555`:** fallback-строки `"fallback-secret-key-change-in-prod"` и `"test-cron-secret-12345"` (только в тестах). **Оценка:** `S`.
  - **`scripts/first-owner.ts:7-9, 17`:** читает `OWNER_EMAIL || argv[2]`, `OWNER_PASSWORD || argv[3]`, `OWNER_NAME || argv[4]`. Передача пароля через CLI `argv[3]` оставляет секрет в истории shell/таблице процессов; проверка длины `password.length < 8`.
  - **[LOW] `src/app/login/page.tsx:289-317`:** кнопки быстрого входа с захардкоженными `"admin@platform.com"`, `"director1@example.com"` и `"Password123!"` (закрыты проверкой `process.env.NODE_ENV !== "production"`). **Оценка:** `S`.

### 1.4 Утечка в клиентский бандл (`NEXT_PUBLIC_*` и `mobile/`)
- **`NEXT_PUBLIC_*` в веб-части:** используются только `NEXT_PUBLIC_URL` (`src/app/api/auth/password/forgot/route.ts:65`, `src/app/api/auth/register/route.ts:93,206`, `src/app/api/auth/resend-confirm/route.ts:49`, `src/app/api/platform/centers/route.ts:225`, `src/lib/password-reset.ts:40`), `NEXT_PUBLIC_CDN_URL` (`src/lib/storage.ts:262,340`) и `NEXT_PUBLIC_FEATURE_UPLOADS` (`src/lib/storage.ts:320`). Серверных ключей/токенов в `NEXT_PUBLIC_*` не обнаружено.
- **`mobile/` клиентский бандл:**
  - `mobile/src/components/dev-quick-login.tsx:14-57, 67, 132`: захардкожены `DEV_DEFAULT_PASSWORD = "MobilePass123!"` и 5 демо-email. В production-сборках подменяется на пустую заглушку `mobile/src/components/dev-quick-login.prod.tsx` через `mobile/metro.config.js:9-19`, дополнительно на клиенте проверяется `if (!__DEV__) return null`, а для проверки release-бандла в репозитории есть `scripts/check-release-bundle.mjs:1-105`.
  - **Риск (LOW):** ошибка в `NODE_ENV` при сборке Android/iOS APK может оставить демо-креды в бандле; необходимо обязательно прогонять `npm run check:release-bundle` в CI. **Оценка:** `S`.
- **Директория `transmitter/`:** локально содержит `.env` с не-dev `TELEGRAM_BOT_TOKEN`; исходный код `transmitter/` — **`НЕ ПРОВЕРЕНО`**.

---

## 2. АУТЕНТИФИКАЦИЯ И СЕССИИ

### 2.1 Хеширование и парольная политика
- **Хеширование (`src/lib/auth.ts:54-60`):** `bcryptjs`, cost factor `10` (`bcrypt.hash(password, 10)`). Допустимо, рекомендуется cost `11–12` для высокопривилегированных аккаунтов.
- **[HIGH] Несогласованная и слабая парольная политика + отсутствие верхнего лимита (риск обрезания bcrypt на 72 байтах и DoS):**
  - `src/lib/validation/auth.ts:35-51` (`registerSchema`): `.min(10).max(128)`, проверка отличия от email.
  - `src/lib/validation/auth.ts:57-69` (`passwordPolicy` для `password/reset` и `password/change`): только `.min(8).max(50)`, **без требований к сложности**.
  - `src/app/api/invites/redeem/route.ts:103-108`: минимальная длина **6 символов** (`password.length < 6`), без сложности и верхнего предела.
  - `src/app/api/tenant/users/route.ts:46, 306-308`: `z.string().min(6).optional().nullable()` без сложности и максимума; при длине `< 6` после trim пароль молча заменяется на сгенерированный.
  - `src/app/api/tenant/users/[id]/reset-password/route.ts:14, 78-80`: `min(6)`, без сложности и максимума.
  - `src/app/api/platform/users/route.ts:38`, `src/app/api/platform/team/route.ts:17`, `src/app/api/platform/first-owner/route.ts:12`: только `min(8)`.
  - `src/app/api/developer/platform-owners/route.ts:47-62`: **нет проверки ни длины, ни сложности пароля** (только `!password` — пропустит 1-символьный пароль).
  - **Механизм атаки:** злоумышленник или небрежный админ устанавливает слабый/короткий пароль для привилегированной учётной записи (`DEVELOPER`/админ), облегчая подбор. **Затронутые данные:** учётные записи платформы и центров. **Оценка:** `S`.
- **[HIGH] `/api/account/change-password` не отзывает активные сессии (`src/app/api/account/change-password/route.ts:70-76`):**
  - В отличие от `/api/auth/password/change/route.ts:70-73`, смена пароля через `/api/account/change-password` не отзывает другие `UserSession` пользователя, не имеет rate limit и не проверяет `emailVerified`.
  - **Механизм атаки:** при компрометации сессии/токена жертвы смена пароля жертвой не выкидывает злоумышленника. **Затронутые данные:** аккаунт и сессии пользователя. **Оценка:** `S`.
- **[MEDIUM] Передача открытых паролей в API-ответах и `EmailOutbox`:**
  - `src/app/api/tenant/users/route.ts:486-502, 527-535`: возвращает сгенерированный пароль в HTTP JSON (правда, с `Cache-Control: no-store`) и ставит его в очередь `EmailOutbox` (таблица БД хранит HTML/текст письма с открытым паролем до 30 дней).
  - Аналогично открытые пароли возвращаются в `src/app/api/platform/users/route.ts:358-362`, `src/app/api/platform/team/route.ts:119`, `src/app/api/platform/users/[id]/reset-password/route.ts:77`, `src/app/api/tenant/users/[id]/reset-password/route.ts:127-133`, `src/app/api/tenant/users/bulk/route.ts:196`, `src/app/api/students/import-csv/route.ts:251`.
  - `src/app/api/invites/bulk-import/route.ts:41` генерирует пароль hex-строкой (`crypto.randomBytes(10).toString("hex")`) вместо `generateSecurePassword`. **Оценка:** `M`.
- **[MEDIUM] Слабая проверка совпадения пароля с email/старым паролем (`src/app/api/auth/password/reset/route.ts:35-37`, `src/app/api/auth/password/change/route.ts:32-34`):** сравнение `newPassword === email` чувствительно к регистру, в `password/change` нет запрета повторного использования текущего пароля. **Оценка:** `S`.

### 2.2 JWT, `UserSession`, ротация и отзыв
- **Положительный контроль (`src/lib/auth.ts:64-78, 197-221`):** HS256, `jti` (UUIDv4) хешируется SHA-256 в `UserSession.jtiHash`; проверяются `revokedAt` и `expiresAt` (при `NODE_ENV !== "test"` токены без `jti` отклоняются).
- **[HIGH] Обход обнаружения кражи refresh-токена и привязки к `deviceId` (`src/app/api/auth/mobile/refresh/route.ts:48-151`):**
  - В строках `50-59` при повторном использовании `prevRefreshTokenHash` глобальный отзыв всех сессий пользователя **пропускается**, если `Math.abs(Date.now() - reusedSession.lastSeenAt) < 1000` (1 секунда). Поскольку выдача токена обновляет `lastSeenAt` (строка `141`), злоумышленник, перехвативший предыдущий refresh-токен, может повторить запрос в течение 1 с и избежать тревоги/отзыва; а более старый (`n-2`) токен попадает на строку `84` (`401 Invalid refresh token`) без отзыва активных сессий.
  - В строках `101-104` проверка устройства `if (session.deviceId && deviceId && session.deviceId !== deviceId)` срабатывает только если `deviceId` передан; в `mobileRefreshTokenSchema` (`src/lib/validation/auth.ts:32`) поле `deviceId` опционально — пропуск поля полностью обходит привязку устройства.
  - **Затронутые данные:** мобильные refresh/access-сессии пользователей. **Оценка:** `S`.
- **[MEDIUM] Старые сессии не отзываются при `switch-tenant`, `invites/accept` и блокировке членства в центре:**
  - `src/app/api/auth/switch-tenant/route.ts:32-45`, `src/app/api/invites/accept/route.ts:151-164`, `src/app/api/invites/redeem/route.ts:223-236` создают новую 7-дневную `UserSession`, оставляя старую действующей.
  - `src/app/api/tenant/users/[id]/route.ts:351-365` (`PATCH` перевод `status` членства в `SUSPENDED`/`ARCHIVED`) не отзывает `UserSession` (в отличие от `DELETE` на строке `451`, который, наоборот, удаляет **все** глобальные сессии пользователя во всех центрах без проверки `canManageUserAccount`). **Оценка:** `S`.
- **[MEDIUM] Мелкие недочёты сессий:**
  - Нет явного указания `algorithms: ["HS256"]` в `jwt.verify` (`src/lib/auth.ts:75`), нет лимита одновременных `UserSession` на пользователя.
  - `src/app/api/auth/login/route.ts:152-153` и `mobile/login/route.ts:138` пропускают проверку `emailVerified` для платформенных ролей (`platformRole !== "NONE"`).
  - `src/app/api/auth/account/delete/route.ts:80-110` не выставляет `deletedAt` и не удаляет cookie `auth_token` из ответа.
  - `src/app/api/auth/mobile/refresh/route.ts:117` при обновлении токена всегда сбрасывает `activeCenterId` на `user.memberships[0]`, теряя выбранный пользователем центр. **Оценка:** `S`.

### 2.3 Cookies
- `auth_token` на `login` (`L229-235`), `switch-tenant` (`L53-59`), `invites/accept` (`L176-182`), `invites/redeem` (`L251-257`), `impersonate` (`L132-147`): `httpOnly: true`, `secure: NODE_ENV === "production"`, `sameSite: "lax"`, `path: "/"`.
- **[HIGH] `POST /api/auth/logout` не удаляет cookie `platform_impersonation_original` (`src/app/api/auth/logout/route.ts:45-47`):**
  - Удаляется только `auth_token`. Если администратор нажал «Выйти» в режиме имперсонации (или оставил браузер), запечатанный cookie `platform_impersonation_original` живёт до 60 минут и позволяет вызовом `POST /api/platform/impersonate/stop` (который не проверяет отзыв исходной `UserSession`) заново получить валидный 7-дневный cookie `SUPERADMIN`/`DEVELOPER`. **Оценка:** `S`.
- **[LOW] Несоответствие сроков в мобильном логине (`src/app/api/auth/mobile/login/route.ts:166, 203-209`):** access JWT выдаётся на `15m`, а выставляемый одновременно cookie `auth_token` имеет `maxAge: 2592000` (30 дней). **Оценка:** `S`.

### 2.4 Brute-force, IP-спуфинг и перечисление пользователей (User Enumeration)
- **[CRITICAL] `getClientIp()` возвращает `"unknown"` по умолчанию или доверяет подделываемым заголовкам (`src/lib/ip.ts:1-32`):**
  - При `TRUSTED_PROXY_HEADERS !== "true"` или `TRUSTED_PROXY_HOPS <= 0` (в `.env.example:17` стоит `TRUSTED_PROXY_HOPS=0`) функция возвращает строку `"unknown"` **для всех клиентов подряд**. Все вызовы `checkRateLimit(ip)` и `LoginAttempt(email, ip)` слипаются в один ключ `"unknown"`: несколько неудачных запросов с одного злоумышленника блокируют вход и регистрацию **всем пользователям платформы** (глобальный DoS).
  - При `TRUSTED_PROXY_HEADERS === "true"` заголовки `cf-connecting-ip` / `x-real-ip` принимаются без проверки IP доверенного прокси, а при коротком `x-forwarded-for` строки `13-18` откатываются к `parts[0]` (левому, контролируемому клиентом IP) — что позволяет с любого клиента обходить rate limit и IP-блокировки простым перебором заголовка `X-Forwarded-For`.
  - **Затронутые данные:** доступность аутентификации и обход всех лимитов. **Оценка:** `M`.
- **[HIGH] Отсутствие rate limit и обход блокировки на 2FA / мобильном входе / смене пароля:**
  - `src/app/api/auth/2fa/route.ts`: полностью отсутствует rate limit на `POST` (перебор 6-значных TOTP-кодов) и `DELETE` (онлайн-перебор пароля).
  - `src/app/api/auth/login/route.ts:162-177`: при верном пароле и неверном `twoFactorCode` строка `175` возвращает `401` **без вызова `handleFailure()`** (`LoginAttempt` не растёт — TOTP можно перебирать с разных IP).
  - `src/app/api/auth/mobile/login/route.ts:59-126`: проверяет `globalAttempt.lockoutUntil`, но строки `107-111` **никогда не устанавливают `lockoutUntil` для `"GLOBAL"`**! Распределённый перебор паролей с нескольких IP на мобильном API не блокируется никогда.
  - `src/app/api/account/change-password/route.ts`, `src/app/api/auth/invites/accept/route.ts`, `src/app/api/invites/parent-link/route.ts`: отсутствует rate limit. **Оценка:** `S`.
- **[HIGH] Перечисление пользователей и утечка по времени (Timing Oracle):**
  - `src/app/api/auth/login/route.ts:142-150` и `mobile/login/route.ts:128-135`: `comparePassword` (тяжёлый `bcrypt`) вызывается **только если пользователь найден и активен**; для несуществующих email ответ возвращается заметно быстрее. Также веб-логин (`L81-94`) выдаёт разные коды при `GLOBAL` lockout (`429`) и IP lockout (`401`), а оба эндпоинта выдают `403 EMAIL_NOT_VERIFIED` и `{ requiresTwoFactor: true }`.
  - `src/app/api/auth/register/route.ts:65-122, 188`: для существующего email применяются дополнительные ключи `checkRateLimit` (может дать `429`), или возвращается `409`; вдобавок **неаутентифицированный пользователь со знанием кода приглашения может спамить `PendingInvite` и письмами для чужого существующего аккаунта без проверки пароля и статуса центра** (`BLOCKED`/`CANCELLED`).
  - `src/app/api/invites/redeem/route.ts:55-92`: явно отвечает `401 "Аккаунт с таким email уже существует..."`, раскрывая наличие аккаунта и статус блокировки пользователя/центра.
  - `src/app/api/auth/password/forgot/route.ts:26-93`: выравнивает задержку на `300ms`, но вызывает `sendEmailWithOutbox` внутри `if (user && user.isActive)`; внешний HTTP-запрос к Resend при отправке может превышать `300ms`, демаскируя существующий email. **Оценка:** `M`.

### 2.5 Токены сброса пароля, подтверждения email и инвайт-коды
- **Токены сброса пароля и email:** `crypto.randomBytes(32).toString("hex")` (256 бит), хранятся как SHA-256 `tokenHash` (срок: 30 мин для forgot, 24ч для email/setup, 72ч для создания центра/директора).
- **[MEDIUM] Неатомарное гашение токена сброса и утечка ссылки в ответе:**
  - `src/app/api/auth/password/reset/route.ts:26-47`: проверяет `resetToken.usedAt` до транзакции и обновляет по `where: { id: resetToken.id }` **без условия `usedAt: null`** (гонка при одновременных запросах).
  - `src/app/api/platform/centers/route.ts:213-222, 261`, `src/app/api/platform/centers/[id]/director/route.ts:55-63, 139` не отзывают предыдущие неиспользованные токены и возвращают открытый `resetUrl` в JSON-ответе (равно как `tenant/users/[id]/send-reset-link/route.ts:72` вне prod). **Оценка:** `S`.
- **Инвайт-коды:**
  - `src/lib/invites.ts:3-11` (`generateSecureInviteCode`): CSPRNG `crypto.randomBytes(12)` без modulo-bias (~60 бит энтропии); код хранится в открытом виде в `InviteCode.code`.
  - **[CRITICAL] Критические уязвимости родительских инвайт-кодов (`src/app/api/invites/parent-link/route.ts`):**
    1. Строка `41`: код генерируется с помощью **некриптографического `Math.random()`** — всего 4 цифры (`1000..9999`, ~13 бит энтропии) после предсказуемого префикса `studentMem.id.slice(0, 5)`.
    2. Строки `91-93` (`CLAIM_PARENT_LINK`): **не проверяются `expiresAt`, `maxUses`, `usesCount` и `center.status`** — просроченные и исчерпанные коды работают вечно (инкремент `usesCount` на `L159-162` неатомарен).
    3. Строка `114`: `const studentIdToLink = codeObj.studentMembershipId || studentId` — если использован обычный родительский инвайт без привязки к ученику (`studentMembershipId: null`), вызывающий может подставить **любой `studentId` из тела запроса** (IDOR) и получить статус `CONFIRMED` родителя чужого ребёнка в центре!
    - **Затронутые данные:** ПДн детей, оценки, посещаемость, оплаты. **Оценка:** `S`.
  - **[HIGH] Гонка `maxUses` и пропуск статуса центра при принятии инвайта (`src/app/api/invites/accept/route.ts:41-51, 143-148`, `src/app/api/invites/redeem/route.ts:202-205`):** неатомарное увеличение `usesCount` позволяет превысить `maxUses` и лимит мест `maxStudents`; `accept` не проверяет `center.status` и `emailVerified`; `invites/generate/route.ts:37-39` разрешает `customCode` любой длины (даже 1 символ). **Оценка:** `S`.

### 2.6 Имперсонация (`src/lib/impersonation.ts`, `/api/platform/impersonate/*`)
- **[CRITICAL] Эскалация привилегий до `SUPERADMIN` / `DEVELOPER` через имперсонацию (`src/app/api/platform/impersonate/route.ts:21, 59-103`, `src/lib/permissions.ts:281`):**
  - Право `"platform.impersonation"` выдано не только `DEVELOPER` и `SUPERADMIN`, но и **`PLATFORM_SUPPORT`** (`permissions.ts:281`).
  - `POST /api/platform/impersonate` вообще **не проверяет `targetUser.platformRole`, `isActive` и `deletedAt`** (`L59-70`) и выдаёт токен с `platformRole: targetUser.platformRole` (`L93`). `PLATFORM_SUPPORT` может войти под любым `SUPERADMIN` или `DEVELOPER` (а также создать цепочку имперсонации при манипуляции cookie `L107-110`).
  - **Затронутые данные:** вся платформа и все учебные центры. **Оценка:** `S`.
- **[CRITICAL] Отсутствие режима `read-only` при имперсонации и обход RBAC (`src/lib/tenant.ts:193-256`, `src/lib/tenant-access.ts:21, 81, 416`):**
  - Вопреки аудитам и баннеру, `requireTenantAccess` **не запрещает мутации** в режиме имперсонации. Запрет записи реализован лишь точечно (`requireFinanceTenantAccess`, `PATCH /api/account/profile`, `PATCH /api/account/notification-preferences`, частично в D2/U2). Остальные write-эндпоинты (оценки, посещаемость, расписание, сотрудники, ученики, **смена/отключение 2FA `/api/auth/2fa`, смена пароля, удаление аккаунта `/api/auth/account/delete`**) доступны имперсонатору на запись.
  - Более того, в `src/lib/tenant-access.ts:21, 81, 416` при `isActorImpersonating(ctx) === true` функции `requireCenterPermission`, `assertGroupAccess` и `getActorAcademicScope` **отключают проверки прав и выдают неограниченный доступ**, даже если админ вошёл под ролью `STUDENT`. **Оценка:** `M`.
- **[HIGH] `/api/platform/impersonate/stop` обходит отзыв сессий (`src/app/api/platform/impersonate/stop/route.ts:33-102`):**
  - Cookie `platform_impersonation_original` не привязан к `jti` / `UserSession`. Даже после отзыва сессии админа или нажатия `/api/auth/logout`, этот cookie в течение 60 минут позволяет получить свежий 7-дневный cookie с правами оригинала; кроме того, `stop` не проверяет сохранение права `platform.impersonation` у `originalUser` и не отзывает созданную сессию имперсонации в БД. **Оценка:** `S`.

### 2.7 Двухфакторная аутентификация (2FA) и мобильный вход
- **[CRITICAL] Полный обход 2FA через `/api/auth/mobile/login` (`src/app/api/auth/mobile/login/route.ts:128-235`):**
  - Мобильный логин проверяет пароль и сразу выдаёт access JWT, refresh token и браузерную cookie `auth_token` **без проверки `user.twoFactorEnabled` и TOTP-кода**. Любой злоумышленник, знающий пароль аккаунта с включённой 2FA, обходит её одним запросом на `/api/auth/mobile/login`. **Оценка:** `S`.
- **[CRITICAL] Секрет 2FA хранится в БД в открытом виде (`src/app/api/auth/2fa/route.ts:99`):**
  - Несмотря на комментарий в `prisma/schema.prisma:27` (`// TOTP secret (encrypted)`), в колонку `twoFactorSecret` записывается чистая строка Base32 (`twoFactorSecret: secret`), и так же без расшифровки читается в `login/route.ts:173`. Утечка дампа БД или ответа API компрометирует 2FA всех пользователей. **Оценка:** `M`.
- **[CRITICAL] Резервные коды 2FA фиктивные (`src/app/api/auth/2fa/route.ts:93, 116`, `src/lib/totp.ts:132-141`):**
  - При включении 2FA пользователю генерируются и показываются 8 резервных кодов, **но их хеши никуда не сохраняются в БД**, а на входе резервные коды не принимаются. Пользователи, потерявшие устройство, оказываются заблокированы. **Оценка:** `M`.
- **[CRITICAL] Произвольная перезапись 2FA без пароля (`src/app/api/auth/2fa/route.ts:74-101`):**
  - `POST /api/auth/2fa` принимает `{ secret, code }` от клиента без серверной привязки к выданному на `setup` секрету, не проверяет `twoFactorEnabled === true` и не запрашивает текущий пароль. Любая захваченная сессия (или имперсонация) позволяет тихо подменить `twoFactorSecret` на ключ злоумышленника. **Оценка:** `S`.
- **[HIGH] Повторное использование TOTP-кодов (Replay Attack) (`src/lib/totp.ts:95-117`):**
  - Принимается окно шагов `[-1, 0, +1]` (90 секунд), но последний использованный временной шаг нигде не запоминается; перехваченный одноразовый код можно использовать повторно в пределах 90 секунд. **Оценка:** `S`.
- **[HIGH] Гонка обновления токенов в мобильном приложении (`mobile/src/services/api-client.ts:69-99`):**
  - При параллельных ответах `401` каждый запрос независимо вызывает `/api/auth/mobile/refresh` без мьютекса и без передачи `deviceId` (`L75`). Первый запрос вращает токен, остальные отправляют устаревший токен, вызывая сброс авторизации на клиенте (`onUnauthorizedCallback`) либо глобальный отзыв всех сессий пользователя на сервере. **Оценка:** `M`.
- **[MEDIUM] Незашифрованные разделы офлайн-кэша и in-memory fallback (`mobile/src/services/auth-storage.ts:12-32`, `mobile/src/services/offline-cache.ts:26-55`):**
  - Внутренняя реализация `mobile/src/services/secure-cipher.ts` проверена в части интеграции (криптопримитивы внутри `secure-cipher.ts` отдельно не разбирались — частично `НЕ ПРОВЕРЕНО`), но `offline-cache.ts` шифрует только ключи с `grade|child|parent|student`, сохраняя дашборды, расписания и ДЗ в `SecureStore` открытым JSON; `auth-storage.ts` тихо деградирует до `Map` в ОЗУ при ошибке `SecureStore`. Также `mustChangePassword` из ответа `mobile/login:224` не блокирует API-запросы на сервере. **Оценка:** `M`.

---

## 3. АВТОРИЗАЦИЯ

### 3.1 Критические и высокие пробелы в API
1. **[CRITICAL] Публичный захват `SUPERADMIN` (`src/app/api/platform/first-owner/route.ts:16-24, 45-52`):** `GET` и `POST` не имеют ни аутентификации, ни bootstrap-секрета, ни блокировки по `NODE_ENV`. При `superadminCount === 0` любой запрос с интернета создаёт или повышает `existingUser` (`L60-70`) до `SUPERADMIN`. **Оценка:** `S`.
2. **[CRITICAL] Эскалация `CENTER_ADMIN` → `DIRECTOR` через инвайты (`src/app/api/invites/generate/route.ts:7-15, 23-29`):** список `VALID_TARGET_ROLES` включает `"DIRECTOR"`, а эндпоинт разрешён `CENTER_ADMIN`. Админ центра может выпустить инвайт-код директора и захватить центр. **Оценка:** `S`.
3. **[CRITICAL] Эскалация `PLATFORM_SUPPORT` → `SUPERADMIN`/`DEVELOPER` (`src/app/api/platform/impersonate/route.ts:21, 59-103` + `src/lib/permissions.ts:281`):** описано в п. 2.6. **Оценка:** `S`.
4. **[CRITICAL] IDOR-захват родительских прав (`src/app/api/invites/parent-link/route.ts:91-93, 114`):** описано в п. 2.5. **Оценка:** `S`.
5. **[CRITICAL] Подмена `centerId` в тикетах (`src/app/api/platform/support/route.ts:85-134`):** `POST` проверяет только `getAuthSession(req)` (любой авторизованный пользователь, включая ученика другого центра) и напрямую записывает произвольный `centerId` из тела в `SupportTicket`, делая его видимым/привязанным к чужому центру. **Оценка:** `S`.
6. **[HIGH] Ошибка в ключе прав `GET /api/developer/audit-logs` (`src/app/api/developer/audit-logs/route.ts:9`):** проверяет `"audit.read"` вместо `"platform.audit.read"` / `requireDeveloper()`. В результате `PLATFORM_ADMIN` и `FULL_ACCESS` (у которых есть `"audit.read"` в `permissions.ts:264, 273`) читают глобальный журнал аудита разработчиков. **Оценка:** `S`.
7. **[HIGH] Переключение на произвольный центр для платформенных ролей (`src/app/api/auth/switch-tenant/route.ts:19-30`):** при `platformRole !== "NONE"` (включая `SEO_ADMIN`) не проверяется ни существование `centerId`, ни наличие членства. **Оценка:** `S`.
8. **[HIGH] Отсутствие RBAC и скоупинга в `GET /api/courses` (`src/app/api/courses/route.ts:5-37`):** любой участник центра (`STUDENT`, `PARENT`, `ACCOUNTANT`, `CENTER_SUPPORT`) получает все курсы (включая неопубликованные черновики), модули, уроки, группы, список зачислений и email учителей. **Оценка:** `S`.
9. **[HIGH] Пробелы владения объектами (IDOR) у учителей и ассистентов в модулях, уроках, материалах и тестах:**
   - `src/app/api/lessons/[id]/route.ts:6-38, 49-56`: `GET` без проверки роли/зачисления; `DELETE` разрешён `TEACHER` для **любого урока центра** без проверки курса/группы.
   - `src/app/api/modules/reorder/route.ts:22-39` и `src/app/api/modules/[id]/route.ts:21-47`: разрешают `TEACHER` менять порядок/редактировать модули **любого курса центра** без проверки закрепления за курсом/группой.
   - `src/app/api/materials/[id]/route.ts:81-92, 158-169`: позволяют `TEACHER` и `TEACHER_ASSISTANT` менять/удалять материалы, вызывая проверку чтения (`"read"`) и пропуская `assertGroupAccess`, если `existing.groupId === null`.
   - `src/app/api/materials/route.ts:147-149` и `src/app/api/tests/route.ts:206-208`: если не передан `groupId`, учитель/TA может прикрепить материал или тест к чужому `courseId`/`lessonId` центра.
   - `src/app/api/tests/[id]/route.ts:316-336`: любой `TEACHER` центра может удалить любой тест центра (`DELETE`) без проверки авторства/группы.
   - `src/app/api/tests/start/route.ts:5-40`: нет проверки `role === "STUDENT"` и `assertMaterialAccess` — любой участник центра (родитель, незачисленный ученик) может запустить попытку любого теста центра. **Оценка:** `M`.
10. **[HIGH] Утечки и обход скоупов из-за неучтённых ролей (`ACCOUNTANT`, `CENTER_SUPPORT`, `TEACHER_ASSISTANT`):**
    - `src/lib/tenant-access.ts:419` (`getActorAcademicScope`) + `L551-557`: считает `ACCOUNTANT` неограниченной ролью (`isUnrestricted: true`), хотя в `permissions.ts:340-354` у бухгалтера нет прав на материалы/тесты/учеников.
    - `src/app/api/tests/route.ts:82-100` и `src/app/api/tests/[id]/route.ts:49-64`: для `TEACHER`, `TEACHER_ASSISTANT` и `ACCOUNTANT` `attemptsWhere === undefined`, что отдаёт чужие попытки учеников на общих тестах курса.
    - `src/app/api/attendance/analytics/route.ts:29-52`: нет ограничений для `TEACHER_ASSISTANT`, `CENTER_SUPPORT`, `ACCOUNTANT`, а параметр `groupId` (`L20-26`) не проверяется на принадлежность учителю.
    - `src/app/api/grades/matrix/route.ts:91-100, 138-150`: не ограничивает `TEACHER_ASSISTANT`, `ACCOUNTANT`, `CENTER_SUPPORT` — доступ к оценкам и email всех учеников любой группы.
    - `src/app/api/grades/route.ts:76-85`: для `TEACHER_ASSISTANT` передача `?groupId=...` (`L84`) перетирает фильтр групп без проверки принадлежности.
    - `src/app/api/homework/route.ts:40-163, 565-573`: не блокирует `ACCOUNTANT`/`CENTER_SUPPORT`; оставляет `allowedSubmissionStudentIds = null` для `TEACHER`/`TA` (утечка работ учеников из чужих групп на общем курсе); `PATCH` перезаписывает `Grade` в обход финализации (`FINAL`).
    - `src/app/api/students/[id]/route.ts:88-130` и `src/app/api/students/[id]/performance/route.ts:26-59`: пропускают `TEACHER_ASSISTANT`, `ACCOUNTANT`, `CENTER_SUPPORT` ко всем данным/оценкам/платежам любого ученика центра.
    - `src/app/api/tenant/students/[id]/transcript/route.ts:14-24`: проверяет `hasPermission("students.read")` без группового скоупа (позволяя `TEACHER`/`TA`/`CENTER_SUPPORT` выгружать транскрипты чужих учеников, но блокируя `PARENT`).
    - `src/app/api/tenant/schedule/route.ts:106-140`: `ACCOUNTANT`/`CENTER_SUPPORT` видят всё расписание; для `TA`/`STUDENT`/`PARENT` параметр `?groupId=...` перезаписывает скоуп-фильтр.
    - `src/app/api/center-payments/route.ts:26-38`: отдаёт оплаты учеников ролям `TEACHER` и `TEACHER_ASSISTANT`, у которых в `permissions.ts:355-381` нет `payments.read`. **Оценка:** `M`.
11. **[HIGH] Отсутствие проверки прав на `POST /api/upload/presign` (`src/app/api/upload/presign/route.ts:5-38`):** проверяется только `requireTenantAccess`, без проверки роли и категории (`MATERIAL` и т.п.) — любой ученик/родитель может запросить presigned URL для защищённых категорий (пока флаг `FEATURE_UPLOADS=false`, не активно на S3, но опасно при включении). **Оценка:** `S`.
12. **[MEDIUM] Обход read-only `PLATFORM_SUPPORT` в настройках центра (`src/app/api/account/notification-preferences/route.ts:118-122, 148-157`):** прямой вызов `db.learningCenter.update` пропускает `PLATFORM_SUPPORT` под условием `tenantCtx.isPlatformStaff`. **Оценка:** `S`.
13. **[MEDIUM] Утечка внутренних заметок поддержки и пропуск ролей в `/api/tickets*`:**
    - `src/app/api/tickets/route.ts:18-21, 30, 49, 80` и `src/app/api/tickets/[id]/route.ts:26, 32-35`: в `isPlatformStaff` забыты `DEVELOPER` и `FULL_ACCESS`; выборка `messages` не фильтрует `isInternal: false` — **внутренние служебные заметки (`isInternal: true`) утекают авторам тикетов и директорам**; `POST /api/tickets` доверяет `scope` из тела запроса. **Оценка:** `S`.
14. **[MEDIUM] Иные пробелы авторизации в инвайтах/модуле пользователей:**
    - `src/app/api/invites/accept/route.ts:41-49`: не проверяет `invite.center.status` и `emailVerified`.
    - `src/app/api/invites/redeem/route.ts:55`: проверяет только `BLOCKED` (пропуская `CANCELLED`).
    - `src/app/api/platform/users/[id]/memberships/route.ts`: не запрещает `PLATFORM_ADMIN` править членство `SUPERADMIN`/`DEVELOPER` (в части других роутов запрещено). **Оценка:** `S`.

### 3.2 `src/middleware.ts`, Server Components и публичные/cron-эндпоинты
- **`src/middleware.ts:18-53`:**
  - **Не выполняет проверку JWT/сессии/RBAC** вообще — защита страниц и API полностью децентрализована по обработчикам.
  - CSRF-проверка по `Origin`: игнорирует `GET`/`HEAD`/`OPTIONS` (`SAFE_METHODS`), пропускает запросы вообще без заголовка `Origin` (`L29`), и **[MEDIUM]** формирует список разрешённых хостов из `req.headers.get("host")` и **`req.headers.get("x-forwarded-host")`** (`L37`). Если прокси не перезаписывает `X-Forwarded-Host`, злоумышленник может подставить свой домен и обойти защиту от CSRF. **Оценка:** `S`.
- **Server Components / Layouts (найдено `0` Server Actions `"use server"`):**
  - **[HIGH] `src/app/center/invites/page.tsx:15-41`:** нет серверной проверки роли — любой `STUDENT`/`PARENT`, открыв `/center/invites`, получает в RSC-пропсах все активные инвайт-коды центра. **Оценка:** `S`.
  - **[HIGH] `src/app/center/courses/page.tsx:15-39` и `src/app/center/courses/[id]/page.tsx:22-58`:** нет проверки роли и зачисления — отдают в RSC неопубликованные курсы, уроки, `fileUrl` материалов, группы и email преподавателей всем ролям центра. **Оценка:** `S`.
  - **[HIGH] `src/app/center/support/[id]/page.tsx:38-43`:** пускает по условию `ticket.centerId === centerId` (`isCenterTicket`) без проверки роли админа — любой ученик/родитель центра может читать чужие тикеты центра (включая внутренние заметки при отсутствии фильтра). **Оценка:** `S`.
  - **[MEDIUM] `src/app/center/groups/page.tsx:18-99`:** передаёт в клиентский компонент массив `enrollments`, раскрывающий ученикам/родителям `email`, `phone`, `attendanceRate`, `isAtRisk`, `parentName`, `parentPhone` одногруппников. **Оценка:** `S`.
  - **[MEDIUM] `src/app/center/settings/page.tsx:15-69` & `src/app/center/page.tsx:84, 125-129, 2099`:** передают реквизиты (`inn`, `legalName`, `subscription`) и `totalRevenue` центра в SSR даже пользователям без прав на настройки/финансы. **Оценка:** `S`.
  - **[MEDIUM] `src/app/platform-admin/layout.tsx:20-31`, `src/app/platform-admin/page.tsx:23-85`, `src/app/dashboard/platform/page.tsx:6-48`:** layout допускает `SEO_ADMIN` и `PLATFORM_SUPPORT`, а `platform-admin/page.tsx` и `dashboard/platform/page.tsx` выгружают список центров, владельцев и тарифы без проверки `"platform.dashboard"`. **Оценка:** `S`.
  - **[MEDIUM] `src/app/onboarding/page.tsx:22-25` vs `src/app/api/tenant/onboarding/route.ts`:** UI заявляет, что создание центров закрыто, но API `POST /api/tenant/onboarding` остаётся открытым для любого авторизованного пользователя (кроме `PLATFORM_SUPPORT`), без проверки `emailVerified` и лимита центров. **Оценка:** `S`.
  - **[LOW] `src/app/center/students/page.tsx:17-29`, `activity/page.tsx:6-17`, `audit/page.tsx:6-17`, `students/[id]/page.tsx:140+`:** отсутствие SSR-гейтов (данные таблиц грузятся API, но раскрываются названия групп, а на карточке ученика — `parentInviteCode` и IP из `activeSessions`). **Оценка:** `S`.
- **Публичные, Health и Cron эндпоинты:**
  - **[MEDIUM] `/api/cron/subscriptions` (`src/app/api/cron/subscriptions/route.ts:25`):** выражение `if (!authorized && process.env.NODE_ENV !== "test")` отключает проверку авторизации в тестовом окружении. **Оценка:** `S`.
  - **[LOW] `/api/cron/*` (`src/lib/cron-auth.ts:7`):** сравнение секрета через `===` вместо `crypto.timingSafeEqual` (теоретическая атака по времени); также разрешён HTTP `GET`. **Оценка:** `S`.
  - **[LOW] `/api/public/leads` (`POST`):** нет rate limit (потенциал для спама/DoS при подключении уведомлений/записи в БД). **Оценка:** `S`.
  - **[LOW] `/api/health` (`GET`):** публичный, без `Cache-Control: no-store`, раскрывает `version`, `environment`, `uptime` и `latencyMs` БД. **Оценка:** `S`.

### 3.3 Полный реестр авторизации всех 165 `route.ts` в `src/app/api`

Обозначения: `DIR` = `DIRECTOR`, `ADM` = `CENTER_ADMIN`, `TA` = `TEACHER_ASSISTANT`, `ACC` = `ACCOUNTANT`, `SUP` = `CENTER_SUPPORT`, `cid` = откуда берётся `centerId`. Проверена полнота `TENANT_MODELS` в `src/lib/db-tenant.ts:4-39`: все **34/34** моделей Prisma с полем `centerId` включены в `TENANT_MODELS`; модели без `centerId` (`Attendance`, `ParentLink`, `HomeworkMaterial`) требуют ручной изоляции по связям.

#### Маршруты 1–85 из 165

| # | Путь | Методы | Проверка аутентификации | Проверка роли / прав | Изоляция центра | Проверка владения (IDOR) | Источник `centerId` |
|---|---|---|---|---|---|---|---|
| 1 | `/api/account/change-password` | POST | `getAuthSession(req)` | Self-service (проверка текущего пароля) | N/A (глобальный пользователь) | Self (`session.user.id`) | none |
| 2 | `/api/account/notification-preferences` | GET, PATCH | `requireTenantAccess(req)` | GET: любой; PATCH центра (`L118-122`): `settings.manage`/`isPlatformStaff` (**GAP**: `PLATFORM_SUPPORT` проходит на raw `db.learningCenter.update` L148) | `requireTenantAccess` + `center.id` | User: self; Center: `center.id` | `tenantCtx.center.id` |
| 3 | `/api/account/profile` | GET, PATCH | `requireTenantAccess(req)` | Блокирует имперсонацию; `fullName` только DIR/ADM/`isPlatformStaff` | `requireTenantAccess` | Self (`session.user.id`) | none |
| 4 | `/api/attendance/analytics` | GET | `requireTenantAccess(req)` | **GAP** `L29-52`: нет скоупа для `TA`, `SUP`, `ACC` | `getTenantDb` + `course.centerId` | **GAP** `L20-26`: `groupId` не проверяется для TEACHER | `tenantCtx.center.id` |
| 5 | `/api/attendance/bulk` | POST | `requireTenantAccess(req)` | DIR/ADM/TEACHER/TA/`isPlatformStaff` | `getTenantDb` + `center.id` | `assertGroupAccess(..., "attendance")` | `tenantCtx.center.id` |
| 6 | `/api/attendance/export` | GET | `requireTenantAccess(req)` | DIR/ADM/TEACHER/`isPlatformStaff` | `getTenantDb` | Проверка групп учителя | `tenantCtx.center.id` |
| 7 | `/api/attendance` | GET, POST | `requireTenantAccess(req)` | GET: скоуп для STUDENT/PARENT/TEACHER/TA (ACC/SUP не отсечены); POST: DIR/ADM/TEACHER/TA/`isPlatformStaff` | `getTenantDb` + `center.id` | Проверка группы/замены на POST | `tenantCtx.center.id` |
| 8 | `/api/auth/2fa` | GET, POST, DELETE | `getAuthSession(req)` | Self-service (**GAP**: нет пароля на перезапись POST, нет rate limit) | Глобальный | Self (`session.user.id`) | none |
| 9 | `/api/auth/account/delete` | DELETE | `getAuthSession(req)` | Self-service (пароль + проверка единственного DIR) | Глобальный + членства | Self (`session.user.id`) | none |
| 10 | `/api/auth/confirm-email` | POST | NONE (публичный токен) | Проверка токена (rate-limited) | Глобальный | Совпадение хеша токена | none |
| 11 | `/api/auth/dev-login` | POST | Env-gate `L11` (`NODE_ENV==="production" \|\| DEV_LOGIN!=="true"` -> 404) | Нет в dev-режиме | Глобальный `db` | Dev only: `userId` из тела (`L16`) | none |
| 12 | `/api/auth/invites/accept` | POST | `getAuthSession()` | Блокирует `PLATFORM_SUPPORT` | `getTenantDb(invite.centerId)` | `invite.email === session.user.email` + статус центра | `invite.centerId` |
| 13 | `/api/auth/login` | POST | NONE (публичный) | Блокировки + `emailVerified` + 2FA TOTP | Глобальный `db` | Проверка учётных данных | none |
| 14 | `/api/auth/logout` | POST | Опц. `getAuthSession(req)` | Отзыв своей сессии | Глобальный `db` | Свой JTI / `userId` | none |
| 15 | `/api/auth/me/language` | PATCH | `getAuthSession()` | Self-service | Глобальный `db` | Self (`session.user.id`) | none |
| 16 | `/api/auth/me` | GET | `getAuthSession()` | Авторизованный | Глобальный `db` | Self (`session.user.id`) | none |
| 17 | `/api/auth/mobile/login` | POST | NONE (публичный) | Блокировки + пароль (**CRITICAL GAP**: нет проверки 2FA) | Глобальный `db` | Проверка учётных данных | none |
| 18 | `/api/auth/mobile/refresh` | POST | NONE (refresh token) | Ротация + обнаружение повтора (**GAP**: окно 1000ms и опц. `deviceId`) | Глобальный `db` | Хеш refresh-токена | none |
| 19 | `/api/auth/password/change` | POST | `getAuthSession()` | Авторизованный + `emailVerified` | Глобальный `db` | Self (`session.user.id`) | none |
| 20 | `/api/auth/password/forgot` | POST | NONE (публичный) | Rate-limited | Глобальный `db` | Нейтральный ответ | none |
| 21 | `/api/auth/password/reset` | POST | NONE (публичный токен) | Токен + отзыв всех сессий | Глобальный `db` | Хеш токена (неатомарно) | none |
| 22 | `/api/auth/register` | POST | NONE (публичный инвайт) | `DIRECTOR` исключён из `allowedRoles` | `getTenantDb(invite.centerId)` | Валидный инвайт (для existing user — спам `PendingInvite`) | `invite.centerId` |
| 23 | `/api/auth/resend-confirm` | POST | NONE (публичный) | Rate-limited | Глобальный `db` | Нейтральный ответ | none |
| 24 | `/api/auth/sessions` | GET, DELETE | `getAuthSession()` | Self-service | Глобальный `db` | Скоуп `session.user.id` | none |
| 25 | `/api/auth/switch-tenant` | POST | `getAuthSession()` | **GAP** `L19-30`: при `platformRole!=="NONE"` не проверяет членство и центр | Условная проверка (`NONE` only) | Обход для платформенных ролей | `body` (`centerId`) |
| 26 | `/api/center-payments/report` | GET | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` | Сводный отчёт центра | `tenantCtx.center.id` |
| 27 | `/api/center-payments` | GET, POST, PATCH | `requireTenantAccess(req)` | **GAP** GET `L26-38` пускает TEACHER/TA к платежам; POST/PATCH: DIR/ADM/ACC/`isPlatformStaff` | `getTenantDb` + `center.id` | STUDENT self; PARENT confirmed; TEACHER/TA группа | `tenantCtx.center.id` |
| 28 | `/api/courses/[id]` | GET, PATCH, DELETE | `requireTenantAccess(req)` | GET: `courses.read` или STUDENT; PATCH/DELETE: `courses.manage`/`isPlatformStaff` | `getTenantDb` + `center.id` | Нет скоупа зачисления на GET для STUDENT/TEACHER | `tenantCtx.center.id` |
| 29 | `/api/courses` | GET, POST | `requireTenantAccess(req)` | **GAP** GET `L5-37`: **нет проверки роли**; POST: DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | **GAP** GET: нет скоупинга | `tenantCtx.center.id` |
| 30 | `/api/cron/cleanup` | GET, POST | `verifyCronSecret(req)` | Секрет (**GAP**: `===` вместо `timingSafeEqual`) | Глобальный `db` | Системная задача | none |
| 31 | `/api/cron/email-outbox` | GET, POST | `verifyCronSecret(req)` | Секрет (**GAP**: `===` вместо `timingSafeEqual`) | Глобальный `db` | Системная задача | none |
| 32 | `/api/cron/subscriptions` | GET, POST | `verifyCronSecret` или `getAuthSession` | Секрет или `platform.billing.manage`; **GAP** `L25`: обход при `NODE_ENV==="test"` | Глобальный `db` | Системная задача | none |
| 33 | `/api/developer/audit-logs` | GET | `requirePlatformPermission(..., req)` | **GAP** `L9`: проверяет `"audit.read"` вместо `"platform.audit.read"`/`requireDeveloper` | Глобальный `db` | Фильтр `?centerId=` | `query` (`centerId`) |
| 34 | `/api/developer/health` | GET | `requireDeveloper()` | Только `DEVELOPER` | Глобальный `db` | Здоровье платформы | none |
| 35 | `/api/developer/platform-owners` | GET, POST, PATCH | `requireDeveloper()` | Только `DEVELOPER` | Глобальный `db` | Валидация ID пользователя | none |
| 36 | `/api/finance/accounts` | GET, POST, PATCH | `requireFinanceTenantAccess(req)` | `finance.read` / `finance.write` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 37 | `/api/finance/categories` | GET, POST, PATCH | `requireFinanceTenantAccess(req)` | `finance.read` / `finance.write` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 38 | `/api/finance/export` | GET | `requireFinanceTenantAccess(req)` | `finance.export` + `finance.read` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 39 | `/api/finance/periods` | GET, POST | `requireFinanceTenantAccess(req)` | `finance.read` / `finance.period.close` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 40 | `/api/finance/reports` | GET | `requireFinanceTenantAccess(req)` | `finance.read` | Ручной `centerId` | Агрегация центра | `tenantCtx.center.id` |
| 41 | `/api/finance/salary-rates/disburse` | POST | `requireFinanceTenantAccess(req)` | `finance.write` | `getTenantDb` + `center.id` | Проверка членства учителя в центре | `tenantCtx.center.id` |
| 42 | `/api/finance/salary-rates` | GET, POST | `requireFinanceTenantAccess(req)` | `finance.read` / `finance.write` | `getTenantDb` + `center.id` | Проверка членства в центре | `tenantCtx.center.id` |
| 43 | `/api/finance/student-debts` | GET, POST | `requireFinanceTenantAccess(req)` | `finance.read` / `finance.write` | `getTenantDb` + `center.id` | Проверка ученика/счёта в центре | `tenantCtx.center.id` |
| 44 | `/api/finance/transactions/[id]/reverse` | POST | `requireFinanceTenantAccess(req)` | `finance.storno` | Проверка `center.id` в tx | Проверка tx в `center.id` | `tenantCtx.center.id` |
| 45 | `/api/finance/transactions` | GET, POST | `requireFinanceTenantAccess(req)` | `finance.read` / `finance.write` | `getTenantDb` + `center.id` | Проверка счёта/категории/ученика в центре | `tenantCtx.center.id` |
| 46 | `/api/grades/export` | GET | `requireTenantAccess(req)` | DIR/ADM/TEACHER/`isPlatformStaff` | `getTenantDb` | Проверка групп учителя | `tenantCtx.center.id` |
| 47 | `/api/grades/finalize` | POST | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Группа/урок в центре | `tenantCtx.center.id` |
| 48 | `/api/grades/matrix` | GET | `requireTenantAccess(req)` | **GAP** `L91-100, L138-150`: не ограничивает `TA`, `ACC`, `SUP` | `getTenantDb` | TEACHER группа; STUDENT self; PARENT confirmed; **прочие без скоупа** | `tenantCtx.center.id` |
| 49 | `/api/grades` | GET, POST, PATCH, DELETE | `requireTenantAccess(req)` | GET блокирует ACC/SUP; POST/PATCH/DELETE: TEACHER/DIR/ADM/`grades.finalize` | `getTenantDb` + `center.id` | **GAP** GET `L76-85`: `groupId` перетирает скоуп для `TA` | `tenantCtx.center.id` |
| 50 | `/api/grades/unlock` | POST | `requireTenantAccess(req)` | DIR/`isPlatformStaff` | `getTenantDb` + `center.id` | Оценка/группа в центре | `tenantCtx.center.id` |
| 51 | `/api/groups/[id]/enrollments` | POST, DELETE | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Группа и ученик в центре | `tenantCtx.center.id` |
| 52 | `/api/groups/[id]` | GET, PUT | `requireTenantAccess(req)` | `requireCenterPermission` (`groups.read`/`manage`) | `getTenantDb` + `center.id` | `assertGroupAccess` | `tenantCtx.center.id` |
| 53 | `/api/groups/[id]/transfer` | POST | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Обе группы в центре | `tenantCtx.center.id` |
| 54 | `/api/groups` | GET, POST | `requireTenantAccess(req)` | `requireCenterPermission` (`groups.read`/`manage`) | `getTenantDb` + `center.id` | `getScopedGroupWhere` + DTO | `tenantCtx.center.id` |
| 55 | `/api/health` | GET | NONE (публичный) | Нет | N/A | Раскрывает `version`/`env`/`uptime`/`latencyMs` | none |
| 56 | `/api/homework` | GET, POST, PATCH | `requireTenantAccess(req)` | **GAP** GET не отсекает ACC/SUP; POST/PATCH TEACHER/TA/STUDENT | `getTenantDb` + `center.id` | **GAP** GET `L40,163`: утечка работ других групп TEACHER/TA; PATCH обходит `FINAL` | `tenantCtx.center.id` |
| 57 | `/api/invites/[id]` | PATCH | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 58 | `/api/invites/accept` | POST | `getAuthSession(req)` | Блокирует `PLATFORM_SUPPORT`; **GAP** не проверяет `center.status` и `emailVerified` | `getTenantDb(invite.centerId)` | Неатомарный `usesCount` | `invite.centerId` |
| 59 | `/api/invites/bulk-import` | POST | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Роль/группа в центре | `tenantCtx.center.id` |
| 60 | `/api/invites/generate` | POST | `requireTenantAccess(req)` | **CRITICAL GAP** `L7-15, 23-29`: `CENTER_ADMIN` может выпустить инвайт `DIRECTOR` | `getTenantDb` + `center.id` | Курс/группа в центре | `tenantCtx.center.id` |
| 61 | `/api/invites/parent-link` | POST | `getAuthSession(req)` (+ `requireTenantAccess` для админа) | Админ: DIR/ADM/`isPlatformStaff`; Claim: любой авторизованный | `getTenantDb(codeObj.centerId)` | **CRITICAL IDOR** `L91-93, 114`: без проверки срока/лимита, `studentId` из тела | `codeObj.centerId` / `tenantCtx` |
| 62 | `/api/invites/redeem` | POST | NONE (публичный) | Rate limit; **GAP** `L55` проверяет только `BLOCKED` (не `CANCELLED`) | `getTenantDb(invite.centerId)` | Валидация кода | `invite.centerId` |
| 63 | `/api/lessons/[id]` | GET, DELETE | `requireTenantAccess(req)` | **GAP** GET `L6-38`: нет роли; DELETE `L49-56`: любой `TEACHER` | `getTenantDb` + `center.id` | **GAP** GET без зачисления; DELETE: **TEACHER удаляет любой урок центра** | `tenantCtx.center.id` |
| 64 | `/api/lessons/reorder` | POST | `requireTenantAccess(req)` | DIR/ADM/TEACHER/`isPlatformStaff` | `getTenantDb` | Проверка курса учителя | `tenantCtx.center.id` |
| 65 | `/api/lessons` | POST, PATCH | `requireTenantAccess(req)` | DIR/ADM/TEACHER/`isPlatformStaff` | `getTenantDb` + `center.id` | Проверка группы/курса учителя | `tenantCtx.center.id` |
| 66 | `/api/materials/[id]/download` | GET | `requireTenantAccess(req)` | `assertMaterialAccess` (**GAP**: `ACCOUNTANT` unrestricted via `L419`) | `getTenantDb` + `center.id` | **CRITICAL** Path Traversal в `fileUrl` (`L49-57`) | `tenantCtx.center.id` |
| 67 | `/api/materials/[id]` | GET, PATCH, DELETE | `requireTenantAccess(req)` | GET: `assertMaterialAccess`; **GAP** PATCH/DELETE допускают TEACHER/TA | `getTenantDb` + `center.id` | **GAP** `L90,167`: обход проверки при `groupId: null`; режим `"read"` | `tenantCtx.center.id` |
| 68 | `/api/materials` | GET, POST | `requireTenantAccess(req)` | GET: `getScopedMaterialWhere` (**GAP** `ACC`); POST: `materials.*`/TEACHER/TA | `getTenantDb` + `center.id` | **GAP** POST `L147-149`: без `groupId` прикрепляет к чужому курсу | `tenantCtx.center.id` |
| 69 | `/api/mobile/director/dashboard` | GET | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | По центру | `tenantCtx.center.id` |
| 70 | `/api/mobile/parent/dashboard` | GET | `requireTenantAccess(req)` | PARENT/`isPlatformStaff` | `getTenantDb` | Проверка `ParentLink` `CONFIRMED` | `tenantCtx.center.id` |
| 71 | `/api/mobile/platform/dashboard` | GET | `getAuthSession(req)` | SUPERADMIN/PLATFORM_ADMIN/DEVELOPER/FULL_ACCESS/PLATFORM_SUPPORT | Глобальный `db` | Платформа | none |
| 72 | `/api/mobile/push-token/register` | POST | `getAuthSession(req)` | Блокирует `PLATFORM_SUPPORT` | Глобальный `db` | Self (`session.user.id`) | `session.activeCenterId` |
| 73 | `/api/mobile/push-token/unregister` | POST | `getAuthSession(req)` | Блокирует `PLATFORM_SUPPORT` | Глобальный `db` | Self (`session.user.id`) | none |
| 74 | `/api/mobile/student/dashboard` | GET | `requireTenantAccess(req)` | STUDENT/`isPlatformStaff` | `getTenantDb` | Self (`membership.id`) | `tenantCtx.center.id` |
| 75 | `/api/mobile/teacher/dashboard` | GET | `requireTenantAccess(req)` | TEACHER/TA/`isPlatformStaff` | `getTenantDb` | Группы учителя/TA | `tenantCtx.center.id` |
| 76 | `/api/modules/[id]` | PATCH, DELETE | `requireTenantAccess(req)` | **GAP** PATCH `L21-28`: разрешён `TEACHER`; DELETE: `courses.manage`/`isPlatformStaff` | `getTenantDb` + `center.id` | **GAP** PATCH `L21-47`: TEACHER правит чужие курсы центра | `tenantCtx.center.id` |
| 77 | `/api/modules/reorder` | POST | `requireTenantAccess(req)` | **GAP** `L22-29`: разрешён `TEACHER` | `getTenantDb` + `center.id` | **GAP** `L22-39`: TEACHER меняет чужие курсы центра | `tenantCtx.center.id` |
| 78 | `/api/modules` | POST | `requireTenantAccess(req)` | DIR/ADM/TEACHER/`isPlatformStaff` | `getTenantDb` + `center.id` | Проверка группы/курса учителя | `tenantCtx.center.id` |
| 79 | `/api/my/balance` | GET | `requireTenantAccess(req)` | STUDENT/PARENT/DIR/ADM/ACC/`isPlatformStaff` | `getTenantDb` | STUDENT self; PARENT confirmed child | `tenantCtx.center.id` |
| 80 | `/api/notifications` | GET, PATCH | `getAuthSession()` | Авторизованный | Глобальный `db` | Скоуп `session.user.id` | none |
| 81 | `/api/platform/analytics` | GET | `requirePlatformOwner()` | SUPERADMIN/DEVELOPER/FULL_ACCESS | Глобальный `db` | Платформа | none |
| 82 | `/api/platform/announcements/[id]/read` | POST | `getAuthSession(req)` | Авторизованный (нет проверки целевой аудитории) | Глобальный `db` | Self (`session.user.id`) | none |
| 83 | `/api/platform/announcements` | GET, POST, PATCH, DELETE | `getAuthSession(req)` | `platform.announcements.read` / `manage` | Глобальный `db` | Платформа | none |
| 84 | `/api/platform/audit/export` | GET | `requirePlatformPermission("platform.audit.read", req)` | `platform.audit.read` | Глобальный `db` | Опциональный `?centerId=` | `query` (`centerId`) |
| 85 | `/api/platform/audit` | GET | `requirePlatformPermission("platform.audit.read", req)` | `platform.audit.read` | Глобальный `db` | Опциональный `?centerId=` | `query` (`centerId`) |


#### Маршруты 86–165 из 165

| # | Путь | Методы | Проверка аутентификации | Проверка роли / прав | Изоляция центра | Проверка владения (IDOR) | Источник `centerId` |
|---|---|---|---|---|---|---|---|
| 86 | `/api/platform/centers/[id]/director` | POST | `getAuthSession(req)` | `platform.centers.write` | Глобальный `db` | Валидация целевого центра `[id]` | `params.id` |
| 87 | `/api/platform/centers/[id]/export` | GET | `getAuthSession(req)` | Только `SUPERADMIN` | Глобальный `db` | Целевой центр `[id]` (**GAP**: нет `logAuditEvent` и лимитов `take`) | `params.id` |
| 88 | `/api/platform/centers/[id]` | GET, PATCH, DELETE | `getAuthSession(req)` | `platform.centers.read`/`write` / только `SUPERADMIN` (`DELETE`) | Глобальный `db` | Целевой центр `[id]` | `params.id` |
| 89 | `/api/platform/centers/[id]/suspend` | POST | `getAuthSession(req)` | `platform.centers.block` | Глобальный `db` | Целевой центр `[id]` | `params.id` |
| 90 | `/api/platform/centers/export` | GET | `requirePlatformPermission("platform.centers.read", req)` | `platform.centers.read` | Глобальный `db` | Платформа (**GAP**: `escapeCsv` без защиты от формул и без аудита) | none |
| 91 | `/api/platform/centers` | GET, POST | `getAuthSession(req)` | `platform.centers.read`/`write` | Глобальный `db` | Платформа | none |
| 92 | `/api/platform/dashboard` | GET | `requirePlatformPermission("platform.dashboard", req)` | `platform.dashboard` | Глобальный `db` | Платформа | none |
| 93 | `/api/platform/finance/expenses/[id]/storno` | POST | `requirePlatformPermission("platform.expenses.manage", req)` | `platform.expenses.manage` | Глобальный `db` | Проверка расхода `[id]` | none |
| 94 | `/api/platform/finance/expenses/categories` | GET, POST | `requirePlatformPermission(..., req)` | `platform.billing.read`/`expenses.manage` | Глобальный `db` | Платформа | none |
| 95 | `/api/platform/finance/expenses` | GET, POST | `requirePlatformPermission(..., req)` | `platform.billing.read`/`expenses.manage` | Глобальный `db` | Платформа | none |
| 96 | `/api/platform/finance/payments/[id]/refund` | POST | `requirePlatformPermission("platform.billing.refund", req)` | `platform.billing.refund` | Глобальный `db` | Проверка платежа `[id]` | none |
| 97 | `/api/platform/finance/payments/[id]` | GET | `requirePlatformPermission("platform.billing.read", req)` | `platform.billing.read` | Глобальный `db` | Проверка платежа `[id]` | none |
| 98 | `/api/platform/finance/payments/export` | GET | `requirePlatformPermission("platform.billing.read", req)` | `platform.billing.read` | Глобальный `db` | Опц. `?centerId=` (персонал платформы) | `query` (`centerId`) |
| 99 | `/api/platform/finance/payments` | GET, POST | `requirePlatformPermission(..., req)` | `platform.billing.read`/`manage` | Глобальный `db` | Опц. `?centerId=` / `body.centerId` | `query` / `body` |
| 100 | `/api/platform/finance/stats/export` | GET | `requirePlatformPermission("platform.billing.read", req)` | `platform.billing.read` | Глобальный `db` | Платформа | none |
| 101 | `/api/platform/finance/stats` | GET | `requirePlatformPermission("platform.billing.read", req)` | `platform.billing.read` | Глобальный `db` | Платформа | none |
| 102 | `/api/platform/first-owner` | GET, POST | **CRITICAL GAP** NONE (публичный) | **CRITICAL GAP** `L16-24, L45-52` (`superadminCount === 0`) | Глобальный `db` | Создаёт/повышает `SUPERADMIN` при 0 владельцах | none |
| 103 | `/api/platform/impersonate` | POST | `getAuthSession(req)` | **CRITICAL GAP** `platform.impersonation` (доступно `PLATFORM_SUPPORT`), нет фильтра целевой роли | Глобальный `db` | **CRITICAL**: эскалация в `SUPERADMIN`/`DEVELOPER` | `body` (`targetCenterId`) |
| 104 | `/api/platform/impersonate/stop` | POST | Подписанный cookie `platform_impersonation_original` | Проверка `originalUser.isActive` (**GAP**: нет проверки отзыва `UserSession` и не отзывается сессия имперсонации) | Глобальный `db` | Восстановление исходной сессии | none |
| 105 | `/api/platform/plans` | GET, POST, PATCH | `requirePlatformPermission("platform.plans.manage", req)` | `platform.plans.manage` | Глобальный `db` | Платформа | none |
| 106 | `/api/platform/registrations/export` | GET | `requirePlatformPermission("platform.users.read", req)` | `platform.users.read` | Глобальный `db` | Платформа | none |
| 107 | `/api/platform/registrations` | GET | `requirePlatformPermission("platform.users.read", req)` | `platform.users.read` | Глобальный `db` | Платформа | none |
| 108 | `/api/platform/security/reset-lockout` | POST | `requirePlatformPermission("platform.security", req)` | `platform.security` | Глобальный `db` | Платформа | none |
| 109 | `/api/platform/security` | GET | `requirePlatformPermission("platform.security", req)` | `platform.security` | Глобальный `db` | Платформа (**HIGH LEAK**: в `activeSessions` отдаются хеши токенов) | none |
| 110 | `/api/platform/security/sessions/[id]/revoke` | POST | `requirePlatformPermission("platform.security", req)` | `platform.security` | Глобальный `db` | Целевая сессия `[id]` | none |
| 111 | `/api/platform/seo` | GET, POST | `requirePlatformPermission(..., req)` | `platform.settings.read`/`manage` | Глобальный `db` | Платформа | none |
| 112 | `/api/platform/settings` | GET, POST | `requirePlatformPermission(..., req)` | `platform.settings.read`/`manage` | Глобальный `db` | Платформа | none |
| 113 | `/api/platform/subscriptions/[id]` | GET, PATCH | `requirePlatformPermission(..., req)` | `platform.billing.read`/`manage` | Глобальный `db` | Подписка `[id]` | none |
| 114 | `/api/platform/subscriptions/export` | GET | `requirePlatformPermission("platform.billing.read", req)` | `platform.billing.read` | Глобальный `db` | Платформа | none |
| 115 | `/api/platform/subscriptions` | GET, POST | `requirePlatformPermission(..., req)` | `platform.billing.read`/`manage` | Глобальный `db` | Валидация целевого `centerId` | `body` (`centerId`) |
| 116 | `/api/platform/support/[id]/messages` | POST | `requirePlatformPermission("platform.support", req)` | `platform.support` | Глобальный `db` | Тикет `[id]` | none |
| 117 | `/api/platform/support/[id]` | GET, PATCH | `requirePlatformPermission("platform.support", req)` | `platform.support` | Глобальный `db` | Тикет `[id]` | none |
| 118 | `/api/platform/support` | GET, POST | GET: `requirePlatformPermission`; **CRITICAL GAP** POST `L85-115`: только `getAuthSession` | GET: `platform.support`; **CRITICAL GAP** POST: NONE | **CRITICAL GAP** POST: NONE | **CRITICAL GAP** POST `L98, L112`: `centerId` из тела без проверки членства | `body` (`centerId`) |
| 119 | `/api/platform/system/health` | GET | `requirePlatformPermission("platform.system.health", req)` | `platform.system.health` | Глобальный `db` | Платформа | none |
| 120 | `/api/platform/team` | GET, POST, PATCH | `getAuthSession(req)` | `platform.team.manage` + проверка иерархии | Глобальный `db` | Проверка иерархии ролей | none |
| 121 | `/api/platform/users/[id]/block` | POST | `getAuthSession(req)` | `platform.users.write` + иерархия и запрет самоблокировки | Глобальный `db` | Пользователь `[id]` | none |
| 122 | `/api/platform/users/[id]/memberships` | POST, PATCH, DELETE | `getAuthSession(req)` | `platform.users.write` (**minor**: не запрещает править членства `SUPERADMIN`/`DEVELOPER`) | Глобальный `db` | `[id]` + `centerId` | `body` (`centerId`) |
| 123 | `/api/platform/users/[id]/reset-password` | POST | `getAuthSession(req)` | `platform.users.reset_password` + иерархия | Глобальный `db` | Пользователь `[id]` | none |
| 124 | `/api/platform/users/[id]` | GET, PATCH, DELETE | `getAuthSession(req)` | `platform.users.read`/`write`/`delete` + иерархия | Глобальный `db` | `[id]` (**CRITICAL LEAK** PATCH `L256-273` отдаёт сырую модель `PlatformUser`) | none |
| 125 | `/api/platform/users/[id]/sessions` | DELETE | `getAuthSession(req)` | `platform.users.write` + проверка прав | Глобальный `db` | Пользователь `[id]` | none |
| 126 | `/api/platform/users/export` | GET | `getAuthSession(req)` | `platform.users.read` | Глобальный `db` | Опц. `?centerId=` | `query` (`centerId`) |
| 127 | `/api/platform/users` | GET, POST | `getAuthSession(req)` | `platform.users.read`/`write` | Глобальный `db` | Опц. `?centerId=` | `query` (`centerId`) |
| 128 | `/api/public/leads` | POST | NONE (публичный) | Нет (Zod, **GAP**: нет rate limit) | N/A | N/A | none |
| 129 | `/api/schedule/ical` | GET | `requireTenantAccess(req)` | Скоуп TEACHER/STUDENT/PARENT (**minor**: ACC/SUP видят всё) | `getTenantDb` | Расписание по роли (**MEDIUM**: `DESCRIPTION` `L101,113` без `escapeIcal`) | `tenantCtx.center.id` |
| 130 | `/api/students/[id]/performance` | GET | `requireTenantAccess(req)` | **GAP** `L26-59`: пропущены `TA`, `ACC`, `SUP` | `getTenantDb` | STUDENT self; PARENT confirmed; TEACHER группа; прочие без скоупа | `tenantCtx.center.id` |
| 131 | `/api/students/[id]` | GET | `requireTenantAccess(req)` | **GAP** `L88-130`: пропущены `TA`, `ACC`, `SUP` | `getTenantDb` + `center.id` | STUDENT self; PARENT confirmed; TEACHER группа; прочие без скоупа | `tenantCtx.center.id` |
| 132 | `/api/students/import-csv` | POST | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Группа центра | `tenantCtx.center.id` |
| 133 | `/api/students` | GET, POST | `requireTenantAccess(req)` | GET скоупит не-админов; POST: DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | Зачисления по роли | `tenantCtx.center.id` |
| 134 | `/api/substitutions/[id]` | GET, PATCH | `requireTenantAccess(req)` | Участники/админ на GET; инициатор или DIR/ADM на PATCH | `getTenantDb` + `center.id` | Учитель/заменяющий/админ | `tenantCtx.center.id` |
| 135 | `/api/substitutions` | GET, POST | `requireTenantAccess(req)` | Скоуп не-привилегированных; проверка учителя/TA урока на POST | `getTenantDb` + `center.id` | Учитель/TA урока | `tenantCtx.center.id` |
| 136 | `/api/tenant/academic-terms/[id]` | PATCH, DELETE | `requireTenantAccess(req)` | DIR/ADM/`settings.manage`/`isPlatformStaff` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 137 | `/api/tenant/academic-terms` | GET, POST | `requireTenantAccess(req)` | GET любой участник; POST `settings.manage`/админ | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 138 | `/api/tenant/activity` | GET, POST | `requireTenantAccess(req)` | `audit.read` | `getTenantDb` + `center.id` | Объект в центре | `tenantCtx.center.id` |
| 139 | `/api/tenant/announcements` | GET, POST, PATCH, DELETE | `requireTenantAccess(req)` | Чтение по скоупу; создание админ/учитель (**HIGH GAP** PATCH `L213-247` позволяет менять `targetRole`/`isPinned`/`groupId` без проверки группы) | `getTenantDb` + `center.id` | Проверка автора / целевой группы | `tenantCtx.center.id` |
| 140 | `/api/tenant/audit` | GET | `requireTenantAccess(req)` | `audit.read` | `getTenantDb` + `center.id` | По центру | `tenantCtx.center.id` |
| 141 | `/api/tenant/branches` | GET, POST, PATCH, DELETE | `requireTenantAccess(req)` | GET любой; POST/PATCH админ; DELETE DIR/`isPlatformStaff` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 142 | `/api/tenant/holidays/[id]` | DELETE | `requireTenantAccess(req)` | DIR/ADM/`settings.manage`/`isPlatformStaff` | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 143 | `/api/tenant/holidays` | GET, POST | `requireTenantAccess(req)` | GET любой; POST `settings.manage`/админ | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 144 | `/api/tenant/my-salary` | GET | `requireTenantAccess(req)` | Авторизованный (`membership.id`) | `getTenantDb` + `center.id` | Self (`membership.id`) | `tenantCtx.center.id` |
| 145 | `/api/tenant/onboarding` | POST | `getAuthSession()` | Блокирует `PLATFORM_SUPPORT`; **GAP**: открыт несмотря на закрытый режим в UI, без проверки `emailVerified` и лимита | Создаёт `LearningCenter` | Self -> `DIRECTOR` | Генерируется |
| 146 | `/api/tenant/schedule` | GET, POST, PATCH, DELETE | `requireTenantAccess(req)` | **GAP** GET `L106-140`: `ACC`/`SUP` видят всё; POST/PATCH/DELETE админ | `getTenantDb` + `center.id` | **GAP** GET `L93-96, L112-140`: `?groupId=` перетирает скоуп TA/STUDENT/PARENT | `tenantCtx.center.id` |
| 147 | `/api/tenant/settings` | GET, PATCH | `requireTenantAccess(req)` | `settings.read`/`manage` | `getTenantDb` + `center.id` | Запрещает менять `status`/`slug`/`ownerId`/`planId` | `tenantCtx.center.id` |
| 148 | `/api/tenant/staff` | GET, POST, PATCH, DELETE | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` (запрет `CENTER_ADMIN` vs DIR/ADM; minor: можно переключать `ACCOUNTANT`) | `getTenantDb` + `center.id` | Членство в центре | `tenantCtx.center.id` |
| 149 | `/api/tenant/students/[id]/transcript` | GET | `requireTenantAccess(req)` | **GAP** `L14-24`: `students.read` даёт TEACHER/TA/SUP доступ ко всем ученикам и блокирует `PARENT` | `getTenantDb` + `center.id` | **GAP**: нет проверки группы при `canView` | `tenantCtx.center.id` |
| 150 | `/api/tenant/subjects` | GET, POST, PATCH, DELETE | `requireTenantAccess(req)` | GET любой; POST/PATCH админ; DELETE DIR | `getTenantDb` + `center.id` | Скоуп `tenantDb` | `tenantCtx.center.id` |
| 151 | `/api/tenant/teacher-hours` | GET | `requireTenantAccess(req)` | DIR/ADM/`isPlatformStaff` | `getTenantDb` + `center.id` | По центру | `tenantCtx.center.id` |
| 152 | `/api/tenant/users/[id]/reset-password` | POST | `requireTenantAccess(req)` | `users.reset_password` + `canActorManageRole` + `canManageUserAccount` | `getTenantDb` + `center.id` | Защита общих аккаунтов | `tenantCtx.center.id` |
| 153 | `/api/tenant/users/[id]` | GET, PATCH, DELETE | `requireTenantAccess(req)` | `users.read`/`update`/`block` + `canActorManageRole` + `canManageUserAccount` (PATCH) | `getTenantDb` + `center.id` | **GAP** DELETE `L450-455` отзывает сессии во всех центрах без `canManageUserAccount` | `tenantCtx.center.id` |
| 154 | `/api/tenant/users/[id]/send-reset-link` | POST | `requireTenantAccess(req)` | `users.reset_password` + `canActorManageRole` | `getTenantDb` + `center.id` | Членство в центре | `tenantCtx.center.id` |
| 155 | `/api/tenant/users/bulk` | POST | `requireTenantAccess(req)` | `users.create` + `canActorManageRole` | `getTenantDb` + `center.id` | Проверка FK через `tenantDb` | `tenantCtx.center.id` |
| 156 | `/api/tenant/users` | GET, POST | `requireTenantAccess(req)` | `users.read`/`create` + `canActorManageRole` | `getTenantDb` + `center.id` | Проверка `group.centerId` | `tenantCtx.center.id` |
| 157 | `/api/tests/[id]` | GET, POST, DELETE | `requireTenantAccess(req)` | GET/POST `assertMaterialAccess`; **GAP** DELETE `L316-318` разрешён `TEACHER` | `getTenantDb` + `center.id` | **GAP** GET `L49-64` отдаёт чужие попытки TEACHER/TA/ACC; DELETE любой тест | `tenantCtx.center.id` |
| 158 | `/api/tests/attempt` | POST | `getAuthSession` + `requireTenantAccess` | Только `STUDENT` | `getTenantDb` + `center.id` | `assertMaterialAccess` + `studentMembershipId` | `tenantCtx.center.id` |
| 159 | `/api/tests` | GET, POST | `requireTenantAccess(req)` | GET `getScopedMaterialWhere`; POST `materials.*`/TEACHER/TA | `getTenantDb` + `center.id` | **GAP** GET `ACC` без скоупа и утечка попыток TEACHER/TA; POST без `groupId` | `tenantCtx.center.id` |
| 160 | `/api/tests/start` | POST | `requireTenantAccess(req)` | Только `membership.id` (**GAP**: нет проверки `STUDENT`) | `getTenantDb` + `center.id` | **GAP** `L34-40` нет `assertMaterialAccess` | `tenantCtx.center.id` |
| 161 | `/api/tickets/[id]/messages` | POST | `getAuthSession(req)` | **GAP**: забыты `DEVELOPER`/`FULL_ACCESS` | Глобальный `db` (`ticket.centerId`) | Автор/админ центра/платформа | `ticket.centerId` |
| 162 | `/api/tickets/[id]` | GET, PATCH | `getAuthSession()` | **GAP** `L32-35`: забыты `DEVELOPER`/`FULL_ACCESS` | Глобальный `db` (`ticket.centerId`) | **GAP** GET `L26` раскрывает заметки `isInternal: true` | `ticket.centerId` |
| 163 | `/api/tickets` | GET, POST | `getAuthSession()` | **GAP** `L18-21`: забыты `DEVELOPER`/`FULL_ACCESS` | Глобальный `db` (`session.activeCenterId`) | **GAP** GET `L30,49` раскрывает `isInternal: true`; POST `L80` верит `scope` | `session.activeCenterId` |
| 164 | `/api/upload/presign` | POST | `requireTenantAccess(req)` | **GAP** `L5-38`: НЕТ проверки роли и категории | `centerId: tenantCtx.center.id` | Любой участник может пресайнить закрытую категорию | `tenantCtx.center.id` |
| 165 | `/api/upload` | POST | `requireTenantAccess(req)` | Проверка по категории (`materials.upload`/`manage`, `assignments.*`, STUDENT/PARENT) | `centerId: tenantCtx.center.id` | Категория и роль проверены | `tenantCtx.center.id` |

---

## 4. ВАЛИДАЦИЯ ВВОДА И ИНЪЕКЦИИ

### 4.1 SQL-инъекции
- **Состояние: безопасно.** Во всём репозитории `$queryRaw` используется только в 4 местах со статическим запросом `SELECT 1` (`src/app/api/health/route.ts:15`, `src/app/api/developer/health/route.ts:13`, `src/app/api/platform/dashboard/route.ts:517`, `src/app/api/platform/system/health/route.ts:13`). Вызовов `$executeRaw`, `$queryRawUnsafe` и `$executeRawUnsafe` не обнаружено. Остальные запросы параметризованы через Prisma ORM.

### 4.2 XSS, HTML/CSV/iCal-инъекции и непроверенные URL
- **`dangerouslySetInnerHTML`:** используется только один раз со статической строкой (`src/app/layout.tsx:21-24`).
- **[HIGH] HTML-инъекция в исходящих письмах (`src/lib/email.ts:46-54, 64-224, 321`):**
  - **Механизм:** пользовательские поля (`fullName`, `centerName`, имена, названия) подставляются в HTML-шаблоны писем через интерполяцию без HTML-экранирования. Злоумышленник, задав имя с HTML-тегами/ссылками, внедряет фишинговую разметку в письма, отправляемые от доверенного домена платформы.
  - **Затронутые данные:** доверие пользователей, учётные данные при фишинге через письма. **Оценка:** `S`.
- **[HIGH] CSV Formula Injection (DDE-инъекция) и отсутствие аудита выгрузок:**
  - **Где:** `src/app/api/tenant/students/[id]/transcript/route.ts:173-204`, а также 7 экспортных роутов платформы с локальной `escapeCsv` без нейтрализации формул:
    - `src/app/api/platform/audit/export/route.ts:8-12`
    - `src/app/api/platform/centers/export/route.ts:8-12`
    - `src/app/api/platform/finance/payments/export/route.ts:8-12`
    - `src/app/api/platform/finance/stats/export/route.ts:8-12`
    - `src/app/api/platform/registrations/export/route.ts:7-11`
    - `src/app/api/platform/subscriptions/export/route.ts:8-12`
    - `src/app/api/platform/users/export/route.ts:112-116`
  - **Дополнительно:** `src/lib/csv.ts` (используется в `attendance/export`, `grades/export`) проверяет `^[=+\-@\t\r]` без обрезки ведущих пробелов (в отличие от `finance-export.ts:29`), а указанные экспорты не пишут событие в `AuditLog`.
  - **Механизм:** значения полей вроде имени пользователя/комментария, начинающиеся с `=`, `+`, `-`, `@`, `\t`, `\r` (или пробела перед ними), при открытии CSV в Excel/LibreOffice выполняются как формулы/внешние команды. **Оценка:** `S`.
- **[MEDIUM] Инъекция полей iCalendar (CRLF Injection) (`src/app/api/schedule/ical/route.ts:101, 113`):**
  - **Механизм:** поле `DESCRIPTION` формируется из данных урока/группы без вызова `escapeIcal` / удаления символов перевода строки `\r\n`, что позволяет внедрить произвольные свойства VEVENT в `.ics`-файл. **Оценка:** `S`.
- **[MEDIUM] Невалидированные URL (`javascript:`-вектор и произвольные ссылки):**
  - **Где:** `src/app/api/account/profile/route.ts:13, 174`, `src/app/api/platform/centers/[id]/route.ts:133`, `src/app/api/platform/seo/route.ts:12`, `src/app/api/courses/route.ts:52, 74`, `src/app/api/courses/[id]/route.ts:10, 149`, `src/app/api/lessons/route.ts:97-98, 216-217`.
  - **Механизм:** URL-поля не ограничены схемами `http:`/`https:` или относительными `/uploads/...` — сохранение `javascript:...` способно привести к XSS при рендере `<a href>` на клиенте. **Оценка:** `S`.
- **SSRF и Open Redirect:**
  - **SSRF:** внешних HTTP-запросов по URL от пользователя не найдено (интеграции только с фиксированными API Resend и Eskiz).
  - **Open Redirect:** в API-роутах открытых редиректов не выявлено (за исключением недопроверенного fallback-URL в `materials/[id]/download/route.ts:72` — см. п. 4.3).

### 4.3 Path Traversal
- **[CRITICAL] Произвольное чтение файлов сервера через `GET /api/materials/[id]/download` (`src/app/api/materials/[id]/download/route.ts:49-72`):**
  - **Где также отсутствует валидация:** `src/app/api/materials/route.ts:15, 162` и `src/app/api/materials/[id]/route.ts:14, 104-109` принимают произвольную строку `fileUrl` без проверки на `..` или допустимый префикс, а `deleteStoredFile` в `src/lib/storage.ts:292-296` также не проверяет `path.resolve(...)` на выход за `public/uploads`.
  - **Механизм:** учитель или ассистент создаёт/редактирует материал с `fileUrl`, начинающимся с `/uploads/../../../...` (или `/uploads/../../.env`), после чего запрос к `/api/materials/[id]/download` склеивает `path.join(process.cwd(), "public", normalizedRelative)` (`L49-57`) и без проверки выхода за пределы каталога `public/uploads` читает файл через `fs.readFile` и отдаёт его в ответе; если путь не начинается с `/uploads/`, `L72` делает `NextResponse.redirect(new URL(targetUrl, req.url))` без валидации протокола.
  - **Затронутые данные:** файлы сервера (`.env`, `package.json`, конфиги, файлы других центров). **Оценка:** `S`.

### 4.4 Отсутствие Zod-валидации, Mass Assignment и гонки (TOCTOU)
- Около **38 write-эндпоинтов** разбирают `req.json()` без строгих Zod-схем, что создаёт риски `NaN`, отрицательных чисел, обрезки логики и подмены полей:
  - **[HIGH] `src/app/api/tenant/announcements/route.ts:213-247` (`PATCH`):** позволяет учителю/TA изменить `targetRole`, `isPinned` или `groupId` уже созданного объявления без повторения проверки принадлежности к группе, действующей в `POST`. **Оценка:** `S`.
  - **[HIGH] `src/app/api/grades/route.ts:192-194`:** парсинг `maxValue` без валидации (`maxValue = "abc"` даёт `NaN`, сравнение с `NaN` обходит ограничение максимального балла). **Оценка:** `S`.
  - **[HIGH] `src/app/api/center-payments/route.ts:90-108, 160-166`:** отсутствие строгой схемы допускает отрицательные или `NaN`-суммы платежа. **Оценка:** `S`.
  - **[MEDIUM] `src/app/api/groups/[id]/transfer/route.ts:21`:** гонка проверки вместимости группы (`maxStudents`) при параллельных переводах учеников (TOCTOU). **Оценка:** `S`.
  - Другие роуты без Zod-валидации: `src/app/api/invites/parent-link/route.ts:16, 41, 91, 114`, `src/app/api/platform/plans/route.ts`, `src/app/api/developer/platform-owners/route.ts` и ряд tenant/platform маршрутов. **Оценка:** `M`.

---

## 5. ФАЙЛЫ И ЗАГРУЗКИ

- **[CRITICAL] Прямой неаутентифицированный доступ ко всем загруженным файлам в `public/uploads/` (`src/lib/storage.ts:274-280`):**
  - **Механизм:** в локальном режиме (`STORAGE_PROVIDER` не S3/R2) файлы сохраняются прямо в `public/uploads/<centerId>/<category>/...` (`public/uploads/<centerId>/homework/*_solution.pdf` подтверждены на диске). Next.js раздаёт содержимое `public/` напрямую любому пользователю интернета **без сессии, без проверки центра и без ACL** (`assertMaterialAccess`), полностью обходя закрытый роут `/api/materials/[id]/download`. Имена файлов содержат предсказуемую структуру и ID.
  - **Затронутые данные:** домашние задания учеников, учебные материалы, чеки/документы всех центров. **Оценка:** `M`.
- **[HIGH] Отсутствие проверки magic bytes и неполный чёрный список расширений (`src/lib/storage.ts:78-131`):**
  - **Механизм:** сервер доверяет клиентскому `file.type` и расширению файла, не проверяя сигнатуру содержимого (magic bytes). В `DANGEROUS_EXTENSIONS` отсутствуют `.html`, `.htm`, `.xhtml`, `.svg`, `.shtml`.
  - **Затронутые данные:** целостность хранилища и клиенты при скачивании. **Оценка:** `S`.
- **[HIGH] Stored XSS через загрузку `image/svg+xml` (`src/lib/storage.ts:58`):**
  - **Механизм:** MIME-тип `image/svg+xml` разрешён в `allowedTypes` для категории `MATERIAL`. Поскольку файлы лежат в `public/uploads/...` на основном origin приложения и открываются в браузере без принудительного `Content-Disposition: attachment` и изоляции домена, SVG со встроенным `<script>` исполняет JavaScript в контексте origin приложения (при частичном смягчении текущей CSP, но с полным доступом к DOM/same-origin API).
  - **Затронутые данные:** сессии и действия пользователей центра. **Оценка:** `S`.
- **[MEDIUM] Обход и гонка квот хранилища (`src/lib/storage.ts:144-213, 278`, `src/app/api/materials/route.ts:164`, `src/app/api/upload/route.ts`):**
  - **Механизм:** `checkStorageQuota` выполняется вне блокирующей транзакции с записью (TOCTOU при параллельных загрузках); `POST /api/materials` доверяет переданному клиентом `fileSizeBytes`; `POST /api/upload` сохраняет файлы на диск даже без немедленной привязки к записи в БД, что позволяет копить «сиротский» объём сверх квоты. **Оценка:** `M`.

---

## 6. УТЕЧКИ ДАННЫХ И ОШИБОК

- **[CRITICAL] Утечка хешей паролей, 2FA-секретов и токенов подтверждения через `PATCH /api/platform/users/[id]` (`src/app/api/platform/users/[id]/route.ts:256-273`):**
  - **Механизм:** `db.platformUser.update` вызывается без `select` и целиком возвращается в JSON `{ success: true, user: updatedUser }`. В ответе клиенту передаются `passwordHash`, `twoFactorSecret` (который в данной системе хранится открытым текстом!) и `emailConfirmToken`.
  - **Затронутые данные:** секреты 2FA, хеши паролей и токены любых пользователей платформы. **Оценка:** `S`.
- **[HIGH] Утечка хешей сессионных и refresh-токенов в `GET /api/platform/security` (`src/app/api/platform/security/route.ts:45-62, 77`):**
  - **Механизм:** выборка `activeSessions` возвращает поля `jtiHash`, `refreshTokenHash` и `prevRefreshTokenHash` в ответе API. **Оценка:** `S`.
- **[MEDIUM] Избыточное раскрытие PII и зачислений в низкопривилегированных эндпоинтах:**
  - `GET /api/courses` (`src/app/api/courses/route.ts:5-33`) и `GET /api/courses/[id]` (`L43-47`): возвращают черновики курсов, списки зачислений и email преподавателей.
  - `GET /api/attendance/analytics` (`src/app/api/attendance/analytics/route.ts:29-59`): раскрывает аналитику и данные учеников лишним ролям. **Оценка:** `S`.
- **[MEDIUM] Утечка внутренних ошибок (`err.message` и коды Prisma) в 30+ API-маршрутах:**
  - Включая `src/app/api/auth/2fa/route.ts:120-121`, `src/app/api/platform/impersonate/*`, `src/app/api/platform/centers/*`, `src/app/api/finance/*`, `src/app/api/tickets/*`, `src/app/api/grades/*`, `src/app/api/attendance/*`, `src/app/api/upload/*`, `src/app/api/mobile/*/dashboard`. Раскрывает структуру схемы БД, ограничения уникальности и внутренние исключения. **Оценка:** `M`.
- **[MEDIUM] Отсутствие заголовка `Cache-Control: no-store` на чувствительных ответах:**
  - Заголовок не выставлен на `/api/auth/me`, `/api/auth/sessions`, `/api/auth/2fa`, `/api/auth/mobile/login`, `/api/auth/mobile/refresh`, `/api/platform/users/[id]/reset-password`, `/api/platform/security`, `/api/finance/**`, `/api/health`. Повышает риск кэширования токенов, временных паролей и финансовых данных промежуточными прокси или браузером. **Оценка:** `S`.
- **Debug-страницы, dev-login, CORS и Source Maps:**
  - `src/app/api/auth/dev-login/route.ts:22-24, 58`: в dev-режиме возвращает всю запись пользователя (безопасно закрыто проверкой `NODE_ENV === "production" || DEV_LOGIN !== "true"`).
  - Маршруты `/dev-logins` и `/dev/ui-kit` закрыты проверкой окружения; `/setup` блокируется после создания первого `SUPERADMIN`.
  - CORS-заголовки в `next.config.mjs` не разрешают внешние origins; `productionBrowserSourceMaps` не включены.

---

## 7. ДОСТУПНОСТЬ И ЛИМИТЫ (DoS)

- **[HIGH] Гонка (TOCTOU) и раздувание таблицы в Rate Limiter (`src/lib/rate-limit.ts:31-75`):**
  - Лимитер корректно работает по схеме fail-closed (при отказе БД бросает `RateLimiterDatabaseError` -> `503`/`500`), **но** реализован неатомарно (read-then-write, 2–3 SQL-запроса на проверку), что позволяет при параллельной отправке запросов пробить лимит. Кроме того, в `src/app/api/auth/register/route.ts:28` в ключ rate limit включается произвольный `rawCode` от клиента — злоумышленник может плодить неограниченное число строк в таблице лимитов. **Оценка:** `M`.
- **[HIGH] Векторы Email/SMS-бомбинга и заглушки отправки:**
  - `POST /api/auth/password/forgot` и `POST /api/auth/resend-confirm` не имеют per-email cooldown (ограничены только по IP/ключу, легко спамить жертву через смену прокси/IP).
  - `POST /api/auth/register` (`L65-122`): для уже существующих email продолжает создавать `PendingInvite` и слать письма-уведомления.
  - `POST /api/auth/login` (`L112`): 30 неудачных попыток с разных IP на email жертвы вызывают отправку уведомления о блокировке.
  - `notifyParentsOnAttendance` (`src/lib/notifications.ts:539-575`): роуты `/api/attendance*` не имеют rate limit, а проверка дневного лимита через `auditLog.count` подвержена гонке, позволяя превысить `smsDailyLimit` и израсходовать баланс Eskiz.
  - `EMAIL_PROVIDER=smtp` (`src/lib/email.ts:351-363`): не отправляет письма (заглушка); в режиме `memory` (`L272, 293`) письма бесконечно складываются в массив `sentEmailsBuffer` в памяти процесса (утечка RAM при нагрузочном тесте или ошибочном конфиге). **Оценка:** `M`.
- **[HIGH] Дорогие/нелимитированные запросы, N+1 и `pageSize=NaN`:**
  - `checkStorageQuota` (`src/lib/storage.ts:163-166`) на **каждую** загрузку и `GET /api/materials` вычитывает и парсит **все** `homeworkSubmission.filesJson` центра без агрегации/кэша.
  - Вызовы `findMany` без `take` или с уязвимым разбором `pageSize` (передача нечислового `?pageSize=abc` даёт `NaN`, или верхняя граница не ограничена) найдены в `courses`, `groups`, `tickets`, `tests`, `homework`, `attendance`, `attendance/analytics`, `tenant/announcements:14`, `grades:40`, `notifications:15`, `platform/support:19`, `tenant/my-salary`, `platform/dashboard`, `platform/finance/stats`, а также N+1 `calculateAccountBalance` в `finance/reports`.
  - Массовый импорт с синхронной нагрузкой на CPU: `POST /api/invites/bulk-import` не ограничивает длину входного массива и крутит `bcrypt.hash` в цикле; `POST /api/students/import-csv` позволяет до 500 хэширований `bcrypt` за один HTTP-запрос. **Оценка:** `M`.
- **[MEDIUM] Внешние HTTP-вызовы без таймаутов и пробелы индексов БД:**
  - `fetch` к Resend (`src/lib/email.ts:324`) и Eskiz (`src/lib/notifications.ts:129, 198`) вызывается без `AbortSignal.timeout(...)` — зависание внешнего API блокирует воркеры Next.js.
  - Недостающие индексы в БД на частые фильтры/очистки: `PlatformUser(createdAt, lastLoginAt)`, `UserSession(expiresAt, revokedAt)`, `CenterPayment/Grade(deletedAt, createdAt)`, `Attendance(markedAt, status)`.
  - ReDoS: динамических `new RegExp(userInput)` не найдено (используются только константные регулярные выражения). Пул соединений Prisma настраивается стандартно через `DATABASE_URL`. **Оценка:** `S`.

---

## 8. ИНФРАСТРУКТУРА И ЗАГОЛОВКИ

| Компонент | Текущее состояние | Проблемы и уровень риска | Оценка |
| :--- | :--- | :--- | :--- |
| **`next.config.mjs`** | Заданы `HSTS (63072000)`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `frame-ancestors 'none'` (`L79`), редиректы `/platform*`. | **[MEDIUM]** `CSP` содержит `'unsafe-inline' 'unsafe-eval'` в `script-src` (`L70`) и `'unsafe-inline'` в `style-src` (`L73`), что существенно ослабляет защиту от XSS. | `M` |
| **`Dockerfile`** | Запуск от непривилегированного пользователя `USER nextjs` (UID `1001`, `L31-40`), настроен `HEALTHCHECK` на `/api/health`. | **[LOW/MEDIUM]** Базовый образ `node:20-alpine` не закреплён по digest/patch-версии; в runner-образ копируются все `node_modules` из `builder` (вместе с devDependencies); в `.dockerignore` указан `*.db` вместо `**/*.db`. | `S` |
| **`docker-compose.yml` (dev)** | Локальная инфраструктура разработки. | В файле для разработки указан пароль `password` и открыт порт `5432:5432` на хост (убедиться, что не используется на сервере). | `S` |
| **`docker-compose.prod.yml`** | `postgres:16-alpine` только во внутренней сети; обязательный `POSTGRES_PASSWORD`; `TRUSTED_PROXY_HOPS:-1`. | **[MEDIUM]** Сервис `app` публикует порт `"3000:3000"` по открытому HTTP без reverse proxy / TLS (Nginx/Caddy/Traefik) в составе стека — при деплое без внешнего прокси трафик, пароли и cookies пойдут по HTTP. | `S` |
| **`vercel.json`** | Настроены 3 cron-маршрута (`/api/cron/*`). | Совпадает с кодом маршрутов. | `—` |
| **`DEPLOY.md` / `docs/DEPLOY.md` / `LAUNCH_CHECKLIST.md`** | Документация деплоя и чеклист запуска. | **[LOW]** `DEPLOY.md:89-135` ссылается на несуществующий `scripts/backup-db.sh`, описывает незашифрованный `pg_dump` без `logrotate` и неверный дефолт `EMAIL_PROVIDER`; в `docs/DEPLOY.md` указан неверный путь `/api/cron/email-retry` и неверные переменные `first-owner`; в `docs/LAUNCH_CHECKLIST.md:129` не закрыт пункт Sentry. | `S` |

---

## 9. ЗАВИСИМОСТИ

- **Lockfile и скрипты:** `package-lock.json` присутствует; в `package.json` настроен `"postinstall": "prisma generate"`.
- **[MEDIUM] Ошибка разделения `dependencies` / `devDependencies` (`package.json:47`):**
  - Пакет `bcryptjs` (`^3.0.3`) объявлен в `devDependencies`, хотя напрямую импортируется в runtime-коде (`src/lib/auth.ts:2`). При выполнении `npm ci --omit=dev` в чистом production-окружении приложение упадёт (сейчас маскируется тем, что `Dockerfile` копирует все `node_modules`). **Оценка:** `S`.
- **Результаты `npm audit --omit=dev` (`4` уязвимости: `1 critical`, `3 high`):**
  - **[CRITICAL]** `next` (`9.3.4-canary.0 - 16.3.0-preview.10`, установлено `14.2.35`): **25 бюллетеней безопасности**, включая `GHSA-9g9p-9gw9-jx7f`, `GHSA-h25m-26qc-wcjf`, `GHSA-p293-qw3h-jr36` (RCE на Windows), `GHSA-2464-fhr4-w9xw` (RCE в Image Optimization для SVG), `GHSA-2xp9-vwfh-vxw4` (RCE для AVIF). Исправление по данным npm требует breaking-обновления до `next@16.4.6` (или проверки митигаций: отключение оптимизации изображений, прокси/WAF). **Оценка:** `L`.
  - **[HIGH]** `postcss` (`<=8.5.22`, транзитивная под `next`): `GHSA-qx2v-qp2m-jg93` (XSS), `GHSA-6g55-p6wh-862q` / `GHSA-fxqj-rqcc-2cmp` / `GHSA-r28c-9q8g-f849` (произвольное чтение файлов через `.map`).
  - **[HIGH]** `source-map-js` (`1.0.0 - 1.2.1`): `GHSA-68fv-2mgg-jv7q` (event-loop DoS).
  - **[HIGH]** `zod` (`<4.6.6`, установлено `4.6.5`): `GHSA-mrhx-c7xc-m3w5` (исчерпание памяти на больших ограниченных коллекциях). Лечится минорным `npm audit fix`. **Оценка:** `S`.
- **Результаты полного `npm audit` (с devDependencies — `21` уязвимость: `1 critical`, `9 high`, `11 moderate`):**
  - Дополнительно присутствуют уязвимости в инструментах сборки/тестирования: `@vitest/mocker <=4.1.11` (`moderate`), `brace-expansion` (`high`, 5 бюллетеней), `glob 9.0.0 - 14.0.1` (`high`, под `eslint-config-next`), `js-yaml 4.0.0 - 4.3.1` (`high`), `minimatch 7.0.0 - 11.0.0` (`moderate`), `postcss-selector-parser <6.1.5` (`moderate`), `vite 8.2.0 - 8.2.2` (`high`, уязвимости `launch-editor` и `server.fs` в Windows).

---

## 10. ПРИВАТНОСТЬ И ДАННЫЕ ПОЛЬЗОВАТЕЛЕЙ

- **Инвентарь PII в `prisma/schema.prisma`:** хранятся ФИО (`fullName`), email, телефон (`phone`), аватар, паспортные/юридические реквизиты центров (`inn`, `legalName`), `ParentLink`, посещаемость (`Attendance`), оценки (`Grade`), финансовые транзакции и IP/User-Agent в `UserSession`/`AuditLog`. Поля даты рождения (`birthDate`) в схеме нет.
- **Шифрование в БД и хранение секретов:** прикладного шифрования PII на уровне БД нет; **[CRITICAL]** поле `twoFactorSecret` хранится открытым текстом; временные пароли хранятся в открытом тексте в очереди `EmailOutbox` сроком до 30 дней (до очистки cron-ом).
- **[MEDIUM] Неполное удаление и анонимизация аккаунта:**
  - `DELETE /api/auth/account/delete` (самоудаление): не выставляет `deletedAt`, не очищает `twoFactorSecret` и `username`, не удаляет auth-cookie в HTTP-ответе и **записывает `originalEmail` в `AuditLog`**.
  - `DELETE /api/platform/users/[id]`: оставляет прежнюю строку email с префиксом/суффиксом `_del_`, не затирает `fullName` и `avatarUrl`, а также **записывает `originalEmail` в `AuditLog`**. **Оценка:** `M`.
- **[LOW/MEDIUM] Отсутствие комплаенса (GDPR / локальные законы о ПДн) и контроля экспорта:**
  - Нет self-service выгрузки персональных данных пользователя;
  - Большинство роутов экспорта (`/api/*/export`) не фиксируют факт скачивания PII в `AuditLog`;
  - Отсутствуют страницы Пользовательского соглашения / Политики конфиденциальности и чекбокс согласия при регистрации/приёме инвайта;
  - `ParentLink` со статусом `CONFIRMED` автоматически выставляется админами без подтверждения согласия или верификации канала родителя. **Оценка:** `M`.

---

## 11. ЛОГИРОВАНИЕ И МОНИТОРИНГ

- **[HIGH] Fail-open в системе аудита (`src/lib/tenant.ts:5-29`):**
  - `logAuditEvent` перехватывает ошибки записи в `AuditLog`, пишет сообщение в `console.error` и молча продолжает выполнение операции. Для критических действий (удаления, смена ролей, финансы, имперсонация) сбой БД позволяет провести действие без аудитного следа. **Оценка:** `S`.
- **[HIGH] Утечка PII и паролей в stdout/логи приложения:**
  - `src/lib/notifications.ts:181-183`: при незаданных переменных Eskiz номер телефона и текст SMS (который может содержать коды/данные ученика) выводятся в консоль **даже в `NODE_ENV=production`**.
  - `src/lib/email.ts:301-308`: при `DEV_EMAIL_LOG=true` полные тексты писем (включая пароли/токены) печатаются в логи. **Оценка:** `S`.
- **[MEDIUM] Отсутствие production-наблюдаемости и ротации логов:**
  - Не подключены Sentry (подтверждено открытым пунктом в `docs/LAUNCH_CHECKLIST.md:129`), OpenTelemetry, структурированное логирование (Pino/Winston) и сквозная трассировка запросов (`x-request-id` / correlation ID). Конфигурация `logrotate` в проекте отсутствует. **Оценка:** `M`.

---

## 12. ИТОГОВАЯ СВОДКА И ПЛАН ДЕЙСТВИЙ

### 12.1 Распределение находок по уровням риска

| Уровень | Ключевые выявленные проблемы |
| :--- | :--- |
| **`CRITICAL` (15)** | 1. Публичный захват `SUPERADMIN` (`/api/platform/first-owner`).<br>2. Эскалация `CENTER_ADMIN -> DIRECTOR` (`/api/invites/generate`).<br>3. Эскалация `PLATFORM_SUPPORT -> SUPERADMIN/DEVELOPER` через имперсонацию.<br>4. Отсутствие read-only и отключение RBAC при имперсонации (`tenant.ts`, `tenant-access.ts`).<br>5. Спуфинг IP / глобальный DoS `"unknown"` в `getClientIp()` (`src/lib/ip.ts`).<br>6. Подмена `centerId` в `POST /api/platform/support` любым авторизованным.<br>7. IDOR-привязка родителя к любому ученику + слабый код (`/api/invites/parent-link`).<br>8. Полный обход 2FA в `/api/auth/mobile/login`.<br>9. Хранение `twoFactorSecret` в БД открытым текстом (`/api/auth/2fa`).<br>10. Фиктивные резервные коды 2FA (`/api/auth/2fa`, `src/lib/totp.ts`).<br>11. Перезапись 2FA без пароля (`/api/auth/2fa`).<br>12. Утечка `passwordHash`/`twoFactorSecret`/`emailConfirmToken` в `PATCH /api/platform/users/[id]`.<br>13. Path Traversal в `/api/materials/[id]/download` (и незащищённый `fileUrl`).<br>14. Прямой неаутентифицированный доступ ко всем загруженным файлам в `public/uploads/`.<br>15. Критические бюллетени `next@14.2.35` в `npm audit --omit=dev` (вкл. RCE). |
| **`HIGH` (20+)** | Несогласованная/слабая парольная политика (`min 6`) и отсутствие отзыва сессий в `/api/account/change-password`; отсутствие rate limit на 2FA/смену пароля/принятие инвайтов и отсутствие сброса попыток/глобальной блокировки в `mobile/login`; перечисление пользователей и timing oracle; гонка `maxUses` инвайтов; обход `jti`/отзыва через `impersonate/stop`; TOTP replay + гонка refresh в мобильном клиенте; ошибки RBAC и скоупинга в `developer/audit-logs`, `switch-tenant`, `courses`, `lessons/[id]`, `modules`, `materials`, `tests`, `attendance/analytics`, `grades`, `homework`, `students/[id]`, `transcript`, `schedule`, `center-payments`, `upload/presign`; дыры RSC-страниц (`invites`, `courses`, `support/[id]`); Email HTML Injection; CSV Formula Injection (7+ экспортов); массовые пробелы Zod (`announcements PATCH`, `grades`, `center-payments`); Stored XSS (SVG) и отсутствие проверки magic bytes; утечка хешей сессий в `platform/security`; гонка rate limiter; векторы Email/SMS-бомбинга; DoS в `checkStorageQuota`, `bulk-import` (bcrypt-цикл) и `findMany`; fail-open `AuditLog` и утечка телефонов/SMS в production stdout. |
| **`MEDIUM` (18+)** | Исторические `*.db` в `git log --all`; передача открытых паролей в `EmailOutbox`; `x-forwarded-host` в CSRF `middleware.ts`; cron-обход при `NODE_ENV=test`; отключение проверок `invites/accept` и `redeem` (`CANCELLED`); утечка `isInternal: true` в тикетах; обход read-only `PLATFORM_SUPPORT` в `notification-preferences`; RSC-утечка PII в `groups`/`settings`/`platform-admin`; открытый API `onboarding`; незашифрованные секции мобильного офлайн-кэша; iCal CRLF-инъекция и `javascript:`-ссылки; `err.message` в 30+ API; отсутствие `Cache-Control: no-store`; отсутствие `AbortSignal.timeout`; слабая CSP (`unsafe-inline`/`unsafe-eval`); открытый порт `3000` без TLS в `docker-compose.prod.yml`; `bcryptjs` в `devDependencies`; неполное удаление ПДн; отсутствие Sentry/логирования/индексов БД. |
| **`LOW` (10+)** | Fallback-секреты в dev-скриптах/тестах; риск попадания `dev-quick-login` в мобильный релиз без `check:release-bundle`; `argv` для пароля в `scripts/first-owner.ts`; несоответствие срока cookie в `mobile/login`; `===` вместо `timingSafeEqual` в cron; отсутствие rate limit на `/api/public/leads`; раскрытие `uptime`/`version` в `/api/health`; расхождения в `DEPLOY.md` и `docs/DEPLOY.md`; незакреплённый `node:20-alpine` и devDependencies в runner Dockerfile; отсутствие GDPR-согласий/экспорта ПДн. |

*(Примечание: уровень `HIGH`/`MEDIUM`/`LOW` сгруппирован по тематическим кластерам; конкретные пункты с пометками `[HIGH]`, `[MEDIUM]`, `[LOW]` разобраны в соответствующих разделах выше.)*

### 12.2 Топ-20 приоритетных исправлений

| № | Приоритет | Что исправить | Основные файлы | Оценка |
|---|---|---|---|---|
| 1 | `CRITICAL` | Закрыть `GET`/`POST /api/platform/first-owner` после инициализации (env-флаг/CLI-токен и 404 при `superadminCount > 0`) | `src/app/api/platform/first-owner/route.ts` | `S` |
| 2 | `CRITICAL` | Запретить `DIRECTOR` в `invites/generate` для `CENTER_ADMIN` | `src/app/api/invites/generate/route.ts` | `S` |
| 3 | `CRITICAL` | Добавить проверку 2FA TOTP в `/api/auth/mobile/login` | `src/app/api/auth/mobile/login/route.ts` | `S` |
| 4 | `CRITICAL` | Ограничить роли цели в `/api/platform/impersonate` (запрет `PLATFORM_SUPPORT` -> `SUPERADMIN`/`DEVELOPER`/`PLATFORM_ADMIN`), проверять отмену сессии в `impersonate/stop`, убрать отключение RBAC при имперсонации | `src/app/api/platform/impersonate/**`, `src/lib/tenant-access.ts` | `M` |
| 5 | `CRITICAL` | Убрать `passwordHash`/`twoFactorSecret`/`emailConfirmToken` из ответа `PATCH /api/platform/users/[id]` (добавить строгий `select`) и убрать хеши токенов из `GET /api/platform/security` | `src/app/api/platform/users/[id]/route.ts`, `src/app/api/platform/security/route.ts` | `S` |
| 6 | `CRITICAL` | Закрыть `POST /api/platform/support` (проверка членства в `centerId` и запрет произвольного `centerId` чужих центров) | `src/app/api/platform/support/route.ts` | `S` |
| 7 | `CRITICAL` | Починить `POST /api/invites/parent-link`: `crypto.randomInt`, проверка `expiresAt`/`maxUses`/`center.status`, брать `studentMembershipId` только из записи кода | `src/app/api/invites/parent-link/route.ts` | `S` |
| 8 | `CRITICAL` | Исправить Path Traversal в `materials/[id]/download` и `deleteStoredFile` (`path.resolve` + `startsWith` + запрет `fileUrl` вне допустимого префикса/схем) | `src/app/api/materials/[id]/download/route.ts`, `src/lib/storage.ts`, `src/app/api/materials/**` | `S` |
| 9 | `CRITICAL` | Вынести локальные загрузки из `public/uploads/` в приватный каталог / S3/R2 с отдачей только через авторизованный download-endpoint; убрать `image/svg+xml` и проверять magic bytes | `src/lib/storage.ts`, `src/app/api/upload/**`, `src/app/api/upload/presign/route.ts` | `M` |
| 10 | `CRITICAL` | Зашифровать `twoFactorSecret` (AES-256-GCM), реализовать реальное хранение/проверку резервных кодов и требовать пароль + текущую сессию setup при `POST /api/auth/2fa`, добавить защиту от TOTP replay | `src/app/api/auth/2fa/route.ts`, `src/lib/totp.ts`, `src/app/api/auth/login/route.ts` | `M` |
| 11 | `HIGH` | Усилить `src/lib/ip.ts` (парсить `X-Forwarded-For` строго по `TRUSTED_PROXY_HOPS` справа, `TRUSTED_PROXY_HOPS=1` по умолчанию, безопасный CSRF `x-forwarded-host`) и сделать атомарным `rate-limit.ts` | `src/lib/ip.ts`, `src/lib/rate-limit.ts`, `src/middleware.ts` | `M` |
| 12 | `HIGH` | Исправить все дыры RBAC/IDOR по академическим и тикетным эндпоинтам (`courses`, `lessons`, `modules`, `materials`, `tests`, `homework`, `grades`, `attendance`, `students`, `transcript`, `schedule`, `center-payments`, `announcements PATCH`, `tickets` `isInternal`, `developer/audit-logs`, `switch-tenant`) | `src/app/api/**`, `src/lib/tenant-access.ts` | `L` |
| 13 | `HIGH` | Добавить серверные проверки ролей в RSC-страницах (`center/invites`, `center/courses*`, `center/support/[id]`, `center/groups`, `platform-admin`) и закрыть `/api/tenant/onboarding` при закрытой регистрации | `src/app/center/**`, `src/app/platform-admin/**`, `src/app/api/tenant/onboarding/route.ts` | `M` |
| 14 | `HIGH` | Унифицировать парольную политику (min 8–10, max 72 для bcrypt), внедрить Zod на всех write-эндпоинтах, перевести сброс пароля на атомарное обновление `usedAt`, убрать `EmailOutbox` хранение сырых паролей | `src/lib/validation/auth.ts`, `src/app/api/invites/redeem/route.ts`, `src/app/api/auth/password/reset/route.ts`, `src/lib/email.ts` | `M` |
| 15 | `HIGH` | Устранить XSS/инъекции в документах: HTML-экранирование в `email.ts`, единая защита от CSV-формул во всех 8+ экспортах, `escapeIcal` для `DESCRIPTION`, проверка протоколов URL | `src/lib/email.ts`, `src/lib/csv.ts`, `src/app/api/**/export/route.ts`, `src/app/api/schedule/ical/route.ts` | `S` |
| 16 | `HIGH` | Закрыть векторы Email/SMS-бомбинга, починить `EMAIL_PROVIDER=smtp` / ограничить `memory`-буфер и убрать вывод PII (телефоны/SMS) в production stdout | `src/app/api/auth/**`, `src/lib/notifications.ts`, `src/lib/email.ts` | `M` |
| 17 | `HIGH` | Оптимизировать `checkStorageQuota`, выставить лимиты `take` и безопасный парсинг `pageSize` (защита от `NaN`), ограничить пакетные `bcrypt`-операции, добавить `AbortSignal.timeout` к `fetch` | `src/lib/storage.ts`, `src/app/api/invites/bulk-import/route.ts`, `src/app/api/students/import-csv/route.ts` | `M` |
| 18 | `CRITICAL` | Обновить `zod` (`npm audit fix`) и спланировать/выполнить обновление `next` (`14.2.35` -> безопасный поддерживаемый релиз по политике проекта) + перенести `bcryptjs` в `dependencies` | `package.json`, `package-lock.json` | `L` |
| 19 | `MEDIUM` | Убрать утечки `err.message` в ответах API (единый безопасный обработчик ошибок) и добавить `Cache-Control: no-store` на все auth/token/finance/health-маршруты | `src/app/api/**` | `M` |
| 20 | `MEDIUM` | Исправить гонку token refresh в мобильном клиенте (singleton mutex + передача `deviceId`) и шифровать весь офлайн-кэш чувствительных данных | `mobile/src/services/api-client.ts`, `mobile/src/services/offline-cache.ts`, `mobile/src/services/auth-storage.ts` | `M` |

### 12.3 Быстрые победы (Quick Wins: `CRITICAL`/`HIGH` со сложностью `S`)
1. Отключить/закрыть `/api/platform/first-owner`.
2. Убрать `"DIRECTOR"` из `VALID_TARGET_ROLES` в `/api/invites/generate`.
3. Добавить `select` в `PATCH /api/platform/users/[id]` и `GET /api/platform/security`.
4. Проверить членство в `/api/platform/support` `POST` и запретить чужой `centerId`.
5. Добавить проверку 2FA в `/api/auth/mobile/login`.
6. Починить `path.resolve` в `/api/materials/[id]/download` и `deleteStoredFile`.
7. Заменить `Math.random()` и добавить проверки срока/лимита/`studentMembershipId` в `/api/invites/parent-link`.
8. Перенести `bcryptjs` из `devDependencies` в `dependencies` и выполнить `npm audit fix` для `zod`.
9. Исправить опечатку `"audit.read"` -> `"platform.audit.read"` в `/api/developer/audit-logs` и отфильтровать `isInternal: false` в `/api/tickets*`.
10. Добавить `escapeHtml` в шаблоны `email.ts`, `escapeIcal` в `schedule/ical` и защиту от CSV-формул в 7 платформенных экспортах.

### 12.4 Действия на уровне инфраструктуры и Ops (вне кода)
1. **Проверить и при необходимости перевыпустить секреты**, включая `TELEGRAM_BOT_TOKEN` (если `transmitter/` использовался) и пароли/секреты из локальных файлов окружения; проверить git-историю на наличие реальных учётных данных в старых `prisma/*.db` и при необходимости очистить историю `git filter-repo`.
2. **Не публиковать порт `3000` напрямую в интернет (`docker-compose.prod.yml`):** поставить спереди TLS-терминирующий reverse proxy (Nginx/Caddy/Cloudflare), который строго перезаписывает `X-Forwarded-For`, `X-Real-IP` и `X-Forwarded-Host`, и задать корректный `TRUSTED_PROXY_HOPS`.
3. **Включить приватное объектное хранилище (S3/R2)** вместо локального `public/uploads/` или убрать раздачу загрузок через `public/`.
4. **Настроить мониторинг, Sentry, ротацию логов (`logrotate`) и зашифрованные бэкапы БД**, актуализировав `DEPLOY.md` и `docs/DEPLOY.md`.
5. **Обязательно прогонять `npm run check:release-bundle` в CI** перед публикацией мобильных сборок.

### 12.5 Что уточнить у владельца продукта / инфраструктуры
1. Какой именно reverse proxy используется перед приложением в production (один hop Nginx/Caddy или CDN + LB) для точной настройки `TRUSTED_PROXY_HOPS` и CSRF `Host`?
2. Используется ли в production локальная ФС для загрузок или S3/R2?
3. Планируется ли миграция на Next.js `16.x` для устранения critical-бюллетеней `next@14.2.35`, либо применяется внешний WAF и отключение `next/image` optimization?
4. Требуется ли полное соблюдение GDPR / закона о ПДн РУз (согласия при регистрации, шифрование полей, self-service экспорт и полное удаление из `AuditLog`)?

### 12.6 Область `НЕ ПРОВЕРЕНО`
- Исходный код сервиса в каталоге `transmitter/` (подтверждено лишь наличие локального `.env`).
- Все экраны внутри `mobile/app/(director|parent|platform|student|teacher)/*` (проверены только корневые сервисы `mobile/src/services/*` и `mobile/src/components/dev-quick-login*`).
- Детальная криптографическая реализация внутри `mobile/src/services/secure-cipher.ts`.
- Фактические значения переменных окружения на production-сервере, конфигурация внешнего прокси/WAF и содержимое исторических SQLite-дампов `prisma/*.db` в git-истории.
