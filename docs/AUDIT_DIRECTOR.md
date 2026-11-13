# АУДИТ РОЛЕЙ DIRECTOR И CENTER_ADMIN (e-darschi LMS)

> **Дата аудита:** 11 ноября 2026 г.  
> **Режим:** Read-Only аудит кодовой базы без изменения бизнес-логики приложения.  
> **Объект аудита:** Роль директора (`CenterRole.DIRECTOR`) и сравнительный анализ роли администратора центра (`CenterRole.CENTER_ADMIN`).  
> **Статусы компонентов:** `РАБОТАЕТ`, `ЧАСТИЧНО`, `ЗАГЛУШКА`, `НЕ ПОДКЛЮЧЕНО`, `ДУБЛЬ / МЁРТВЫЙ КОД`.

---

## 1. ПРАВА И ДОСТУП

### 1.1. Матрица CENTER_ROLE_PERMISSIONS: DIRECTOR vs CENTER_ADMIN
Система разграничения прав определена в [`src/lib/permissions.ts:295-336`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L295-L336).

| Право (Permission) | DIRECTOR | CENTER_ADMIN | Реально проверяется в коде | Статус проверки |
|---|:---:|:---:|---|---|
| `students.read` | ✅ | ✅ | `src/app/api/students/route.ts:63` | РАБОТАЕТ (через tenantCtx.role) |
| `students.create` | ✅ | ✅ | `src/app/api/students/route.ts:163` | РАБОТАЕТ |
| `students.update` | ✅ | ✅ | `src/app/api/groups/[id]/transfer/route.ts:14` | РАБОТАЕТ |
| `students.delete` | ✅ | ❌ | `src/app/api/tenant/staff/route.ts:335` | ЧАСТИЧНО (в API удаляет и студентов, и staff) |
| `grades.read` | ✅ | ✅ | `src/app/center/grades/page.tsx:29` | РАБОТАЕТ |
| `grades.create` | ✅ | ✅ | `src/app/api/grades/route.ts` | РАБОТАЕТ |
| `grades.update` | ✅ | ✅ | `src/app/api/grades/route.ts` | РАБОТАЕТ |
| `grades.finalize` | ✅ | ❌ | `src/app/api/grades/finalize/route.ts` | РАБОТАЕТ |
| `grades.delete` | ✅ | ❌ | `src/app/api/grades/route.ts` | ЧАСТИЧНО (API delete ограничен) |
| `attendance.read` | ✅ | ✅ | `src/app/center/attendance/page.tsx:26` | РАБОТАЕТ |
| `attendance.mark` | ✅ | ✅ | `src/app/api/attendance/route.ts` | РАБОТАЕТ |
| `attendance.update` | ✅ | ✅ | `src/app/api/attendance/route.ts` | РАБОТАЕТ |
| `assignments.read` | ✅ | ✅ | `src/app/center/homework/page.tsx:26` | РАБОТАЕТ |
| `assignments.create` | ✅ | ✅ | `src/app/api/homework/route.ts` | РАБОТАЕТ |
| `assignments.review` | ✅ | ✅ | `src/app/center/homework/page.tsx` | РАБОТАЕТ |
| `assignments.grade` | ✅ | ✅ | `src/app/api/homework/submissions/[id]/route.ts` | РАБОТАЕТ |
| `groups.read` | ✅ | ✅ | `src/app/center/groups/page.tsx:15` | РАБОТАЕТ |
| `groups.create` | ✅ | ✅ | `src/app/api/groups/route.ts` | РАБОТАЕТ |
| `groups.manage` | ✅ | ✅ | `src/app/api/groups/[id]/route.ts` | РАБОТАЕТ |
| `courses.read` | ✅ | ✅ | `src/app/center/courses/page.tsx:15` | РАБОТАЕТ |
| `courses.create` | ✅ | ✅ | `src/app/api/courses/route.ts:46` | РАБОТАЕТ |
| `courses.manage` | ✅ | ✅ | `src/app/api/courses/[id]/route.ts` | РАБОТАЕТ |
| `schedule.read` | ✅ | ✅ | `src/app/center/schedule/page.tsx:21` | РАБОТАЕТ |
| `schedule.create` | ✅ | ✅ | `src/app/api/tenant/schedule/route.ts` | РАБОТАЕТ |
| `schedule.manage` | ✅ | ✅ | `src/app/api/tenant/schedule/route.ts` | РАБОТАЕТ |
| `payments.read` | ✅ | ✅ | `src/app/center/payments/page.tsx:33` | РАБОТАЕТ |
| `payments.manage` | ✅ | ✅ | `src/app/api/center-payments/route.ts` | РАБОТАЕТ |
| `payments.refund` | ✅ | ❌ | `src/app/api/platform/finance/payments/[id]/refund/route.ts` | ДЕКОРАТИВНОЕ (на уровне центра возвраты не подключены в UI) |
| `finance.read` | ✅ | ✅ | `src/app/api/finance/*` | РАБОТАЕТ в API, в UI не подключено |
| `finance.write` | ✅ | ✅ | `src/app/api/finance/transactions/route.ts` | РАБОТАЕТ в API, в UI не подключено |
| `finance.storno` | ✅ | ❌ | `src/app/api/finance/transactions/[id]/reverse/route.ts` | РАБОТАЕТ в API, в UI не подключено |
| `finance.period.close` | ✅ | ❌ | `src/app/api/finance/periods/route.ts` | РАБОТАЕТ в API, в UI не подключено |
| `finance.export` | ✅ | ❌ | `src/app/api/finance/export/route.ts` | РАБОТАЕТ в API, в UI не подключено |
| `reports.read` | ✅ | ✅ | `src/app/center/reports/page.tsx:17` | РАБОТАЕТ |
| `reports.export` | ✅ | ✅ | — | ДЕКОРАТИВНОЕ (нет кнопки экспорта отчетов в UI) |
| `users.read` | ✅ | ✅ | `src/app/api/tenant/staff/route.ts:21` | РАБОТАЕТ |
| `users.create` | ✅ | ✅ | `src/app/api/tenant/staff/route.ts:67` | РАБОТАЕТ (с ограничением ролей) |
| `users.manage` | ✅ | ✅ | `src/app/api/tenant/staff/route.ts:220` | РАБОТАЕТ |
| `users.block` | ✅ | ❌ | `src/app/api/tenant/staff/route.ts:250` | ЧАСТИЧНО (деактивация статусом INACTIVE) |
| `announcements.read` | ✅ | ✅ | `src/app/center/announcements/page.tsx:31` | РАБОТАЕТ |
| `announcements.create`| ✅ | ✅ | `src/app/api/tenant/announcements/route.ts:99` | РАБОТАЕТ в API, в UI нет формы |
| `announcements.manage`| ✅ | ✅ | `src/app/api/tenant/announcements/route.ts` | РАБОТАЕТ в API, в UI нет кнопок |
| `materials.read` | ✅ | ✅ | `src/app/api/materials/route.ts` | НЕ ПОДКЛЮЧЕНО (в UI нет экрана) |
| `materials.upload` | ✅ | ✅ | `src/app/api/materials/route.ts` | НЕ ПОДКЛЮЧЕНО (в UI нет экрана) |
| `materials.manage` | ✅ | ✅ | `src/app/api/materials/route.ts` | НЕ ПОДКЛЮЧЕНО (в UI нет экрана) |
| `branches.read` | ✅ | ✅ | `src/app/center/branches/page.tsx:18` | РАБОТАЕТ |
| `branches.manage` | ✅ | ❌ | `src/app/api/tenant/branches/route.ts:31` | ЧАСТИЧНО (в коде разрешено и CENTER_ADMIN) |
| `settings.read` | ✅ | ✅ | — | ДЕКОРАТИВНОЕ (экрана настроек центра нет) |
| `settings.manage` | ✅ | ❌ | — | ДЕКОРАТИВНОЕ (настройки центра меняет платформа) |
| `audit.read` | ✅ | ❌ | `src/lib/permissions.ts:313` | ДЕКОРАТИВНОЕ (нет экрана аудита центра в UI) |
| `invites.read` | ✅ | ✅ | `src/components/InvitesManager.tsx:50` | РАБОТАЕТ |
| `invites.create` | ✅ | ✅ | `src/app/api/invites/generate/route.ts:24` | РАБОТАЕТ |
| `invites.manage` | ✅ | ✅ | `src/app/center/invites/page.tsx` | РАБОТАЕТ |
| `support.read` | ✅ | ✅ | `src/app/center/support/page.tsx:21` | РАБОТАЕТ |
| `support.create` | ✅ | ✅ | `src/app/api/tickets/route.ts` | РАБОТАЕТ |

