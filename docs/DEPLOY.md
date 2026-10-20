# Руководство по развертыванию в Production (Production Deployment Guide)

Данное руководство содержит исчерпывающие пошаговые инструкции по развертыванию образовательной платформы e-Darschi / LMS в рабочей среде с использованием стека **Vercel Pro** и **Neon Serverless Postgres**.

---

## 1. Архитектура и требования

- **Фреймворк**: Next.js 14 (App Router)
- **Среда выполнения**: Node.js 20.x или 22.x LTS (см. `.nvmrc`)
- **Хостинг приложения**: Vercel Pro (Serverless Functions + Edge Middleware)
- **База данных**: Neon Serverless PostgreSQL (версия 15+)
- **Транзакционный пулер**: Neon PgBouncer Connection Pooler
- **Почтовый шлюз**: Resend (Transactional Email API)
- **Хранилище файлов**: S3-совместимое хранилище (AWS S3 / Cloudflare R2), по умолчанию загрузки отключены (`FEATURE_UPLOADS=false`)

---

## 2. Настройка базы данных Neon PostgreSQL

Serverless-архитектура Vercel порождает изолированные инстансы функций, каждый из которых может инициировать соединение с базой данных. Для предотвращения исчерпания лимита соединений Postgres на Neon обязательно разделение на **пулер транзакций** и **прямое соединение**.

