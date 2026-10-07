# Аудит проекта SaaS-платформы LMS (aziz-lms-platform)

## 1. Общая информация
- **Название и назначение:** `aziz-lms-platform` — это мультиарендная (multi-tenant) SaaS-платформа для управления учебными центрами. Она позволяет владельцу сдавать платформу в аренду, а арендаторам (учебным центрам) — вести учет студентов, преподавателей, курсов, расписания, оценок и платежей полностью изолированно друг от друга.
- **Стек технологий:**
  - **Фреймворк:** Next.js 14 (App Router)
  - **Язык:** TypeScript
  - **База данных:** Prisma ORM. Для локальной разработки настроен SQLite (`dev.db`), но в `README.md` заявлен PostgreSQL для продакшена.
  - **UI/Стилизация:** Tailwind CSS, Framer Motion, Lucide-React, `clsx`, `tailwind-merge`.
  - **Авторизация:** Custom JWT (токены хранятся в HttpOnly Cookies). Пароли хешируются через `bcryptjs`.
  - **Тестирование:** Vitest.
- **Версии ключевых зависимостей:** `next: ^14.2.15`, `@prisma/client: ^5.21.0`, `react: ^18.3.1`, `tailwindcss: ^3.4.14`.
- **Запуск проекта:**
  - Команды: `npm install`, `npx prisma db push`, `npx prisma db seed` (или `node --import tsx/esm prisma/seed.ts`), `npm run dev`.
  - Переменные окружения (`.env`): `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`.

## 2. Структура проекта
- `src/app` — Маршрутизация Next.js (App Router). Содержит как frontend-страницы, так и backend API-эндпоинты (`/api`). Разделено по зонам видимости: `/center` (панель арендатора), `/platform` (панель владельца платформы), `/dashboard`, `/developer` и др.
- `src/components` — Переиспользуемые React-компоненты (например, `StaffManager.tsx`, `CourseManager.tsx`, `WorkspaceSwitcher.tsx`).
- `src/lib` — Бизнес-логика и утилиты. Ключевые файлы:
  - `auth.ts` — генерация/проверка JWT и работа с сессиями.
  - `db.ts` — инстанс Prisma Client.
  - `tenant.ts` — логика изоляции арендаторов (проверка прав доступа к конкретному учебному центру).
  - `permissions.ts` — централизованная матрица ролей и прав доступа (RBAC).
- `src/i18n` — Локализация (мультиязычность) с поддержкой русского (`ru.json`) и узбекского (`uz-Latn.json`) языков.
- `prisma/` — Конфигурация БД: `schema.prisma` и `seed.ts`.

## 3. База данных
- **Таблицы:** 
  - *Платформа:* `PlatformUser`, `LearningCenter`, `SubscriptionPlan`, `Subscription`, `SupportTicket`, `AuditLog`.
  - *Учебный процесс:* `Branch`, `Subject`, `CenterMembership`, `InviteCode`, `Course`, `CourseModule`, `Lesson`, `ScheduleSlot`, `Group`, `Enrollment`, `Attendance`, `Homework`, `HomeworkSubmission`, `Grade`, `Material`, `Test`, `TestQuestion`, `TestAttempt`.
  - *Финансы и связи:* `CenterPayment`, `ParentLink`, `Announcement`.
- **Связи:** Реализованы корректно на уровне Prisma (One-to-Many, Many-to-Many через промежуточные таблицы вроде `CenterMembership` или `HomeworkMaterial`).
- **Идентификатор арендатора (organization_id):** Поле называется `centerId`.
  - Оно присутствует почти во всех таблицах, связанных с данными арендатора (например, `Course`, `ScheduleSlot`, `Grade`, `CenterPayment`, `CenterMembership`).
  - В дочерних таблицах (например, `Lesson`, `HomeworkSubmission`, `TestAttempt`) `centerId` отсутствует напрямую, но они жестко привязаны к своим родительским сущностям (`CourseModule` -> `Course`, `Group`), что является нормальным (нормализация 3НФ). Главное, что API проверяет принадлежность родителя к правильному `centerId`.
- **Миграции и сиды:** Файл `prisma/schema.prisma` актуален. Команда для сидирования прописана в `package.json` (`prisma:seed`).

## 4. Роли и права доступа
- **Роли Платформы (`PlatformRole`):** `DEVELOPER`, `SUPERADMIN`, `PLATFORM_ADMIN`, `FULL_ACCESS`, `PLATFORM_SUPPORT`, `SEO_ADMIN`.
- **Роли Центра (`CenterRole`):** `DIRECTOR` (владелец/админ центра), `CENTER_ADMIN`, `TEACHER`, `TEACHER_ASSISTANT`, `CENTER_SUPPORT`, `STUDENT`, `PARENT`.
- **Реализация (файл `src/lib/permissions.ts`):** 
  - Права гранулярные (например, `students.read`, `grades.finalize`). 
  - Функция `hasPermission` проверяет наличие прав в зависимости от глобальной роли и роли внутри `centerId`.
- **Назначение админа организации:** Происходит в `POST /api/platform/centers` (файл `src/app/api/platform/centers/route.ts`). Суперадмин указывает email и ФИО директора, для него создается аккаунт `PlatformUser` и `CenterMembership` с ролью `DIRECTOR`.

