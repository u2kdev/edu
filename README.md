<div align="center">
  <img src="./docs/screenshots/banner.png" alt="e-darschi — LMS для учебных центров" width="100%" />
</div>

<h1 align="center">e-darschi · LMS Platform</h1>

<p align="center">
  Мультиарендная SaaS-платформа для учебных центров и школ<br />
  <sub>Расписание · Посещаемость · Журнал · Домашние задания · Оплаты · Мобильный кабинет</sub>
</p>

<p align="center">
  <a href="https://nextjs.org"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-0B1220?style=for-the-badge&logo=nextdotjs&logoColor=white" /></a>
  <a href="https://www.typescriptlang.org"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" /></a>
  <a href="https://www.postgresql.org"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" /></a>
  <a href="https://www.prisma.io"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-5-1B222D?style=for-the-badge&logo=prisma&logoColor=white" /></a>
  <a href="https://tailwindcss.com"><img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" /></a>
</p>

<p align="center">
  <img alt="tests" src="https://img.shields.io/badge/tests-1166_passing-16A34A?style=flat-square" />
  <img alt="coverage" src="https://img.shields.io/badge/coverage-79%25_stmts-1D4ED8?style=flat-square" />
  <img alt="i18n" src="https://img.shields.io/badge/i18n-RU_·_UZ--Latn-0EA5E9?style=flat-square" />
  <img alt="theme" src="https://img.shields.io/badge/theme-light_·_dark-0B1220?style=flat-square" />
  <img alt="status" src="https://img.shields.io/badge/status-production_ready-16A34A?style=flat-square" />
</p>

<p align="center">
  <a href="#-о-проекте">О проекте</a> ·
  <a href="#-возможности">Возможности</a> ·
  <a href="#-архитектура">Архитектура</a> ·
  <a href="#-быстрый-старт">Быстрый старт</a> ·
  <a href="#-качество-и-тесты">Качество</a> ·
  <a href="#-безопасность">Безопасность</a> ·
  <a href="#-документация">Документация</a>
</p>

---

## ✦ О проекте

**e-darschi** — облачная LMS, которую учебный центр арендует как сервис: без серверов, без разработчиков
и без ручной настройки. Один экземпляр приложения обслуживает множество центров, при этом данные каждого
центра физически лежат в общей базе, но **изолированы на уровне клиента Prisma** — запрос без `centerId`
просто не соберётся.

Платформа закрывает полный цикл работы центра: от заявки и пробного урока до оплат, отчётности и
мобильного кабинета родителя.

<table>
  <tr>
    <td align="center" width="25%"><b>40</b><br /><sub>моделей данных</sub></td>
    <td align="center" width="25%"><b>56</b><br /><sub>экранов</sub></td>
    <td align="center" width="25%"><b>6</b><br /><sub>ролей</sub></td>
    <td align="center" width="25%"><b>133</b><br /><sub>тестовых файла</sub></td>
  </tr>
</table>

---

## ✦ Скриншоты

<table>
  <tr>
    <td width="50%"><img src="./docs/screenshots/landing-light.png" alt="Лендинг — светлая тема" /></td>
    <td width="50%"><img src="./docs/screenshots/landing-dark.png" alt="Лендинг — тёмная тема" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Светлая тема</b> — основная для публичной части</sub></td>
    <td align="center"><sub><b>Тёмная тема</b> — переключатель в шапке, выбор запоминается</sub></td>
  </tr>
</table>

<table>
  <tr>
    <td width="33%"><img src="./docs/screenshots/features-dark.png" alt="Преимущества" /></td>
    <td width="33%"><img src="./docs/screenshots/apps-dark.png" alt="Мобильная экосистема" /></td>
    <td width="33%"><img src="./docs/screenshots/pricing-dark.png" alt="Тарифы" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Преимущества</sub></td>
    <td align="center"><sub>Мобильная экосистема</sub></td>
    <td align="center"><sub>Тарифы</sub></td>
  </tr>
</table>