### 1.2. Ключевые различия: DIRECTOR vs CENTER_ADMIN
1. **Управление административным персоналом ([`src/app/api/tenant/staff/route.ts:94-98, 259-266, 380-386`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L94-L98)):**
   - `DIRECTOR` может создавать, изменять и удалять пользователей с ролями `CENTER_ADMIN` и `ACCOUNTANT`.
   - `CENTER_ADMIN` не имеет права создавать других `CENTER_ADMIN` или `ACCOUNTANT`, не может менять их роли и не может их удалять.
2. **Финансовая дисциплина и бухгалтерское сторно ([`src/app/api/finance/transactions/[id]/reverse/route.ts:20-25`](file:///d:/AZIZ%20PROJECT/src/app/api/finance/transactions/[id]/reverse/route.ts#L20-L25), [`src/app/api/finance/periods/route.ts:40`](file:///d:/AZIZ%20PROJECT/src/app/api/finance/periods/route.ts#L40)):**
   - Только `DIRECTOR` обладает правами `finance.storno`, `finance.period.close`, `finance.export`.
   - `CENTER_ADMIN` имеет доступ только на чтение и добавление рядовых проводок (`finance.read`, `finance.write`).
3. **Финальная фиксация оценок ([`src/lib/permissions.ts:299 vs 320`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L299)):**
   - Только `DIRECTOR` наделен правом `grades.finalize` и `grades.delete`.
4. **Невозможность удаления/деактивации директора ([`src/app/api/tenant/staff/route.ts:250, 372`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L250)):**
   - `DIRECTOR` защищен программным запретом на деактивацию и удаление. Ни `CENTER_ADMIN`, ни сам директор не могут случайно удалить аккаунт владельца центра без назначения преемника (`SOLE_DIRECTOR_CONFLICT`).

### 1.3. Защита маршрутов `/center/*` и API
1. **Защита страниц (`src/app/center/layout.tsx:25-75`):**
   - Серверный `getAuthSession()` проверяет наличие действующего JWT-токена в cookies/headers. Неавторизованные пользователи безусловно редиректятся на `/login`.
   - Проверка `session.user.mustChangePassword`: если флаг активен, принудительный редирект на `/account/change-password`.
   - Проверка наличия активного членства: если у пользователя нет ни одного членства в `CenterMembership`, рендерится заглушка выбора центра со ссылкой на `/onboarding`.
   - `requireTenantPageAccess()` из [`src/lib/tenant.ts:259`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L259) валидирует членство в базе данных и статус центра.
2. **Защита API (`requireTenantAccess` в `src/lib/tenant.ts:98-257`):**
   - Проверяет аутентификацию через `getAuthSession(req)`.
   - Проверяет верификацию email: `session.user.emailVerified` обязателен (иначе 403 `EMAIL_NOT_VERIFIED`).
   - Проверяет наличие записи `CenterMembership` со статусом `ACTIVE` в таблице БД (иначе 403 `MEMBERSHIP_INACTIVE`).
   - Возвращает инкапсулированный клиент `getTenantDb()`, который через Prisma Client Extension или scoped-запросы принудительно внедряет фильтрацию по `centerId`.
3. **Финансовая изоляция (`requireFinanceTenantAccess` в `src/lib/tenant.ts:274-352`):**
   - Маршруты `/api/finance/*` закрыты даже от сотрудников платформы (`SUPERADMIN`, `DEVELOPER`) без явной сессии имперсонации с аудитом `FINANCE_IMPERSONATION_READ`.
4. **Риски утечек между центрами:**
   - **Выявленный риск:** В эндпоинтах, где `centerId` принимается из тела запроса (`req.json()`) вместо принудительного использования `tenantCtx.center.id`, существует риск попытки манипуляции идентификатором. В проверенных маршрутах (`/api/students`, `/api/groups`, `/api/tenant/branches`, `/api/tenant/staff`, `/api/center-payments`) везде используется `tenantCtx.center.id`, что исключает межтенантные утечки.

### 1.4. Поведение при статусах центра (TRIAL / OVERDUE / PAUSED / BLOCKED)
Ограничение статусов описано в [`src/lib/tenant.ts:70, 235-244`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L70):
```ts
export const CENTER_SUSPENDED_STATUSES = ["BLOCKED", "CANCELLED", "PAUSED", "OVERDUE"] as const;
```
- **TRIAL:** Не входит в список приостановленных. Директор видит всю функциональность в полном объеме, лимиты определяются привязанным триальным тарифом (`checkSubscriptionLimit`).
- **OVERDUE, PAUSED, BLOCKED, CANCELLED:**
  - В [`src/lib/tenant.ts:242`](file:///d:/AZIZ%20PROJECT/src/lib/tenant.ts#L242) при вызове `requireTenantAccess` без флага `allowSuspended: true` выбрасывается исключение `TenantSuspendedError(center.status)` (статус 403, код `CENTER_SUSPENDED`).
  - **Критический дефект архитектуры UI:** В [`src/app/center/layout.tsx:68`](file:///d:/AZIZ%20PROJECT/src/app/center/layout.tsx#L68) вызывается `await requireTenantPageAccess()` без опции `allowSuspended`. В директории `src/app/center` **отсутствует файл `error.tsx`**. В результате директор при блокировке или просрочке платежа видит **технический сбой Next.js (500 / unhandled error)** вместо информативного экрана оплаты или продления подписки.

---

## 2. ЭКРАНЫ (UI)

### 2.1. Таблица всех маршрутов директора

| Маршрут | Файл | В сайдбаре | Какие данные показывает | Источник данных | Действия | Статус |
|---|---|:---:|---|---|---|:---:|
| `/center` | `src/app/center/page.tsx` | Да | 4 метрики (студенты, учителя, курсы, выручка), посещаемость (%), группа риска, расписание | Реальные запросы в БД через `tenantDb` | Переход в разделы | РАБОТАЕТ |
| `/center/courses` | `src/app/center/courses/page.tsx` | Да | Список курсов, модули, уроки, привязанные группы | Реальный запрос в БД (`course.findMany`) | Создать курс (`POST /api/courses`), раскрыть модули | ЧАСТИЧНО (нет создания/редактирования модулей и уроков) |
| `/center/groups` | `src/app/center/groups/page.tsx` | Да | Список групп, преподаватели, число студентов, вместимость | БД (`group.findMany`) | Создать, Изменить, Перевести студента, Отчислить | РАБОТАЕТ |
| `/center/students` | `src/app/center/students/page.tsx` | Да | Таблица студентов: ФИО, email, телефон, группы, статус | Клиентский fetch к `/api/students` | Поиск, фильтры, пагинация, Создать (`POST /api/students`), CSV-импорт | РАБОТАЕТ |
| `/center/students/[id]` | `src/app/center/students/[id]/page.tsx` | Нет (из таблицы) | Карточка студента: группы, родители, посещаемость, оценки, платежи, аудит-лог | БД (`centerMembership.findFirst`) | Только просмотр | ЧАСТИЧНО (страница 100% read-only, кнопок редактирования/сброса нет) |
| `/center/schedule` | `src/app/center/schedule/page.tsx` | Да | Календарная сетка занятий (день, неделя, месяц), слоты, аудитории | БД (`scheduleSlot.findMany`) | Создать слот, Изменить слот, Удалить слот, экспорт iCal | РАБОТАЕТ |
| `/center/attendance` | `src/app/center/attendance/page.tsx` | Да | Журнал посещаемости по группам и урокам, статусы, заметки | БД (`group.findMany`) + API | Выставить посещаемость (`POST /api/attendance`), экспорт CSV | РАБОТАЕТ |
| `/center/grades` | `src/app/center/grades/page.tsx` | Да | Электронный журнал оценок, баллы за дз и тесты | БД (`homeworkSubmission`, `testAttempt`) | Просмотр журнала, выставление баллов | РАБОТАЕТ |
| `/center/homework` | `src/app/center/homework/page.tsx` | Да | Список домашних заданий, дедлайны, сданные работы | БД (`homework.findMany`) | Создать ДЗ, Проверить сдачу, Поставить оценку | РАБОТАЕТ |
| `/center/announcements` | `src/app/center/announcements/page.tsx` | Да | Список объявлений центра, закрепленные объявления | БД (`announcement.findMany`) | Только чтение | ЧАСТИЧНО (нет формы создания и кнопок удаления) |
| `/center/branches` | `src/app/center/branches/page.tsx` | Да | Карточки филиалов, контакты, число групп | БД (`branch.findMany`) | Только чтение (надпись: создавайте через curl) | ЧАСТИЧНО (UI не имеет кнопок создания/редактирования) |
| `/center/staff` | `src/app/center/staff/page.tsx` | Да | Список сотрудников центра (учителя, админы, саппорт) | Клиентский fetch к `/api/tenant/staff` | Добавить сотрудника, Активировать/Деактивировать, Архивировать, Удалить | РАБОТАЕТ |
| `/center/invites` | `src/app/center/invites/page.tsx` | Да | Таблица инвайт-кодов, лимиты активаций, счетчик использований | БД (`inviteCode.findMany`) | Сгенерировать код (`POST /api/invites/generate`), Скопировать, Активировать код | РАБОТАЕТ |
| `/center/payments` | `src/app/center/payments/page.tsx` | Да | История платежей студентов, касса, банк, онлайн | БД (`centerPayment.findMany`) | Зафиксировать платеж (`POST /api/center-payments`) | РАБОТАЕТ |
| `/center/reports` | `src/app/center/reports/page.tsx` | Да | Собранная выручка, прогноз MRR, должники, часы учителей | БД (`centerPayment.aggregate`, `centerMembership`) | Напоминание в WhatsApp в 1 клик | ЧАСТИЧНО (часы учителей считаются по формуле-заглушке, нет экспорта) |
| `/center/notifications` | `src/app/center/notifications/page.tsx` | Да (колокольчик) | Лента уведомлений директора, статусы прочтения | Клиентский fetch к `/api/notifications` | Фильтр непрочитанных, Отметить прочитанным, Отметить все | РАБОТАЕТ |
| `/center/support` | `src/app/center/support/page.tsx` | Да | Список тикетов центра в поддержку платформы, переписка | БД (`supportTicket.findMany`) | Просмотр тикетов и ответов | ЧАСТИЧНО (в UI центра нет формы создания тикета) |
| `/center/profile` | `src/app/center/profile/page.tsx` | Да | Данные директора (ФИО, email, телефон, дата регистрации) | БД (`platformUser.findUnique`) | Ссылка на смену пароля и сессии | ЧАСТИЧНО (бейдж «2FA в разработке») |
| `/center/profile/password` | `src/app/center/profile/password/page.tsx` | Нет | Форма смены собственного пароля | Клиентский fetch к `/api/account/change-password` | Сменить пароль | РАБОТАЕТ |
| `/center/profile/sessions` | `src/app/center/profile/sessions/page.tsx` | Нет | Список активных устройств и сессий директора | Клиентский fetch к `/api/auth/sessions` | Отозвать сессию, Отозвать все кроме текущей | РАБОТАЕТ |
| `/dashboard` | `src/app/dashboard/page.tsx` | Нет | Редирект на `/center` | Серверный код | Редирект | РАБОТАЕТ (редирект) |
| `/dashboard/courses` | `src/app/dashboard/courses/page.tsx` | Нет | Дубликат `/center/courses` | БД (`course.findMany`) | Устаревший дубликат | ДУБЛЬ / МЁРТВЫЙ КОД |
| `/dashboard/groups` | `src/app/dashboard/groups/page.tsx` | Нет | Дубликат `/center/groups` | БД (`group.findMany`) | Устаревший дубликат | ДУБЛЬ / МЁРТВЫЙ КОД |
| `/dashboard/invites` | `src/app/dashboard/invites/page.tsx` | Нет | Дубликат `/center/invites` | БД (`inviteCode.findMany`) | Устаревший дубликат | ДУБЛЬ / МЁРТВЫЙ КОД |
| `/dashboard/payments` | `src/app/dashboard/payments/page.tsx` | Нет | Дубликат `/center/payments` | БД (`centerPayment.findMany`) | Устаревший дубликат | ДУБЛЬ / МЁРТВЫЙ КОД |
| `/onboarding` | `src/app/onboarding/page.tsx` | Нет | Информационная страница о закрытой регистрации | Статический JSX | Кнопка «Войти в систему» (`/login`) | РАБОТАЕТ |
| `/invites/accept` | `src/app/invites/accept/page.tsx` | Нет | Страница принятия персонального приглашения | Клиентский fetch к `/api/auth/invites/accept` | Принять инвайт по `pendingInviteId` | РАБОТАЕТ |
| `/account/change-password` | `src/app/account/change-password/page.tsx` | Нет | Принудительная/добровольная смена пароля | Клиентский fetch к `/api/account/change-password` | Обновить пароль | РАБОТАЕТ (с дефектом редиректа на `/platform-admin`) |
| `/account/delete` | `src/app/account/delete/page.tsx` | Нет | Экран удаления аккаунта с подтверждением пароля | Клиентский fetch к `/api/auth/account/delete` | Удалить аккаунт (блокируется при `SOLE_DIRECTOR_CONFLICT`) | РАБОТАЕТ |

### 2.2. Разбор дашборда директора (`/center/page.tsx`)
Дашборд директора формируется в [`src/app/center/page.tsx:1207-1435`](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L1207-L1435):
1. **Виджет «Активные студенты» (Active Students):**
   - *Источник:* `tenantDb.centerMembership.count({ where: { centerId, role: "STUDENT", status: "ACTIVE" } })` ([строка 89](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L89)). Реальный запрос в БД.
2. **Виджет «Преподаватели» (Teachers):**
   - *Источник:* `tenantDb.centerMembership.count({ where: { centerId, role: "TEACHER", status: "ACTIVE" } })` ([строка 93](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L93)). Реальный запрос в БД.
3. **Виджет «Всего курсов» (Courses):**
   - *Источник:* `tenantDb.course.count({ where: { centerId } })` ([строка 97](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L97)). Реальный запрос в БД.
4. **Виджет «Выручка центра» (Revenue):**
   - *Источник:* `tenantDb.centerPayment.aggregate({ where: { centerId, status: "PAID" }, _sum: { amount: true } })` ([строка 101](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L101)). Реальный запрос в БД. Форматируется в UZS.
5. **Виджет «Средняя посещаемость центра» (%):**
   - *Источник:* Выборка `attendance.findMany` по урокам центра, подсчет отношения статусов `PRESENT` и `LATE` к общему числу записей ([строки 109-118](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L109-L118)). Цветовая шкала (зеленый >= 80%, красный < 80%).
6. **Виджет «Студенты группы риска» (At Risk Count):**
   - *Источник:* Группировка посещаемости по студентам; подсчитываются ученики с посещаемостью строго ниже 80% ([строки 120-131](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L120-L131)).
7. **Виджет «Ближайшие занятия центра» (Upcoming Schedule):**
   - *Источник:* `tenantDb.scheduleSlot.findMany` (топ-6 активных слотов, отсортированных по дням недели и времени) ([строка 133](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L133)).
8. **Баннеры подсказок пустого состояния (Empty States):**
   - При `coursesCount === 0` показывается баннер со ссылкой на создание курса.
   - При `activeStudentsCount === 0` показывается баннер со ссылкой на добавление студентов.
9. **Мертвые переменные:**
   - На строке 528 считывается `const currentSub = center.subscriptions[0];`, однако данные подписки, дни триала и лимиты тарифа в интерфейс дашборда **не выводятся**.

### 2.3. Мёртвые кнопки, битые ссылки и дефекты UI
1. **Битый редирект в `/account/change-password/page.tsx:50`:** После успешной смены пароля захардкожен переход на `router.push("/platform-admin")`. Для директора и сотрудников центра без системной роли это вызывает лишний редирект на экран отказа доступа.
2. **Отсутствие формы в `/center/branches/page.tsx:48-50`:** На странице присутствует только текст: «Управление через API: `/api/tenant/branches`». Кнопок «Добавить филиал» или «Редактировать» нет.
3. **Отсутствие формы в `/center/announcements/page.tsx`:** Директор может только читать объявления, кнопки «Создать объявление» на странице нет, хотя API `POST /api/tenant/announcements` полностью готов.
4. **Отсутствие создания тикета в `/center/support/page.tsx`:** Отображаются только существующие тикеты, кнопки «Создать обращение в поддержку» нет.
5. **Валютная опечатка в `/components/PaymentsManager.tsx:162`:** Лейбл поля суммы отображает «Сумма (₽)» (символ рубля), в то время как вся финансовая система платформы и центров оперирует сумами (`UZS`).

---

## 3. API ЭНДПОИНТЫ ДИРЕКТОРА

| Метод | Путь | Назначение | Проверка прав | Zod / Валидация | AuditLog | Вызывается из UI | Статус |
|---|---|---|---|:---:|:---:|:---:|:---:|
| `GET` | `/api/tenant/staff` | Список сотрудников центра | `DIRECTOR`, `CENTER_ADMIN` (`tenant.ts:21`) | Нет (query) | Нет | Да (`StaffManager.tsx:88`) | РАБОТАЕТ |
| `POST` | `/api/tenant/staff` | Добавить учителя/админа | `DIRECTOR`, `CENTER_ADMIN` (`tenant.ts:67`) | Ручная проверка полей | Да (`STAFF_MEMBER_ADDED`) | Да (`StaffManager.tsx:104`) | РАБОТАЕТ |
| `PATCH`| `/api/tenant/staff` | Статус / роль сотрудника | `DIRECTOR`, `CENTER_ADMIN` (`tenant.ts:220`) | Проверка enum | Да (`STAFF_MEMBER_UPDATED`) | Да (`StaffManager.tsx:143`) | РАБОТАЕТ |
| `DELETE`| `/api/tenant/staff` | Удалить сотрудника/студента | `DIRECTOR`, `CENTER_ADMIN` (`tenant.ts:335`) | Проверка membershipId | Да (`MEMBER_DELETED`) | Да (`StaffManager.tsx:191`) | РАБОТАЕТ |
| `GET` | `/api/students` | Список студентов с пагинацией | `DIRECTOR`, `CENTER_ADMIN`, `TEACHER` (`students/route.ts:63`)| Валидация пагинации | Нет | Да (`use-students.ts:77`) | РАБОТАЕТ |
| `POST` | `/api/students` | Создать студента + инвайт | `DIRECTOR`, `CENTER_ADMIN` (`students/route.ts:163`) | Ручная проверка | Нет | Да (`use-students.ts:149`) | РАБОТАЕТ |
| `GET` | `/api/students/[id]` | Детальная карточка студента | Ролевой скоуп (`students/[id]/route.ts:86`) | Проверка ID | Нет | Да (через RSC) | РАБОТАЕТ |
| `POST` | `/api/students/import-csv`| Пакетный импорт студентов из CSV | `DIRECTOR`, `CENTER_ADMIN` (`import-csv/route.ts:30`) | Проверка структуры CSV, лимит 500 | Нет | Да (`use-students.ts:183`) | РАБОТАЕТ |
| `GET` | `/api/courses` | Список курсов центра | Ролевой скоуп | Нет | Нет | Да (`CourseManager.tsx`) | РАБОТАЕТ |
| `POST` | `/api/courses` | Создать курс | `DIRECTOR`, `CENTER_ADMIN` (`courses/route.ts:46`) | Ручная проверка | Да (`COURSE_CREATED`) | Да (`CourseManager.tsx:51`) | РАБОТАЕТ |
| `GET` | `/api/groups` | Список групп центра | Ролевой скоуп | Нет | Нет | Да (`GroupsManager.tsx`) | РАБОТАЕТ |
| `POST` | `/api/groups` | Создать группу | `DIRECTOR`, `CENTER_ADMIN` (`groups/route.ts:44`) | Проверка вместимости | Да (`GROUP_CREATED`) | Да (`use-groups.ts:133`) | РАБОТАЕТ |
| `PATCH`| `/api/groups/[id]` | Изменить параметры группы | `DIRECTOR`, `CENTER_ADMIN` (`groups/[id]/route.ts:48`) | Проверка вместимости | Да (`GROUP_UPDATED`) | Да (`use-groups.ts:175`) | РАБОТАЕТ |
| `POST` | `/api/groups/[id]/transfer`| Перевод студента между группами | `DIRECTOR`, `CENTER_ADMIN` (`transfer/route.ts:14`) | Проверка вместимости целевой группы | Да (`STUDENT_TRANSFERRED`) | Да (`use-groups.ts:223`) | РАБОТАЕТ |
| `POST` | `/api/groups/[id]/drop` | Отчислить студента из группы | `DIRECTOR`, `CENTER_ADMIN` (`drop/route.ts:14`) | Проверка зачисления | Да (`STUDENT_DROPPED`) | Да (`use-groups.ts:265`) | РАБОТАЕТ |
| `GET` | `/api/tenant/schedule` | Сетка расписания | Ролевой скоуп | Query params | Нет | Да (`use-schedule.ts`) | РАБОТАЕТ |
| `POST` | `/api/tenant/schedule` | Создать слот расписания | `DIRECTOR`, `CENTER_ADMIN` (`schedule/route.ts:74`) | Проверка коллизий аудиторий/учителей | Да (`SCHEDULE_SLOT_CREATED`) | Да (`use-schedule.ts`) | РАБОТАЕТ |
| `PATCH`| `/api/tenant/schedule` | Изменить слот расписания | `DIRECTOR`, `CENTER_ADMIN` (`schedule/route.ts:162`) | Проверка коллизий | Да (`SCHEDULE_SLOT_UPDATED`) | Да (`use-schedule.ts`) | РАБОТАЕТ |
| `DELETE`| `/api/tenant/schedule` | Удалить слот расписания | `DIRECTOR`, `CENTER_ADMIN` (`schedule/route.ts:233`) | Проверка ID | Да (`SCHEDULE_SLOT_DELETED`) | Да (`use-schedule.ts`) | РАБОТАЕТ |
| `GET` | `/api/attendance` | Записи посещаемости | Ролевой скоуп | Query params | Нет | Да (`AttendanceManager.tsx`)| РАБОТАЕТ |
| `POST` | `/api/attendance` | Выставить статус посещаемости | `DIRECTOR`, `CENTER_ADMIN`, `TEACHER` | Проверка enum статуса | Да (`ATTENDANCE_MARKED`) | Да (`AttendanceManager.tsx`)| РАБОТАЕТ |
| `GET` | `/api/center-payments` | Платежи студентов | `DIRECTOR`, `CENTER_ADMIN`, `STUDENT`, `PARENT` | Scoped query | Нет | Да (`PaymentsManager.tsx`) | РАБОТАЕТ |
| `POST` | `/api/center-payments` | Зафиксировать оплату студента | `DIRECTOR`, `CENTER_ADMIN` (`center-payments/route.ts:48`)| Проверка суммы и способа оплаты | Да (`PAYMENT_RECORDED`) | Да (`PaymentsManager.tsx:47`)| РАБОТАЕТ |
| `GET` | `/api/tenant/branches` | Список филиалов | `requireTenantAccess` | Нет | Нет | Нет (только через RSC) | РАБОТАЕТ |
| `POST` | `/api/tenant/branches` | Создать филиал | `DIRECTOR`, `CENTER_ADMIN` (`branches/route.ts:31`) | Проверка лимита тарифа `branches` | Да (`BRANCH_CREATED`) | Нет | НЕ ПОДКЛЮЧЕНО |
| `PATCH`| `/api/tenant/branches` | Изменить филиал | `DIRECTOR`, `CENTER_ADMIN` (`branches/route.ts:78`) | Проверка ID | Да (`BRANCH_UPDATED`) | Нет | НЕ ПОДКЛЮЧЕНО |
| `GET` | `/api/tenant/announcements`| Список объявлений центра | Ролевой скоуп | Пагинация | Нет | Нет (только через RSC) | РАБОТАЕТ |
| `POST` | `/api/tenant/announcements`| Создать объявление центра | `DIRECTOR`, `CENTER_ADMIN`, `TEACHER` (`announcements:99`)| Проверка заголовка и тела | Да (`ANNOUNCEMENT_CREATED`)| Нет | НЕ ПОДКЛЮЧЕНО |
| `GET` | `/api/invites/generate` | Список инвайтов | `DIRECTOR`, `CENTER_ADMIN` | Нет | Нет | Да (`InvitesManager.tsx`) | РАБОТАЕТ |
| `POST` | `/api/invites/generate` | Создать инвайт-код | `DIRECTOR`, `CENTER_ADMIN` (`invites/generate:24`) | Проверка роли и лимита использований | Нет | Да (`InvitesManager.tsx:56`)| РАБОТАЕТ |
| `POST` | `/api/invites/accept` | Активировать инвайт-код | Любой авторизованный пользователь | Проверка срока и лимита использований | Нет | Да (`InvitesManager.tsx:80`)| РАБОТАЕТ |
| `POST` | `/api/invites/parent-link`| Привязка родителя | `action === "INITIATE_BY_ADMIN"` | Проверка studentId | Нет | Нет (в UI не вызывается) | НЕ ПОДКЛЮЧЕНО / СЛОМАНО |
| `GET` | `/api/finance/accounts` | Счета и кассы центра | `requireFinanceTenantAccess` (`accounts/route.ts:14`)| Нет | Нет | Нет | НЕ ПОДКЛЮЧЕНО |
| `POST` | `/api/finance/accounts` | Создать кассу/счет центра | `requireFinanceTenantAccess` (`accounts/route.ts:42`)| Zod-валидация | Да (`FINANCE_ACCOUNT_CREATED`)| Нет | НЕ ПОДКЛЮЧЕНО |
| `GET` | `/api/finance/transactions`| Проводки и транзакции | `requireFinanceTenantAccess` | Пагинация, фильтры | Нет | Нет | НЕ ПОДКЛЮЧЕНО |
| `POST` | `/api/finance/transactions`| Создать проводку (доход/расход)| `requireFinanceTenantAccess` | Двойная запись, Zod | Да (`FINANCE_TRANSACTION_CREATED`)| Нет | НЕ ПОДКЛЮЧЕНО |
| `POST` | `/api/finance/transactions/[id]/reverse`| Бухгалтерское сторно | `DIRECTOR` only (`permissions: finance.storno`) | Обязательная причина (>5 симв.) | Да (`FINANCE_TRANSACTION_REVERSED`)| Нет | НЕ ПОДКЛЮЧЕНО |
| `POST` | `/api/finance/periods` | Закрытие финансового периода | `DIRECTOR` only (`permissions: finance.period.close`)| Проверка незакрытых периодов | Да (`FINANCE_PERIOD_CLOSED`)| Нет | НЕ ПОДКЛЮЧЕНО |
| `GET` | `/api/finance/export` | Экспорт проводок в Excel/CSV | `DIRECTOR` only (`permissions: finance.export`)| Дата от/до, CSV escaping | Да (`FINANCE_EXPORT_DOWNLOADED`)| Нет | НЕ ПОДКЛЮЧЕНО |
| `GET` | `/api/materials` | Учебные материалы | `requireTenantAccess` | Query params | Нет | Нет | НЕ ПОДКЛЮЧЕНО |
| `POST` | `/api/materials` | Загрузить материал | `DIRECTOR`, `CENTER_ADMIN`, `TEACHER` | Проверка URL/файла | Да (`MATERIAL_UPLOADED`) | Нет | НЕ ПОДКЛЮЧЕНО |
| `GET` | `/api/notifications` | Уведомления пользователя | Авторизованный пользователь | Фильтр unreadOnly | Нет | Да (`notifications/page.tsx`)| РАБОТАЕТ |
| `PATCH`| `/api/notifications` | Отметить уведомление прочитанным | Авторизованный пользователь | Проверка notificationId | Нет | Да (`notifications/page.tsx`)| РАБОТАЕТ |
| `POST` | `/api/tickets` | Создать обращение в саппорт | Авторизованный пользователь | Проверка subject/message | Да (`TICKET_CREATED`) | Нет (в центре форма отсутствует) | НЕ ПОДКЛЮЧЕНО |

---

## 4. УПРАВЛЕНИЕ ЛЮДЬМИ

| Сценарий | Возможность | Путь клика в интерфейсе | Файлы реализации |
|---|:---:|---|---|
| **Создать учителя (`TEACHER`)** | **Может** | Сайдбар → Сотрудники (`/center/staff`) → Кнопка «Добавить сотрудника» → Модалка (Email, ФИО, Телефон, Роль=Преподаватель) | [`src/components/StaffManager.tsx:97`](file:///d:/AZIZ%20PROJECT/src/components/StaffManager.tsx#L97), [`src/app/api/tenant/staff/route.ts:60`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L60) |
| **Создать помощника (`TEACHER_ASSISTANT`)** | **Не может** | В выпадающем списке ролей `StaffManager.tsx:220` роль `TEACHER_ASSISTANT` отсутствует (доступны только `CENTER_ADMIN`, `TEACHER`, `CENTER_SUPPORT`) | [`src/components/StaffManager.tsx:220`](file:///d:/AZIZ%20PROJECT/src/components/StaffManager.tsx#L220) |
| **Создать ученика (`STUDENT`) через форму** | **Может** | Сайдбар → Ученики (`/center/students`) → Кнопка «Добавить студента» → Модалка (ФИО, Email, Телефон, Группа, чекбокс инвайта) | [`src/components/students/StudentFormModal.tsx:73`](file:///d:/AZIZ%20PROJECT/src/components/students/StudentFormModal.tsx#L73), [`src/app/api/students/route.ts:157`](file:///d:/AZIZ%20PROJECT/src/app/api/students/route.ts#L157) |
| **Создать учеников через CSV (bulk-import)** | **Может** | Сайдбар → Ученики (`/center/students`) → Кнопка «Импорт CSV» → Предпросмотр → Выполнить импорт (до 500 строк) | [`src/components/students/CsvImportModal.tsx`](file:///d:/AZIZ%20PROJECT/src/components/students/CsvImportModal.tsx), [`src/app/api/students/import-csv/route.ts:24`](file:///d:/AZIZ%20PROJECT/src/app/api/students/import-csv/route.ts#L24) |
| **Создать родителя (`PARENT`)** | **Не может** | Ни в `/center/staff`, ни в `/center/students` кнопки добавления родителя нет. Генерация инвайта для `PARENT` создает членство в центре, но не привязывает к ученику | [`src/components/InvitesManager.tsx:236`](file:///d:/AZIZ%20PROJECT/src/components/InvitesManager.tsx#L236), [`src/app/api/invites/accept/route.ts:54`](file:///d:/AZIZ%20PROJECT/src/app/api/invites/accept/route.ts#L54) |
| **Создать админа центра (`CENTER_ADMIN`)** | **Может** | Сайдбар → Сотрудники (`/center/staff`) → Добавить сотрудника → Роль=Админ центра (доступно только директору) | [`src/components/StaffManager.tsx:221`](file:///d:/AZIZ%20PROJECT/src/components/StaffManager.tsx#L221), [`src/app/api/tenant/staff/route.ts:94`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L94) |
| **Увидеть и выдать пароль вручную** | **Не может** | Пароль генерируется криптографически и хешируется через bcrypt. В production-режиме API не возвращает сгенерированный пароль клиенту | [`src/app/api/tenant/staff/route.ts:201`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L201), [`src/app/api/students/route.ts:223`](file:///d:/AZIZ%20PROJECT/src/app/api/students/route.ts#L223) |
| **Сбросить пароль пользователю центра** | **Не может** | У директора нет функционала сброса паролей другим пользователям. Сброс доступен только самому пользователю через публичный `/forgot-password` или супервайзеру платформы | Отсутствует в коде `/center/*` и `/api/tenant/*` |
| **Вход по телефону или username** | **Частично** | API логина (`/api/auth/login`) поддерживает вход по телефону и username, но в форме создания сотрудников/студентов поле `username` отсутствует и в БД не заполняется | [`src/app/api/auth/login/route.ts:37-40`](file:///d:/AZIZ%20PROJECT/src/app/api/auth/login/route.ts#L37-L40) |
| **Привязать родителя к ученику (`ParentLink`)** | **Не может** | Эндпоинт `INITIATE_BY_ADMIN` в `/api/invites/parent-link` не подключен к UI, а погашение кода родителем не получает `studentId` из-за ограничений схемы | [`src/app/api/invites/parent-link/route.ts:19, 107`](file:///d:/AZIZ%20PROJECT/src/app/api/invites/parent-link/route.ts#L19) |
| **Перевести ученика между группами** | **Может** | Сайдбар → Группы (`/center/groups`) → Карточка группы → Кнопка смены группы у студента → Модалка выбора целевой группы и причины | [`src/components/groups/TransferStudentModal.tsx`](file:///d:/AZIZ%20PROJECT/src/components/groups/TransferStudentModal.tsx), [`src/app/api/groups/[id]/transfer/route.ts:4`](file:///d:/AZIZ%20PROJECT/src/app/api/groups/[id]/transfer/route.ts#L4) |
| **Деактивировать / блокировать пользователя** | **Может** | Сайдбар → Сотрудники (`/center/staff`) → Кнопка деактивации у карточки сотрудника (меняет статус на `INACTIVE` / `ARCHIVED`) | [`src/components/StaffManager.tsx:140`](file:///d:/AZIZ%20PROJECT/src/components/StaffManager.tsx#L140), [`src/app/api/tenant/staff/route.ts:269`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L269) |
| **Удалить пользователя из центра** | **Частично** | В `/center/staff` кнопка корзины вызывает `DELETE /api/tenant/staff`. Если у студента есть связанные оценки, платежи или посещаемость, удаление блокируется RESTRICT (P2003) | [`src/app/api/tenant/staff/route.ts:401-419`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/staff/route.ts#L401-L419) |
| **Редактировать профиль любого пользователя** | **Не может** | Ни для сотрудников, ни для студентов в UI нет формы редактирования ФИО, телефона или почты существующего аккаунта | Отсутствуют эндпоинты `PATCH /api/students/[id]` |
| **Видеть историю входов и сессии пользователей** | **Не может** | Директор может видеть только свои личные сессии на `/center/profile/sessions`. Журнал входов сотрудников центра директору недоступен | [`src/app/center/profile/sessions/page.tsx:29`](file:///d:/AZIZ%20PROJECT/src/app/center/profile/sessions/page.tsx#L29) |
| **Лимиты тарифа (поведение и остаток)** | **Частично** | При достижении лимита API возвращает 400/403 (`PLAN_LIMIT_REACHED`). Однако директор **не видит остаток квоты** в интерфейсе (счетчики тарифа не выводятся) | [`src/lib/limits.ts:1-50`](file:///d:/AZIZ%20PROJECT/src/lib/limits.ts#L1-L50) |

---

## 5. УЧЕБНЫЙ ПРОЦЕСС И ФИНАНСЫ ЦЕНТРА

### 5.1. Учебный процесс: готовность подсистем

1. **Филиалы (`Branch`): ЧАСТИЧНО**
   - *Готово:* Модель `Branch` в БД, серверный API (`GET /api/tenant/branches`, `POST`, `PATCH`), проверка лимита подписки `checkSubscriptionLimit(centerId, "branches")`.
   - *Заглушка/Пробел:* Экран [`/center/branches/page.tsx:48`](file:///d:/AZIZ%20PROJECT/src/app/center/branches/page.tsx#L48) полностью статичен (read-only), кнопок создания или модальных окон в UI нет.
2. **Предметы и Курсы (`Course`, `Module`, `Lesson`): ЧАСТИЧНО**
   - *Готово:* Создание курса (`POST /api/courses`), отображение опубликованных курсов, аккордеон с просмотром модулей и уроков.
   - *Заглушка/Пробел:* Добавление, редактирование и удаление модулей и уроков в UI отсутствует.
3. **Группы (`Group`, `Enrollment`): РАБОТАЕТ**
   - *Готово:* Полный сквозной цикл: создание группы с выбором курса, преподавателя и максимальной вместимости; редактирование; перевод студента между группами с проверкой переполнения; отчисление (`DROPPED`).
4. **Расписание (`ScheduleSlot`, `Lesson`): РАБОТАЕТ**
   - *Готово:* Интерактивная сетка (день, неделя, месяц), модальное окно добавления слота с проверкой коллизий по преподавателям и аудиториям, редактирование, удаление, генерация персонального iCal-календаря.
5. **Посещаемость (`Attendance`): РАБОТАЕТ**
   - *Готово:* Выбор группы и урока, отметка статусов (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), текстовые заметки к посещаемости, фильтрация, выгрузка журнала в CSV.
6. **Оценки (`Grade`, `HomeworkSubmission`, `TestAttempt`): РАБОТАЕТ**
   - *Готово:* Сводный журнал оценок по урокам и домашним заданиям, фиксация баллов, ролевое разграничение видимости.
7. **Домашние задания (`Homework`): РАБОТАЕТ**
   - *Готово:* Создание заданий учителем, прикрепление дедлайнов, просмотр сданных работ учеников, рецензирование и выставление оценок.
8. **Тесты и учебные материалы (`Material`, `Test`, `TestQuestion`): НЕ ПОДКЛЮЧЕНО**
   - *Готово в API:* Модели в БД, эндпоинты `/api/materials`, `/api/tests/start`, `/api/tests/attempt`.
   - *Заглушка/Пробел:* В кабинете директора и в сайдбаре **полностью отсутствуют экраны** управления материалами и тестами.
9. **Объявления (`Announcement`): ЧАСТИЧНО**
   - *Готово:* Отображение объявлений на `/center/announcements`, закрепление важных анонсов, серверный API `POST /api/tenant/announcements`.
   - *Заглушка/Пробел:* В интерфейсе директора нет формы создания и кнопок управления объявлением.
10. **Учебные периоды и праздники (`AcademicTerm`, `Holiday`): НЕ ПОДКЛЮЧЕНО / МЁРТВЫЙ КОД**
    - В `prisma/schema.prisma:1009-1033` объявлены модели `AcademicTerm` и `Holiday`. Они включены в белый список `src/lib/db-tenant.ts:23-24`, но для них **нет ни одного API-эндпоинта и ни одного экрана в интерфейсе**.

### 5.2. Финансы центра: готовность подсистем

1. **Оплаты учеников (`CenterPayment`): РАБОТАЕТ**
   - Фиксация оплат учеников через форму на `/center/payments` (`POST /api/center-payments`).
   - Поддерживаемые методы: наличные (`CASH`), банковский перевод (`BANK_TRANSFER`), эквайринг (`ONLINE`).
   - Дефект: В интерфейсе отображается символ рубля (`₽`) вместо сума (`UZS`).
2. **Управление долгами: ЧАСТИЧНО**
   - На странице `/center/reports` выводится список должников (платежи со статусом `PENDING`) с формированием ссылки на отправку напоминания в WhatsApp в 1 клик.
   - Пробел: Нет автоматического начисления абонентской платы или выставления счетов за следующий месяц.
3. **Зарплаты учителей: ЗАГЛУШКА в UI / ГОТОВО в API**
   - В UI на `/center/reports:205` часы учителей считаются по фиктивной формуле: `groups * 12 + substitutes * 1.5`. Реальные ставки учителей (`TeacherSalaryRate`) из базы не считываются.
   - В бэкенде [`src/lib/finance.ts`](file:///d:/AZIZ%20PROJECT/src/lib/finance.ts) и `/api/finance/salary-rates` реализована полноценная подсистема расчета зарплат с фиксированными ставками, ставками за урок и за ученика, но она **не подключена к UI**.
4. **Управленческий учет и двойная запись (ACC-2): НЕ ПОДКЛЮЧЕНО в UI**
   - Вся финансовая архитектура (план счетов `FinanceAccount`, категории `FinanceCategory`, двойная запись `FinanceTransaction`, закрытие периодов `FinancePeriod`, сторнирование, экспорт проводок) полностью реализована в API `/api/finance/*`, однако клиентский интерфейс для директора (`/center/finance/*`) еще не создан.

---

## 6. НАБЛЮДЕНИЕ И АНАЛИТИКА

| Область наблюдения | Что видит директор | Источник данных | Полнота реализации |
|---|---|---|:---:|
| **Посещаемость центра** | KPI процент посещаемости за все время, виджет студентов в зоне риска (<80%), сводный журнал | Запрос в БД `attendance.findMany` | РАБОТАЕТ |
| **Успеваемость** | Сводный журнал оценок по всем группам, средний балл | Запрос в БД `grade.findMany` | РАБОТАЕТ |
| **Оплаты и выручка** | Общая собранная сумма, ожидаемые оплаты, прогноз выручки на следующий месяц | Агрегации `centerPayment._sum` | РАБОТАЕТ |
| **Активность учителей** | Количество активных групп, число обученных студентов, количество проведенных замен | Связи `taughtGroups`, `substituteLessons` | ЧАСТИЧНО (часы считаются приблизительно) |
| **Отчёты (`/center/reports`)** | 3 карточки финансовых метрик + таблица должников с WhatsApp + таблица нагрузки учителей | Серверные агрегации в БД | ЧАСТИЧНО (нет графиков динамики, нет экспорта в Excel/PDF) |
| **Журнал действий (AuditLog)** | Короткая история зачислений и переводов видна **только** на карточке отдельного студента (`/center/students/[id]`). Общей страницы аудита центра директору **не предоставлено** | БД `auditLog.findMany` | ЧАСТИЧНО (хотя право `audit.read` у директора есть) |
| **Уведомления** | Всплывающий колокольчик в шапке с бейджем непрочитанных, отдельный экран `/center/notifications` | API `/api/notifications` | РАБОТАЕТ |

---

## 7. ЗАГЛУШКИ И ИНТЕГРАЦИИ

| Файл:Строка | Что имитирует (Stub / Mock) | Что требуется для production |
|---|---|---|
| [`src/lib/notifications.ts:57`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L57) | `sendEmailTransport` делает только `console.log("📧 [Email Driver]...")` | Подключение реального SMTP или API Resend/SendGrid через очередь `EmailOutbox` |
| [`src/lib/notifications.ts:69`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L69) | `sendSmsTransport` делает только `console.log("📱 [SMS Driver]...")` | Реальный HTTP-клиент к API шлюза Eskiz.uz (`https://notify.eskiz.uz/api/message/sms/send`) с авторизацией по токену |
| [`src/lib/storage.ts:158`](file:///d:/AZIZ%20PROJECT/src/lib/storage.ts#L158) | `StorageService` выбрасывает исключение `"Real S3 upload not implemented in this demo"` | Подключение AWS S3 / Cloudflare R2 / MinIO SDK для загрузки аватаров, материалов и вложений |
| [`src/app/center/profile/page.tsx:73`](file:///d:/AZIZ%20PROJECT/src/app/center/profile/page.tsx#L73) | Статический бейдж `"Двухфакторная защита (В разработке)"` | Реализация генерации TOTP-секрета (Google Authenticator) или подтверждения через SMS |
| [`src/app/center/reports/page.tsx:205`](file:///d:/AZIZ%20PROJECT/src/app/center/reports/page.tsx#L205) | Формула `groups * 12 + substitutes * 1.5` для оценки часов учителей | Интеграция с реальным журналом расписания и ставками `TeacherSalaryRate` |
| [`src/components/PaymentsManager.tsx:121`](file:///d:/AZIZ%20PROJECT/src/components/PaymentsManager.tsx#L121) | Пункт `"Онлайн-эквайринг"` просто сохраняет запись в БД со статусом PAID | Интеграция с платежными системами Узбекистана (Click Merchant API, Payme Business, Uzum Pay) |
| [`src/lib/email.ts:191`](file:///d:/AZIZ%20PROJECT/src/lib/email.ts#L191) | При отсутствии `RESEND_API_KEY` письма пишутся в массив оперативной памяти `sentEmailsBuffer` | Настройка рабочего почтового шлюза (иначе письма активации паролей теряются при перезапуске) |

---

## 8. АНАЛИЗ МОДЕЛЕЙ БАЗЫ ДАННЫХ ДЛЯ ЦЕНТРА

| Модель Prisma | Кто читает | Кто пишет | Наличие в API | Наличие в UI | Неиспользуемые / проблемные поля |
|---|---|---|:---:|:---:|---|
| `CenterMembership` | Все роли центра | Директор, Админ, Инвайты | Да | Да | `membershipPermissions` (JSON-переопределения прав) поддерживается парсером в `permissions.ts:473`, но в UI формы редактирования нет |
| `InviteCode` | Директор, Админ | Директор, Админ | Да | Да | `expiresAt` редко заполняется в UI |
| `ParentLink` | Директор, Родитель, Студент | `invites/parent-link` | Да | Только чтение | `initiatedBy`, `inviteCodeUsed` не задействованы в UI |
| `PendingInvite` | Система авторизации | `/api/auth/register` | Да | `/invites/accept` | Поле `ipAddress` пишется, но в UI нигде не отображается |
| `Branch` | Директор, Админ | `/api/tenant/branches` | Да | Только чтение | Модель готова, но интерфейс создания отсутствует |
| `Course` | Все роли | Директор, Админ | Да | Да | Поле `deletedAt` объявлено для soft delete, но в UI кнопки удаления курса нет |
| `Module` | Все роли | Seed / внутренний API | Да | Только чтение | Нет интерфейса создания и редактирования модулей |
| `Lesson` | Все роли | Расписание / посещаемость | Да | Только чтение | `contentJson` не редактируется в UI |
| `Group` | Все роли | Директор, Админ | Да | Да | Модель полностью покрыта UI и API |
| `Enrollment` | Все роли | Директор, Админ, Инвайты | Да | Да | Полный жизненный цикл (`ACTIVE`, `DROPPED`) |
| `Attendance` | Все роли | Учитель, Директор | Да | Да | Модель полностью покрыта UI и API |
| `Grade` | Все роли | Учитель, Директор | Да | Да | `feedback` редко заполняется |
| `Homework` | Все роли | Учитель | Да | Да | Модель полностью покрыта UI и API |
| `HomeworkSubmission` | Учитель, Студент | Студент, Учитель | Да | Да | Модель полностью покрыта UI и API |
| `Material` | API | API | Да | **Нет** | Модель есть в БД и API, но страниц в UI нет |
| `Test` / `TestQuestion`| API | API | Да | **Нет** | Модели есть в БД и API, но страниц в UI нет |
| `TestAttempt` | Студент, Директор | API тестирования | Да | Журнал оценок | Показывается в журнале оценок |
| `CenterPayment` | Директор, Студент, Родитель | Директор, Админ | Да | Да | `invoiceNumber` генерируется опционально |
| `FinanceAccount` | Бухгалтерия API | Бухгалтерия API | Да | **Нет** | Ждет внедрения интерфейса ACC-2 |
| `FinanceCategory` | Бухгалтерия API | Бухгалтерия API | Да | **Нет** | Ждет внедрения интерфейса ACC-2 |
| `FinanceTransaction` | Бухгалтерия API | Бухгалтерия API | Да | **Нет** | Ждет внедрения интерфейса ACC-2 |
| `FinancePeriod` | Бухгалтерия API | Бухгалтерия API | Да | **Нет** | Ждет внедрения интерфейса ACC-2 |
| `TeacherSalaryRate` | Бухгалтерия API | Бухгалтерия API | Да | **Нет** | Ждет внедрения интерфейса ACC-2 |
| `TeacherLessonSalary` | Бухгалтерия API | Бухгалтерия API | Да | **Нет** | Ждет внедрения интерфейса ACC-2 |
| `AcademicTerm` | `db-tenant.ts` whitelist | Никто | **Нет** | **Нет** | **Мертвый код**: модель объявлена, но не используется |
| `Holiday` | `db-tenant.ts` whitelist | Никто | **Нет** | **Нет** | **Мертвый код**: модель объявлена, но не используется |
| `Announcement` | Все роли | API объявлений | Да | Только чтение | Поле `isPinned` активно используется |
| `AuditLog` | Директор (студенты), Супервайзер | Вся система | Да | ЧАСТИЧНО | Централизованного экрана аудита центра нет |
| `Notification` | Все роли | Системные события | Да | Да | Полностью подключена |

---

## 9. ТЕСТЫ И КАЧЕСТВО

### 9.1. Покрытие тестами роли директора и изоляции центров
Тестовый набор проекта содержит обширную группу тестов изоляции и прав:
- **Изоляция данных и мультитенантность:**
  - `tests/tenant-isolation.test.ts` — проверка невозможности чтения чужого центра.
  - `tests/acc-api-isolation.test.ts` — проверка изоляции финансового API.
  - `tests/tenant-suspended-status.test.ts` — блокировка операций при статусах `SUSPENDED`.
  - `tests/tenant-ondelete-restrict.test.ts` — защита от каскадного удаления связанных записей студентов.
- **Бизнес-логика директора и администратора:**
  - `tests/core-students-groups.test.ts` — создание групп, зачисление, переводы.
  - `tests/core-attendance-grades.test.ts` — учет посещаемости и выставление оценок.
  - `tests/pages-center-dashboard.test.ts` — рендеринг дашборда директора.
  - `tests/pages-center-reports.test.ts` — расчет отчетов и агрегаций.
  - `tests/pages-center-schedule.test.ts` — предотвращение коллизий в расписании.
- **Пробелы в тестовом покрытии:**
  - Нет тестов на создание филиалов через UI (так как UI отсутствует).
  - Нет сквозных тестов отправки реальных email/SMS уведомлений.
  - Нет тестов на превышение лимитов при создании курсов и филиалов в UI.

### 9.2. Результаты статического анализа
1. **Проверка типов TypeScript (`npx tsc --noEmit`):**
   - **Результат: `0 ошибок` (Clean).**
2. **Линтер ESLint (`npm run lint`):**
   - **Результат: `0 ошибок` (Clean).** (Выводятся только информационные предупреждения Next.js о тегах `<img>` вместо `<Image />`).

---

## 10. СВОДКА

### 10.1. Таблица статусов по разделам функционала директора

| Раздел функционала | Статус | Комментарий |
|---|:---:|---|
| **Права и RBAC изоляция** | **РАБОТАЕТ** | Изоляция через `requireTenantAccess` и `getTenantDb` надежна. Межтенантных утечек нет |
| **Дашборд директора (`/center`)** | **РАБОТАЕТ** | Все 4 метрики, процент посещаемости, группа риска и расписание считаются из реальной БД |
| **Управление группами** | **РАБОТАЕТ** | Полный цикл создания, редактирования, перевода учеников и отчисления |
| **Расписание и календарь** | **РАБОТАЕТ** | Календарная сетка, модалки создания/редактирования, проверка коллизий, iCal |
| **Журнал посещаемости** | **РАБОТАЕТ** | Отметка статусов, заметки, фильтрация по урокам, выгрузка CSV |
| **Журнал оценок и ДЗ** | **РАБОТАЕТ** | Выставление оценок, рецензирование домашних заданий, дедлайны |
| **Управление персоналом (`/center/staff`)** | **РАБОТАЕТ** | Создание учителей и админов, деактивация, архивация, удаление |
| **Прием оплат студентов (`/center/payments`)** | **РАБОТАЕТ** | Касса, банк, эквайринг (вручную). Опечатка в символе валюты (`₽` вместо `UZS`) |
| **Уведомления директора** | **РАБОТАЕТ** | Колокольчик, счетчик, экран просмотра и отметки о прочтении |
| **Курсы (`/center/courses`)** | **ЧАСТИЧНО** | Курсы создаются, но редактировать модули и уроки в UI нельзя |
| **Студенты (`/center/students`)** | **ЧАСТИЧНО** | Добавление и CSV-импорт работают, но карточка студента read-only (нет редактирования) |
| **Отчёты (`/center/reports`)** | **ЧАСТИЧНО** | Должники с WhatsApp работают; часы учителей считаются по формуле-заглушке; нет экспорта |
| **Филиалы (`/center/branches`)** | **ЧАСТИЧНО** | Список филиалов выводится, но формы создания и кнопок управления в UI нет |
| **Объявления (`/center/announcements`)** | **ЧАСТИЧНО** | Список объявлений выводится, но формы создания в UI нет |
| **Журнал аудита центра** | **ЧАСТИЧНО** | В БД пишется, но экрана просмотра аудита у директора нет |
| **Привязка родителей к ученикам** | **НЕ ПОДКЛЮЧЕНО** | Генерация инвайта не связывает родителя со студентом; админский API не выведен в UI |
| **Материалы и тестирование** | **НЕ ПОДКЛЮЧЕНО** | В API эндпоинты есть, но страниц `/center/materials` и `/center/tests` в UI нет |
| **Управленческие финансы (ACC-2)** | **НЕ ПОДКЛЮЧЕНО** | Счета, категории, двойная запись, сторно и закрытие периодов есть в API, но нет UI |
| **Учебные периоды и праздники** | **МЁРТВЫЙ КОД** | Модели `AcademicTerm` и `Holiday` объявлены в схеме, но ни в API, ни в UI не используются |

---

### 10.2. Топ-15 пробелов для директора по важности (с оценкой трудоёмкости)

| № | Пробел | Описание и влияние на бизнес | Оценка (S/M/L) |
|---|---|---|:---:|
| **1** | **Обработка блокировки центра (`TenantSuspendedError`)** | При статусах `OVERDUE` или `BLOCKED` директор получает техническую ошибку 500 из-за отсутствия `error.tsx` в `/center`, вместо понятной страницы оплаты подписки | **S** |
| **2** | **Привязка родителей к ученикам (`ParentLink`)** | Директор не может привязать родителя к ребенку через интерфейс, а при активации инвайта родителем связь не создается | **M** |
| **3** | **Интерфейс управленческих финансов (ACC-2)** | API счетов, транзакций, категорий, сторно и закрытия периодов есть, но директору негде этим пользоваться в UI | **L** |
| **4** | **Форма создания и редактирования филиалов** | Экран `/center/branches` не имеет кнопок создания/редактирования, отправляя пользователя в curl | **S** |
| **5** | **Форма создания объявлений центра** | Экран `/center/announcements` не имеет кнопки и модалки публикации объявлений | **S** |
| **6** | **Редактирование профилей студентов и сотрудников** | Директор не может исправить опечатку в ФИО, телефоне или email студента/учителя после создания | **M** |
| **7** | **Индикатор остатка квоты тарифа в UI** | Директор не видит, сколько свободных мест (студентов, учителей, курсов) осталось по текущему тарифу | **S** |
| **8** | **Редактирование программы курса (модули и уроки)** | В `/center/courses` нельзя добавлять новые модули и темы уроков после создания курса | **M** |
| **9** | **Битый редирект после смены пароля** | `/account/change-password` перенаправляет директора на платформенную панель `/platform-admin` | **S** |
| **10**| **Символ валюты в приеме оплат** | В модалке `/center/payments` отображается рубль `(₽)` вместо сума `(UZS)` | **S** |
| **11**| **Расчет зарплат учителей по реальным ставкам** | В отчетах `/center/reports` часы и зарплата учителей считаются по формуле-заглушке, игнорируя `TeacherSalaryRate` | **M** |
| **12**| **Экран создания тикетов в поддержку** | В `/center/support` директор видит список тикетов, но не имеет формы открытия нового обращения | **S** |
| **13**| **Интерфейс учебных материалов и тестов** | Модели и API для файлов и онлайн-тестов созданы, но у центра нет экранов в сайдбаре | **L** |
| **14**| **Экран журнала аудита центра для директора** | Право `audit.read` у директора есть, но отдельной страницы просмотра журнала действий центра нет | **M** |
| **15**| **Реальные транспорты уведомлений (Email и SMS)** | Без настройки боевого `RESEND_API_KEY` и интеграции с Eskiz.uz приглашения и пароли оседают в логах сервера | **M** |

---

### 10.3. Риски безопасности и изоляции
1. **Отсутствие утечек данных между центрами:** Архитектура `requireTenantAccess` с получением `tenantDb` надежно изолирует запросы по `centerId`. Данные других учебных центров директор получить не может.
2. **Риск потери доступа директора:** Единственный директор центра защищен от случайного самораскрепления (`SOLE_DIRECTOR_CONFLICT`).
3. **Безопасность сброса паролей:** Директор не видит пароли пользователей в открытом виде и не может произвольно скомпрометировать чужой аккаунт. Пользователи активируют аккаунты через одноразовые токены.
4. **Безопасность финансов:** Доступ сотрудников платформы к финансам центра строго изолирован и требует обязательной имперсонации с фиксацией в аудит-логе.

---

### 10.4. Вопросы к заказчику
1. **Управленческие финансы (ACC-2):** Планируется ли вывод полноценной бухгалтерии (счета, категории, двойная запись, закрытие месяца) в отдельный раздел сайдбара `/center/finance` для Директора и Бухгалтера, или достаточно упрощенной кассы `/center/payments`?
2. **Сценарий связывания родителя и ученика:** Как удобнее организовать привязку: через выдачу персонального родительского кода на карточке ученика, либо через ввод номера телефона родителя при создании ученика с автоматическим поиском/созданием аккаунта?
3. **Редактирование модулей и уроков:** Должен ли директор иметь возможность визуального редактирования учебного плана курса (конструктор тем и уроков), или курсы предполагаются импортируемыми централизованно?
4. **SMS-шлюз для Узбекистана:** Планируется ли интеграция аккаунта Eskiz.uz / PlayMobile для реальной отправки СМС с кодами доступа и напоминаниями об оплате?
