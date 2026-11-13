# АУДИТ РОЛИ SUPERADMIN (PlatformRole.SUPERADMIN) В ПРОЕКТЕ E-DARSCHI

**Дата аудита:** 11 ноября 2026 г.  
**Ветка репозитория:** `main` (HEAD: `cb6daaf`)  
**Режим проверки:** Read-Only аудит исходного кода (без изменения кода, без миграций, без внешних зависимостей).  
**Инструменты статического анализа:** `tsc --noEmit` (0 ошибок), `next lint` (0 ошибок, 7 предупреждений).

---

## 1. ПРАВА И ДОСТУП

### 1.1. Значения PlatformRole в Prisma и в коде
В схеме базы данных [`prisma/schema.prisma:14-25`](file:///d:/AZIZ%20PROJECT/prisma/schema.prisma#L14-L25) и перечислении TypeScript [`src/lib/permissions.ts:17-25`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L17-L25) определены 7 значений роли уровня платформы (`PlatformRole`):

| Роль платформы | Назначение в архитектуре | Описание в коде |
|---|---|---|
| `NONE` | Обычный пользователь | Не имеет доступа к платформенным панелям (`/platform-admin`, `/developer`). |
| `DEVELOPER` | Главный технический администратор (Technical Super Admin) | Полный доступ ко всем словарным и инфраструктурным разделам, сквозной обход мультитенантности без ограничений. |
| `SUPERADMIN` | Владелец платформы (Platform Owner) | Коммерческое управление (центры, тарифы, подписки, тикеты, аудит, имперсонация директоров). |
| `PLATFORM_ADMIN` | Операционный администратор платформы | Управление центрами, тарифами, тикетами, просмотр подписок. Нет прав на аудит платформы, имперсонацию и технический Dev-панель. |
| `FULL_ACCESS` | Внутренний расширенный доступ (Legacy) | Инженерный доступ для мониторинга центров, просмотр тикетов и аудита. |
| `PLATFORM_SUPPORT` | Агент технической поддержки платформы | Просмотр центров, тикеты, имперсонация с жестким ограничением **Read-Only** (в тенанте получает роль `CENTER_SUPPORT`). |
| `SEO_ADMIN` | Администратор маркетинга и SEO | Доступ к метатегам и анонсам блога платформы (`/platform-admin/seo`). |

### 1.2. Отличия SUPERADMIN от других платформенных ролей

1. **SUPERADMIN vs DEVELOPER:**
   - По замыслу матрицы прав ([`src/lib/permissions.ts:187-203`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L187-L203)), `SUPERADMIN` управляет коммерческой стороной и не должен иметь доступа к системным ресурсам (`platform.infrastructure`, `platform.database`, `platform.logs`, `platform.feature_flags`, `platform.security`).
   - **Архитектурная брешь / несоответствие:** В хелпере [`src/lib/platformAuth.ts:24-38`](file:///d:/AZIZ%20PROJECT/src/lib/platformAuth.ts#L24-L38) функция `requireDeveloper()` явно включает `SUPERADMIN`:
     ```typescript
     const isDeveloper = role === "DEVELOPER" || role === "SUPERADMIN";
     ```
     Аналогично в лэйауте Dev-панели [`src/app/developer/layout.tsx:14`](file:///d:/AZIZ%20PROJECT/src/app/developer/layout.tsx#L14):
     `const isDeveloper = ["SUPERADMIN", "DEVELOPER"].includes(role);`.  
     В результате `SUPERADMIN` имеет фактический доступ ко всем системным экранам и API разработчика (`/developer`, `/developer/audit`, `/developer/owners`, `/api/developer/*`), что стирает грань между коммерческим суперадмином и разработчиком.
   - С другой стороны, в лэйауте коммерческой панели [`src/app/platform-admin/layout.tsx:16-26`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/layout.tsx#L16-L26) роль `DEVELOPER` **забыта** в массиве `allowedPlatformRoles` (`["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT", "SEO_ADMIN"]`). Если пользователь с ролью `DEVELOPER` переходит на `/platform-admin`, он редиректится на `/center`!

2. **SUPERADMIN vs PLATFORM_ADMIN:**
   - `PLATFORM_ADMIN` не имеет прав на глобальный аудит-лог платформы ([`src/app/platform-admin/audit/page.tsx:10`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/audit/page.tsx#L10)), не отображается пункт аудита в сайдбаре ([`src/components/platform/PlatformSidebar.tsx:90`](file:///d:/AZIZ%20PROJECT/src/components/platform/PlatformSidebar.tsx#L90)).
   - `PLATFORM_ADMIN` не имеет права на имперсонацию по матрице `permissions.ts:204-216` (хотя в API `/api/platform/impersonate/route.ts:17` он ошибочно добавлен в массив `allowedRoles`).
   - `PLATFORM_ADMIN` не может входить в `/developer/*`.

3. **SUPERADMIN vs PLATFORM_SUPPORT:**
   - `PLATFORM_SUPPORT` ограничен только чтением: при попытке мутации данных центра внутри тенанта хелпер [`src/lib/tenant.ts:175-179`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L175-L179) выбрасывает `403 SUPPORT_READ_ONLY`.
   - При имперсонации `PLATFORM_SUPPORT` получает в контексте центра роль `CENTER_SUPPORT` ([`src/lib/auth.ts:254`](file:///d:/AZIZ%20PROJECT/src/lib/auth.ts#L254)), тогда как `SUPERADMIN` получает роль `DIRECTOR`.

4. **SUPERADMIN vs SEO_ADMIN:**
   - `SEO_ADMIN` имеет пустой массив прав в [`src/lib/permissions.ts:234`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L234), но допускается только на страницу `/platform-admin/seo` ([`src/app/platform-admin/seo/page.tsx:9`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/seo/page.tsx#L9)).

### 1.3. Гранулярные права в `src/lib/permissions.ts` (Активные vs Декоративные)
В матрице `PLATFORM_ROLE_PERMISSIONS.SUPERADMIN` ([`src/lib/permissions.ts:187-203`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L187-L203)) для суперадмина задекларировано 14 прав. Сквозной поиск по всей кодовой базе выявил критическую особенность: **большинство этих прав декоративны и нигде не проверяются через `hasPermission()`**.

| Право в матрице SUPERADMIN | Проверяется в коде через `hasPermission()`? | Реальный механизм защиты | Статус |
|---|---|---|---|
| `platform.dashboard` | **НЕТ** | `allowedPlatformRoles.includes(role)` в [`src/app/platform-admin/layout.tsx:16`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/layout.tsx#L16) | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.centers.read` | **ДА** | [`src/app/api/platform/centers/route.ts:23`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts#L23), [`src/app/api/platform/centers/[id]/route.ts:10`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/[id]/route.ts#L10) | РАБОТАЕТ |
| `platform.centers.write` | **ДА** | [`src/app/api/platform/centers/route.ts:88`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts#L88), [`src/app/api/platform/centers/[id]/route.ts:50`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/[id]/route.ts#L50), [`src/app/api/platform/centers/[id]/director/route.ts:24`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/[id]/director/route.ts#L24) | РАБОТАЕТ |
| `platform.centers.block` | **ДА** | [`src/app/api/platform/centers/[id]/suspend/route.ts:16`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/[id]/suspend/route.ts#L16) | РАБОТАЕТ |
| `platform.tenants.read` | **НЕТ** | Нигде не вызывается | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.tenants.manage` | **НЕТ** | Нигде не вызывается | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.plans.manage` | **НЕТ** | `requirePlatformOwner()` в [`src/app/api/platform/plans/route.ts:25`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/plans/route.ts#L25) | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.billing.read` | **НЕТ** | Нигде не вызывается | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.billing.manage` | **НЕТ** | Нигде не вызывается | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.impersonation` | **НЕТ** | Хардкод массива ролей в [`src/app/api/platform/impersonate/route.ts:17`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/impersonate/route.ts#L17) | ДУБЛЬ / МЁРТВЫЙ КОД |
| `platform.support` | **НЕТ** | `requirePlatformOwner()` в [`src/app/api/platform/support/route.ts:12`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/support/route.ts#L12) | ДУБЛЬ / МЁРТВЫЙ КОД |
| `audit.read` | **НЕТ** | Проверка `session.user.platformRole !== "SUPERADMIN"` в [`src/app/platform-admin/audit/page.tsx:10`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/audit/page.tsx#L10) | ДУБЛЬ / МЁРТВЫЙ КОД |
| `support.read` | **НЕТ** | Нигде не вызывается на платформенном уровне | ДУБЛЬ / МЁРТВЫЙ КОД |
| `support.create` | **НЕТ** | Нигде не вызывается на платформенном уровне | ДУБЛЬ / МЁРТВЫЙ КОД |

### 1.4. Гарды и защита страниц / API
1. **Middleware (`src/middleware.ts:1-53`)**:  
   В `src/middleware.ts` **нет проверки авторизации и роутинга**! Middleware занимается исключительно базовой защитой от межсайтовых запросов (CSRF-проверка заголовка `Origin` для мутирующих запросов POST/PUT/DELETE, [`src/middleware.ts:18-48`](file:///d:/AZIZ%20PROJECT/src/middleware.ts#L18-L48)). Доступ к защищенным путям проверяется только на уровне Next.js Server Components (layout/page) и Route Handlers.
2. **Лэйауты страниц**:
   - [`src/app/platform-admin/layout.tsx:10-26`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/layout.tsx#L10-L26): вызывает `getAuthSession()`. Если сессии нет — редирект на `/login`. Если `platformRole` не входит в список `["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT", "SEO_ADMIN"]` — редирект на `/center`.
   - [`src/app/developer/layout.tsx:8-18`](file:///d:/AZIZ%20PROJECT/src/app/developer/layout.tsx#L8-L18): пускает только `["SUPERADMIN", "DEVELOPER"]`. Остальных редиректит на `/platform`.
   - [`src/app/platform/layout.tsx:13-17`](file:///d:/AZIZ%20PROJECT/src/app/platform/layout.tsx#L13-L17): пускает `["PLATFORM_ADMIN", "SUPERADMIN", "DEVELOPER", "FULL_ACCESS"]`.
3. **API Гарды**:
   - `requirePlatformOwner(req)` ([`src/lib/platformAuth.ts:4-22`](file:///d:/AZIZ%20PROJECT/src/lib/platformAuth.ts#L4-L22)): разрешает `PLATFORM_ADMIN`, `SUPERADMIN`, `DEVELOPER`, `FULL_ACCESS`.
   - `requireDeveloper(req)` ([`src/lib/platformAuth.ts:24-38`](file:///d:/AZIZ%20PROJECT/src/lib/platformAuth.ts#L24-L38)): разрешает `DEVELOPER` и `SUPERADMIN`.
   - `hasPermission(permission, role)` ([`src/lib/permissions.ts:356-373`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L356-L373)): для `SUPERADMIN` возвращает `true`, если право есть в `PLATFORM_ROLE_PERMISSIONS.SUPERADMIN` либо в `CENTER_ROLE_PERMISSIONS.DIRECTOR`.

### 1.5. Сквозной доступ к тенантам и аудит
1. **Обход изоляции тенанта (`src/lib/tenant.ts:128-205`)**:
   - При вызове `requireTenantAccess()` для ролей `DEVELOPER`, `SUPERADMIN`, `PLATFORM_SUPPORT` проверка принадлежности пользователя к таблице `CenterMembership` пропускается (`isPlatformStaff = true`).
   - Если центр находится в статусе `BLOCKED` или `CANCELLED`: доступ на чтение имеют только `SUPERADMIN` и `DEVELOPER` ([`src/lib/tenant.ts:140-148`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L140-L148)). Для выполнения операции записи (`isWrite = true`) суперадмин **обязан** передать причину через заголовок `x-action-reason` или body (`reason`), иначе запрос отклоняется с `400 REASON_REQUIRED` ([`src/lib/tenant.ts:151-158`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L151-L158)). Каждая такая запись фиксируется событием `PLATFORM_SUSPENDED_TENANT_WRITE` в таблице `AuditLog`.
   - Обычный вход сотрудника платформы в любой тенант всегда логируется как `PLATFORM_TENANT_ACCESS` ([`src/lib/tenant.ts:181-191`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L181-L191)).
2. **Изоляция финансов центра (`src/lib/tenant.ts:266-352`)**:
   - Функция `requireFinanceTenantAccess()` блокирует прямой доступ сотрудникам платформы к `/api/finance/*` без явной имперсонации: выбрасывается ошибка `403 FINANCE_IMPERSONATION_REQUIRED` ([`src/lib/tenant.ts:303-308`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L303-L308)).
   - При работе под сессией имперсонации доступ к финансам центра становится **строго Read-Only**: любые мутации (`POST`, `PUT`, `PATCH`, `DELETE`) отклоняются ошибкой `403 FINANCE_IMPERSONATION_READ_ONLY` ([`src/lib/tenant.ts:311-317`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L311-L317)).
   - Каждое чтение финансов суперадмином под имперсонацией логируется в `AuditLog` с действием `FINANCE_IMPERSONATION_READ` ([`src/lib/tenant.ts:325-338`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L325-L338)).

---

## 2. ЭКРАНЫ (UI)

### 2.1. Сводная таблица всех маршрутов, доступных SUPERADMIN

| Маршрут (URL) | Файл компонента | В сайдбаре? | Отображаемые данные | Источник данных | Действия пользователя | Статус |
|---|---|---|---|---|---|---|
| `/platform-admin` | [`src/app/platform-admin/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/page.tsx) | ДА (Аналитика) | Метрики центров (всего, активных, замороженных, на триале, заблокированных), студентов, преподавателей, истекающие подписки, таблица последних центров | Прямые агрегации БД Prisma (`db.learningCenter`, `db.platformUser`, `db.subscription`) | Переход в списки, быстрый вход (`ImpersonateButton`) | **РАБОТАЕТ** |
| `/platform-admin/centers` | [`src/app/platform-admin/centers/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/page.tsx) | ДА (Управление центрами) | Таблица учебных центров с поиском по названию/slug/email, фильтр по статусу, пагинация | `GET /api/platform/centers` | Поиск, фильтрация, переход в карточку, вход от имени владельца | **РАБОТАЕТ** |
| `/platform-admin/centers/create` | [`src/app/platform-admin/centers/create/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/create/page.tsx) | НЕТ (кнопка в реестре) | 4-шаговый визард: реквизиты, статус/триал, данные директора, подтверждение | Локальный state React + Zod-валидация | `POST /api/platform/centers` (создание организации) | **РАБОТАЕТ** |
| `/platform-admin/centers/[id]` | [`src/app/platform-admin/centers/[id]/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/[id]/page.tsx) | НЕТ (по ссылке из таблицы) | Детальная карточка: вкладки Обзор, Редактирование, Директор, Статус/Блокировка, история аудита | `GET /api/platform/centers/[id]` | `PATCH` данных, `POST` смены директора, `POST` блокировки/возобновления, вход (`ImpersonateButton`) | **РАБОТАЕТ** |
| `/platform-admin/plans` | [`src/app/platform-admin/plans/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/plans/page.tsx) | ДА (Тарифные планы) | Сетка тарифов (студенты, учителя, курсы, филиалы, память, цена, число активных подписок) | `GET /api/platform/plans` | Модалка создания тарифа (`POST`), редактирование тарифа (`PATCH`), активация/деактивация | **РАБОТАЕТ** |
| `/platform-admin/subscriptions` | [`src/app/platform-admin/subscriptions/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/subscriptions/page.tsx) | ДА (Подписки) | Реестр подписок центров, даты начала/окончания, статус (TRIAL, ACTIVE, PAST_DUE и др.), тариф | `GET /api/platform/subscriptions` | Фильтрация по статусу, пагинация, ссылка на карточку центра | **РАБОТАЕТ** |
| `/platform-admin/support` | [`src/app/platform-admin/support/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/support/page.tsx) | ДА (Поддержка) | Список тикетов от директоров центров (тема, центр, автор, статус, приоритет, кол-во сообщений) | `GET /api/platform/support` | Фильтр по статусу, кнопки смены статуса на `IN_PROGRESS`, `RESOLVED`, `CLOSED` | **ЧАСТИЧНО** (нет чата/просмотра сообщений) |
| `/platform-admin/audit` | [`src/app/platform-admin/audit/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/audit/page.tsx) | ДА (Аудит-лог) | Последние 50 глобальных системных событий (дата, автор, действие, ресурс, IP, детали) | Прямой запрос к БД `db.auditLog.findMany` (RSC) | Просмотр логов (только для `SUPERADMIN`) | **РАБОТАЕТ** |
| `/platform-admin/seo` | [`src/app/platform-admin/seo/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/seo/page.tsx) | НЕТ | Форма метатегов (Meta Title, Description, OG Image, Keywords) | Полный хардкод строковых значений в полях input | Кнопка «Сохранить SEO теги» без onClick и بدون form action | **ЗАГЛУШКА** |
| `/platform-admin/impersonate` | Отсутствует файл | ДА (Имперсонация) | Страницы физически не существует в файловой системе! | Нет | При клике по пункту в сайдбаре открывается стандартная 404 страница Next.js | **ДУБЛЬ / МЁРТВЫЙ КОД** (Битая ссылка) |
| `/platform` | [`src/app/platform/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform/page.tsx) | НЕТ | Редирект на `/platform-admin` | Next.js Server Redirect | Редирект | **ДУБЛЬ / МЁРТВЫЙ КОД** |
| `/platform/tenants` | [`src/app/platform/tenants/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform/tenants/page.tsx) | НЕТ | Редирект на `/platform-admin/centers` | Next.js Server Redirect | Редирект | **ДУБЛЬ / МЁРТВЫЙ КОД** |
| `/platform/tenants/create` | [`src/app/platform/tenants/create/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform/tenants/create/page.tsx) | НЕТ | Редирект на `/platform-admin/centers/create` | Next.js Server Redirect | Редирект | **ДУБЛЬ / МЁРТВЫЙ КОД** |
| `/platform/tenants/[id]` | [`src/app/platform/tenants/[id]/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform/tenants/[id]/page.tsx) | НЕТ | Редирект на `/platform-admin/centers/${id}` | Next.js Server Redirect | Редирект | **ДУБЛЬ / МЁРТВЫЙ КОД** |
| `/platform/subscriptions` | [`src/app/platform/subscriptions/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform/subscriptions/page.tsx) | НЕТ | Редирект на `/platform-admin/plans` (некорректный целевой путь, должен быть subscriptions!) | Next.js Server Redirect | Редирект | **ДУБЛЬ / МЁРТВЫЙ КОД** |
| `/platform/support` | [`src/app/platform/support/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform/support/page.tsx) | НЕТ | Редирект на `/platform-admin/support` | Next.js Server Redirect | Редирект | **ДУБЛЬ / МЁРТВЫЙ КОД** |
| `/developer` | [`src/app/developer/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/developer/page.tsx) | НЕТ (в сайдбаре dev) | Дашборд здоровья: пинг БД, статус Redis, Uptime, Memory RSS/Heap, Environment | `GET /api/developer/health` | Мониторинг состояния сервера | **РАБОТАЕТ** |
| `/developer/audit` | [`src/app/developer/audit/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/developer/audit/page.tsx) | НЕТ (в сайдбаре dev) | Инженерный просмотр до 200 записей аудит-лога с поиском на клиенте | `GET /api/developer/audit-logs?limit=200` | Поиск по логам | **РАБОТАЕТ** |
| `/developer/owners` | [`src/app/developer/owners/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/developer/owners/page.tsx) | НЕТ (в сайдбаре dev) | Список администраторов платформы (email, ФИО, роль, статус, дата создания) | `GET /api/developer/platform-owners` | Кнопки «Add Administrator» и «Configure» без `onClick` обработчиков | **ЧАСТИЧНО** (заглушки кнопок) |
| `/setup` | [`src/app/setup/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/setup/page.tsx) | НЕТ | Инициализация первого владельца (если `db.platformUser.count({ where: { platformRole: "SUPERADMIN" } }) === 0`). При наличии суперадмина — редирект на `/login`. | `db.platformUser.count` | Форма `SetupForm` -> `POST /api/platform/first-owner` | **РАБОТАЕТ** |
| `/onboarding` | [`src/app/onboarding/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/onboarding/page.tsx) | НЕТ | Информационный лендинг «Закрытый Мультитенантный Режим». Разъясняет, что центры создает только суперадмин. | Статическая верстка | Кнопка «Войти в систему» -> `/login` | **РАБОТАЕТ** |
| `/dev/ui-kit` | [`src/app/dev/ui-kit/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/dev/ui-kit/page.tsx) | НЕТ | Витрина UI компонентов для разработки (только в `NODE_ENV !== "production"`, в проде 404). | Статическая верстка | Нет | **РАБОТАЕТ** |

### 2.2. Анализ виджетов дашборда `/platform-admin` ([`src/app/platform-admin/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/page.tsx))

1. **Баннер инженерного доступа (`lines 91-100`)**:
   - Отображается, если `session.user.platformRole === "FULL_ACCESS"`. Для `SUPERADMIN` скрыт.
2. **Карточка 1: «Управление центрами» (`lines 148-173`)**:
   - Значение: `totalCenters` (`db.learningCenter.count()`).
   - Бейджи: `activeCenters` (`count({ status: "ACTIVE" })`), `pausedCenters` (`count({ status: "PAUSED" })`), `blockedCenters` (`count({ status: "BLOCKED" })`).
   - Источник: реальная БД. Статус: `РАБОТАЕТ`.
3. **Карточка 2: «Ученики платформы» (`lines 176-189`)**:
   - Значение: `totalStudents` (`db.centerMembership.count({ role: "STUDENT", status: "ACTIVE" })`).
   - Подпись: `totalUsers` (`db.platformUser.count()`).
   - Источник: реальная БД. Статус: `РАБОТАЕТ`.
4. **Карточка 3: «Учителя платформы» (`lines 192-205`)**:
   - Значение: `totalTeachers` (`db.centerMembership.count({ role: "TEACHER", status: "ACTIVE" })`).
   - Источник: реальная БД. Статус: `РАБОТАЕТ`.
5. **Карточка 4: «Пробный период / Подписки» (`lines 208-229`)**:
   - Значение: `trialCenters` (`db.learningCenter.count({ status: "TRIAL" })`).
   - Предупреждение: счетчик `expiringSubscriptions.length` (подписки, истекающие в ближайшие 7 дней).
   - Источник: реальная БД. Статус: `РАБОТАЕТ`.
6. **Блок оповещений: «Подписки с истекающим сроком действия» (`lines 232-268`)**:
   - Список до 5 подписок (`lte: now + 7 days`), название центра, тариф, срок, кнопка «Карточка».
   - Источник: реальная БД. Статус: `РАБОТАЕТ`.
7. **Таблица: «Недавно добавленные центры и быстрый доступ» (`lines 271-342`)**:
   - Последние 8 центров (`db.learningCenter.findMany({ take: 8, orderBy: { createdAt: "desc" } })`), директор, статус, текущий план, компонент `ImpersonateButton`.
   - Источник: реальная БД. Статус: `РАБОТАЕТ`.

### 2.3. Битые ссылки, заглушки и мертвые кнопки в интерфейсе
1. **Битая ссылка в главном меню платформы**: В [`src/components/platform/PlatformSidebar.tsx:93-97`](file:///d:/AZIZ%20PROJECT/src/components/platform/PlatformSidebar.tsx#L93-L97) для `SUPERADMIN` выводится пункт «Имперсонация» со ссылкой `/platform-admin/impersonate`. Файл страницы отсутствует в проекте, переход ведет на 404 ошибку.
2. **Заглушка на странице SEO**: Кнопка «Сохранить SEO теги» в [`src/app/platform-admin/seo/page.tsx:49-51`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/seo/page.tsx#L49-L51) не имеет привязанного обработчика или формы. Все значения захардкожены.
3. **Мертвые кнопки в панели администраторов**: На странице [`src/app/developer/owners/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/developer/owners/page.tsx) кнопки «Add Administrator» (строка 37) и «Configure» (строка 92) являются простыми тегами `<button>` без атрибута `onClick` и без модальных окон.
4. **Некорректный редирект в legacy-папке**: Файл [`src/app/platform/subscriptions/page.tsx:4`](file:///d:/AZIZ%20PROJECT/src/app/platform/subscriptions/page.tsx#L4) перенаправляет на `/platform-admin/plans` вместо `/platform-admin/subscriptions`.

---

## 3. API ЭНДПОИНТЫ

### 3.1. Сводная таблица платформенных эндпоинтов

| Метод | Путь API | Описание | Проверка прав | Валидация входных данных | Запись в AuditLog | Вызывается из UI? | Статус |
|---|---|---|---|---|---|---|---|
| `GET` | `/api/platform/analytics` | Сводная аналитика (центры, пользователи, MRR/ARR по планам, последние логи) | `requirePlatformOwner()` ([`src/lib/platformAuth.ts:4`](file:///d:/AZIZ%20PROJECT/src/lib/platformAuth.ts#L4)) | Нет (GET) | Нет | **НЕТ** (UI дашборда делает прямые запросы к БД) | **НЕ ПОДКЛЮЧЕНО** |
| `GET` | `/api/platform/announcements` | Получение системных объявлений (`centerId: "PLATFORM"`) | `requirePlatformOwner()` | Нет (GET) | Нет | **НЕТ** | **НЕ ПОДКЛЮЧЕНО** |
| `POST` | `/api/platform/announcements` | Создание платформенного объявления | `requirePlatformOwner()` | Ручная проверка `title`, `body` | `PLATFORM_ANNOUNCEMENT_CREATED` | **НЕТ** | **ДУБЛЬ / МЁРТВЫЙ КОД** *(При вызове упадет с FK constraint: нет центра "PLATFORM")* |
| `GET` | `/api/platform/centers` | Реестр центров с пагинацией и поиском | `hasPermission("platform.centers.read")` | Zod (`getQuerySchema`) | Нет | Да (`PlatformCentersPage`) | **РАБОТАЕТ** |
| `POST` | `/api/platform/centers` | Создание центра, директора, триальной подписки | `hasPermission("platform.centers.write")` + Rate Limit 5/мин | Zod (`postBodySchema`) | `PLATFORM_CREATE_LEARNING_CENTER` | Да (`CreateCenterPage`) | **РАБОТАЕТ** *(но resetUrl не возвращается в JSON)* |
| `GET` | `/api/platform/centers/[id]` | Детальная информация по центру, директору, метрикам и логам | `hasPermission("platform.centers.read")` | Параметр маршрута `id` | Нет | Да (`PlatformCenterDetailsPage`) | **РАБОТАЕТ** |
| `PATCH` | `/api/platform/centers/[id]` | Обновление реквизитов центра (name, phone, email, timeZone) | `hasPermission("platform.centers.write")` | Zod (`patchBodySchema`) | `PLATFORM_UPDATE_LEARNING_CENTER` | Да (`PlatformCenterDetailsPage`, вкладка edit) | **РАБОТАЕТ** |
| `POST` | `/api/platform/centers/[id]/director` | Смена директора центра | `hasPermission("platform.centers.write")` + Rate Limit | Zod (`email`) | `PLATFORM_CHANGE_DIRECTOR` | Да (`PlatformCenterDetailsPage`, вкладка director) | **РАБОТАЕТ** |
| `POST` | `/api/platform/centers/[id]/suspend` | Изменение статуса центра (`pause`, `block`, `resume`) | `hasPermission("platform.centers.block")` | Zod (`action`, `reason`) | `PLATFORM_SUSPEND_LEARNING_CENTER` | Да (`PlatformCenterDetailsPage`, вкладка suspend) | **РАБОТАЕТ** |
| `GET` | `/api/platform/first-owner` | Проверка наличия первого суперадмина | Публичный (проверяет `count === 0`) | Нет | Нет | Да (`SetupForm.tsx`) | **РАБОТАЕТ** |
| `POST` | `/api/platform/first-owner` | Регистрация первого суперадмина платформы | Доступен, только если суперадминов в БД 0 | Zod (`email`, `password`, `fullName`) | `PLATFORM_INIT_FIRST_OWNER` | Да (`SetupForm.tsx`) | **РАБОТАЕТ** |
| `POST` | `/api/platform/impersonate` | Старт сессии имперсонации под пользователем | Проверка роли: SUPERADMIN, DEVELOPER, PLATFORM_ADMIN, FULL_ACCESS, PLATFORM_SUPPORT | Ручная проверка `targetUserId` | `PLATFORM_IMPERSONATION_STARTED` | Да (`ImpersonateButton.tsx`) | **РАБОТАЕТ** |
| `GET` | `/api/platform/plans` | Список тарифных планов платформы | `requirePlatformOwner()` | Нет | Нет | Да (`PlatformPlansPage`) | **РАБОТАЕТ** |
| `POST` | `/api/platform/plans` | Создание нового тарифного плана | `requirePlatformOwner()` | Ручная проверка полей | `PLATFORM_PLAN_CREATED` | Да (`PlatformPlansPage`) | **РАБОТАЕТ** |
| `PATCH` | `/api/platform/plans` | Редактирование существующего тарифа | `requirePlatformOwner()` | Ручная проверка `id` | `PLATFORM_PLAN_UPDATED` | Да (`PlatformPlansPage`) | **РАБОТАЕТ** |
| `GET` | `/api/platform/subscriptions` | Реестр подписок центров с пагинацией | `requirePlatformOwner()` | Ручной парсинг `page`, `limit`, `status` | Нет | Да (`PlatformSubscriptionsPage`) | **РАБОТАЕТ** *(Только чтение! Нет методов мутации)* |
| `GET` | `/api/platform/support` | Список тикетов поддержки | `requirePlatformOwner()` | Фильтр по `status` | Нет | Да (`PlatformSupportPage`) | **РАБОТАЕТ** |
| `PATCH` | `/api/platform/support` | Обновление статуса тикета поддержки | `requirePlatformOwner()` | Ручная проверка `id`, `status` | `PLATFORM_TICKET_UPDATED` | Да (`PlatformSupportPage`) | **РАБОТАЕТ** |
| `GET` | `/api/developer/audit-logs` | Выборка глобального аудит-лога | `requireDeveloper()` | Параметры `limit`, `centerId` | Нет | Да (`GlobalAuditLogsPage`) | **РАБОТАЕТ** |
| `GET` | `/api/developer/health` | Проверка здоровья БД, Redis, памяти, аптайма | `requireDeveloper()` | Нет | Нет | Да (`DeveloperDashboard`) | **РАБОТАЕТ** *(Redis — заглушка "N/A")* |
| `GET` | `/api/developer/platform-owners` | Список сотрудников платформы | `requireDeveloper()` | Нет | Нет | Да (`PlatformOwnersPage`) | **РАБОТАЕТ** |
| `POST` | `/api/developer/platform-owners` | Создание нового сотрудника (`PLATFORM_ADMIN`, `PLATFORM_SUPPORT`) | `requireDeveloper()` | Ручная валидация полей | `DEVELOPER_CREATED_PLATFORM_OWNER` | **НЕТ** (Кнопка в UI — заглушка без вызова) | **НЕ ПОДКЛЮЧЕНО** |
| `PATCH` | `/api/developer/platform-owners` | Блокировка/смена роли сотрудника платформы | `requireDeveloper()` | Проверка по `ALLOWED_PLATFORM_ROLES` | `DEVELOPER_MODIFIED_PLATFORM_OWNER` | **НЕТ** (Кнопка в UI — заглушка без вызова) | **НЕ ПОДКЛЮЧЕНО** |
| `GET` / `POST` | `/api/cron/cleanup` | Очистка просроченных rate limit и старых email outbox | `verifyCronSecret(req)` (CRON_SECRET) | Нет | Нет | Cron / Внешний триггер | **РАБОТАЕТ** |
| `GET` / `POST` | `/api/cron/email-outbox` | Фоновая досылка писем из очереди Outbox | `verifyCronSecret(req)` (CRON_SECRET) | Нет | Нет | Cron / Внешний триггер | **РАБОТАЕТ** |

### 3.2. Детальный разбор проблемных эндпоинтов

1. **Критическая ошибка модели в `POST /api/platform/announcements` ([`src/app/api/platform/announcements/route.ts:33-42`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/announcements/route.ts#L33-L42))**:
   Код пытается создать объявление с фиксированным `centerId: "PLATFORM"` и `authorId: session.user.id`. Однако в Prisma-схеме ([`prisma/schema.prisma:620-636`](file:///d:/AZIZ%20PROJECT/prisma/schema.prisma#L620-L636)) модель `Announcement` имеет обязательный внешний ключ `centerId -> LearningCenter.id` и `authorId -> CenterMembership.id`. Поскольку центра с ID `"PLATFORM"` не существует, а `authorId` суперадмина не является записью `CenterMembership`, любой реальный вызов данного API завершится необработанным исключением 500 (Foreign Key Constraint Violation). При этом UI для работы с данным эндпоинтом вообще отсутствует.
2. **Утеря ссылки первого входа в `POST /api/platform/centers` ([`src/app/api/platform/centers/route.ts:200-234`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts#L200-L234))**:
   Эндпоинт создает токен сброса пароля `resetToken`, генерирует `resetUrl = ${appUrl}/reset-password?token=${resetToken}` и отправляет его через почтовый транспорт. Но в возвращаемом JSON-ответе поле `resetUrl` отсутствует! В интерфейсе создания центра ([`src/app/platform-admin/centers/create/page.tsx:88-94`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/create/page.tsx#L88-L94)) ссылка также не перехватывается. Если SMTP-сервер недоступен или работает in-memory драйвер, суперадмин физически не может передать директору созданного центра ссылку для установки пароля.
3. **Отсутствие мутаций подписок в `/api/platform/subscriptions` ([`src/app/api/platform/subscriptions/route.ts:7-61`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/subscriptions/route.ts#L7-L61))**:
   Эндпоинт поддерживает исключительно метод `GET`. Ни суперадмин, ни автоматические процессы не имеют API для продления, заморозки, отмены или ручной смены тарифа существующей подписки тенанта.

---

## 4. БАЗА ДАННЫХ

### 4.1. Анализ моделей, связанных с платформой

| Модель Prisma | Поля | Кто читает (Reader) | Кто пишет (Writer) | Есть UI? | Есть API? | Статус |
|---|---|---|---|---|---|---|
| `PlatformUser` | id, email, phone, passwordHash, fullName, avatarUrl, platformRole, preferredLanguage, isActive, twoFactorEnabled, twoFactorSecret, createdAt, emailConfirmToken, emailConfirmExpires, emailVerified, updatedAt | `getAuthSession`, `/api/developer/platform-owners`, `/api/platform/centers` | `/api/platform/first-owner`, `/api/developer/platform-owners`, `/api/platform/centers` (создание директора), `/api/auth/*` | ДА | ДА | **РАБОТАЕТ** |
| `LearningCenter` | id, slug, name, centerType, status, suspensionReason, logoUrl, phone, email, brandingConfig, defaultLanguage, timeZone, gradingScale, ownerId, createdAt, updatedAt | `PlatformAdminDashboard`, `/api/platform/centers`, `requireTenantAccess` | `/api/platform/centers` (create), `/api/platform/centers/[id]` (patch), `/api/platform/centers/[id]/suspend` | ДА | ДА | **РАБОТАЕТ** |
| `SubscriptionPlan` | id, name, maxStudents, maxTeachers, maxCourses, maxBranches, maxStorage, priceMonthly, featuresJson, isActive, createdAt, updatedAt | `PlatformPlansPage`, `/api/platform/plans`, `/api/platform/analytics` | `POST /api/platform/plans`, `PATCH /api/platform/plans` | ДА | ДА | **РАБОТАЕТ** |
| `Subscription` | id, centerId, planId, status, trialEndsAt, currentPeriodStartsAt, currentPeriodEndsAt, autoRenew, createdAt, updatedAt | `PlatformSubscriptionsPage`, `/api/platform/subscriptions`, `/api/platform/analytics` | `POST /api/platform/centers` (при создании центра) | ДА (список) | ДА (только GET) | **ЧАСТИЧНО** (нет обновления/продления) |
| `PlatformPayment` | id, centerId, planId, subscriptionId, amount, currency, status, paymentMethod, paymentDate, recordedByUserId, invoiceNumber, comment, createdAt, updatedAt | Зарегистрирована в `db-tenant.ts:18` | Нет (модель создана в ACC-3, контроллеры не реализованы) | **НЕТ** | **НЕТ** | **НЕ ПОДКЛЮЧЕНО** |
| `PlatformExpense` | id, categoryId, amount, currency, expenseDate, description, recipient, paymentMethod, recordedByUserId, receiptUrl, isTaxDeductible, createdAt, updatedAt | Зарегистрирована в `db-tenant.ts:19` | Нет (модель создана в ACC-3, контроллеры не реализованы) | **НЕТ** | **НЕТ** | **НЕ ПОДКЛЮЧЕНО** |
| `PlatformExpenseCategory` | id, name, code, description, isTaxDeductible, isActive, createdAt, updatedAt | Зарегистрирована в `db-tenant.ts:20` | Нет (модель создана в ACC-3, контроллеры не реализованы) | **НЕТ** | **НЕТ** | **НЕ ПОДКЛЮЧЕНО** |
| `SupportTicket` | id, centerId, creatorUserId, subject, category, priority, status, createdAt, updatedAt | `PlatformSupportPage`, `/api/platform/support` | `PATCH /api/platform/support` (смена статуса), тикеты создаются в `/center` | ДА (список) | ДА | **ЧАСТИЧНО** |
| `TicketMessage` | id, ticketId, senderUserId, body, attachmentsJson, isInternal, createdAt | Эндпоинты тикетов внутри тенанта (`/api/center/support`) | Эндпоинты тикетов внутри тенанта | **НЕТ** (на платформе) | **НЕТ** (на платформе) | **НЕ ПОДКЛЮЧЕНО** |
| `AuditLog` | id, centerId, actorUserId, action, resource, resourceId, detailsJson, ipAddress, createdAt | `PlatformAuditLogPage`, `/api/developer/audit-logs`, `/api/platform/centers/[id]` | `logAuditEvent` в `src/lib/tenant.ts` | ДА | ДА | **РАБОТАЕТ** |
| `UserSession` | id, userId, jtiHash, expiresAt, revokedAt, lastSeenAt, ipAddress, userAgent, createdAt | `getAuthSession` ([`src/lib/auth.ts:186`](file:///d:/AZIZ%20PROJECT/src/lib/auth.ts#L186)) | `createSessionToken` ([`src/lib/auth.ts:106`](file:///d:/AZIZ%20PROJECT/src/lib/auth.ts#L106)), `/api/auth/logout` | НЕТ (системная) | ДА | **РАБОТАЕТ** |
| `LoginAttempt` | id, ip, email, attempts, lockoutUntil, createdAt, updatedAt | `/api/auth/login`, `/api/auth/mobile/login` | `/api/auth/login`, `/api/auth/mobile/login` | НЕТ (системная) | ДА | **РАБОТАЕТ** |
| `EmailOutbox` | id, to, subject, body, html, status, attempts, maxAttempts, lastError, nextRetryAt, sentAt, createdAt, updatedAt | `processEmailOutbox` ([`src/lib/email.ts:327`](file:///d:/AZIZ%20PROJECT/src/lib/email.ts#L327)) | `enqueueEmailOutbox` ([`src/lib/email.ts:277`](file:///d:/AZIZ%20PROJECT/src/lib/email.ts#L277)) | НЕТ | ДА (cron) | **РАБОТАЕТ** |
| `Notification` | id, centerId, userId, title, body, type, link, isRead, createdAt | Центровые страницы нотификаций | `sendNotification` ([`src/lib/notifications.ts:33`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L33)) | ДА (в центре) | ДА (в центре) | **РАБОТАЕТ** *(на уровне центров)* |

### 4.2. Ответы по специфическим полям и требованиям

1. **Center Type (Школа / Центр / Сад)**:
   - В схеме [`prisma/schema.prisma:1397-1401`](file:///d:/AZIZ%20PROJECT/prisma/schema.prisma#L1397-L1401) объявлен перечислимый тип:
     ```prisma
     enum CenterType {
       OFFLINE
       ONLINE
       HYBRID
     }
     ```
   - Разделения на "школу", "центр", "детский сад" **в коде и базе данных НЕТ**. Тип описывает исключительно формат обучения (офлайн, онлайн, гибрид). При создании центра на UI поле даже не выводится и всегда принимает значение по умолчанию `HYBRID`.
2. **Поле `username`**:
   - В модели `PlatformUser` ([`prisma/schema.prisma:16-33`](file:///d:/AZIZ%20PROJECT/prisma/schema.prisma#L16-L33)) поле `username` **отсутствует**. Идентификация пользователя производится строго по `email`.
3. **Вход по номеру телефона**:
   - В модели `PlatformUser` есть поле `phone String?`, но в схемах валидации аутентификации ([`src/lib/validation/auth.ts`](file:///d:/AZIZ%20PROJECT/src/lib/validation/auth.ts)), веб-контроллере [`src/app/api/auth/login/route.ts:27-28`](file:///d:/AZIZ%20PROJECT/src/app/api/auth/login/route.ts#L27-L28) и мобильном контроллере [`src/app/api/auth/mobile/login/route.ts:23-24`](file:///d:/AZIZ%20PROJECT/src/app/api/auth/mobile/login/route.ts#L23-L24) принимается **только email**. Вход по номеру телефона **НЕ РЕАЛИЗОВАН**.
4. **Поле `mustChangePassword`**:
   - В модели `PlatformUser` флаг принудительной смены пароля при первом входе **отсутствует**.
5. **Поле `lastLoginAt`**:
   - В модели `PlatformUser` поля `lastLoginAt` **нет**. Дата последней активности отслеживается только в связанной таблице сессий `UserSession.lastSeenAt` ([`prisma/schema.prisma:1473`](file:///d:/AZIZ%20PROJECT/prisma/schema.prisma#L1473)), обновляемой с троттлингом в 5 минут ([`src/lib/auth.ts:196-202`](file:///d:/AZIZ%20PROJECT/src/lib/auth.ts#L196-L202)).

---

## 5. ЧТО СУПЕРАДМИН МОЖЕТ СЕЙЧАС (СКВОЗНЫЕ СЦЕНАРИИ)

| № | Сценарий | Статус | Путь в интерфейсе (Click Path) и участвующие файлы | Детальное описание и ограничения |
|---|---|---|---|---|
| 1 | **Создать учебный центр** | **РАБОТАЕТ** *(с замечанием)* | Меню -> «Управление центрами» -> кнопка «Добавить центр» -> визард 4 шага (`/platform-admin/centers/create`). Файлы: [`CreateCenterPage.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/create/page.tsx), [`POST /api/platform/centers`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts). | Создает организацию, привязывает директора, создает триальную подписку на 14 дней и токен сброса пароля. **Ограничение:** Ссылка сброса пароля не отображается в UI, отправляется только по почте (если настроен SMTP). |
| 2 | **Заблокировать / приостановить / разблокировать центр** | **РАБОТАЕТ** | Меню -> «Управление центрами» -> клик по центру -> вкладка «Статус и блокировка» (`/platform-admin/centers/[id]`). Файлы: [`PlatformCenterDetailsPage.tsx:122-141`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/[id]/page.tsx#L122-L141), [`POST /api/platform/centers/[id]/suspend`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/[id]/suspend/route.ts). | Позволяет перевести центр в `PAUSED`, `BLOCKED` или вернуть в `ACTIVE` с обязательным указанием причины (от 5 до 500 символов). Пишет событие в `AuditLog`. |
| 3 | **Сменить директора центра** | **РАБОТАЕТ** | Меню -> «Управление центрами» -> карточка центра -> вкладка «Директор» (`/platform-admin/centers/[id]`). Файлы: [`PlatformCenterDetailsPage.tsx:105-120`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/centers/[id]/page.tsx#L105-L120), [`POST /api/platform/centers/[id]/director`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/[id]/director/route.ts). | Деактивирует членство предыдущего директора, находит/создает нового пользователя, назначает роль `DIRECTOR` и обновляет `ownerId` центра. Высылает письмо с инвайтом/сбросом. |
| 4 | **Создать пользователя внутри чужого центра** | **РАБОТАЕТ** *(только через имперсонацию)* | В платформенной панели прямой кнопки нет. Путь: В карточке центра нажать «Войти как» (`ImpersonateButton`) -> переход в `/center` директором -> меню центра «Учителя» / «Студенты» -> создание пользователя. Файлы: [`ImpersonateButton.tsx`](file:///d:/AZIZ%20PROJECT/src/components/ImpersonateButton.tsx), [`POST /api/platform/impersonate`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/impersonate/route.ts). | Прямого платформенного API для создания учеников/учителей чужого центра нет; операция доступна только в режиме работы под директором тенанта. |
| 5 | **Посмотреть пароль / сбросить пароль / сгенерировать временный** | **НЕ МОЖЕТ** | Нет интерфейса и API. | Пароли хешируются `bcrypt` (просмотр невозможен в принципе). Кнопки ручной генерации временного пароля или инициации сброса пароля конкретного пользователя из админки **нет**. Пользователь может сбросить пароль только самостоятельно через `/forgot-password`. |
| 6 | **Создать / изменить тарифный план** | **РАБОТАЕТ** | Меню -> «Тарифные планы» (`/platform-admin/plans`) -> кнопка «Добавить тариф» или иконка редактирования тарифа. Файлы: [`PlatformPlansPage.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/plans/page.tsx), [`POST/PATCH /api/platform/plans`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/plans/route.ts). | Позволяет создавать и менять лимиты студентов, учителей, курсов, филиалов, объема диска, ежемесячной цены и активности тарифа. Логируется в `AuditLog`. |
| 7 | **Назначить тариф / продлить подписку / сменить тариф центра** | **НЕ МОЖЕТ** | На `/platform-admin/subscriptions` отображается только таблица. В карточке центра вкладки биллинга нет. | Начальный тариф назначается только при создании центра ([`src/app/api/platform/centers/route.ts:161-177`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts#L161-L177)). После создания нет ни UI, ни API эндпоинта для продления срока подписки или перевода существующего центра на другой тариф! |
| 8 | **Посмотреть платежи / MRR / выручку платформы** | **ЧАСТИЧНО** | Дашборд `/platform-admin`. Файлы: [`PlatformAdminDashboard`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/page.tsx), [`GET /api/platform/analytics`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/analytics/route.ts). | Эндпоинт `/api/platform/analytics` агрегирует MRR и ARR по активным подпискам, но **UI дашборда не выводит карточку MRR/выручки**! Таблица реальных оплат аренды `PlatformPayment` из ACC-3 не имеет интерфейса и контроллеров. |
| 9 | **Войти под директором центра (impersonation)** | **РАБОТАЕТ** *(с двумя дефектами)* | Дашборд `/platform-admin` или реестр центров -> кнопка «Войти как» в строке центра. Файлы: [`ImpersonateButton.tsx`](file:///d:/AZIZ%20PROJECT/src/components/ImpersonateButton.tsx), [`POST /api/platform/impersonate`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/impersonate/route.ts). | Выпускает сессионный токен директора, логирует `PLATFORM_IMPERSONATION_STARTED` и редиректит в `/center`. **Дефекты:** 1) Ссылка в сайдбаре ведет на 404; 2) В интерфейсе `/center` отсутствует плашка возврата в аккаунт суперадмина (требуется полный логаут и повторный вход). |
| 10 | **Ответить в тикет поддержки** | **ЧАСТИЧНО** | Меню -> «Поддержка» (`/platform-admin/support`). Файлы: [`PlatformSupportPage.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/support/page.tsx), [`PATCH /api/platform/support`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/support/route.ts). | Суперадмин может переключать статусы (`В работу`, `Решено`, `Закрыть`). Однако **просмотреть текст обращения, переписку и отправить ответ невозможно** — нет интерфейса просмотра тикета и сообщений. |
| 11 | **Посмотреть аудит-лог действий** | **РАБОТАЕТ** | Меню -> «Аудит-лог» (`/platform-admin/audit`) либо через панель разработчика (`/developer/audit`). Файлы: [`PlatformAuditLogPage.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/audit/page.tsx), [`GlobalAuditLogsPage.tsx`](file:///d:/AZIZ%20PROJECT/src/app/developer/audit/page.tsx). | Выводит историю системных событий с фильтрацией: кто совершил действие, IP-адрес, тип ресурса, JSON-детали операции. Доступно только суперадмину и разработчику. |
| 12 | **Создать / заблокировать администратора платформы** | **ЧАСТИЧНО** *(API готово, UI заглушка)* | Переход в `/developer/owners`. Файлы: [`PlatformOwnersPage.tsx`](file:///d:/AZIZ%20PROJECT/src/app/developer/owners/page.tsx), [`src/app/api/developer/platform-owners/route.ts`](file:///d:/AZIZ%20PROJECT/src/app/api/developer/platform-owners/route.ts). | API полностью реализовано (`POST` создает `PLATFORM_ADMIN`/`PLATFORM_SUPPORT`, `PATCH` блокирует/меняет роль). Но в UI на странице `/developer/owners` кнопки являются пустыми заглушками без обработчиков. |
| 13 | **Выгрузить бэкап данных / экспорт базы** | **НЕ МОЖЕТ** | Нет функционала. | В кодовой базе отсутствуют какие-либо эндпоинты, скрипты или кнопки для резервного копирования или экспорта базы данных на уровне платформы. |

---

## 6. ИНТЕГРАЦИИ И ЗАГЛУШКИ

### 6.1. Реестр заглушек, моков и недописанного кода (TODO/FIXME)

| Файл и строки | Суть интеграции / заглушки | Что делает текущий код | Что требуется для production |
|---|---|---|---|
| [`src/lib/notifications.ts:49-59`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L49-L59) | Email Transporter для системных уведомлений | Выводит в консоль: `console.log("📧 [Email Driver] Sending email to ...")` | Подключение реального SMTP/Nodemailer или Resend API |
| [`src/lib/notifications.ts:62-71`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L62-L71) | SMS-интеграция для Узбекистана (Eskiz.uz) | Выводит в консоль: `console.log("📱 [SMS Driver (Eskiz.uz)] Sending SMS to ...")` | Реальный HTTP-клиент к `https://notify.eskiz.uz/api/message/sms/send` с токеном авторизации |
| [`src/lib/email.ts:187-212`](file:///d:/AZIZ%20PROJECT/src/lib/email.ts#L187-L212) | Почтовый транспорт платформы (`sendEmail`) | По умолчанию `EMAIL_PROVIDER="memory"` — сохраняет отправленные письма в локальный JS-массив `sentEmailsBuffer` в ОЗУ | Установка переменной `EMAIL_PROVIDER=resend` и `RESEND_API_KEY` в проде |
| [`src/app/api/developer/health/route.ts:17-24`](file:///d:/AZIZ%20PROJECT/src/app/api/developer/health/route.ts#L17-L24) | Мониторинг кэша Redis | Хардкод: `const redisPing = "N/A"`, `redisStatus: "N/A"` | Подключение реального клиента `ioredis` / Upstash и отправка команды `PING` |
| Оплата аренды платформы (Click / Payme / Uzum) | Платежные шлюзы для оплат подписок LMS центрами | **Полностью отсутствуют**. В проекте нет ни SDK, ни вебхуков для приема онлайн-платежей в сумах | Разработка модулей вебхуков Click Merchant API, Payme Subscribe API, Uzum Pay API |
| [`src/app/platform-admin/seo/page.tsx:37-77`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/seo/page.tsx#L37-L77) | SEO-панель управления метатегами | Статические захардкоженные строки ("AcademiaSaaS..."), кнопка без действия | Создание модели `PlatformSettings` в БД и подключение API чтения/записи |
| [`src/app/developer/owners/page.tsx:37, 92`](file:///d:/AZIZ%20PROJECT/src/app/developer/owners/page.tsx#L37) | Управление штатом администраторов платформы | Кнопки добавления и настройки не имеют обработчиков событий | Подключение модальных форм к существующим `POST/PATCH /api/developer/platform-owners` |

### 6.2. Расписание фоновых задач (Cron)
В конфигурации [`vercel.json:1-14`](file:///d:/AZIZ%20PROJECT/vercel.json#L1-L14) настроены 2 cron-задачи:
1. `0 3 * * *` — `/api/cron/email-outbox` (запуск **раз в сутки в 03:00 UTC**).
   - Обрабатывает таблицу `EmailOutbox` пачками по 50 записей ([`src/app/api/cron/email-outbox/route.ts:11`](file:///d:/AZIZ%20PROJECT/src/app/api/cron/email-outbox/route.ts#L11)).
   - **Проблема архитектуры:** Если отправка письма со ссылкой для входа новому директору упала в Outbox, повторная попытка произойдет только в 3 часа ночи следующих суток! Для почтовой очереди интервал должен составлять 1–5 минут.
2. `0 4 * * *` — `/api/cron/cleanup` (запуск раз в сутки в 04:00 UTC).
   - Очищает истекшие записи `RateLimit` и удаляет письма из `EmailOutbox` старше 30 дней.

### 6.3. Реальность отправки почты и сброса паролей
- При создании центра ([`src/app/api/platform/centers/route.ts:217-227`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts#L217-L227)) вызывается `sendEmailWithOutbox`.
- Если `EMAIL_PROVIDER` не задан в `.env`, он принимает значение `"memory"`. Функция `sendEmail` считает отправку успешной (`queued: false`) и просто складывает письмо в оперативную память процесса. В таблицу `EmailOutbox` письмо **даже не попадает**, так как ошибки не возникло!
- При этом сгенерированный токен `resetToken` хешируется в таблице `PasswordResetToken` алгоритмом SHA-256 ([`src/app/api/platform/centers/route.ts:189`](file:///d:/AZIZ%20PROJECT/src/app/api/platform/centers/route.ts#L189)). Исходный токен восстановить из базы **невозможно**.
- **Результат:** При стандартном развертывании без внешнего почтового сервиса директор не получает письмо, а суперадмин не может увидеть сгенерированную ссылку в интерфейсе.

---

## 7. ТЕСТЫ И КАЧЕСТВО

### 7.1. Покрытие тестами функционала SUPERADMIN
В каталоге `tests/` имеется развитый набор тестов платформенного уровня:

| Тестовый файл | Что проверяет |
|---|---|
| [`tests/platform-access.test.ts`](file:///d:/AZIZ%20PROJECT/tests/platform-access.test.ts) | Защита маршрутов `/platform-admin/*` и изоляция ролей |
| [`tests/platform-impersonation.test.ts`](file:///d:/AZIZ%20PROJECT/tests/platform-impersonation.test.ts) | Полный сквозной цикл имперсонации директора, выпуск токенов, аудит |
| [`tests/acc-platform-impersonation.test.ts`](file:///d:/AZIZ%20PROJECT/tests/acc-platform-impersonation.test.ts) | Запрет прямого доступа суперадмина к финансам центра и режим Read-Only при имперсонации |
| [`tests/platform-organizations.test.ts`](file:///d:/AZIZ%20PROJECT/tests/platform-organizations.test.ts) | Создание учебного центра через API, валидация slug, транзакционность |
| [`tests/platform-organizations-suspension.test.ts`](file:///d:/AZIZ%20PROJECT/tests/platform-organizations-suspension.test.ts) | Приостановка, блокировка центров и требование указания причины |
| [`tests/platform-plans-subscriptions.test.ts`](file:///d:/AZIZ%20PROJECT/tests/platform-plans-subscriptions.test.ts) | CRUD тарифных планов и проверка фильтрации подписок |
| [`tests/platform-support-audit.test.ts`](file:///d:/AZIZ%20PROJECT/tests/platform-support-audit.test.ts) | Чтение тикетов, обновление статуса, чтение аудит-логов |
| [`tests/developer-access.test.ts`](file:///d:/AZIZ%20PROJECT/tests/developer-access.test.ts) | Проверка доступа к dev-панели и эндпоинтам разработчика |
| [`tests/first-platform-owner.test.ts`](file:///d:/AZIZ%20PROJECT/tests/first-platform-owner.test.ts) | Инициализация первого суперадмина на `/setup` |

### 7.2. Белые пятна в тестовом покрытии
1. Нет e2e/интеграционных тестов на попытку редактирования/продления подписок центров (поскольку функционал не реализован).
2. Нет тестов на эндпоинт `POST /api/platform/announcements` — если бы такой тест был написан, он сразу бы выявил падение с ошибкой Foreign Key Constraint.
3. Нет компонентных тестов на работу с интерфейсом управления администраторами (`/developer/owners`).

### 7.3. Результаты статического анализа
1. **TypeScript (`npx tsc --noEmit`)**:
   - Ошибок компиляции: **0 ошибок**.
2. **ESLint (`npm run lint`)**:
   - Ошибок линтера: **0 ошибок**.
   - Предупреждений: **7 предупреждений** (использование тегов `<img>` вместо `next/image` в лендинге, пропущенная зависимость `useEffect` в `notifications/page.tsx`, загрузка шрифта в `layout.tsx`).

---

## 8. СВОДКА

### 8.1. Сводная таблица статусов

| Область аудита | РАБОТАЕТ | ЧАСТИЧНО | ЗАГЛУШКА | НЕ ПОДКЛЮЧЕНО | ДУБЛЬ / МЁРТВЫЙ КОД | ВСЕГО |
|---|---|---|---|---|---|---|
| **Экраны (UI)** | 9 | 2 | 1 | 0 | 7 | 19 |
| **API Эндпоинты** | 16 | 0 | 0 | 4 | 1 | 21 |
| **Модели БД** | 8 | 2 | 0 | 3 | 1 | 14 |
| **Сквозные сценарии** | 5 | 4 | 0 | 0 | 4 *(не может)* | 13 |

### 8.2. Топ-15 функциональных разрывов и пробелов

1. **Невозможно продлить или изменить подписку центра (Размер: M)**  
   Модель `Subscription` имеет только чтение. Суперадмин не может продлить триал, активировать оплату или изменить тариф действующего центра ни через UI, ни через API.
2. **Битая ссылка в сайдбаре `/platform-admin/impersonate` (Размер: S)**  
   Пункт в навигационном меню ведет на несуществующую страницу (404 ошибка).
3. **Отсутствие плашки выхода из режима имперсонации (Размер: M)**  
   После входа в аккаунт директора суперадмин не имеет кнопки «Вернуться в панель управления платформой» в интерфейсе `/center`. Приходится делать полный логаут.
4. **Невозможность прочитать текст тикетов поддержки и ответить (Размер: M)**  
   В `/platform-admin/support` можно только менять статусы тикетов. Просмотр переписки и отправка ответов со стороны платформы не реализованы.
5. **Потеря ссылки первичного сброса пароля директора при создании центра (Размер: S)**  
   `POST /api/platform/centers` не отдает `resetUrl` в ответе API, а визард создания центра не отображает ссылку на экране. При отсутствии настроенного SMTP директор не может войти.
6. **Падение с ошибкой эндпоинта `POST /api/platform/announcements` (Размер: S)**  
   Контроллер пытается записать `centerId: "PLATFORM"`, что нарушает ограничение внешнего ключа в БД PostgreSQL.
7. **Отсутствие UI для создания платформенных администраторов (Размер: S)**  
   На странице `/developer/owners` кнопки «Add Administrator» и «Configure» являются заглушками без обработчиков событий, хотя бэкенд API полностью готов.
8. **Экраны и API для моделей платформенных финансов ACC-3 не созданы (Размер: L)**  
   Модели `PlatformPayment`, `PlatformExpense`, `PlatformExpenseCategory` добавлены в схему БД, но не имеют ни одного маршрута API и страниц в UI.
9. **Виджет MRR/выручки отсутствует на дашборде (Размер: S)**  
   API `/api/platform/analytics` считает MRR/ARR, но компонент `PlatformAdminDashboard` не выводит эти финансовые метрики в интерфейсе.
10. **Заглушка экрана SEO `/platform-admin/seo` (Размер: S)**  
    Форма содержит захардкоженные значения, кнопка сохранения не работает, модель настроек в БД отсутствует.
11. **Почтовая очередь Outbox настроена на запуск раз в сутки (Размер: S)**  
    В `vercel.json` крон `/api/cron/email-outbox` запускается раз в день в 03:00. При сбое отправки письмо будет ожидать до 24 часов вместо 1-2 минут.
12. **Размытие прав: доступ SUPERADMIN к технической панели DEVELOPER (Размер: S)**  
    Хелпер `requireDeveloper()` и лэйаут `/developer/layout.tsx` разрешают доступ роли `SUPERADMIN`, стирая разграничение между техническим и коммерческим администрированием.
13. **Отсутствие роли DEVELOPER в лэйауте `/platform-admin` (Размер: S)**  
    В [`src/app/platform-admin/layout.tsx`](file:///d:/AZIZ%20PROJECT/src/app/platform-admin/layout.tsx) роль `DEVELOPER` забыта в списке разрешенных, из-за чего разработчик перенаправляется на `/center`.
14. **Дублирующие редирект-маршруты `/platform/*` (Размер: S)**  
    Шесть устаревших файлов страниц в папке `src/app/platform/` дублируют функционал `src/app/platform-admin/`, создавая технический долг.
15. **Отсутствие функционала бэкапа и экспорта данных (Размер: L)**  
    На платформенном уровне нет средств выгрузки дампов базы данных или экспорта сводных реестров тенантов в CSV/Excel.

### 8.3. Риски безопасности

1. **Неконтролируемое повышение привилегий до уровня инфраструктуры (Privilege Escalation):**  
   Из-за проверки в [`src/lib/platformAuth.ts:31`](file:///d:/AZIZ%20PROJECT/src/lib/platformAuth.ts#L31) (`role === "DEVELOPER" || role === "SUPERADMIN"`) коммерческий управляющий имеет доступ к просмотру серверных метрик памяти, пингу БД и списку учетных записей разработчиков.
2. **Отсутствие проверки прав в Middleware:**  
   Поскольку `src/middleware.ts` не проверяет JWT-токены на платформенных URL, безопасность полностью зависит от корректности вызова `getAuthSession()` в каждом отдельном RSC-файле или Route Handler.
3. **Застревание суперадмина в сессии имперсонации:**  
   Перезапись куки `auth_token` сессией директора без сохранения исходного токена платформы не позволяет безопасно вернуться назад, что вынуждает пользователей хранить пароли суперадмина в открытом доступе для частых повторных логинов.

### 8.4. Вопросы пользователю

1. **Биллинг подписок:** Планируется ли интеграция онлайн-эквайринга (Click, Payme, Uzum) для автоматического продления подписок учебными центрами, или суперадмину требуется ручной интерфейс выставления счетов и пролонгации?
2. **Разделение DEVELOPER и SUPERADMIN:** Должен ли `SUPERADMIN` иметь доступ к технической Dev-панели (`/developer`), или его нужно строго ограничить коммерческим контуром `/platform-admin`?
3. **Доставка транзакционной почты:** Какой провайдер транзакционных писем планируется в проде (Resend, локальный SMTP-сервер учебного центра, узбекский почтовый шлюз), и нужно ли временно выводить ссылки первичного сброса пароля прямо в интерфейс админки при создании центра?
4. **Тикеты поддержки:** Требуется ли полноценный чат с директором центра прямо внутри платформенной панели поддержки, или поддержка будет переведена на внешний канал (например, Telegram-бот)?

---

## ОГЛАВЛЕНИЕ

1. [ПРАВА И ДОСТУП](#1-права-и-доступ)
   - [1.1. Значения PlatformRole в Prisma и в коде](#11-значения-platformrole-в-prisma-и-в-коде)
   - [1.2. Отличия SUPERADMIN от других платформенных ролей](#12-отличия-superadmin-от-других-платформенных-ролей)
   - [1.3. Гранулярные права в src/lib/permissions.ts (Активные vs Декоративные)](#13-гранулярные-права-в-srclibpermissionsts-активные-vs-декоративные)
   - [1.4. Гарды и защита страниц / API](#14-гарды-и-защита-страниц--api)
   - [1.5. Сквозной доступ к тенантам и аудит](#15-сквозной-доступ-к-тенантам-и-аудит)
2. [ЭКРАНЫ (UI)](#2-экраны-ui)
   - [2.1. Сводная таблица всех маршрутов, доступных SUPERADMIN](#21-сводная-таблица-всех-маршрутов-доступных-superadmin)
   - [2.2. Анализ виджетов дашборда /platform-admin](#22-анализ-виджетов-дашборда-platform-admin)
   - [2.3. Битые ссылки, заглушки и мертвые кнопки в интерфейсе](#23-битые-ссылки-заглушки-и-мертвые-кнопки-в-интерфейсе)
3. [API ЭНДПОИНТЫ](#3-api-эндпоинты)
   - [3.1. Сводная таблица платформенных эндпоинтов](#31-сводная-таблица-платформенных-эндпоинтов)
   - [3.2. Детальный разбор проблемных эндпоинтов](#32-детальный-разбор-проблемных-эндпоинтов)
4. [БАЗА ДАННЫХ](#4-база-данных)
   - [4.1. Анализ моделей, связанных с платформой](#41-анализ-моделей-связанных-с-платформой)
   - [4.2. Ответы по специфическим полям и требованиям](#42-ответы-по-специфическим-полям-и-требованиям)
5. [ЧТО СУПЕРАДМИН МОЖЕТ СЕЙЧАС (СКВОЗНЫЕ СЦЕНАРИИ)](#5-что-суперадмин-может-сейчас-сквозные-сценарии)
6. [ИНТЕГРАЦИИ И ЗАГЛУШКИ](#6-интеграции-и-заглушки)
   - [6.1. Реестр заглушек, моков и недописанного кода (TODO/FIXME)](#61-реестр-заглушек-моков-и-недописанного-кода-todofixme)
   - [6.2. Расписание фоновых задач (Cron)](#62-расписание-фоновых-задач-cron)
   - [6.3. Реальность отправки почты и сброса паролей](#63-реальность-отправки-почты-и-сброса-паролей)
7. [ТЕСТЫ И КАЧЕСТВО](#7-тесты-и-качество)
   - [7.1. Покрытие тестами функционала SUPERADMIN](#71-покрытие-тестами-функционала-superadmin)
   - [7.2. Белые пятна в тестовом покрытии](#72-белые-пятна-в-тестовом-покрытии)
   - [7.3. Результаты статического анализа](#73-результаты-статического-анализа)
8. [СВОДКА](#8-сводка)
   - [8.1. Сводная таблица статусов](#81-сводная-таблица-статусов)
   - [8.2. Топ-15 функциональных разрывов и пробелов](#82-топ-15-функциональных-разрывов-и-пробелов)
   - [8.3. Риски безопасности](#83-риски-безопасности)
   - [8.4. Вопросы пользователю](#84-вопросы-пользователю)