<p align="center">
  <img src="./docs/screenshots/landing-mobile-dark.png" alt="Мобильная версия" width="300" />
  <br />
  <sub>Мобильная версия: тот же интерфейс, адаптированный под 390 px</sub>
</p>

---

## ✦ Возможности

### 🏛 Для платформы

| Модуль | Что умеет |
| :--- | :--- |
| **Центры** | Создание, карточка центра, владельцы, блокировка / пауза / отмена подписки с мгновенным отзывом доступа |
| **Тарифы и подписки** | Планы, лимиты (ученики, филиалы, сотрудники), статусы оплат и продлений |
| **Поддержка** | Тикеты центров, ответы, доступ `PLATFORM_SUPPORT` в режиме **только чтение** |
| **Аудит** | Неизменяемый журнал критических действий по всей платформе |
| **SEO и developer API** | Управление метаданными, health-check, аудит и владельцы центров |

### 🏫 Для учебного центра

| Модуль | Что умеет |
| :--- | :--- |
| **Студенты и родители** | Карточки, статусы (`ACTIVE` / `ARCHIVED`), привязка родитель → ребёнок, импорт и экспорт CSV |
| **Группы и курсы** | Курсы, модули, группы, зачисления, преподаватели, филиалы |
| **Расписание** | Слоты с защитой от конфликтов преподавателя / аудитории / группы, замены, отмена с причиной, экспорт в iCal |
| **Посещаемость** | Отметки по занятию, опоздания, автоматическое попадание в зону внимания при посещаемости < 80% |
| **Журнал оценок** | Оценки A–F, средний балл, GPA, блокировка журнала после закрытия периода |
| **Домашние задания** | Выдача, сдача, проверка, обратная связь, вложения, тесты с автопроверкой |
| **Оплаты** | Начисления, оплаты, задолженности, статусы (Payme / Click / Uzum — интеграционные точки) |
| **Отчёты** | Посещаемость, успеваемость, выручка, загрузка групп и преподавателей |
| **Объявления и уведомления** | Рассылки центром, e-mail, Telegram / SMS / push-транспорты |
| **Сотрудники и инвайты** | Приглашения по коду, роли, отзыв сессий, журнал действий |

### 👩‍🏫 Для преподавателя · 🎓 студента · 👨‍👩‍👧 родителя

- **Преподаватель** — свои группы и расписание, посещаемость, оценки, домашние задания и тесты.
- **Студент** — расписание, материалы, сдача ДЗ, онлайн-тесты с мгновенным результатом, свои оценки и GPA.
- **Родитель** — успеваемость, посещаемость и оплаты ребёнка в одном экране.

---

## ✦ Архитектура

```mermaid
flowchart TB
    B["🌐 Браузер<br/>RU · UZ-Latn"] -->|HTTPS| N["Next.js 14 · App Router<br/>Server Components + Route Handlers"]
    N -->|"requireTenantAccess()"| T["tenantCtx.getTenantDb()<br/>Prisma Client, ограниченный centerId"]
    T --> P[("PostgreSQL 16<br/>40 моделей · 13 миграций")]
    N --> A["AuditLog · UserSession<br/>RateLimitRecord · EmailOutbox"]
    A --> P

    style B fill:#0B1220,stroke:#1D4ED8,color:#fff
    style N fill:#1D4ED8,stroke:#1D4ED8,color:#fff
    style T fill:#EEF3FF,stroke:#1D4ED8,color:#0B1220
    style P fill:#0B1220,stroke:#5B8CFF,color:#fff
    style A fill:#F6F7FB,stroke:#C7D2E2,color:#0B1220
```

**Ключевые решения**

- **Изоляция арендаторов в коде, а не в договорённостях.** Модели с `centerId` доступны только через
  обёртку `getTenantDb()`: она подставляет `centerId` в каждый запрос, отклоняет попытки его переопределить
  и проверяет внешние связи по DMMF. Импорт «сырого» клиента запрещён правилом ESLint.
- **Fail-closed.** Нет сессии — редирект на логин *до* tenant-проверки; нет доступа — 403; центр на паузе —
  запись запрещена, чтение остаётся.
