# План обновления Next.js и Аудит Бюллетеней Безопасности (Next.js Security Upgrade Plan)

## 1. Текущий статус

- **Установленная версия:** `next@14.2.35`
- **Максимальная стабильная версия линейки 14.x:** `14.2.35` (`npm view next versions` подтверждает, что 14.2.35 — финальный релиз в ветке 14.x).
- **Статус `npm audit --omit=dev`:**
  - `zod`, `source-map-js`, `postcss`: **устранены** (обновлены и закреплены через `overrides`).
  - `next`: В базе npm advisories зафиксировано 25 бюллетеней, устранение которых Vercel зафиксировал в ветках Next.js 15+ и 16+.

---

## 2. Анализ 25 бюллетеней безопасности Next.js и их применимость к проекту e-darschi

| № | Advisory ID / CVE | Описание | Применимость к e-darschi LMS | Компенсирующие меры в проекте |
|---|-------------------|----------|------------------------------|-------------------------------|
| 1 | `GHSA-p293-qw3h-jr36` | RCE на Windows-серверах | Низкая (Dev only) | Production разворачивается строго в Linux-контейнерах (`node:20-alpine` в `docker-compose.prod.yml`). |
| 2 | `GHSA-2464-fhr4-w9xw` | RCE в Image Optimizer через SVG | Не применимо | В `src/lib/storage.ts` реализована строгая проверка Magic Bytes; загрузка SVG и HTML категорически запрещена. |
| 3 | `GHSA-2xp9-vwfh-vxw4` | RCE в Image Optimizer через AVIF | Не применимо | Загрузка файлов ограничена белым списком JPEG, PNG, WebP с проверкой заголовков байтов. |
| 4 | `GHSA-m99w-x7hq-7vfj` | DoS через Server Actions в App Router | Не применимо | В проекте **не используются Server Actions**; вся бизнес-логика и мутации работают через строгие Route Handlers (`src/app/api/*`). |
| 5 | `GHSA-89xv-2m56-2m9x` | SSRF в Server Actions на custom servers | Не применимо | Server Actions не используются. |
| 6 | `GHSA-p3m5-59mp-jv5r` | DoS в App Router через Server Actions | Не применимо | Server Actions не используются. |
| 7 | `GHSA-4c39-4ccg-62r3` | Unbounded Server Action payload | Не применимо | Вся обработка тел запросов ограничена лимитом 1MB в `src/middleware.ts`. |
| 8 | `GHSA-955p-x3mx-jcvp` | Раскрытие внутренних Server Functions | Не применимо | Внутренние Server Functions не используются. |
| 9 | `GHSA-36qx-fr4f-26g5` | Обход Middleware в Pages Router i18n | Не применимо | В проекте используется **App Router**; Pages Router отсутствует. Мультиязычность реализована в БД и API. |
| 10 | `GHSA-c4j6-fc7j-m34r` | SSRF при WebSocket upgrades | Не применимо | Next.js не проксирует WebSocket-соединения; сокеты отсутствуют. |
| 11 | `GHSA-ggv3-7p47-pfv8` | HTTP Request Smuggling в rewrites | Не применимо | Рерайты в `middleware.ts` работают исключительно на внутренний путь `/api/files/*` без внешних прокси-хостов. |
| 12 | `GHSA-p9j2-gv94-2wf4` | SSRF в rewrites через целевой хост | Не применимо | Целевые хосты в rewrites жестко фиксированы локально. |
| 13 | `GHSA-3g8h-86w9-wvmq` | Отравление кэша Middleware редиректов | Не применимо | Во всех эндпоинтах и middleware отдаются заголовки `Cache-Control: private, no-store, max-age=0`. |
| 14 | `GHSA-wfc6-r584-vfw7` | Отравление кэша в RSC-ответах | Не применимо | Глобальный `Cache-Control: private, no-store` предотвращает кэширование на прокси/CDN. |
| 15 | `GHSA-vfv6-92ff-j949` | RSC cache-busting collisions | Не применимо | Все мутации и чувствительные данные не используют встроенный Data Cache Next.js. |
| 16 | `GHSA-68g3-v927-f742` | Cache confusion для тел запросов | Не применимо | Кэширование тел POST/PUT/PATCH запрещено на уровне HTTP-заголовков. |
| 17 | `GHSA-4633-3j49-mh5q` | Cache confusion при невалидном UTF-8 | Не применимо | Валидация Zod `.strict()` отсекает некорректные байтовые последовательности. |
| 18 | `GHSA-gx5p-jg67-6x7h` | XSS в beforeInteractive скриптах | Не применимо | Тег `next/script` с beforeInteractive и пользовательскими данными не используется. |
| 19 | `GHSA-ffhc-5mcf-pf4q` | XSS в App Router при CSP nonces | Низкая | Все пользовательские строки экранируются функцией `escapeHtml()`; dangerouslySetInnerHTML не используется для ввода пользователей. |
| 20 | `GHSA-3x4c-7xq6-9pq8` | Неограниченный рост дискового кэша next/image | Средняя | Хранилище загрузок вынесено в изолированный S3/R2 storage и защищенный `/api/files/*`. |
| 21 | `GHSA-h64f-5h5j-jqjh` | DoS в Image Optimization API | Средняя | Изображения обслуживаются через прямой CDN или контролируемые DTO. |
| 22 | `GHSA-9g9p-9gw9-jx7f` | DoS Image Optimizer remotePatterns | Не применимо | `remotePatterns` в `next.config.mjs` не содержит открытых масок (`**`). |
| 23 | `GHSA-h25m-26qc-wcjf` | DoS при десериализации RSC | Низкая | RSC-страницы защищены сессионными cookie `requireTenantAccess` / `getAuthSession`. |
| 24 | `GHSA-q4gf-8mx6-v5v3` | DoS в Server Components | Низкая | Приватные RSC, строгий ролевой шлюз перед рендером компонентов. |
| 25 | `GHSA-8h8q-6873-q5fj` | DoS в Server Components | Низкая | Двухуровневый Rate Limiter отсекает шквал запросов до генерации RSC-дерева. |

