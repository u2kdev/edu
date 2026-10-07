# SaaS LMS Platform

Современная мультиарендная (multi-tenant) SaaS-платформа для управления учебными центрами. Обеспечивает полную изоляцию данных между учебными центрами в рамках единой базы данных и кодовой базы.

---

## 🚀 Быстрый старт

### 1. Требования
* Node.js: `>= 20.0.0` (см. `.nvmrc`)
* npm: `>= 9.0.0`

### 2. Установка зависимостей
```bash
npm ci
```

### 3. Настройка окружения
Создайте `.env` в корне проекта (файл добавлен в `.gitignore`):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-jwt-key-at-least-32-chars-long"
DEV_LOGIN="true"
DEV_EMAIL_LOG="false"
```

### 4. Инициализация базы данных и Prisma
```bash
# Генерация Prisma Client
npm run prisma:generate

# Создание и синхронизация схемы БД
npm run prisma:db-push

# Заполнение начальными данными (тарифы, суперадмин, тестовый центр)
npm run prisma:seed
```

### 5. Запуск сервера разработки
```bash
npm run dev
```
Приложение откроется по адресу [http://localhost:3000](http://localhost:3000).

---

## 🧪 Полная верификация качества (CI / Локально)

Скрипт проверяет все 4 этапа контроля качества: TypeScript, ESLint, Vitest и сборку Next.js:

```bash
npm run verify
```

Либо запуск каждого шага по отдельности:

```bash
# 1. Проверка типов TypeScript (0 ошибок)
npx tsc --noEmit

# 2. Проверка стиля кода (ESLint)
npm run lint

# 3. Запуск всех 31 тестовых наборов (165 тестов)
npx vitest run

# 4. Производственная сборка приложения
npm run build
```

---

## 🔐 Роли и Доступ

* `SUPERADMIN` / `PLATFORM_ADMIN` — панель управления платформой (`/platform/tenants`).
* `DIRECTOR` — владелец центра (`/center/dashboard`, управление сотрудниками и тарифом).
* `TEACHER` — преподаватель (управление своими группами, материалами, уроками, посещаемостью).
* `STUDENT` — учащийся (просмотр уроков, материалов, сдача ДЗ, посещаемость).
* `PARENT` — родитель (контроль оценок и посещаемости ребенка).

---

## 🛠 CI / CD

Проект использует **GitHub Actions** (`.github/workflows/ci.yml`).  
При каждом `push` и `pull_request` в ветки `feature/lms-upgrade` и `main` автоматически выполняются:
1. `npm ci`
2. `npx prisma generate`
3. `npx prisma db push --accept-data-loss`
4. `npx tsc --noEmit`
5. `npx next lint`
6. `npx vitest run`
7. `npx next build`