- **Сессии с отзывом.** JWT в httpOnly cookie + запись `UserSession` с хэшем `jti`: выход, смена пароля и
  блокировка центра гасят токен на сервере.
- **Единый UI-язык.** Токены `ink / paper / line / brand` и scoped-тема `.public-shell`; админ-панели не
  зависят от публичной темы.

---

## ✦ Стек

| Слой | Технологии |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide |
| **Backend** | Route Handlers, Zod, JWT (httpOnly + `jti`), bcrypt, PostgreSQL rate limiter |
| **Данные** | PostgreSQL 16, Prisma 5 (40 моделей, 13 миграций) |
| **Интеграции** | Resend (e-mail), S3 / Cloudflare R2 (presigned uploads), Telegram / SMS-транспорты |
| **Качество** | Vitest + Testing Library (jsdom), ESLint, `tsc --noEmit`, coverage v8, GitHub Actions |
| **Инфраструктура** | Docker, docker-compose (prod), healthcheck, Vercel-совместимая сборка |

---

## ✦ Быстрый старт

### 1 · Требования

- Node.js **≥ 20** (см. `.nvmrc`)
- npm **≥ 9**
- PostgreSQL **16**

### 2 · Установка

```bash
git clone https://github.com/u2kdev/edu.git
cd edu
npm ci
```

### 3 · Окружение

```bash
cp .env.example .env
```

