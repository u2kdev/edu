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
- `POST /api/cron/cleanup` — очистка устаревших сессий и лимитов (раз в сутки).

### Вариант A: Vercel Pro
В `vercel.json` настроен вызов каждые 5 минут (`*/5 * * * *`). Секрет `CRON_SECRET` устанавливается в переменных окружения Vercel.

### Вариант B: Внешний планировщик (Vercel Hobby / Render / Dokku / VPS)
На бесплатном тарифе Vercel Hobby разрешены только суточные cron-задачи. Для отправки очереди писем каждые 5 минут настройте внешний планировщик (например, cron-job.org, Cloudflare Worker, Upstash QStash, GitHub Actions или системный crontab):

```bash
# Пример вызова через curl каждые 5 минут:
*/5 * * * * curl -X POST https://your-domain.com/api/cron/email-outbox -H "Authorization: Bearer $CRON_SECRET"
0 4 * * * curl -X POST https://your-domain.com/api/cron/cleanup -H "Authorization: Bearer $CRON_SECRET"
```

---

## 5. Резервное копирование базы данных (pg_dump по расписанию)

Для обеспечения непрерывности бизнеса и безопасности данных бэкап PostgreSQL выполняется на уровне инфраструктуры/СУБД через утилиту `pg_dump` по расписанию.

### Скрипт автоматического резервного копирования (`scripts/backup-db.sh`):

```bash
#!/bin/bash
set -e

# Конфигурация
BACKUP_DIR="/var/backups/postgres/edarschi"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/edarschi_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

# Создание сжатого дампа
echo "[$(date)] Starting database backup..."
pg_dump "${DIRECT_URL:-$DATABASE_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${BACKUP_FILE}"

# Проверка целостности созданного файла
if [ -s "${BACKUP_FILE}" ]; then
  echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
  echo "[$(date)] ERROR: Backup file is empty!" >&2
  exit 1
fi

# Ротация старых копий (хранение 30 дней)
echo "[$(date)] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "edarschi_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# (Опционально) Отправка в S3 / Cloudflare R2:
# aws s3 cp "${BACKUP_FILE}" "s3://my-edarschi-backups/daily/"
```

### Настройка в crontab сервера (ежедневно в 03:00 ночи):

```bash
# Запуск ежедневно в 03:00 ночи по времени Ташкента (UTC+5)
0 3 * * * /bin/bash /opt/edarschi/scripts/backup-db.sh >> /var/log/db_backup.log 2>&1
```

### Восстановление из резервной копии:

```bash
# Распаковка и накат дампа:
gunzip -c /var/backups/postgres/edarschi/edarschi_20261111_030000.sql.gz | psql "$DIRECT_URL"
```
