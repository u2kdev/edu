# Руководство по развёртыванию (Deployment Guide)

Данный документ описывает требования к окружению и шаги для развёртывания платформы e-Darschi / Aziz LMS Platform.

---

## 1. Переменные окружения (Environment Variables)

### База данных (PostgreSQL)

| Переменная | Описание | Пример |
|---|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL (может указывать на Connection Pooler, например PgBouncer / Supabase / Neon / Prisma Accelerate) | `postgresql://user:pass@ep-pooler.eu-central-1.aws.neon.tech/lms?pgbouncer=true` |
| `DIRECT_URL` | Прямое подключение к PostgreSQL без пулера соединений. Обязательно для выполнения миграций Prisma (`prisma migrate deploy`) | `postgresql://user:pass@ep-direct.eu-central-1.aws.neon.tech/lms` |

> **Важно**: При использовании управляемых БД (Supabase, Neon, AWS Aurora Serverless) подключение через транзакционный пулер не поддерживает выполнение DDL-миграций. `DIRECT_URL` обеспечивает прямое соединение с базой данных для безопасного наката миграций.

### Безопасность и аутентификация

| Переменная | Описание | Пример |
|---|---|---|
| `JWT_SECRET` | Секретный ключ для подписи токенов сессий (минимум 32 символа) | `a-very-long-and-secure-random-secret-key-32-chars` |
| `TRUSTED_PROXY_HOPS` | Количество доверенных обратных прокси (1 для Vercel/Render/Nginx) | `1` |

### Приложение и интеграции

| Переменная | Описание | По умолчанию |
|---|---|---|
| `APP_URL` / `NEXT_PUBLIC_APP_URL` | Канонический URL инстанса | `http://localhost:3000` |
| `FEATURE_UPLOADS` | Флаг включения загрузок файлов (S3/R2) | `false` |
| `EMAIL_PROVIDER` | Драйвер почты (`resend`, `smtp`, `console`) | `console` |

---

## 2. Развёртывание на чистой базе данных

1. Установите переменные `DATABASE_URL` и `DIRECT_URL`.
2. Выполните накат миграций:
   ```bash
   npx prisma migrate deploy
   ```
3. Сгенерируйте Prisma Client:
   ```bash
   npx prisma generate
   ```
4. (Опционально) Заполните начальные данные:
   ```bash
   npm run prisma:seed
   ```

---

## 3. Сборка и запуск приложения

```bash
npm ci
npm run build
npm start
```


---

## 4. Настройка фоновых задач (Cron)

Платформа использует cron-эндпоинты, защищенные заголовком авторизации `Authorization: Bearer <CRON_SECRET>`:

- `POST /api/cron/email-outbox` — отправка писем из очереди Outbox (каждые 5 минут).
- `POST /api/cron/click-reconcile` — сверка зависших платежных намерений Click и истечение просроченных инвойсов (каждые 15 минут).
- `POST /api/cron/subscriptions` — проверка сроков тарифов центров и блокировка при просрочке (раз в сутки в 03:00 UTC).
- `POST /api/cron/payment-reminders` — ежечасные напоминания об оплате, рассылки по расписанию и досылка уведомлений после тихих часов (`0 * * * *`).
- `POST /api/cron/cleanup` — очистка устаревших сессий и лимитов (раз в сутки в 04:00 UTC).

### Вариант A: Vercel Pro
В `vercel.json` настроены все cron-эндпоинты (`/api/cron/email-outbox`, `/api/cron/click-reconcile`, `/api/cron/payment-reminders`, `/api/cron/subscriptions`, `/api/cron/cleanup`). Секрет `CRON_SECRET` устанавливается в переменных окружения Vercel.

### Вариант B: Внешний планировщик (Vercel Hobby / Render / Dokku / VPS)
На бесплатном тарифе Vercel Hobby разрешены только суточные cron-задачи. Для частых задач (очередь писем, напоминания об оплате и сверка Click) настройте внешний планировщик (например, cron-job.org, Cloudflare Worker, Upstash QStash, GitHub Actions или системный crontab):

```bash
# Пример вызова через curl:
*/5 * * * * curl -X POST https://your-domain.com/api/cron/email-outbox -H "Authorization: Bearer $CRON_SECRET"
*/15 * * * * curl -X POST https://your-domain.com/api/cron/click-reconcile -H "Authorization: Bearer $CRON_SECRET"
0 * * * * curl -X POST https://your-domain.com/api/cron/payment-reminders -H "Authorization: Bearer $CRON_SECRET"
0 3 * * * curl -X POST https://your-domain.com/api/cron/subscriptions -H "Authorization: Bearer $CRON_SECRET"
0 4 * * * curl -X POST https://your-domain.com/api/cron/cleanup -H "Authorization: Bearer $CRON_SECRET"
```

---

## 5. Резервное копирование базы данных (зашифрованный pg_dump по расписанию)

Для обеспечения непрерывности бизнеса и безопасности данных бэкап PostgreSQL выполняется через утилиту `pg_dump` со сжатием и шифрованием по расписанию.

### Скрипт автоматического резервного копирования (`scripts/backup-db.sh`):

Скрипт шифрует дамп алгоритмом **AES-256-CBC с PBKDF2 (100 000 итераций)** с использованием переменной `BACKUP_ENCRYPTION_KEY`, гарантируя нулевую утечку секретов в `ps aux`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/edarschi}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
BACKUP_FILE="${BACKUP_DIR}/edarschi_${TIMESTAMP}.sql.gz.enc"

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY must be set!" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

pg_dump "${DB_URL}" --clean --if-exists --no-owner --no-privileges \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -out "${BACKUP_FILE}"

if [ -s "${BACKUP_FILE}" ]; then
  chmod 600 "${BACKUP_FILE}"
  echo "Backup successful: ${BACKUP_FILE}"
else
  echo "ERROR: Backup file is empty!" >&2
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Ротация старых копий (хранение 30 дней)
find "${BACKUP_DIR}" -name "edarschi_*.sql.gz.enc" -type f -mtime +"${RETENTION_DAYS}" -delete
```

### Настройка в crontab сервера (ежедневно в 03:00 ночи):

```bash
# Запуск ежедневно в 03:00 ночи по времени Ташкента (UTC+5)
0 3 * * * BACKUP_ENCRYPTION_KEY="<your-secret>" /bin/bash /opt/edarschi/scripts/backup-db.sh >> /var/log/db_backup.log 2>&1
```

### Восстановление из резервной копии:

```bash
# Расшифровка, распаковка и накат дампа:
export BACKUP_ENCRYPTION_KEY="<your-secret>"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass env:BACKUP_ENCRYPTION_KEY -in /var/backups/postgres/edarschi/edarschi_20261111_030000.sql.gz.enc | gunzip | psql "$DIRECT_URL"
```