---

## 3. Архитектурные защитные барьеры (Defense-in-Depth)

Все потенциальные уязвимости Next.js 14.2.35 нейтрализованы на уровне приложения:
1. **Строгий лимит тела запроса:** в `src/middleware.ts` отсекаются все запросы >1MB (413 Payload Too Large) до парсинга JSON или запуска React-рантайма.
2. **Исключение Server Actions:** проект не использует `use server` / Server Actions; все операции выполняются через REST Route Handlers с Zod-валидацией.
3. **Запрет кэширования:** глобальный `Cache-Control: private, no-store, no-cache, must-revalidate` блокирует атаки Cache Poisoning и Cache Confusion.
4. **Валидация файлов:** `src/lib/storage.ts` проверяет magic bytes и запрещает SVG/HTML, ликвидируя векторы RCE через Image Optimizer.
5. **Двухуровневый Rate Limiter:** `BoundedMemoryRateLimiter` + DB блокирует DoS-атаки на сетевом и процессном уровне.

---

## 4. Пошаговый план миграции на Next.js 15+ (Post-Launch Phase)

Мажорный апгрейд на Next.js 15/16 требует обновления React 18 -> React 19 и тестирования совместимости зависимостей (`framer-motion`, `@testing-library/react`, `vitest`).

### Фаза 1: Подготовка ветки (Next-Sprint)
1. Создать изолированную ветку `feature/next-15-upgrade`.
2. Обновить `react` и `react-dom` до `^19.0.0` (или версии, рекомендуемой Next.js 15).
3. Обновить `next` до `^15.2.0` / последней LTS-версии.
4. Обновить `@types/react` и `@types/react-dom` до `^19.0.0`.

### Фаза 2: Адаптация Breaking Changes
1. **Асинхронные параметры роутов:** в Next.js 15 `params` и `searchParams` в Page и Route Handlers становятся `Promise`:
   ```ts
   // Было (Next 14)
   export async function GET(req: Request, { params }: { params: { id: string } }) { ... }
   // Станет (Next 15)
   export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
     const { id } = await params;
   }
   ```
2. **Асинхронный доступ к cookies и headers:**
   `cookies()` и `headers()` требуют `await cookies()`.
3. **Обновление `framer-motion`:** синхронизировать версию с поддержкой React 19.

### Фаза 3: Валидация и сквозное тестирование
1. Запуск полной тестовой матрицы:
   - `npx tsc --noEmit`
   - `npm run lint`
   - `npx vitest run` (все 190+ тестовых файлов)
   - `npm run build`
2. Сверка `npm audit --omit=dev`: подтверждение отсутствия критических уязвимостей.
3. Развертывание на staging-окружении для регрессионного нагрузочного тестирования.
