# Аудит написания бренда: e-darschi / edarschi / e-darischi

**Статус:** Аудит завершён, ожидает утверждения целевого варианта (`______`).  
**Публичные URL:** Не изменяются до явного подтверждения.

---

## 1. Сводная статистика по вариантам

| Вариант написания | Количество вхождений | Основные зоны применения |
|---|---|---|
| **`e-darschi`** | **96** | Маркетинговые лендинги (`messages/ru.json`, `messages/uz.json`), `README.md`, мобильное приложение (`mobile/app.json`, i18n), почтовые шаблоны (`src/lib/email.ts`), доменные записи (`@e-darschi.uz`) |
| **`e-darischi`** | **48** | Ранние компоненты авторизации и платформы (`src/app/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/components/platform/PlatformSidebar.tsx`, `src/i18n/locales/*`, `tests/platform-*`, `tests/client-*`) |
| **`edarschi`** | **43** | Технические идентификаторы, cookies (`edarschi_locale`), `localStorage` (`edarschi-theme`, `edarschi-lang`), Tailwind токены (`colors.edarschi`), Telegram поддержка (`t.me/edarschi_support`), Bundle ID (`uz.edarschi.mobile`), поддомены API (`api.edarschi.uz`) |

---

## 2. Детальный список файлов по категориям

### Группа 1: Вариант `e-darischi` (48 вхождений)
Устаревший вариант транслитерации (с лишней буквой «i» в корне узбекского слова «dars»):
1. `src/i18n/locales/ru.json`: ключи `"brandName"`, `"appName"`
2. `src/i18n/locales/uz-Latn.json`: ключи `"brandName"`, `"appName"`
3. `src/app/layout.tsx`: `title: "e-darischi — Multi-tenant платформа для учебных центров"`
4. `src/app/login/page.tsx`: логотип и футер копирайта
5. `src/app/(auth)/register/page.tsx`: логотип и ссылка «Уже есть аккаунт в e-darischi?»
6. `src/components/auth/AuthShell.tsx`: текстовый логотип бренда
7. `src/components/landing/Header.tsx`, `Footer.tsx`, `Hero.tsx`: заголовки и alt-тексты
8. `src/components/platform/PlatformSidebar.tsx`: сайдбар суперадмина
9. `src/app/platform-admin/centers/create/page.tsx`, `centers/page.tsx`, `support/page.tsx`: подписи в шапках
10. `tests/client-login-view.test.ts`, `tests/client-register-view.test.ts`, `tests/client-landing-redesign.test.ts`, `tests/platform-*.test.ts`: тесты, жестко проверяющие строку «e-darischi»

### Группа 2: Вариант `e-darschi` (96 вхождений)
Грамматически корректная форма на узбекском («dars» + «chi»):
1. `messages/ru.json`, `messages/uz.json`: 16 вхождений (бренд, цитаты отзывов, заголовки)
2. `src/app/page.tsx`, `src/app/ru/page.tsx`: метаданные OpenGraph и канонические ссылки
3. `src/lib/email.ts`: `from: "e-darschi LMS <noreply@e-darschi.uz>"` и темы писем
4. `README.md`, `DEPLOY.md`, `docker-compose.prod.yml`, `docs/DEPLOY.md`: документация платформы
5. `mobile/app.json`: `name: "e-darschi"`
6. `mobile/src/i18n/locales/ru.json`, `uz.json`: экраны логина и профиля
7. `mobile/app/(auth)/login.tsx`, `(director)/index.tsx`, `(student)/index.tsx`, `(teacher)/index.tsx`
8. `tests/email-transport.test.ts`, `tests/e-darschi-landing.test.ts`, `tests/pages-misc.test.ts`

### Группа 3: Вариант `edarschi` (43 вхождения)
Технические идентификаторы без дефиса:
1. Домены и сетевые адреса: `https://api.edarschi.uz`, `https://s3.edarschi.uz`, `https://t.me/edarschi_support`
2. Bundle ID и пакеты: `uz.edarschi.mobile`, `mobile/package.json` (`"name": "edarschi-mobile"`)
3. Хранилище браузера:
   - `cookie`: `edarschi_locale`
   - `localStorage`: `edarschi-theme`, `edarschi-lang`
4. Стили: `tailwind.config.ts` (`colors.edarschi`)
5. Скрипт проверки релиза: `scripts/check-release-bundle.mjs`

---

## 3. Предложение по унификации (Proposal)

1. **Пользовательский интерфейс и видимый бренд (UI / i18n / SEO)**:
   - Целевой вариант бренда: **`______`** (рекомендуется `e-darschi` либо `E-Darschi` с заглавной первой буквой).
   - Заменить `e-darischi` на **`______`** в `src/i18n/locales/*`, `src/components/landing/*`, `src/app/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `PlatformSidebar.tsx`.
   - Синхронизировать проверочные ассерты в тестах (`tests/platform-*.test.ts`, `tests/client-*.test.ts`).

2. **Публичные URL, домены и сетевые идентификаторы (БЕЗ ИЗМЕНЕНИЙ без подтверждения)**:
   - Сохранить текущие рабочие DNS и endpoints:
     - `https://e-darschi.uz` (основной домен сайта)
     - `https://api.edarschi.uz` (мобильный API)
     - `https://s3.edarschi.uz` (хранилище)
     - `https://t.me/edarschi_support` (Telegram бот/канал)
   - Сохранить внутренние технические ключи (`edarschi_locale`, `edarschi-theme`, `uz.edarschi.mobile`) во избежание сброса настроек на клиентских устройствах.
