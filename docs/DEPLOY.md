# Развертывание (Deployment Guide)

> [!NOTE]
> **Статус руководства: в работе.** Разделы Vercel + Neon, почтового провайдера Resend и резервного копирования дополняются по мере готовности соответствующих облачных интеграций.

Данное руководство описывает развертывание платформы LMS в рабочей среде (Production / Staging).

---

## 1. Системные требования

- **Node.js**: v20.x или v22.x LTS (см. `.nvmrc`)
- **База данных**: PostgreSQL 15+ (рекомендуется PostgreSQL 16 или Neon Serverless Postgres)
- **Менеджер пакетов**: `npm` v10+

---

## 2. Развертывание на Vercel + Neon Postgres

### 2.1. Конфигурация базы данных Neon
При работе с serverless-платформой Vercel каждый serverless-экземпляр открывает отдельные соединения с базой данных. Для исключения исчерпания пула соединений Postgres на Neon используются две строки подключения:
1. `DATABASE_URL`: Строка подключения через пулер транзакций (PgBouncer):
   ```env
   DATABASE_URL="postgres://user:pass@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true"
   ```
2. `DIRECT_URL`: Прямое соединение без пулера, необходимое для выполнения миграций Prisma (`prisma migrate deploy`), DDL-запросов и подготовки схемы:
   ```env
   DIRECT_URL="postgres://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require"
   ```

В `prisma/schema.prisma` настройка datasource:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 2.2. Почтовый провайдер Resend
Для боевой доставки писем (подтверждение email, сброс паролей, инвайты) используется Resend:
```env
EMAIL_PROVIDER="resend"
RESEND_API_KEY="re_123456789..."
EMAIL_FROM="Academia LMS <noreply@yourdomain.uz>"
```
Если `RESEND_API_KEY` не задан, сервис отправки логирует факт отправки в stdout/stderr (эмуляция для dev-среды).

### 2.3. Резервное копирование и стратегия отката (Backup & Rollback)
1. **Автоматические бэкапы Neon (Point-in-Time Recovery):**
   - Neon сохраняет журнал WAL и позволяет мгновенно откатить состояние БД к любой секунде в пределах окна удержания (от 7 до 30 дней в зависимости от плана) или создать снапшот ветки (`branch`).
2. **Дамп перед релизом (Cold Backup):**
   ```bash
   pg_dump -d "$DIRECT_URL" -Fc -f backup_$(date +%Y%m%d_%H%M%S).dump
   ```
3. **Откат релиза на Vercel:**
   - Если после деплоя обнаружена критическая регрессия, в панели Vercel (Deployments) выберите предыдущий успешный деплой и нажмите **«Instant Rollback»**.
   - Если в релиз входили несовместимые изменения схемы БД, восстановите дамп:
     ```bash
     pg_restore --clean --if-exists -d "$DIRECT_URL" backup_YYYYMMDD_HHMMSS.dump
     ```

---

## 3. Переменные окружения (Environment Variables)

Создайте файл `.env` на основе шаблона `.env.example`:

```bash
cp .env.example .env
```

### Основные переменные
- `DATABASE_URL`: Строка подключения к PostgreSQL через пулер.
- `DIRECT_URL`: Прямая строка подключения к PostgreSQL.
- `JWT_SECRET`: Секретный ключ для подписи JWT токенов (не менее 32 случайных символов, приложение падает при старте в production при длине < 32).
- `APP_URL`: Базовый URL платформы (например, `https://lms.yourdomain.uz`).
- `DEV_LOGIN`: `false` для боевого окружения (запрещает dev-маршруты обхода входа).
- `DEV_EMAIL_LOG`: `false` для боевого окружения.

### Настройка доверенных прокси (`TRUSTED_PROXY_HOPS`)

> **ВАЖНО!** При развертывании приложения за любым reverse-proxy (Vercel, Cloudflare, Nginx, AWS ALB и т.д.) переменная `TRUSTED_PROXY_HOPS` является **СТРОГО ОБЯЗАТЕЛЬНОЙ**. Без неё реальный IP клиента не может быть безопасно определен, и все запросы классифицируются как IP `unknown`.

- На **Vercel** установите:
  ```env
  TRUSTED_PROXY_HOPS=1
  ```
- На **Vercel + Cloudflare** (двойное проксирование):
  ```env
  TRUSTED_PROXY_HOPS=2
  ```

---

## 4. Сборка и запуск

1. **Установка зависимостей**:
   ```bash
   npm ci
   ```

2. **Генерация Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Применение миграций БД**:
   ```bash
   npx prisma migrate deploy
   ```

4. **Сборка Next.js приложения**:
   ```bash
   npm run build
   ```

5. **Запуск сервера**:
   ```bash
   npm run start
   ```