### Шаг 2.1. Создание проекта в Neon
1. Зарегистрируйтесь или войдите в консоль [Neon Console](https://console.neon.tech/).
2. Создайте новый проект (например, `lms-production`).
3. Выберите регион, максимально близкий к региону развертывания Vercel (например, `aws-eu-central-1` во Франкфурте).

### Шаг 2.2. Получение строк подключения
В панели управления проектом перейдите в раздел **Connection Details**:

1. **Строка подключения через пулер (`DATABASE_URL`)**:
   - Включите переключатель **«Connection Pooling»** (PgBouncer).
   - Скопируйте строку подключения. Она содержит хост с суффиксом `-pooler` и параметр `sslmode=require`:
     ```env
     DATABASE_URL="postgres://username:password@ep-xyz-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
     ```
   - Данная строка используется приложением в Next.js runtime для регулярных запросов.

2. **Прямая строка подключения (`DIRECT_URL`)**:
   - Отключите переключатель «Connection Pooling» (Direct connection).
   - Скопируйте строку прямого соединения без суффикса `-pooler`:
     ```env
     DIRECT_URL="postgres://username:password@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require"
     ```
   - **Важно:** `DIRECT_URL` строго обязателен для выполнения DDL-миграций Prisma (`prisma migrate deploy`), так как транзакционный пулер PgBouncer не поддерживает транзакционные DDL-команды и Prisma advisory locks.

### Шаг 2.3. Конфигурация в Prisma
В файле `prisma/schema.prisma` источник данных сконфигурирован для автоматического разделения:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### Шаг 2.4. Выполнение первичных миграций
Перед первым запуском приложения выполните накат миграций на базу данных с использованием `DIRECT_URL`:
```bash
npx prisma migrate deploy
```

---

## 3. Развертывание на Vercel Pro

### Шаг 3.1. Создание проекта в Vercel
1. Войдите в аккаунт [Vercel Pro](https://vercel.com/).
2. Нажмите **Add New...** -> **Project** и импортируйте репозиторий GitHub.
3. Настройки проекта (**Project Settings**):
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./`
   - **Build Command**: `npm run build` (вызывает `prisma generate && next build`)
   - **Output Directory**: `.next`
   - **Node.js Version**: `20.x` в настройках General Settings.

---

## 4. Переменные окружения (Environment Variables)

Все обязательные переменные окружения должны быть добавлены в настройках проекта Vercel (**Settings -> Environment Variables**) для окружения **Production** (и **Preview** при необходимости).

| Переменная | Описание | Обязательность | Пример значения |
|---|---|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL через пулер Neon (PgBouncer) | **Строго обязательно** | `postgres://user:pass@ep-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Прямое подключение к PostgreSQL без пулера для миграций | **Строго обязательно** | `postgres://user:pass@ep.region.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Криптографический ключ для подписи сессионных токенов (не менее 32 символов) | **Строго обязательно** | `openssl rand -base64 32` |
| `APP_URL` | Канонический базовый URL платформы без завершающего слеша | **Строго обязательно** | `https://lms.yourdomain.uz` |
| `EMAIL_PROVIDER` | Почтовый драйвер. В production должен иметь значение `resend` | **Строго обязательно** | `resend` |
| `RESEND_API_KEY` | Секретный API-ключ от сервиса Resend | **Строго обязательно** | `re_123456789abcdef` |
| `EMAIL_FROM` | Валидированный email отправителя в сервисе Resend | **Строго обязательно** | `Academia LMS <noreply@yourdomain.uz>` |
| `TRUSTED_PROXY_HOPS` | Количество доверенных обратных прокси. Для Vercel равно `1` (при Vercel + Cloudflare — `2`) | **Строго обязательно** | `1` |
| `CRON_SECRET` | Секретный токен для авторизации Vercel Cron вызовов в эндпоинтах `/api/cron/*` | **Строго обязательно** | `openssl rand -hex 24` |
| `FEATURE_UPLOADS` | Флаг включения загрузок S3/R2 (`false` по умолчанию) | Опционально | `false` |
| `DEV_LOGIN` | Флаг режима обхода авторизации для разработки (`false` в production) | Опционально | `false` |
| `DEV_EMAIL_LOG` | Флаг вывода писем в консоль (`false` в production) | Опционально | `false` |

> [!CAUTION]
> **Контроль запуска в Production**: При старте сервера в `NODE_ENV=production` приложение выполняет валидацию всех обязательных переменных окружения (`JWT_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `APP_URL`, `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `TRUSTED_PROXY_HOPS`, `CRON_SECRET`). При отсутствии любой из них или если длина `JWT_SECRET < 32` сервер немедленно выбрасывает фатальную ошибку.

> [!NOTE]
> Сборка приложения (`next build`) не требует боевых секретов базы данных или Resend. Проверка осуществляется исключительно во время запуска сервера (server runtime).

---

## 5. Настройка пользовательского домена (Custom Domain)

1. В панели управления Vercel перейдите в **Settings -> Domains**.
2. Добавьте канонический домен вашей платформы, например: `lms.yourdomain.uz`.
3. Настройте DNS-записи у вашего DNS-провайдера:
   - Для субдомена (`lms.yourdomain.uz`): добавьте запись `CNAME` на `cname.vercel-dns.com`.
   - Для корневого домена (`yourdomain.uz`): добавьте запись `A` на IP `76.76.21.21`.
4. Vercel автоматически выпустит и настроит бесплатный SSL-сертификат Let's Encrypt.
5. Убедитесь, что переменная `APP_URL` точно соответствует вашему домену (`https://lms.yourdomain.uz`).

---

## 6. Настройка Vercel Cron (Фоновые задачи)

В корне репозитория настроен файл `vercel.json` с конфигурацией планировщика Cron-задач:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/email-retry",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

### Задачи Cron:
1. `/api/cron/cleanup`:
   - Запускается раз в сутки в 03:00 UTC.
   - Выполняет ротацию и очистку устаревших записей `RateLimitRecord` и успешно отправленных или безнадежно отмененных писем в `EmailOutbox`.
2. `/api/cron/email-retry`:
   - Запускается каждые 10 минут.
   - Повторяет отправку неотправленных писем из очереди `EmailOutbox` с экспоненциальной задержкой и лимитом до 5 попыток.

### Защита эндпоинтов Cron:
Все эндпоинты `/api/cron/*` защищены заголовком `Authorization: Bearer <CRON_SECRET>`. Vercel Pro автоматически передает этот заголовок при вызове Cron-задач. Несанкционированные вызовы отклоняются со статусом `401 Unauthorized`.

---

## 7. Безопасность и блокировка тестовых интерфейсов

В рабочей среде приложение автоматически применяет следующие меры защиты:

1. **Заголовки безопасности (Security Headers)**:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Content-Security-Policy`: базовые безопасные директивы CSP.
2. **Безопасность Cookie**:
   - `HttpOnly: true` (защита от кражи через XSS).
   - `Secure: true` (передача только по HTTPS).
   - `SameSite: Lax` (защита от CSRF-атак).
3. **Блокировка Dev-поверхностей в Production**:
   - Маршруты `/dev/ui-kit`, `dev-login` и тестовые сиды возвращают ошибку `404 Not Found` или `403 Forbidden`.
4. **Отказоустойчивый лимитер (Fail-Closed Rate Limiter)**:
   - При сбое базы данных критические маршруты авторизации (`/api/auth/login`, `/api/auth/register`, `/api/auth/reset-password`) возвращают код `503 Service Unavailable`, предотвращая обход ограничений через намеренное переполнение памяти.
   - Параметр `TRUSTED_PROXY_HOPS=1` обеспечивает корректное извлечение клиентского IP из `X-Forwarded-For`.

---

## 8. Первый запуск и инициализация Владельца Платформы (Platform Owner)

После наката миграций в системе нет ни одной учетной записи. Для инициализации первого суперпользователя платформы предусмотрено два безопасных механизма.

### Способ А: Веб-мастер первичной настройки (`/setup`)
1. Откройте в браузере страницу:
   ```
   https://lms.yourdomain.uz/setup
   ```
2. Данная страница доступна **исключительно** до тех пор, пока в базе данных насчитывается **0** пользователей с ролью `SUPERADMIN`.
3. Заполните форму первичной инициализации:
   - Имя владельца платформы
   - Email адрес
   - Надежный пароль (не менее 10 символов)
4. После создания первого суперпользователя страница `/setup` **безвозвратно блокируется** и при последующих обращениях возвращает `403 Forbidden`.

### Способ Б: Консольная команда (`npm run setup:first-owner`)
Вы можете инициализировать владельца платформы через защищенную CLI-команду:
```bash
npm run setup:first-owner
```
Команда запускает `scripts/first-owner.ts`, которая:
- Проверяет наличие суперпользователей в БД.
- Безопасно запрашивает учетные данные через консольный ввод (пароль скрыт) либо считывает переменные окружения `SETUP_SUPERADMIN_EMAIL`, `SETUP_SUPERADMIN_PASSWORD`, `SETUP_SUPERADMIN_NAME`.
- Ни при каких обстоятельствах не выводит пароль в логи или stdout.
- Создает аккаунт `SUPERADMIN` и активирует платформу.

---

## 9. План резервного копирования и отката (Backup & Rollback)

### 9.1. Резервное копирование базы данных (Backup)

1. **Автоматический PITR в Neon**:
   - Neon Serverless Postgres автоматически сохраняет журнал опережающей записи (WAL).
   - В консоли Neon вы можете выполнить Point-in-Time Recovery (PITR) к любой секунде за последние 7–30 дней.
2. **Создание ветки (Branching) перед крупным обновлением**:
   - В консоли Neon создайте ветку `pre-release-snapshot` перед накатом новых миграций.
3. **Холодный дамп (Cold Backup)**:
   - Рекомендуется выполнять дамп базы данных перед каждым масштабным релизом:
     ```bash
     pg_dump -d "$DIRECT_URL" -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump
     ```

### 9.2. Стратегия отката (Rollback)

1. **Мгновенный откат приложения на Vercel**:
   - Перейдите в Vercel Dashboard -> **Deployments**.
   - Найдите предыдущий стабильный деплой и нажмите **«Instant Rollback»**.
   - Трафик мгновенно переключается на предыдущую версию кода без простоя.
2. **Откат состояния базы данных**:
   - Если релиз содержал обратно-несовместимые изменения DDL, восстановите базу данных из снапшота Neon или дампа:
     ```bash
     pg_restore --clean --if-exists -d "$DIRECT_URL" backup_YYYYMMDD_HHMMSS.dump
     ```
