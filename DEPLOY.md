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