## 5. Мультиарендность (изоляция организаций)
- **Изоляция:** Реализована через функцию `requireTenantAccess()` в `src/lib/tenant.ts`. 
- **Как определяется:** Поле `activeCenterId` зашито прямо в JWT-токен пользователя.
- **Утечки данных:** Не обнаружено грубых нарушений. Все изученные API-эндпоинты (например, `/api/courses/route.ts`, `/api/groups/route.ts`) вызывают `requireTenantAccess()` и добавляют `centerId: tenantCtx.center.id` в запросы к БД.
- **Управление арендатором:** Реализован жизненный цикл арендатора (`TRIAL`, `ACTIVE`, `PAUSED`, `OVERDUE`, `BLOCKED`, `CANCELLED`). API проверяет статус (например, блокирует доступ преподавателям/студентам, если центр просрочил оплату).

## 6. Функциональность: таблица статусов

| Функция | Статус | Доказательство (Файлы) |
| --- | --- | --- |
| Панель владельца платформы | ✅ Готово | `src/app/platform/page.tsx`, `api/platform/centers/route.ts` |
| Авторизация (вход, JWT) | ✅ Готово | `src/lib/auth.ts`, `api/auth/login/route.ts` |
| Создание организации | ✅ Готово | `api/platform/centers/route.ts`, `api/tenant/onboarding/route.ts` |
| Панель админа организации | ✅ Готово | `src/app/center/page.tsx` |
| Управление персоналом / студентами | ✅ Готово | `src/components/StaffManager.tsx`, `api/tenant/staff/route.ts` |
| Курсы и группы | ✅ Готово | `api/courses/route.ts`, `api/groups/route.ts` |
| Расписание и посещаемость | ✅ Готово | `src/app/center/attendance/page.tsx`, `api/attendance/route.ts` |
| Оценки и успеваемость | ✅ Готово | `api/grades/route.ts` |
| Платежи | ✅ Готово | `api/center-payments/route.ts`, `src/components/PaymentsManager.tsx` |
| Уведомления | 🟡 Частично | В `src/lib/notifications.ts` стоят mock-драйверы (эмуляция Email/SMS). |
| Профиль пользователя | 🟡 Частично | Модели есть, логика частичная в `src/app/center/profile`. |
| Мультиязычность | ✅ Готово | Папка `src/i18n` (ru.json, uz-Latn.json) |

## 7. Бэкенд / API
- Структура REST API на App Router (`src/app/api`).
- Примеры:
  - `POST /api/auth/login` — Авторизация.
  - `GET/POST /api/courses` — Управление курсами (защищено проверкой `requireTenantAccess`).
  - `GET/POST /api/platform/centers` — Управление тенантами (защищено `session.user.platformRole === "SUPERADMIN"`).
- **Валидация:** Делается вручную (проверки `if (!courseId) return NextResponse.json(...)`). Zod не используется повсеместно, что может быть уязвимостью.
- **Ошибки:** Стандартные блоки `try/catch` с возвратом JSON и статусов 400/401/403/500.

## 8. Фронтенд
- Используются Server Components для прямого доступа к базе (`src/app/center/page.tsx`).
- Клиентские компоненты (`"use client"`) лежат в `src/components`.
- **Моки / Заглушки:** 
  - `src/lib/notifications.ts` (строка 48: `Mock/real Email Transporter`).
  - `src/app/api/developer/health/route.ts` (строка 15: `Mock Redis ping`).
  - `src/app/api/tenant/staff/route.ts` (строка 175: `TODO: Send invite email/SMS`).

## 9. Безопасность
- **Хранение паролей:** Используется `bcryptjs.hash`.
- **JWT:** Хранится в `httpOnly: true` куках, что защищает от XSS атак на токен.
- **Защита от SQL-i:** Prisma ORM защищает от классических инъекций.
- **Эскалация прав:** Маловероятна, так как `activeCenterId` берется из подписанного JWT и сверяется с таблицей `CenterMembership` на бэкенде. Сменить `centerId` произвольно пользователь не сможет, если не подделает подпись JWT (`JWT_SECRET`).

## 10. Качество кода и проблемы
- **Технический долг (TODO/FIXME):**
  - Отсутствует реальная отправка Email/SMS.
  - Нет интеграции с реальными платежными системами Узбекистана (Click/Payme) — сейчас платежи добавляются вручную (`CenterPayment`).
- **Валидация:** Отсутствие библиотеки валидации (типа Zod) приводит к громоздким конструкциям `if` в каждом API-роуте и возможным багам приведения типов.
- **Тесты:** В `package.json` есть `vitest`, но покрытие нужно проверять запуском.

## 11. Итоговая оценка
- **Процент готовности:** ~80-85%. Ядро платформы (БД, Мультиарендность, Роли, Основные сущности LMS) написано и работает. Для реального продакшена не хватает интеграции рассылок и платежных систем.
- **Топ-3 критичных проблем:**
  1. **Валидация API-входов:** Нужно внедрить `Zod` для всех `POST/PATCH` запросов, чтобы исключить передачу некорректных типов.
  2. **Уведомления:** Нужно подключить реальный SMTP-сервер и SMS-шлюз (например, eskiz.uz).
  3. **Бэкапы и Продакшен БД:** Перейти с SQLite на PostgreSQL (как указано в `README`), так как SQLite не потянет полноценный SaaS.
- **План действий:**
  1. Настроить PostgreSQL.
  2. Заменить Mock-сервисы (Email/SMS) на реальные API.
  3. Внедрить Zod для валидации эндпоинтов.
  4. Написать недостающие тесты для critical path (оплата, выдача прав).
  5. Продакшен деплой.
