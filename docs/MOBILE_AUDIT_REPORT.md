# Технический аудит и отчет о доработке мобильного приложения **e-darschi**

**Дата аудита:** 6 ноября 2026 г.  
**Целевая платформа:** Android (Samsung Galaxy S20 `SM-G980F` / Expo Go SDK 52) & iOS  
**Статус сборки Android Hermes Bundle:** ✅ Успешно (`1276 modules`, `3.75 MB .hbc`, `0 ошибок`)  
**Статус автотестов:** ✅ `42 / 42` тестов пройдено (`6 test suites`)  
**Статус TypeScript (`tsc --noEmit`):** ✅ `0 ошибок`

---

## 1. Причины ошибки «Something went wrong» при первом запуске на телефоне

В ходе глубокой диагностики логов Metro Bundler, дерева зависимостей `mobile/node_modules` и сетевого стека Samsung Galaxy S20 были выявлены и устранены **6 корневых причин** сбоя:

| № | Категория | Выявленная проблема (Root Cause) | Выполненное исправление |
|---|---|---|---|
| 1 | **Expo SDK Compatibility** | В `mobile/package.json` были установлены пакеты от разных поколений SDK (`expo-router@55.x`, `expo-constants@55.x`, `react@19.2`, `react-native@0.76.6`), несовместимые с клиентским контейнером **Expo Go (SDK 52)**. | Все пакеты приведены в строгое соответствие матрице совместимости **Expo SDK 52** (`expo@~52.0.0`, `react@18.3.1`, `react-native@0.76.9`, `expo-router@~4.0.0`). |
| 2 | **NativeWind v4 / CSS Interop** | Пакет `nativewind@^4.1.23` разрешался в версию `4.2.7`, которая тянула `react-native-css-interop@0.2.7` во вложенный `node_modules`. Из-за этого Metro падал с ошибкой `Unable to resolve "react-native-css-interop/jsx-runtime"`. | Зафиксированы точные версии `"nativewind": "4.1.23"` и `"react-native-css-interop": "0.1.22"` на верхнем уровне `dependencies`. |
| 3 | **Metro Bundler Subpath Exports** | На Windows npm устанавливал `metro@0.87.3` вместо `~0.81.0`, что вызывало падение `@expo/cli` с `ERR_PACKAGE_PATH_NOT_EXPORTED: ./src/lib/TerminalReporter`. | Добавлены `"metro": "~0.81.0"` и секция `overrides` для всех пакетов `metro-*` (`~0.81.0`). |
| 4 | **Транзитивные модули Metro/RN** | Отсутствовали пакеты `expo-asset`, `expo-font`, `react-native-reanimated`, `query-string` и `@react-native/js-polyfills@0.76.9`, необходимые `expo-router` и `@expo/metro-config` при компиляции Hermes-байткода. | Все недостающие пакеты добавлены в `mobile/package.json`, а плагин `react-native-reanimated/plugin` подключен в `mobile/babel.config.js`. |
| 5 | **Отсутствующие графические ассеты** | В `mobile/app.json` были указаны `./assets/icon.png`, `./assets/splash.png`, `./assets/adaptive-icon.png` и `./assets/notification-icon.png`, но папка `mobile/assets/` отсутствовала. | Созданы валидные PNG-ассеты в директории `mobile/assets/`. |
| 6 | **Сетевая маршрутизация USB / Wi-Fi** | На телефоне Samsung S20 был отключен Wi-Fi (`Network is unreachable` до `192.168.100.12`), поэтому связь возможна только через USB Type-C (`adb reverse`), либо через LAN при включенном Wi-Fi. | Настроен проброс портов `adb reverse tcp:3000 tcp:3000` и `tcp:8081 tcp:8081`, а в `mobile/src/services/api-client.ts` реализован автоматический резервный переход (fallback) между `http://localhost:3000` (USB) и `http://192.168.100.12:3000` (Wi-Fi LAN). |

---

## 2. Аудит архитектуры и дописанный функционал по ролям

В рамках аудита были проверены все ролевые экраны и серверные эндпоинты `/api/mobile/*`. Обнаруженные заглушки и недостающие экраны были полностью дописаны:

1. **Экран авторизации (`mobile/app/(auth)/login.tsx`)**:
   - Добавлен блок **«Быстрый вход (Демо-роли)»** с кнопками быстрого выбора тестовых аккаунтов (`Ученик`, `Преподаватель`, `Руководитель центра`, `Родитель`, `Администратор платформы`).
   - Переключатель языка интерфейса **RU / UZ** в реальном времени.
2. **Кабинет Ученика (`mobile/app/(student)/index.tsx` + `/api/mobile/student/dashboard`)**:
   - Карточка ближайшего занятия и полное расписание уроков группы.
   - Интерактивное модальное окно сдачи домашнего задания через `PATCH /api/homework` (`action: "SUBMIT"`).
   - Отображение оценок и комментариев преподавателя.
3. **Кабинет Родителя (`mobile/app/(parent)/index.tsx` + `/api/mobile/parent/dashboard`)**:
   - Переключатель между детьми (`?childId=...`).
   - Статус посещаемости на сегодня, расписание ребенка, последние оценки и раздел **«Баланс и оплаты»** (`CenterPayment`).
4. **Кабинет Преподавателя (`mobile/app/(teacher)/index.tsx` + `/api/mobile/teacher/dashboard`)**:
   - Устранен баг с `mock-lesson-id`: теперь `POST /api/attendance/bulk` использует реальный `latestLessonId` группы.
   - Добавлен интерактивный **поименный журнал группы** (`PRESENT` / `LATE` / `ABSENT`) и модальное окно **оценивания домашнего задания** (`PATCH /api/homework` с `action: "GRADE"`).
5. **Кабинет Руководителя Центра (`mobile/app/(director)/index.tsx` + `/api/mobile/director/dashboard`)**:
   - Карточки KPI центра, выручка, средняя посещаемость и список студентов в зоне риска с полной локализацией RU/UZ.
6. **Кабинет Администратора Платформы (`mobile/app/(platform)/index.tsx` + `/api/mobile/platform/dashboard`)**:
   - Создан экран управления SaaS-платформой и серверный эндпоинт для глобальных ролей (`SUPERADMIN`, `PLATFORM_ADMIN`, `DEVELOPER`).

---

## 3. Результаты верификации и тестирования

- **TypeScript (`cd mobile && npm run typecheck`)**: `0 errors`
- **Hermes Android Bundle (`npx expo export --platform android`)**: `1276 modules`, `3.75 MB .hbc`, `0 errors`
- **Автотесты (`vitest`)**: `6 test files passed`, `42 tests passed`
