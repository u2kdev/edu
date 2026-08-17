# SaaS LMS Platform

Современная SaaS-платформа для управления учебными центрами. Платформа поддерживает мультиарендность (multi-tenant), что позволяет изолированно управлять множеством различных учебных центров (клиентов) в рамках единой кодовой базы и базы данных.

## 🚀 Технологический стек

- **Фреймворк:** [Next.js 14](https://nextjs.org/) (App Router)
- **Язык:** [TypeScript](https://www.typescriptlang.org/)
- **База данных:** PostgreSQL
- **ORM:** [Prisma](https://www.prisma.io/)
- **Стилизация:** [Tailwind CSS](https://tailwindcss.com/)
- **Тестирование:** [Vitest](https://vitest.dev/)
- **Аутентификация:** JWT (с хранением в HttpOnly Cookies)

## 📦 Установка и запуск (Для разработчиков)

Для того чтобы развернуть проект локально, следуйте этим шагам:

### 1. Клонирование репозитория

```bash
git clone https://github.com/u2kdev/edu.git
cd edu
```

### 2. Установка зависимостей

Убедитесь, что у вас установлен Node.js (рекомендуется v20+).

```bash
npm install
```

### 3. Настройка переменных окружения

Создайте файл `.env` в корне проекта (вы можете скопировать данные из `.env.example`, если он есть).
Обязательные переменные:

```env
# Подключение к PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/aziz_lms?schema=public"

# Секретный ключ для подписи JWT токенов (минимум 32 символа)
JWT_SECRET="super-secret-jwt-key-for-development"
```

### 4. Настройка Базы Данных (Prisma)

Примените схему базы данных и сгенерируйте клиент Prisma:

```bash
# Синхронизируем схему с БД (используйте migrate dev в продакшене)
npx prisma db push

# Генерируем типы Prisma Client
npx prisma generate
```

### 5. Заполнение БД тестовыми данными (Seed)

Чтобы в базе сразу появились нужные тарифы, суперадмин и тестовый учебный центр, выполните сид:

```bash
npx prisma db seed
```
*(Пароль для всех тестовых аккаунтов по умолчанию: `Password123!`)*

### 6. Запуск сервера разработки

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в вашем браузере.

---

## 🔐 Доступ и Роли

Система имеет строгую иерархию доступов (RBAC) и изоляцию данных между Tenants.

**Ключевые роли:**
- `PLATFORM_OWNER` / `SUPERADMIN` — Владелец SaaS платформы (доступ к `/platform` и `/developer`).
- `DIRECTOR` — Владелец учебного центра (доступ к `/center` для своего Tenant).
- `TEACHER` — Преподаватель (доступ только к своим группам и ученикам).
- `STUDENT` — Студент (доступ к своим оценкам, расписанию, домашним заданиям).
- `PARENT` — Родитель (доступ к данным своих детей).

## 🧪 Тестирование

Проект содержит E2E, интеграционные и security-тесты на базе Vitest.

```bash
# Запуск всех тестов
npm run test

# Запуск конкретного теста на безопасность (IDOR / Tenant Isolation)
npx vitest run tests/idor.test.ts
```

## 📂 Структура проекта

- `/src/app/api` — Backend Route Handlers (REST API).
- `/src/app/(...UI...)` — Frontend страницы и Layouts.
- `/src/lib` — Утилиты, аутентификация (`auth.ts`), проверка доступов к Tenant (`tenant.ts`).
- `/src/components` — Переиспользуемые React компоненты.
- `/prisma` — Схема базы данных `schema.prisma` и скрипт сидирования.
- `/tests` — Тесты бизнес-логики и безопасности.