Минимум для локального запуска:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/lms?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/lms?schema=public"
JWT_SECRET="super-secret-jwt-key-at-least-32-chars-long"
APP_URL="http://localhost:3000"
DEV_LOGIN="true"
DEV_EMAIL_LOG="false"
```

<details>
<summary><b>Полный список переменных</b> — e-mail, cron, storage, proxy</summary>

| Переменная | Назначение |
| :--- | :--- |
| `EMAIL_PROVIDER` | `memory` · `console` · `resend` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Отправка писем через Resend |
| `CRON_SECRET` | Защита `/api/cron/*` |
| `FEATURE_UPLOADS`, `STORAGE_*` | Включение и настройка S3 / R2 |
| `TRUSTED_PROXY_HOPS` | Сколько прокси перед приложением (IP для rate limit и аудита) |
| `NEXT_PUBLIC_APP_URL` | Публичный адрес приложения |

Полный перечень и комментарии — в [`.env.example`](./.env.example).
</details>

### 4 · База данных

```bash
npm run prisma:generate      # Prisma Client
npx prisma migrate deploy    # применить миграции
npm run prisma:seed          # тарифы, суперадмин, демо-центр
```

### 5 · Запуск

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) — лендинг, [http://localhost:3000/login](http://localhost:3000/login) — вход.
Демо-роли и тестовые аккаунты описаны в [`docs/DEMO.md`](./docs/DEMO.md).

---

## ✦ Скрипты

| Команда | Что делает |
| :--- | :--- |
| `npm run dev` | Dev-сервер Next.js |
| `npm run build` / `npm start` | Production-сборка и запуск |
| `npm run verify` | Полный контур: `tsc` → ESLint → Vitest → build |
| `npm run lint` | ESLint (`src` + `tests`) |
| `npm test` / `npm run test:watch` | Тесты один раз / в watch-режиме |
| `npm run test:coverage` | Тесты с покрытием (порог CI: 66 / 55 / 62 / 66) |
| `npm run prisma:generate` | Генерация Prisma Client |
| `npm run prisma:seed` | Начальные данные |
| `npm run prisma:db-push` | Быстрая синхронизация схемы (dev) |
| `npm run setup:first-owner` | Создание первого суперадмина |

---

## ✦ Качество и тесты

```bash
npm run verify
```

| Проверка | Результат |
| :--- | :--- |
| `tsc --noEmit` | **0 ошибок** |
| ESLint | **0 ошибок** |
| Vitest | **133 файла · 1166 тестов** на реальной PostgreSQL |
| Coverage | **79.6 % stmts · 68.8 % branch · 86.5 % funcs · 80.5 % lines** |
| `next build` | ✅ успешно |

Тесты работают с отдельной базой (`TEST_DATABASE_URL`, по умолчанию
`postgresql://postgres:admin@localhost:5432/lms_test`) и создают данные в транзакциях.

<details>
<summary><b>CI</b> — что запускается на каждый push и pull request</summary>

`.github/workflows/ci.yml`, ветки `main` и `feature/lms-upgrade`, сервисный PostgreSQL 16:

1. `npm ci`
2. `npx prisma generate`
3. `npx prisma migrate deploy`
4. `npx tsc --noEmit`
5. `npm run lint`
6. `npx vitest run`
7. `npm run build`
</details>

---

## ✦ Безопасность

- **Мультитенантность** — `centerId` принудительно добавляется в каждый запрос; попытка подменить его
  или сослаться на чужую запись возвращает `403`.
- **Аутентификация** — httpOnly JWT, серверные сессии с `jti`, отзыв при выходе и смене пароля,
  подтверждение e-mail, блокировка после серии неудачных попыток.
- **Rate limiting** — в PostgreSQL (`RateLimitRecord`), работает при нескольких инстансах; fail-closed.
- **CSRF и CSP** — проверка origin для мутаций, строгие заголовки безопасности.
- **Приватность оценок** — правильные ответы тестов не уходят на клиент до сдачи.
- **Аудит** — `AuditLog` и `ActivityLog` фиксируют критичные действия платформы и центра.
- **Пароли** — bcrypt, политика сложности, сброс по одноразовому токену.

> ⚠️ Если вы форкнули или склонировали репозиторий: `.env` и `transmitter/` не входят в репозиторий,
> но **история прежних коммитов могла содержать токен Telegram-бота**. Перед публичным деплоем
> смените `TELEGRAM_BOT_TOKEN` в @BotFather и все ключи из `.env.example`.

---

## ✦ Роли

| Роль | Доступ |
| :--- | :--- |
| `SUPERADMIN` / `PLATFORM_ADMIN` | Платформа: центры, тарифы, подписки, поддержка, аудит, SEO |
| `PLATFORM_SUPPORT` | Поддержка платформы, **read-only** внутри центра |
| `DIRECTOR` | Центр: сотрудники, студенты, группы, расписание, оплаты, отчёты, тариф |
| `TEACHER` | Свои группы: расписание, посещаемость, оценки, ДЗ и тесты |
| `STUDENT` | Расписание, материалы, ДЗ, тесты, оценки, посещаемость |
| `PARENT` | Успеваемость, посещаемость и оплаты ребёнка |

---

## ✦ Документация

| Документ | О чём |
| :--- | :--- |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Мультитенантность, `getTenantDb`, слой данных |
| [`docs/DEMO.md`](./docs/DEMO.md) | Демо-роли и сценарии показа |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Production-деплой, Docker, переменные |
| [`docs/I18N.md`](./docs/I18N.md) | Локализация RU / UZ-Latn, ключи и правила |
| [`docs/RECOVERY.md`](./docs/RECOVERY.md) | Бэкапы и восстановление |
| [`docs/LAUNCH_CHECKLIST.md`](./docs/LAUNCH_CHECKLIST.md) | Чек-лист перед запуском |
| [`docs/STATUS.md`](./docs/STATUS.md) · [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Состояние и планы |

---

## ✦ Деплой

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

- `Dockerfile` — multi-stage сборка, non-root пользователь, healthcheck.
- `docker-compose.prod.yml` — приложение + PostgreSQL + переменные окружения.
- `vercel.json` — альтернативный деплой на Vercel.
- Пошагово — в [`DEPLOY.md`](./DEPLOY.md) и [`docs/DEPLOY.md`](./docs/DEPLOY.md).

---

<div align="center">

**e-darschi** — меньше бумажной работы, больше времени на учеников.

<sub>Сделано в Ташкенте · © 2026 e-darschi. Все права защищены.</sub>

</div>
