# Функциональный и архитектурный аудит проекта e-darschi (`docs/AUDIT_FEATURES.md`)

**Дата аудита:** 2026-11-15  
**Режим:** строго read-only анализ кодовой базы (`prisma/schema.prisma`, `src/`, `package.json`). Изменения в код и схему БД не вносились.  
**База проверки:** текущее состояние репозитория после этапов **D0–D4**, **U0–U3**, **S1–S6**.

## Продуктовые решения (рамка аудита)

1. **Предоплатная модель центров:** центр берёт оплату вперёд за период **1, 2 или 3 месяца** (цена за период задаётся на уровне группы).
2. **Монетизация платформы:** платформа зарабатывает на подписке учебных центров по тарифам (`SubscriptionPlan`). **Комиссии с платежей учеников нет (0%)**, деньги идут напрямую на мерчант-аккаунт центра в **Click**.
3. **Каналы коммуникации:** **Telegram**, **SMS (Eskiz)**, **Email**, **Push**. **WhatsApp — только ссылками (`wa.me`)**.

## Шкала статусов

- **ЕСТЬ И РАБОТАЕТ** — реализованы модель БД, серверная бизнес-логика/API и рабочий UI.
- **ЧАСТИЧНО** — часть сценария работает, но отсутствуют ключевые для продукта поля/автоматика/экраны или есть расхождения между слоями.
- **ТОЛЬКО В БД-API** — есть модель, enum, cron или API-эндпоинт, но нет UI или вызова в рабочем процессе.
- **НЕТ** — функциональность отсутствует в БД, API и UI.
- **НЕ ПРОВЕРЕНО** — конкретный файл/экран не инспектировался в ходе чтения кода.

Оценка трудоёмкости: **S** (1–3 дня), **M** (4–10 дней), **L** (2–4+ недели).

---

## Ключевые расхождения с прежними планами и документацией

> [!IMPORTANT]
> При сверке реального кода и `prisma/schema.prisma` выявлены критические несоответствия предположениям из предыдущих этапов:
> 1. **«Charge/Invoice из D3» в коде НЕТ.** В `prisma/schema.prisma` отсутствуют модели `Charge` и `Invoice`. Начисления учеников рассчитываются «на лету» сразу в **трёх несогласованных местах** (`src/lib/student-balance.ts`, `src/app/api/finance/student-debts/route.ts`, `src/lib/finance-reports.ts`).
> 2. **«Переписки учитель–родитель из U3» в коде НЕТ.** Модель `SupportTicket` / `TicketMessage` обслуживает только тикеты *Центр ↔ Поддержка платформы*. Для *Учитель ↔ Родитель* есть лишь односторонние комментарии к оценкам/ДЗ.
> 3. **Публичная форма лидов (`POST /api/public/leads`) — фикция:** валидирует форму и возвращает `200 { success: true }` без сохранения в БД (`src/app/api/public/leads/route.ts:14-42`).
> 4. **Мобильный Push (`src/lib/mobile-push.ts:27-84`) — заглушка:** читает токены, но не отправляет запросы в Expo/FCM.
> 5. **Настройки SMS в интерфейсе центра рассинхронизированы:** экран `CenterSettingsManager.tsx` пишет `enableSms` в JSON `brandingConfig`, а реальная отправка в `notifications.ts:590` читает `LearningCenter.smsEnabled`, редактируемое только на другом экране (`CenterProfileEditor.tsx`).
> 6. **`SubscriptionPlan.featuresJson` (`prisma/schema.prisma:146`) нигде не проверяется** и даже отсутствует в форме редактирования тарифов (`src/app/platform-admin/plans/page.tsx:38-47`).

---

## БЛОК 1. ДЕНЬГИ

### 1.1 Начисления и счета (`Charge` / `Invoice`)
- **Статус:** **НЕТ** (ученические счета); **ЧАСТИЧНО** (B2B-инвойс на подписку центра).
- **Где в коде:**
  - `prisma/schema.prisma`: модели `Charge` и `Invoice` отсутствуют; для учеников есть только `CenterPayment` (`L652-680`) и `FinanceTransaction` (`L1221-1274`).
  - `src/app/api/platform/finance/payments/route.ts:1-200` + печатная HTML-страница B2B-счёта для центра: `src/app/platform-admin/finance/payments/[id]/invoice/page.tsx` (`L1-100`).
- **Что переиспользовать:** паттерн генерации номера квитанции/счёта (`INV-...`/`TX-...` в `src/lib/student-balance.ts`), реквизиты и печатную вёрстку B2B-счёта из `platform-admin/finance/payments/[id]/invoice/page.tsx`.
- **Чего не хватает:** моделей `Charge` (периодическое/разовое начисление по зачислению) и `Invoice` (счёт на оплату за 1/2/3 месяца со статусами `DRAFT`, `ISSUED`, `PARTIAL`, `PAID`, `VOID`, `EXPIRED`), автогенерации начислений по расписанию/продлению периода.
- **Оценка:** **L**.

### 1.2 Периоды оплаты и оплаченный период у ученика (`paidUntil`)
- **Статус:** **НЕТ**
- **Где в коде:**
  - `prisma/schema.prisma:336` (`Course.priceMonthly`), `Enrollment` (полей `paidUntil`, `prepaidMonths`, `billingAnchorDay` нет).
  - `src/lib/student-balance.ts:1-314` считает начисления умножением `priceMonthly * monthsEnrolled` от `en.enrolledAt`, не отслеживая конкретные оплаченные даты/периоды.
- **Что переиспользовать:** модель `Enrollment`, логику дат в `Asia/Tashkent` (`getTashkentYearMonth` в `src/lib/finance.ts`).
- **Чего не хватает:** поля `paidUntil` на `Enrollment`, учёта периодов (`periodStart`, `periodEnd`, `monthsCount: 1 | 2 | 3`) в платежах и начислениях, cron-проверки истекающего оплаченного периода.
- **Оценка:** **M**.

### 1.3 Цена группы за 1, 2 или 3 месяца
- **Статус:** **НЕТ**
- **Где в коде:**
  - `prisma/schema.prisma:336`: цена есть только на уровне курса (`Course.priceMonthly Float @default(0)`). У модели `Group` вообще нет полей цены или длительности тарифов.
  - `src/app/api/groups/route.ts` (`L1-100`): не принимает тарифы группы.
- **Что переиспользовать:** `Course.priceMonthly` как fallback-значение по умолчанию при создании группы.
- **Чего не хватает:** тарифных планов группы (`GroupPricingPlan` или колонок/связи на `Group`) на `1`, `2`, `3` месяца (плюс скидка за 2/3 мес.), выбора периода при записи и выставлении счёта.
- **Оценка:** **M**.

### 1.4 Пауза обучения и заморозка оплаченного периода
- **Статус:** **НЕТ**
- **Где в коде:**
  - `prisma/schema.prisma:1491-1496`: `EnrollmentStatus` содержит только `ACTIVE`, `WAITLIST`, `COMPLETED`, `DROPPED` (статуса `FROZEN`/`PAUSED` у зачисления нет).
- **Что переиспользовать:** `Enrollment.status`, аудит изменений (`AuditLog`).
- **Чего не хватает:** статуса `FROZEN` или таблицы `EnrollmentFreeze` (`startDate`, `endDate`, `reason`, `shiftedDays`), автоматического сдвига `paidUntil` и приостановки начислений на период заморозки, UI-кнопки заморозки в карточке ученика/группы.
- **Оценка:** **M**.

### 1.5 Скидки и промокоды
- **Статус:** **ЧАСТИЧНО** (разовая скидка в полях БД/API; промокодов и UI приёма оплаты со скидкой **НЕТ**).
- **Где в коде:**
  - `prisma/schema.prisma:652-680`: `CenterPayment` имеет `originalAmount`, `discountAmount`, `note`.
  - `src/app/api/center-payments/route.ts:1-193`: `POST` принимает `originalAmount` и `discountAmount`, но **`note` игнорируется при создании**; при этом `src/lib/student-balance.ts` мапит `discountPercent: p.discountAmount || null` и `promoCodeUsed: p.note || null`.
  - `src/components/PaymentsManager.tsx:455-552`: форма добавления платежа отправляет только `{ studentMembershipId, amount, paymentMethod }` — полей скидки и промокода в UI нет.
- **Что переиспользовать:** `originalAmount`, `discountAmount` в `CenterPayment`.
- **Чего не хватает:** модели `PromoCode` (код, % или фикс, срок действия, лимит использований, область: курс/группа/период) и `PromoCodeRedemption`, серверного пересчёта суммы при вводе промокода, UI для администратора и формы онлайн-оплаты.
- **Оценка:** **M**.

### 1.6 Возвраты и перерасчёт
- **Статус:** **ЧАСТИЧНО** (ручной возврат с финансовым сторно **ЕСТЬ И РАБОТАЕТ**; автоматического перерасчёта нет).
- **Где в коде:**
  - `src/app/api/center-payments/route.ts` (`PATCH`, доступно `DIRECTOR` и платформенным ролям) вызывает `syncCenterPaymentRefundToFinance` (`src/lib/finance.ts:720-870`), создающую реверсивную `FinanceTransaction` (`isReversal: true`).
  - `src/components/finance/CenterFinanceManager.tsx` (`L1-200`): вкладка транзакций и модал сторнирования.
- **Что переиспользовать:** `syncCenterPaymentRefundToFinance` с защитой уникальным ключом `@@unique([centerPaymentId, isReversal])` (`prisma/schema.prisma:1221-1274`).
- **Чего не хватает:** частичного возврата с откатом `paidUntil` на `Enrollment`, перерасчёта при отчислении (`DROPPED`), отмене/переносе занятий или заморозке.
- **Оценка:** **M**.

### 1.7 Рассрочка
- **Статус:** **ЧАСТИЧНО** (есть только числовой индекс `installmentIndex` в БД/API).
- **Где в коде:**
  - `prisma/schema.prisma:652-680`: поле `CenterPayment.installmentIndex`.
  - `src/app/api/center-payments/route.ts`: принимает `installmentIndex` в `POST`.
  - В `src/components/PaymentsManager.tsx` и UI финансов графиков рассрочки нет.
- **Что переиспользовать:** `CenterPayment.installmentIndex` + `Charge`/`Invoice` после внедрения P1.
- **Чего не хватает:** графика платежей по частям (`InstallmentPlan` / разбивка `Invoice` на транши с `dueDate`), автоматических напоминаний по очередному траншу.
- **Оценка:** **M**.

### 1.8 Баланс и долги ученика
- **Статус:** **ЧАСТИЧНО** (работает, но имеет **3 конфликтующих расчёта** и UX-ошибки).
- **Где в коде:**
  1. `src/lib/student-balance.ts:1-314` (`calculateStudentBalances`): начисляет `Course.priceMonthly * monthsEnrolled` с `Enrollment.enrolledAt`, учитывает оплаченные `CenterPayment` и standalone `FinanceTransaction` (`centerPaymentId: null`). Используется в `src/app/center/payments/page.tsx:1-96` и `src/app/api/my/balance/route.ts:1-100`.
  2. `src/app/api/finance/student-debts/route.ts:1-262`: считает период с `CenterMembership.joinedAt` (а не `Enrollment.enrolledAt`) и **игнорирует** standalone `FinanceTransaction`.
  3. `src/lib/finance-reports.ts:311-397` (`calculateDebtorsReport`): считает долги **только** по записям `CenterPayment` со статусами `PENDING` / `PARTIALLY_PAID` с бакетами просрочки (`0-30`, `31-60`, `61+`).
  - Дополнительно в `src/app/api/center-payments/route.ts`: `POST` ставит `paidAt: new Date()` даже при `status: "PENDING"`.
  - В `src/app/api/center-payments/report/route.ts:1-65`: если платежей нет (`_count === 0`), `expectedMRR` использует хардкод-заглушку `150000`.
- **Что переиспользовать:** единый DTO баланса из `src/lib/student-balance.ts` и возрастную группировку (`0-30`/`31-60`/`61+`) из `src/lib/finance-reports.ts:357-366`.
- **Чего не хватает:** унификации на базе явной таблицы `Charge` (исключить динамическое пересчитывание по `joinedAt`/`enrolledAt`), исправления `paidAt` при `PENDING`, удаления fallback `150000` из `center-payments/report`.
- **Оценка:** **M** (в связке с 1.1).

### 1.9 Квитанции
- **Статус:** **ЧАСТИЧНО** (есть печать браузером для центра; нет PDF и отправки в Telegram/Email).
- **Где в коде:**
  - `src/components/PaymentsManager.tsx:455-474`: модал квитанции с кнопкой `window.print()`.
  - `src/app/platform-admin/finance/payments/[id]/invoice/page.tsx:1-100`: печатный B2B-инвойс подписки.
  - `src/lib/student-balance.ts`: формирует `receiptNumber`.
- **Что переиспользовать:** дизайн печатного чека из `PaymentsManager.tsx` и B2B-счёта.
- **Чего не хватает:** серверной генерации PDF-квитанции (QR-код проверки подлинности), скачивания родителем/учеником в `/api/my/balance` UI, автоотправки квитанции в Telegram/Email после оплаты через Click.
- **Оценка:** **S–M**.

### 1.10 Напоминания о долге
- **Статус:** **ЧАСТИЧНО** (ручные ссылки WhatsApp; авто-рассылки по должникам нет).
- **Где в коде:**
  - `src/app/center/reports/page.tsx:163`: кнопки `https://wa.me/${phoneClean}?text=...` только для записей `CenterPayment` в статусе `PENDING`.
  - `prisma/schema.prisma:1498-1514`: в `NotificationType` определены `PAYMENT_DUE` и `PAYMENT_OVERDUE`, но в коде `src/lib/notifications.ts` (`L1-642`) эти типы не отправляются автоматически ни cron-ом, ни по событию.
- **Что переиспользовать:** enum `NotificationType.PAYMENT_DUE` / `PAYMENT_OVERDUE`, Eskiz SMS из `src/lib/notifications.ts`, логику просрочки из `src/lib/finance-reports.ts`.
- **Чего не хватает:** cron-джобы напоминаний о скором истечении `paidUntil` / долге (за 3 дня, в день оплаты, +3/+7 дней) с идемпотентностью и отправкой в **Telegram / SMS Eskiz / Email / Push**, плюс кнопка «Напомнить в WhatsApp» из единого списка должников.
- **Оценка:** **M**.

### 1.11 Click, Payme, Uzum, вебхуки платежей и 0% комиссии
- **Статус:** **НЕТ** (есть только UI-упоминание и `PaymentMethod.ONLINE`).
- **Где в коде:**
  - `src/components/PaymentsManager.tsx:149` (информационный баннер о `0%` комиссии платформы) и `L525` (значение `ONLINE` в выборе способа оплаты).
  - `prisma/schema.prisma`: у `CenterPayment` есть `externalTxId`, но нет ни моделей `PaymentWebhookEvent`/`PaymentIntent`, ни роутов `/api/webhooks/click`, ни упоминаний Payme/Uzum в `src/`/`mobile/`/`transmitter/`.
- **Что переиспользовать:** поле `CenterPayment.externalTxId`, баннер 0%-модели, криптографию из `src/lib/two-factor-cipher.ts`.
- **Чего не хватает:** полной интеграции **Click (Prepare / Complete + Checkout redirect URL / Click Pass)** на мерчант-аккаунт конкретного центра, страницы оплаты ученика/родителя, таблицы идемпотентных вебхуков, сверки статусов (подробная архитектура — в **Блоке 11**).
- **Оценка:** **L**.

### 1.12 Хранение ключей мерчанта центра
- **Статус:** **НЕТ**
- **Где в коде:**
  - Модели конфигурации мерчанта центра нет.
  - Готовый модуль шифрования: `src/lib/two-factor-cipher.ts:31-75` (`encryptTwoFactorSecret`, `decryptTwoFactorSecret` на AES-256-GCM с ключом `TWO_FACTOR_ENC_KEY`, формат `enc:gcm:${ivHex}:${tagHex}:${cipherHex}`).
- **Что переиспользовать:** рефакторинг `src/lib/two-factor-cipher.ts` в общий `src/lib/crypto-cipher.ts` для шифрования `secretKey` мерчанта Click каждого центра; защиту от утечки в `AuditLog`/ответах API по паттерну `SENSITIVE_AUDIT_KEYS` / `sanitizeAuditDetails` (`src/lib/tenant.ts:5-26`).
- **Чего не хватает:** модели `CenterMerchantConfig` (`serviceId`, `merchantId`, `merchantUserId`, `encryptedSecretKey`, `isActive`, `keyVersion`), экрана настроек Click у `DIRECTOR` и проверки тестовой транзакции/подписи.
- **Оценка:** **S–M**.

### 1.13 Связь оплаты с финансовой проводкой
- **Статус:** **ЕСТЬ И РАБОТАЕТ**
- **Где в коде:**
  - `src/lib/finance.ts:730-840`: `syncCenterPaymentToFinance` и `syncCenterPaymentRefundToFinance`.
  - `prisma/schema.prisma:1221-1274`: `FinanceTransaction` с `@@unique([centerPaymentId, isReversal])`, обеспечивающим идемпотентность.
  - `src/app/api/center-payments/route.ts`: вызывает синхронизацию при создании `PAID`-платежа и при `PATCH`-возврате.
- **Что переиспользовать:** полностью готовый механизм синхронизации и сторнирования; обязательно вызывать `syncCenterPaymentToFinance` внутри транзакции вебхука Click `Complete` (для счёта центра типа `BANK`/`ONLINE`).
- **Чего не хватает:** привязки конкретного финансового `Account` (расчётный счёт / мерчант Click) в настройках мерчанта, чтобы онлайн-оплата падала не в дефолтную кассу, а на нужный счёт.
- **Оценка:** **S**.

---

## БЛОК 2. CRM

### 2.1 Заявки и лиды
- **Статус:** **НЕТ** (есть только пустая UI-заглушка на лендинге).
- **Где в коде:**
  - `src/components/landing/LeadModal.tsx:1-100` + `src/components/landing/Pricing.tsx:1-180`.
  - `src/app/api/public/leads/route.ts:14-42`: принимает форму, валидирует поля и **сразу возвращает `{ success: true }` без записи в БД** (в `schema.prisma` модели `Lead` нет).
- **Что переиспользовать:** форму и UX `LeadModal.tsx` (для B2B-лидов платформы) как шаблон.
- **Чего не хватает:** модели `Lead` для учебных центров (`centerId`), API CRUD лидов центра (`/api/crm/leads`), публичной формы записи центра и отдельного сохранения B2B-заявок с лендинга платформы.
- **Оценка:** **M**.

### 2.2 Воронка продаж (стадии, канбан)
- **Статус:** **НЕТ**
- **Где в коде:** в `prisma/schema.prisma` и `src/` моделей и страниц канбана/воронки нет.
- **Что переиспользовать:** UI-паттерны дашборда центра и `TenantContext`.
- **Чего не хватает:** enum `LeadStage` (`NEW`, `CONTACTED`, `TRIAL_SCHEDULED`, `TRIAL_COMPLETED`, `NEGOTIATION`, `WON`, `LOST`), кастомизируемых подстадий/порядка, канбан-доски и табличного вида с фильтрами.
- **Оценка:** **M–L**.

### 2.3 Источники и UTM-метки
- **Статус:** **НЕТ**
- **Где в коде:** отсутствует в `prisma/schema.prisma` и `src/app/api/public/leads/route.ts`.
- **Что переиспользовать:** справочную структуру по аналогии с `FinanceCategory`.
- **Чего не хватает:** полей `source` (`INSTAGRAM`, `TELEGRAM`, `WEBSITE`, `WALK_IN`, `REFERRAL`, `2GIS`, `OTHER`), `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm`, парсинга UTM-параметров на публичной форме записи центра.
- **Оценка:** **S**.

### 2.4 Пробные уроки
- **Статус:** **НЕТ**
- **Где в коде:** отсутствует в БД и расписании (`ScheduleSlot`/`Lesson` рассчитаны только на `Enrollment` действующих учеников).
- **Что переиспользовать:** `Group`, `ScheduleSlot`, `Lesson`, уведомления о расписании.
- **Чего не хватает:** модели `TrialLesson` (`leadId`, `groupId`, `lessonId`, `scheduledAt`, `status`: `SCHEDULED`/`ATTENDED`/`NO_SHOW`/`CANCELLED`, `feedback`), отображения гостей на пробный урок в интерфейсе посещаемости учителя, автонапоминаний лиду за 24ч и 2ч.
- **Оценка:** **M**.

### 2.5 Причины отказа
- **Статус:** **НЕТ**
- **Где в коде:** отсутствует.
- **Что переиспользовать:** enum или настраиваемый справочник причин центра.
- **Чего не хватает:** поля `lossReason` + `lossComment` при переводе лида в `LOST` (обязательный выбор: дорого, расписание, далеко, выбрал конкурента, не отвечает, передумал).
- **Оценка:** **S**.

### 2.6 Задачи и напоминания менеджера
- **Статус:** **НЕТ**
- **Где в коде:** отсутствует.
- **Что переиспользовать:** центр уведомлений `/center/notifications` и cron-инфраструктуру (`src/lib/cron-lock.ts`).
- **Чего не хватает:** модели `LeadTask` (`leadId`, `assigneeMembershipId`, `title`, `dueAt`, `status`, `priority`), виджета просроченных/сегодняшних задач, push/in-app/Telegram-уведомлений менеджеру.
- **Оценка:** **M**.

### 2.7 Листы ожидания (`Waitlist`)
- **Статус:** **ТОЛЬКО В БД-API** (enum в схеме есть, логики и UI нет).
- **Где в коде:**
  - `prisma/schema.prisma:1491-1496`: в `EnrollmentStatus` присутствует `WAITLIST`.
  - `src/app/api/groups/[id]/enrollments/route.ts:1-100`: при достижении `maxStudents` API просто отдаёт ошибку `400`, никогда не ставит статус `WAITLIST`.
- **Что переиспользовать:** `EnrollmentStatus.WAITLIST` или явную очередь на `Group`/`Course`.
- **Чего не хватает:** режима «Добавить в лист ожидания» при переполнении группы (для лидов и учеников), отображения очереди в карточке группы, уведомления администратора при освобождении места (`DROPPED`/`COMPLETED`).
- **Оценка:** **S–M**.

### 2.8 Поиск и слияние дубликатов
- **Статус:** **НЕТ**
- **Где в коде:** нормализация телефонов и проверка уникальности есть для `User` при регистрации/инвайтах, но не для лидов и кандидатов в CRM.
- **Что переиспользовать:** нормализацию телефонов Узбекистана `+998...` (если она используется в инвайтах/учениках; **НЕ ПРОВЕРЕНО** точное место хелпера, кроме `center/reports/page.tsx:163` и `notifications.ts`).
- **Чего не хватает:** мягкой дедупликации по нормализованному телефону при создании лида (предупреждение + быстрая склейка карточек/перенос активности), проверки совпадения лида с уже существующим `User`/`STUDENT` в центре.
- **Оценка:** **S–M**.

### 2.9 Журнал контактов (звонки, заметки, касания)
- **Статус:** **НЕТ**
- **Где в коде:** отсутствует.
- **Что переиспользовать:** аудит-ленту активности (timeline UI) из карточки сотрудника/ученика.
- **Чего не хватает:** таблицы `LeadActivity` (`CALL`, `NOTE`, `STAGE_CHANGE`, `TRIAL`, `TELEGRAM`, `WHATSAPP_CLICK`, `SMS`), единой ленты в карточке лида с переходом в историю `STUDENT` после конверсии.
- **Оценка:** **S**.

### 2.10 Роль менеджера по продажам (`SALES_MANAGER`)
- **Статус:** **НЕТ**
- **Где в коде:**
  - `prisma/schema.prisma` (и `src/lib/permissions.ts:1-200`): роли в центре только `DIRECTOR`, `CENTER_ADMIN`, `ACCOUNTANT`, `TEACHER`, `STUDENT`, `PARENT`, `CENTER_SUPPORT`.
- **Что переиспользовать:** матрицу выдачи ролей и RBAC-декораторы из `src/lib/permissions.ts`.
- **Чего не хватает:** новой роли `SALES_MANAGER` (права: CRM лиды, пробные уроки, просмотр расписания/групп, создание учеников/зачислений/инвайтов с ограничениями; без доступа к зарплатам, расходам, настройкам мерчанта и системным ключам), обновления матрицы в `permissions.ts` (`DIRECTOR`/`CENTER_ADMIN` могут назначать `SALES_MANAGER`).
- **Оценка:** **S**.

### 2.11 Публичная страница центра (поддомен, каталог, расписание, форма записи)
- **Статус:** **ЧАСТИЧНО** (в БД есть заготовки; рабочей витрины с записью лидов нет).
- **Где в коде:**
  - `prisma/schema.prisma`: у `LearningCenter` есть `slug`, `landingConfigJson`, `brandingConfig` (наличие полей бренда подтверждено через настройки, но детальный рендер публичных роутов витрины центра: **НЕ ПРОВЕРЕНО**, кроме лендинга самой платформы в `src/components/landing/*`).
  - `src/app/api/public/leads/route.ts:1-42`: работает как общая заглушка платформы без `centerId`.
- **Что переиспользовать:** `LearningCenter.slug`, `brandingConfig` (цвета/логотип), публичный iCal (`src/app/api/schedule/ical/route.ts:1-100`).
- **Чего не хватает:** публичной витрины `/c/[slug]` и роутинга по поддомену `slug.e-darschi.uz`, публичного каталога курсов/групп с актуальными ценами 1/2/3 мес и расписанием, формы онлайн-записи, создающей `Lead` + UTM в выбранном центре.
- **Оценка:** **M–L**.

### 2.12 Отчёты воронки
- **Статус:** **НЕТ**
- **Где в коде:** отсутствует.
- **Что переиспользовать:** графики `CenterTrendCharts.tsx` (`src/components/dashboard/CenterTrendCharts.tsx:1-100`).
- **Чего не хватает:** отчёта конверсии по стадиям (`NEW → TRIAL → PAID`), эффективности источников/UTM (CAC/CPL если введены бюджеты, ROMI по первым оплатам), среднего времени прохождения воронки и KPI по менеджерам.
- **Оценка:** **M**.

---

## БЛОК 3. КОММУНИКАЦИИ

### 3.1 Telegram (бот, привязка аккаунтов, уведомления)
- **Статус:** **НЕТ** (есть только контактная ссылка на поддержку платформы).
- **Где в коде:**
  - `prisma/schema.prisma:1375-1380`: `NotificationChannel` содержит `IN_APP`, `EMAIL`, `SMS`, `PUSH` (**`TELEGRAM` нет**).
  - `src/components/landing/Footer.tsx:138`: ссылка `https://t.me/edarschi_support`.
  - Других упоминаний бота/вебхуков Telegram в `src/`/`mobile/`/`transmitter/` нет.
- **Что переиспользовать:** механизм одноразовых криптографических токенов с SHA-256 хешем и транзакционной активацией из `src/app/api/invites/parent-link/route.ts:101-200`, таблицу `EmailOutbox` как шаблон очереди/ретраев, локализованные шаблоны.
- **Чего не хватает:**
  - Поля/модели `TelegramAccount` (`userId`, `telegramChatId`, `username`, `linkedAt`) и `TelegramLinkToken` (deep link `https://t.me/<bot>?start=<token>`).
  - Webhook endpoint `/api/webhooks/telegram` с проверкой заголовка `X-Telegram-Bot-Api-Secret-Token` через `safeCompareTokens`.
  - Бота для родителей/учеников/учителей: привязка, статус баланса и `paidUntil`, ссылка на оплату Click, расписание на сегодня, уведомления о пропусках, долгах и переносах уроков.
- **Оценка:** **L**.

### 3.2 Рассылки по группам и должникам
- **Статус:** **ЧАСТИЧНО** (работают только `IN_APP` объявления по ролям/группе; нет должников и внешних каналов).
- **Где в коде:**
  - `src/app/api/tenant/announcements/route.ts:1-200` + `src/components/AnnouncementsManager.tsx:1-100`: умеют отправлять объявление для `ALL`, `targetRole` или `groupId`, создают только `Notification` в БД (`IN_APP`).
- **Что переиспользовать:** `AnnouncementsManager`, API выбора аудитории, rate-limiting из `src/lib/notifications.ts`.
- **Чего не хватает:** сегментов аудитории (должники, истекающий период оплаты, лиды по стадии, группы/филиалы), выбора каналов (`TELEGRAM`, `SMS`, `EMAIL`, `PUSH`), отложенного запуска и журнала доставки (`Broadcast` / `BroadcastRecipient`).
- **Оценка:** **M**.

### 3.3 Шаблоны `ru` и `uz-Latn`
- **Статус:** **ЧАСТИЧНО** (только зашитые в код системные шаблоны; нет шаблонов оплаты/долга/CRM и редактора центра).
- **Где в коде:**
  - `src/lib/notifications.ts`: 3 SMS-шаблона посещаемости (`ru` и `uz`).
  - `src/lib/email.ts:1-100`: 5 email-шаблонов (`EMAIL_CONFIRMATION`, `PASSWORD_RESET`, `INVITE_LINK`, `ACCOUNT_LOCKED`, `LOGIN_CREDENTIALS`) на `ru`/`uz`.
- **Что переиспользовать:** хелперы локализации шаблонов `ru` / `uz-Latn`.
- **Чего не хватает:** шаблонов для оплаты, долга, истекающего периода, переноса/отмены урока, пробного урока, плюс таблицы кастомизируемых шаблонов центра (`CommunicationTemplate`) с переменными (`{{studentName}}`, `{{amount}}`, `{{paidUntil}}`, `{{payUrl}}`).
- **Оценка:** **S–M**.

### 3.4 Переписка учитель–родитель
- **Статус:** **НЕТ** (вопреки упоминанию U3 в прежних планах).
- **Где в коде:**
  - `src/app/api/tickets/route.ts:1-100` и `src/app/api/tickets/[id]/messages/route.ts:1-91`: только `SupportTicket`/`TicketMessage` (центр ↔ платформа).
  - `src/app/api/homework/route.ts` / `src/app/api/grades/route.ts`: только односторонние комментарии преподавателя (`HomeworkSubmission.feedback`, `Grade.comment`).
- **Что переиспользовать:** архитектуру сообщений (`TicketMessage` + вложения через `src/lib/storage.ts`), привязку родителя `ParentLink` (`CONFIRMED`).
- **Чего не хватает:** моделей `Conversation` (привязанной к паре ученик + учитель/группа + подтверждённые родители) и `Message`, экранов чата в кабинете учителя и родителя/мобильного API, оповещений в Telegram/Push при новом сообщении (и альтернативы — безопасного скрытия телефонов учителя если включена политика центра).
- **Оценка:** **L**.

### 3.5 Настройки уведомлений и тихие часы
- **Статус:** **ЧАСТИЧНО** (есть базовая матрица предпочтений; есть баг UI-рассинхрона; **нет тихих часов**).
- **Где в коде:**
  - `src/app/api/account/notification-preferences/route.ts:1-230`: пользовательские `user.notificationPrefsJson` + дефолты центра `LearningCenter.defaultNotificationPrefsJson`, `smsEnabled`, `smsDailyLimit`.
  - `src/components/profile/CenterProfileEditor.tsx:400-500`: редактирует реальные `smsEnabled`/`smsDailyLimit`.
  - **РАССИНХРОН:** `src/components/settings/CenterSettingsManager.tsx:1-100, 451-548` сохраняет `enableSms`/`enableEmail` внутри `brandingConfig` JSON, тогда как `notifyParentsOnAttendance` (`src/lib/notifications.ts:590`) проверяет `LearningCenter.smsEnabled`.
  - Тихих часов (`quietHours`) в `prisma/schema.prisma` и `notifications.ts` нет.
- **Что переиспользовать:** `notification-preferences` API и `defaultNotificationPrefsJson`.
- **Чего не хватает:** устранения дубля в `CenterSettingsManager.tsx` (привязать к реальным колонкам `LearningCenter` и `NotificationChannel`), добавления политики **тихих часов** центра и пользователя (например, 21:00–08:00 по `Asia/Tashkent`) с отложением некритичных SMS/Push/Telegram до утра.
- **Оценка:** **S**.

### 3.6 Push, SMS Eskiz, Email и WhatsApp-ссылки (реальная доставка)
- **Статус:** **ЧАСТИЧНО** (Eskiz и Email работают частично; Push — заглушка; WhatsApp ссылками — частично).
- **Где в коде:**
  - **SMS Eskiz (`src/lib/notifications.ts:1-642`)**: реальный REST-клиент `notify.eskiz.uz/api/auth/login` и `/message/sms/send` (`ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM`), лимиты 5/час и 15/день на номер, 500/день на центр, глобальный `SMS_DAILY_LIMIT`; без env падает в режим симуляции. Минус: используется **только** в `notifyParentsOnAttendance` (`L415-642`).
  - **Email (`src/lib/email.ts`, `src/app/api/cron/email-outbox/route.ts:1-31`, `src/lib/notifications.ts:381`)**: `EmailOutbox` и транзакционные письма работают, но универсальная `sendNotification` при `channel === "EMAIL"` **хардкодит** `renderEmailTemplate("LOGIN_CREDENTIALS", ...)` (`L381`)!
  - **Push (`src/lib/mobile-push.ts:27-84`)**: `dispatchMobilePush` — **заглушка** (`_title`, `_body`, `_data` не используются, запросов в Expo/FCM не делает; в `sendNotification` канал `PUSH` не вызывается). Таблица `DevicePushToken` при этом существует.
  - **WhatsApp-ссылки**: работают в `src/components/groups/GroupCard.tsx:140-190` и в долгах `src/app/center/reports/page.tsx:163` (`https://wa.me/...`).
- **Что переиспользовать:** клиент Eskiz + лимитеры из `notifications.ts`, таблицу `DevicePushToken` + проверки активности в `mobile-push.ts`, `EmailOutbox` + cron `8802`.
- **Чего не хватает:**
  1) доработки `dispatchMobilePush` через Expo Push API и/или `firebase-admin` (FCM);
  2) исправления `sendNotification` (`EMAIL` с реальными шаблонами по `NotificationType`, вызов `PUSH` и `TELEGRAM`, вызов `SMS` для финансовых/учебных событий);
  3) расширения `wa.me` ссылок на CRM-лидов и единый реестр должников (в т.ч. предзаполненный текст со ссылкой на оплату Click).
- **Оценка:** **M**.

---

## БЛОК 4. ОБУЧЕНИЕ

### 4.1 Перенос, отмена и отработка уроков (с уведомлением)
- **Статус:** **ЧАСТИЧНО** (перенос/отмена и замены учителей есть, отработки и полных уведомлений нет).
- **Где в коде:**
  - `src/app/api/lessons/route.ts:1-284`, `src/app/api/lessons/[id]/route.ts:1-130`: создание/редактирование `Lesson` с проверкой `Holiday`. При `CANCELLED` или смене замещающего учителя отправляет `sendNotification` (`IN_APP`) ученикам — **родителям не отправляет, при `RESCHEDULED` (смена даты/времени) уведомление не отправляется**.
  - `src/app/api/tenant/schedule/route.ts:1-400`: регулярное расписание `ScheduleSlot` уведомляет учеников `IN_APP` при отмене/смене времени, но **не проверяет `Holiday`** (в отличие от `lessons/route.ts`).
  - `src/app/api/substitutions/route.ts:1-100` и `src/app/api/substitutions/[id]/route.ts:1-328`: заявки на замену (`REQUESTED -> APPROVED | REJECTED | CANCELLED`), проверка коллизии слота у замещающего учителя (`L208-251`), но уведомляются только инициатор и заменяющий учитель (не ученики/родители).
- **Что переиспользовать:** `Lesson` статусы, `SubstitutionRequest`, `Holiday`, `sendNotification`.
- **Чего не хватает:** модели `MakeupLesson` (индивидуальная/групповая отработка пропущенного по уважительной причине урока, привязка к исходному `Attendance`/`Lesson`), отправки уведомлений **ученикам И родителям** через Telegram/Push/SMS при `RESCHEDULED`/`CANCELLED`/замене, проверки `Holiday` при создании/генерации из `ScheduleSlot`.
- **Оценка:** **M**.

### 4.2 Ссылка на живой урок
- **Статус:** **ЧАСТИЧНО** (ссылка в БД и показ в расписании есть; автогенерации/учёта входа по ссылке нет).
- **Где в коде:**
  - `ScheduleSlot` / `Lesson` имеют `onlineMeetingUrl`.
  - `src/components/schedule/UpcomingLessons.tsx:1-78`: рендерит кнопку перехода по `onlineMeetingUrl`.
  - Экран создания/редактирования `Lesson`/`ScheduleSlot` полностью не перепроверялся в разрезе всех полей формы онлайн-ссылок (`ScheduleManager.tsx` проверен на `L1-157`).
- **Что переиспользовать:** поле `onlineMeetingUrl` и UI-кнопку из `UpcomingLessons.tsx`.
- **Чего не хватает:** интеграции с Zoom/Google Meet/Jitsi (или единой комнаты группы), логирования клика ученика как подтверждения присутствия на онлайн-уроке, напоминания со ссылкой за 15 мин в Telegram/Push.
- **Оценка:** **S–M**.

### 4.3 Прогресс по курсу
- **Статус:** **ЧАСТИЧНО** (детальная оценка `my/courses` UI: **НЕ ПРОВЕРЕНО**).
- **Где в коде:**
  - `src/app/api/courses/route.ts:1-85` + `src/app/center/courses/[id]/page.tsx:1-100`: конструктор курса/модулей/уроков.
  - `src/app/api/students/[id]/performance/route.ts:1-100` и `src/app/api/tenant/students/[id]/transcript/route.ts:1-100`: сводка успеваемости и транскрипт оценок/посещаемости (CSV/JSON).
- **Что переиспользовать:** конструктор модулей/уроков курса, API успеваемости и транскрипта.
- **Чего не хватает:** расчёта % прохождения программы курса по завершённым темам/ДЗ/тестам, отображения шкалы прогресса у ученика и родителя (включая в Telegram-боте), отметок «пройден/не пройден» по конкретным темам для отработок.
- **Оценка:** **S–M**.

### 4.4 Банк вопросов и типы вопросов
- **Статус:** **ЧАСТИЧНО** (4 типа вопросов и безопасный грейдинг работают; банка вопросов для переиспользования нет).
- **Где в коде:**
  - `prisma/schema.prisma:1344-1349`: `QuestionType` (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TEXT`, `TRUE_FALSE`).
  - `src/app/api/tests/route.ts:1-200` + `src/lib/test-grading.ts:1-100`: серверный подсчёт баллов, лимит попыток, `sanitizeQuestionForClient` скрывает правильные ответы от клиента.
- **Что переиспользовать:** `Test`, `Question`, `sanitizeQuestionForClient`, логику грейдинга.
- **Чего не хватает:** библиотеки/банка вопросов центра (`QuestionBank` с тегами по предмету, теме, уровню CEFR/классу, сложностью), импорта вопросов из CSV/Excel, случайной выборки N вопросов из банка на попытку, типов вопросов `MATCHING` / `FILL_IN_BLANKS` / `AUDIO` (актуально для языковых центров).
- **Оценка:** **M**.

### 4.5 Сертификаты
- **Статус:** **НЕТ**
- **Где в коде:** моделей `Certificate` и эндпоинтов генерации нет.
- **Что переиспользовать:** шаблон печатного документа + локальное/S3-хранилище (`src/lib/storage.ts`) + `EnrollmentStatus.COMPLETED` + транскрипт `tenant/students/[id]/transcript`.
- **Чего не хватает:** модели `Certificate` (`serialNumber`, `verifyTokenHash`, `studentMembershipId`, `courseId`, `issuedAt`, `pdfUrl`), конструктора шаблона сертификата (подпись/печать/логотип центра), генерации PDF с QR-кодом и публичной страницы проверки `/verify/[code]`.
- **Оценка:** **M**.

### 4.6 Договоры и согласия (оферта, договор с центром, ПДн)
- **Статус:** **НЕТ**
- **Где в коде:** моделей договоров и согласий в `prisma/schema.prisma` нет.
- **Что переиспользовать:** `src/lib/storage.ts` (валидация PDF и квота), `ParentLink` (для согласия родителя за несовершеннолетнего).
- **Чего не хватает:** моделей `ContractTemplate`, `StudentContract` (шаблон с подстановкой ФИО, ПИНФЛ/паспорта, суммы/периода, файла/эЦП-акцепта через SMS OTP или клик с фиксацией IP/времени) и `ConsentRecord` (согласие на обработку ПДн, фото/видеосъёмку, оферту при онлайн-оплате).
- **Оценка:** **M**.

### 4.7 Комментарии к урокам
- **Статус:** **НЕТ** (комментариев под уроком курса/живым уроком в `schema.prisma` и проверенных API нет).
- **Где в коде:** есть только комментарии преподавателя к ДЗ (`HomeworkSubmission.feedback` — см. `src/app/api/homework/route.ts:290-350`) и к оценкам (`Grade.comment` — см. `src/app/api/grades/route.ts:320-385`). Наличие комментариев непосредственно в интерфейсе курса студента: **НЕ ПРОВЕРЕНО**.
- **Что переиспользовать:** `AuditLog` / notification triggers из `homework/route.ts` и `grades/route.ts`.
- **Чего не хватает:** модели `LessonComment` (`lessonId` / `courseLessonId`, `authorMembershipId`, `parentId` для ответов) для вопросов учеников под темой урока или заметок учителя по проведённому занятию с видимостью родителям.
- **Оценка:** **S**.

---

## БЛОК 5. УПРАВЛЕНИЕ ЦЕНТРОМ

### 5.1 Кабинеты и ресурсы (занятость и коллизии)
- **Статус:** **ЧАСТИЧНО** (текстовая проверка коллизии `roomName` есть; справочника кабинетов, вместимости и сетки занятости нет).
- **Где в коде:**
  - `prisma/schema.prisma:424`: `ScheduleSlot.roomName String?` — свободная строка без таблицы `Room`.
  - `src/app/api/tenant/schedule/route.ts:1-400`: проверяет коллизию точного совпадения строки `roomName` под `withKeyedLock`.
- **Что переиспользовать:** `withKeyedLock` и алгоритм проверки временных пересечений из `tenant/schedule/route.ts`.
- **Чего не хватает:** модели `Room` (`branchId`, `name`, `capacity`, `equipmentJson`, `isActive`), связи `ScheduleSlot.roomId` и `Lesson.roomId` (вместо опечаток вроде «Каб. 1» vs «Кабинет 1»), проверки `Group.maxStudents <= Room.capacity`, визуальной шахматки занятости аудиторий по филиалу/дню.
- **Оценка:** **M**.

### 5.2 Доступность и отпуска учителей
- **Статус:** **НЕТ** (доступность/отпуска не хранятся; есть только постфактум замена).
- **Где в коде:**
  - `src/app/api/substitutions/[id]/route.ts:208-251`: проверяет только пересечение с другими активными слотами расписания у замещающего учителя.
- **Что переиспользовать:** алгоритм пересечения временных интервалов из `substitutions/[id]/route.ts`.
- **Чего не хватает:** моделей `TeacherAvailability` (предпочтительные дни/часы работы по филиалам) и `TeacherLeave` (`VACATION`, `SICK`, `UNPAID`, `startDate`, `endDate`, `status`), предупреждения при постановке `ScheduleSlot`/`Lesson` на нерабочее время или отпуск учителя, автосоздания черновиков замен при утверждении отпуска.
- **Оценка:** **M**.

### 5.3 Документы ученика и файловое хранилище
- **Статус:** **НЕТ** (документов ученика); **ЧАСТИЧНО** (хранилище работает только локально, S3/R2 недописан).
- **Где в коде:**
  - Модели `StudentDocument` в `prisma/schema.prisma` нет.
  - `src/lib/storage.ts:250-483`:
    - `validateFileBufferSignature` (`L275-335`) проверяет magic bytes (JPEG, PNG, GIF, WEBP, PDF, ZIP/DOCX) и режет XSS/SVG.
    - `saveFile` (`L337-399`) проверяет квоту `checkStorageQuota` (`L353`), но при `STORAGE_PROVIDER=s3|r2|minio` (`L365-381`) **не загружает байты в бакет, а просто возвращает сформированный URL**! Реально сохраняет только на локальный диск (`L384-398`).
    - `generatePresignedUploadUrl` (`L447-483`) и `src/app/api/upload/presign/route.ts:1-89` при `s3`/`r2` явно бросают ошибку (`"Real S3 uploads require AWS SDK presigner and credentials. Mock signatures are disabled."`).
- **Что переиспользовать:** строгую валидацию magic bytes, `checkStorageQuota`, `safeResolvePath` и `/api/upload/route.ts` (`L1-60`).
- **Чего не хватает:**
  1) модели `StudentDocument` (`PASSPORT`, `BIRTH_CERT`, `MEDICAL`, `CONTRACT`, `OTHER`, номер, дата истечения, `fileUrl`, `sizeBytes`);
  2) реального клиента `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` в `storage.ts` (иначе при multi-instance деплое или R2 файлы теряются/не загружаются).
- **Оценка:** **M**.

### 5.4 Единая карточка ученика (и сотрудника)
- **Статус:** **ЕСТЬ И РАБОТАЕТ** (базовый профиль богатый; нужно расширить новыми блоками).
- **Где в коде:**
  - `src/components/students/StudentProfileClient.tsx` (проверены `L551-650`, 9 вкладок), `src/app/api/students/route.ts:1-150`, `src/app/api/students/[id]/performance/route.ts:1-100`, `src/app/api/tenant/students/[id]/transcript/route.ts:1-100`.
  - Профиль сотрудника: `src/components/staff/StaffProfileClient.tsx` (`L1-100`, 4 вкладки: `profile`, `access`, `groups`, `history` + активные сессии).
- **Что переиспользовать:** всю структуру `StudentProfileClient` с проверками IDOR в API.
- **Чего не хватает:** добавления в карточку ученика вкладок/виджетов для: **оплаченных периодов и промокодов**, **CRM-истории (из какого лида и UTM пришёл)**, **документов и договоров**, **чата с родителями**, **отработок уроков** и **сертификатов**.
- **Оценка:** **S–M** (инкрементально по мере готовности модулей).

---

## БЛОК 6. АНАЛИТИКА

### 6.1 Дашборд владельца (`DIRECTOR` / `CENTER_ADMIN`)
- **Статус:** **ЕСТЬ И РАБОТАЕТ** (на реальных данных БД, кроме мелкого fallback в одном API).
- **Где в коде:**
  - `src/app/center/page.tsx:51-330`: серверный расчёт KPI (активные ученики, группы, выручка, долги, 90-дневные тренды, проблемные зоны).
  - `src/components/dashboard/CenterTrendCharts.tsx:1-100` и `src/app/api/mobile/director/dashboard/route.ts:1-80`.
  - Финансовые отчёты: `src/lib/finance-reports.ts:66-200, 311-397` + `src/app/api/finance/reports/route.ts:1-103` + `src/lib/finance-export.ts:1-100` (реальные P&L, CashFlow по счетам, разбивки по месяцам Tashkent, категориям, филиалам, курсам, группам, Aging должников).
  - Платформенная аналитика (для `SUPERADMIN`): `src/app/api/platform/analytics/route.ts:1-82` и `src/app/api/platform/finance/stats/route.ts:1-200` (MRR/ARR/ARPU, churn центров, просрочки подписок).
- **Что переиспользовать:** `generateFinanceReport`, `CenterTrendCharts`, `calculateDebtorsReport`.
- **Чего не хватает:**
  - В `src/app/api/center-payments/report/route.ts:1-65` убрать фиктивный fallback `150000` при расчёте `expectedMRR`.
  - Добавить на дашборд директора **прогноз продлений (сколько учеников с `paidUntil` истекает в ближайшие 7/14 дней)** и **конверсию лидов CRM**.
- **Оценка:** **S–M**.

### 6.2 Отчёты воронки CRM
- **Статус:** **НЕТ** (дублирует п. 2.12 — зависит от появления CRM).
- **Оценка:** **M**.

### 6.3 Отток (`Churn`) и риск ухода ученика
- **Статус:** **ЧАСТИЧНО** (есть риск по посещаемости <80%; нет полного анализа оттока и LTV).
- **Где в коде:**
  - `src/app/api/attendance/analytics/route.ts:1-200`: реально считает студентов с посещаемостью ниже `80%`, неотмеченные уроки и неактивных учителей.
  - `src/app/api/platform/analytics/route.ts:1-82`: считает churn, но на уровне центров платформы, а не учеников.
- **Что переиспользовать:** метрику `attendance/analytics`, статус `EnrollmentStatus.DROPPED`.
- **Чего не хватает:** скоринга риска оттока ученика (комбинация: посещаемость `< 75%` + пропуски подряд >= 2 + просрочка оплаты > 5 дней + неотработанный урок), отчёта по причинам отчисления и когортного retention / LTV по курсам и преподавателям.
- **Оценка:** **M**.

### 6.4 Загрузка кабинетов и учителей
- **Статус:** **ЧАСТИЧНО** (часы и зарплаты учителей считаются; загрузка аудиторий — нет).
- **Где в коде:**
  - `src/app/api/tenant/teacher-hours/route.ts:1-100` + `src/lib/finance-reports.ts:400` (`TeacherSalaryRow`; строки после `L400` детально **НЕ ПРОВЕРЕНО**), базовые таблицы в `CenterFinanceManager.tsx` (вкладка `salaries`) и `src/app/center/reports/page.tsx:1-200`.
- **Что переиспользовать:** агрегацию проведённых часов и ставок из `tenant/teacher-hours`.
- **Чего не хватает:** после внедрения `Room` — расчёта % загрузки аудиторий (фактические слот-часы / доступные часы работы филиала по сменам) и средней заполненности групп (`enrollments / room.capacity`).
- **Оценка:** **S–M**.

---

## БЛОК 7. ВОВЛЕЧЁННОСТЬ

### 7.1 Баллы, значки и рейтинги (`Leaderboard`)
- **Статус:** **НЕТ** в БД/API (детальные UI-флаги вроде упоминаемого в поиске `goodAttendanceBadge`: **НЕ ПРОВЕРЕНО**).
- **Где в коде:**
  - `prisma/schema.prisma` (`38` моделей): таблиц `PointTransaction`, `Badge`, `StudentBadge`, `Leaderboard` нет.
  - Существующие источники событий для начисления: `Attendance` (посещаемость), `HomeworkSubmission` (вовремя сданное ДЗ), `TestAttempt` (баллы за тест), `Grade`.
- **Что переиспользовать:** события выставления посещаемости/оценок/тестов и `StudentProfileClient.tsx`.
- **Чего не хватает:** правил начисления баллов центра (`PointsRule`), журнала транзакций баллов (`GamificationTransaction`), каталога значков и автовыдачи (`StudentBadge`), рейтинга в разрезе группы/курса/центра (с настройкой приватности — скрытие ФИО при желании) и витрины призов/обмена баллов (если центр включает геймификацию).
- **Оценка:** **M**.

### 7.2 Реферальная программа («Приведи друга»)
- **Статус:** **НЕТ**
- **Где в коде:** моделей `Referral` и реферальных кодов нет.
- **Что переиспользовать:** будущий движок `PromoCode` (P1) и модель `Lead` (P3).
- **Чего не хватает:** персонального реферального кода/ссылки ученика или родителя, атрибуции нового лида/ученика к пригласившему, триггера начисления бонуса только **после первой успешной оплаты** друга (защита от накрутки), учёта бонусных дней к `paidUntil` или скидки на следующий период.
- **Оценка:** **M**.

---

## БЛОК 8. ПЛАТФОРМА

### 8.1 Бренд центра и поддомен
- **Статус:** **ЧАСТИЧНО** (настройки бренда в БД есть; мультидоменного/поддоменного роутинга нет).
- **Где в коде:**
  - `prisma/schema.prisma`: `LearningCenter` содержит `slug`, `brandingConfig`, `landingConfigJson`.
  - `src/components/settings/CenterSettingsManager.tsx:1-100`: UI настроек центра и `brandingConfig`.
  - `src/middleware.ts:1-100`: проверяет `Origin`/CSRF и лимит тела `1MB`; мульти-тенантной маршрутизации по поддомену `Host` (`slug.e-darschi.uz`) в проверенной части `middleware.ts` не обнаружено (строки за пределами `L100`: **НЕ ПРОВЕРЕНО**).
- **Что переиспользовать:** `LearningCenter.slug`, `brandingConfig` (логотип, основной цвет).
- **Чего не хватает:** wildcard-маршрутизации `*.e-darschi.uz` (или `/c/[slug]`) в `middleware.ts`, white-label страницы логина, витрины курсов и формы оплаты центра в цветах/логотипе центра, CNAME/кастомного домена для старшего тарифа.
- **Оценка:** **M**.

### 8.2 Языки (`ru`, `uz-Latn`, `uz-Cyrl`, `en`)
- **Статус:** **ЧАСТИЧНО** (работают `ru` и `uz-Latn`; `uz-Cyrl` и `en` неполноценны или отсутствуют).
- **Где в коде:**
  - `prisma/schema.prisma:1573-1577`: enum `Language` = `ru`, `uz_Latn`, `uz_Cyrl` (**`en` отсутствует**).
  - `src/i18n/index.ts:1-100` и `src/lib/language.ts:1-40`: `SUPPORTED_LOCALES = ["ru", "uz-Latn"]`; значения `uz_Cyrl` принудительно сводятся к `"ru"`.
  - `src/lib/landing-i18n.ts:1-23`: на лендинге только `uz` и `ru`.
- **Что переиспользовать:** систему словарей `src/i18n/`, `User.language` и `LearningCenter` язык по умолчанию.
- **Чего не хватает:** словарей для **`uz-Cyrl`** (кириллический узбекский) и **`en`** (английский — критично для IT/IELTS-центров и экспатов-преподавателей), добавления `en` в `Language` enum, синхронизации языка уведомлений (Telegram/SMS/Email) с профилем родителя/ученика.
- **Оценка:** **M** (инфраструктура S + перевод словарей M).

### 8.3 Вход через Telegram / Google
- **Статус:** **НЕТ**
- **Где в коде:**
  - `prisma/schema.prisma`: у `User` есть только `email`, `phone`, `passwordHash`, `twoFactorSecret`, `emailVerified`, `phoneVerified`; моделей OAuth-аккаунтов и `telegramId` нет.
  - В `package.json:1-64` библиотек OAuth (`next-auth` и т.п.) нет.
- **Что переиспользовать:** текущую JWT-сессию (`src/lib/auth.ts`) и модель `TelegramAccount` (из блока 3.1).
- **Чего не хватает:** Telegram Login Widget / Mini App initData верификации (HMAC-SHA256 с bot token + `timingSafeEqual`), Google OAuth 2.0 / OIDC с PKCE, привязки к существующему пользователю только после подтверждения владения контактом/паролем (защита от account takeover).
- **Оценка:** **M**.

### 8.4 Импорт Excel/CSV и миграция из других CRM
- **Статус:** **ЧАСТИЧНО** (есть CSV-импорт учеников; нет `.xlsx` и коннекторов из других CRM).
- **Где в коде:**
  - `src/app/api/students/import-csv/route.ts:1-100`: **ЕСТЬ И РАБОТАЕТ** (preview + execute до `500` строк с `sanitizeCsvValue`).
  - `src/app/api/invites/bulk-import/route.ts:1-103`: массовый JSON-импорт инвайтов.
  - `package.json:1-64`: пакеты `exceljs` / `xlsx` отсутствуют.
- **Что переиспользовать:** валидацию строк, предпросмотр ошибок и лимит батча из `students/import-csv`.
- **Чего не хватает:** парсера `.xlsx` (через `exceljs`) для миграции баз из Excel/AmoCRM/Modme/AlfaCRM (за один импорт: ученик + телефон родителя + группа + текущая дата `paidUntil` + начальный долг/аванс), маппинга колонок в UI.
- **Оценка:** **M**.

### 8.5 Публичное API и вебхуки для интеграций центра
- **Статус:** **НЕТ**
- **Где в коде:** моделей API-ключей и исходящих webhook-подписок центров нет.
- **Что переиспользовать:** паттерн SHA-256 хеширования токенов (`src/lib/auth.ts`), rate-limiting (`src/lib/rate-limit.ts`).
- **Чего не хватает:** API-ключей с набором скоупов (`CenterApiKey` — хранится только хеш, префикс, `lastUsedAt`, IP-allowlist), REST endpoints `/api/v1/leads` (приём заявок с внешних сайтов/Tilda/Telegram-рекламы), `/api/v1/students`, `/api/v1/schedule` и исходящих вебхуков (с HMAC-SHA256 подписью и очередью ретраев).
- **Оценка:** **L**.

### 8.6 Онбординг нового центра
- **Статус:** **ЧАСТИЧНО** (есть противоречие между закрытой страницей UI и активным API).
- **Где в коде:**
  - `src/app/onboarding/page.tsx:1-46`: UI выводит сообщение, что самостоятельная регистрация закрыта и центр создаёт администратор платформы.
  - `src/app/api/tenant/onboarding/route.ts:1-119`: серверный `POST`-роут при этом всё ещё функционирует.
  - `src/app/api/platform/centers/route.ts:101-200`: создание центра платформой генерирует случайный 32-байтный пароль и отправляет ссылку сброса директору.
- **Что переиспользовать:** `/api/platform/centers` и `tenant/onboarding/route.ts`.
- **Чего не хватает:** единой политики (закрыть или защитить `tenant/onboarding` под решение о self-signup), плюс **чек-листа запуска для директора** после первого входа (1. Филиал и кабинеты → 2. Курсы и группы с ценами 1/2/3 мес → 3. Приглашение/импорт учеников → 4. Подключение Click → 5. Привязка Telegram-бота).
- **Оценка:** **S–M**.

---

## БЛОК 9. ТАРИФЫ ПЛАТФОРМЫ

### 9.1 Структура `SubscriptionPlan` и `featuresJson`
- **Статус:** **ЧАСТИЧНО** (количественные лимиты работают; `featuresJson` пустая формальность).
- **Где в коде:**
  - `prisma/schema.prisma:137-153`: `SubscriptionPlan` хранит `priceMonthly`, `maxStudents`, `maxTeachers`, `maxCourses`, `maxBranches`, `maxStorage`, `featuresJson`.
  - `src/lib/subscription-plans.ts:1-27` и `src/app/api/platform/plans/route.ts:1-94`.
  - `src/app/platform-admin/plans/page.tsx:1-200` (`formData` на `L38-47`): **не включает поле `featuresJson`** в форму создания/редактирования и выводит цену как **`$priceMonthly / месяц`** (USD-символ, хотя в финансах платформы и на лендинге суммы в UZS — см. `src/lib/landing-i18n.ts:22`).

### 9.2 Проверка лимитов и флагов функций
- **Статус:** **ЧАСТИЧНО** (числовые лимиты проверяются с багом; `featuresJson` **НЕ проверяется вообще**).
- **Где в коде:**
  - `src/lib/limits.ts:1-154`: проверяет `students`, `teachers`, `courses`, `branches`; `checkStorageQuota` в `src/lib/storage.ts:353` проверяет `maxStorage`.
  - **БАГ в `src/lib/limits.ts:53`:** `checkSubscriptionLimit` считает всех учителей без фильтра `status: { not: "ARCHIVED" }`, в отличие от `getCenterSubscriptionUsage` (`L89`), что ложно блокирует добавление нового преподавателя после архивации старых.
  - `featuresJson` **нигде в коде не парсится и не проверяется** (`requireFeature(...)` отсутствует).

### 9.3 Предлагаемая привязка модулей к тарифам (`featuresJson`)

| Модуль / Лимит | Starter (базовый) | Pro (растущий центр) | Business / Enterprise |
| :--- | :--- | :--- | :--- |
| Лимиты (`students` / `branches` / `storage`) | До 100 / 1 / 1 ГБ | До 500 / 3 / 10 ГБ | Безлимит или кастом / 50+ ГБ |
| Учёт групп, расписания, посещаемости, ручных оплат | Да | Да | Да |
| **Тарифы групп 1/2/3 мес + промокоды** | Базовый (1 мес) | Полный + промокоды | Полный + промокоды |
| **Онлайн-оплата Click (0% комиссии платформы)** | Нет / лимит или платно | Да | Да + мульти-мерчант по филиалам |
| **CRM (лиды, воронка, пробные уроки, waitlist)** | Нет или только приём заявок | Да | Да + автораспределение и отчёты |
| **Telegram-бот (оповещения и статус оплаты)** | Базовые уведомления | Да | Да + кастомные шаблоны |
| **SMS Eskiz и автонапоминания о долгах** | Оплата центра / выкл | Да (до квоты) | Да + приоритетная очередь |
| **Рассылки, отработки, сертификаты, договоры** | Нет | Сертификаты + рассылки | Всё + ЭДО/согласия + документы |
| **Справочник кабинетов, зарплата учителей, P&L** | Упрощённый | Да | Да + глубокий churn & LTV |
| **Поддомен `slug.e-darschi.uz` и витрина центра** | `/c/slug` | Поддомен + витрина | Кастомный домен + white-label |
| **Публичное API, вебхуки, `.xlsx` импорт** | CSV только | CSV + `.xlsx` | API + Webhooks + `.xlsx` |

### 9.4 Периоды оплаты подписки центра
- **Статус:** **ЧАСТИЧНО** (ручные B2B-подписки + cron просрочки есть; гибких периодов 1/3/6/12 мес и онлайн-оплаты подписки нет).
- **Где в коде:**
  - `src/app/api/platform/subscriptions/route.ts:1-196`, `src/app/api/platform/finance/payments/route.ts:1-200`.
  - `src/lib/platform-subscription-cron.ts:1-100` + `src/app/api/cron/subscriptions/route.ts:1-48` (advisory lock `8803`): автоматический перевод `PAST_DUE → PAUSED`, уведомления и `EmailOutbox`.
- **Чего не хватает:** цен на 3/6/12 месяцев со скидкой, единой валюты (UZS по всему стеку без знака `$`), кнопки продления подписки директором прямо из `/center/settings` через B2B Click/Payme или счёт на юрлицо.
- **Оценка по блоку 9:** **M** (починка `limits.ts:53`, валидируемая схема `PlanFeaturesSchema` + хелпер `requirePlanFeature(centerId, featureKey)` + периоды оплаты).

---

## БЛОК 10. ДАННЫЕ И МОДЕЛЬ (Черновик Prisma для P1–P5)

> [!NOTE]
> Ниже приведён **только архитектурный черновик** для `docs/AUDIT_FEATURES.md`. Файл `prisma/schema.prisma` не изменялся.  
> **Критическое правило изоляции:** каждую новую модель, содержащую `centerId`, необходимо добавить в `TENANT_MODELS` в `src/lib/db-tenant.ts:4-39`, иначе tenant-middleware не будет изолировать запросы.

### 10.1 Черновик расширений и новых моделей

```prisma
// === P1: Тарифы групп 1/2/3 мес, Оплаченный период, Единые начисления, Промокоды, Click ===

enum BillingPeriodMonths {
  ONE_MONTH   // 1
  TWO_MONTHS  // 2
  THREE_MONTHS // 3
}

enum ChargeStatus {
  PENDING
  PARTIALLY_PAID
  PAID
  VOID
  REFUNDED
}

enum PromoDiscountType {
  PERCENT
  FIXED_AMOUNT
}

enum PaymentProvider {
  CLICK
}

enum WebhookProcessStatus {
  RECEIVED
  PROCESSED
  FAILED
  IGNORED
}

// Расширение Group (добавить связь с тарифами и опционально кабинет)
// pricingPlans GroupPricingPlan[]
// defaultRoomId String? -> Room?

model GroupPricingPlan {
  id           String   @id @default(cuid())
  centerId     String
  groupId      String
  periodMonths Int      // 1, 2 или 3 (CHECK constraint в SQL миграции)
  price        Int      // Хранить в целых сумах (UZS) во избежание Float-ошибок
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([groupId, periodMonths])
  @@index([centerId, groupId, isActive])
}

// Расширение Enrollment:
// paidUntil     DateTime?
// frozenUntil   DateTime?
// freezes       EnrollmentFreeze[]
// charges       Charge[]
// Позволяет точно знать, до какого числа ученик предоплачен, без эвристики от enrolledAt.

model EnrollmentFreeze {
  id           String   @id @default(cuid())
  centerId     String
  enrollmentId String
  startDate    DateTime
  endDate      DateTime
  shiftedDays  Int      @default(0)
  reason       String?
  createdById  String
  createdAt    DateTime @default(now())

  enrollment Enrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  @@index([centerId, enrollmentId, startDate])
}

model PromoCode {
  id              String            @id @default(cuid())
  centerId        String
  code            String            // Нормализуется в UPPERCASE + trim
  discountType    PromoDiscountType
  discountValue   Int               // Процент (1..100) или фикс в UZS
  maxUses         Int?
  usesCount       Int               @default(0)
  perStudentLimit Int               @default(1)
  validFrom       DateTime?
  validUntil      DateTime?
  minPeriodMonths Int?              // Например, действует только при оплате за 2 или 3 мес
  courseId        String?           // NULL = на любой курс центра
  groupId         String?
  isActive        Boolean           @default(true)
  deletedAt       DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  redemptions PromoCodeRedemption[]

  @@unique([centerId, code])
  @@index([centerId, isActive, validUntil])
}

model PromoCodeRedemption {
  id                  String   @id @default(cuid())
  centerId            String
  promoCodeId         String
  studentMembershipId String
  chargeId            String?
  centerPaymentId     String?
  discountApplied     Int
  redeemedAt          DateTime @default(now())

  promoCode PromoCode @relation(fields: [promoCodeId], references: [id], onDelete: Restrict)

  @@unique([promoCodeId, chargeId])
  @@index([centerId, studentMembershipId, promoCodeId])
}

model Charge {
  id                  String       @id @default(cuid())
  centerId            String
  studentMembershipId String
  enrollmentId        String?
  groupId             String?
  periodMonths        Int?         // 1, 2, 3 или NULL для разовых услуг
  periodStart         DateTime?
  periodEnd           DateTime?
  baseAmount          Int          // Цена по тарифу группы в UZS
  discountAmount      Int          @default(0)
  promoCodeId         String?
  finalAmount         Int          // baseAmount - discountAmount
  paidAmount          Int          @default(0)
  dueDate             DateTime
  status              ChargeStatus @default(PENDING)
  invoiceNumber       String       // Человекочитаемый номер INV-YYYYMM-XXXX
  createdById         String?
  deletedAt           DateTime?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  enrollment     Enrollment?    @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)
  paymentLinks   ChargePaymentAllocation[]

  @@unique([centerId, invoiceNumber])
  @@index([centerId, studentMembershipId, status])
  @@index([centerId, status, dueDate])
}

model ChargePaymentAllocation {
  id              String   @id @default(cuid())
  centerId        String
  chargeId        String
  centerPaymentId String
  allocatedAmount Int
  createdAt       DateTime @default(now())

  charge Charge @relation(fields: [chargeId], references: [id], onDelete: Cascade)

  @@unique([chargeId, centerPaymentId])
  @@index([centerId, centerPaymentId])
}

model CenterMerchantConfig {
  id                    String          @id @default(cuid())
  centerId              String
  branchId              String?         // NULL = общий мерчант центра; опционально на филиал
  provider              PaymentProvider @default(CLICK)
  serviceId             String
  merchantId            String
  merchantUserId        String?
  encryptedSecretKey    String          // AES-256-GCM: enc:gcm:iv:tag:cipher
  targetAccountId       String?         // Account центра (BANK/ONLINE), куда падает FinanceTransaction
  isActive              Boolean         @default(false)
  lastVerifiedAt        DateTime?
  rotatedAt             DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  @@unique([centerId, provider, serviceId])
  @@index([provider, serviceId, isActive])
}

model PaymentIntent {
  id                  String          @id @default(cuid())
  centerId            String
  provider            PaymentProvider @default(CLICK)
  merchantConfigId    String
  chargeId            String?
  studentMembershipId String
  merchantTransId     String          @unique // Уникальный ID заказа, отдаваемый в Click
  amount              Int             // Ожидаемая точная сумма в UZS
  periodMonths        Int?
  promoCodeId         String?
  clickPrepareId      BigInt?
  clickTransId        String?
  status              String          @default("CREATED") // CREATED, PREPARED, PAID, CANCELLED, EXPIRED
  expiresAt           DateTime
  createdByUserId     String
  centerPaymentId     String?         @unique
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  @@index([centerId, studentMembershipId, status])
  @@index([provider, clickTransId])
}

model PaymentWebhookEvent {
  id            String               @id @default(cuid())
  centerId      String?
  provider      PaymentProvider
  externalEventId String             // click_trans_id + ":" + action
  action        Int                  // 0=Prepare, 1=Complete
  merchantTransId String?
  amount        Int?
  signatureValid Boolean
  status        WebhookProcessStatus @default(RECEIVED)
  errorCode     Int?
  payloadJson   Json                 // Без secret_key и чувствительных токенов!
  receivedAt    DateTime             @default(now())
  processedAt   DateTime?

  @@unique([provider, externalEventId])
  @@index([centerId, receivedAt])
}

// === P2: Коммуникации (Telegram, Шаблоны, Рассылки, Тихие часы, Чат P5) ===

model TelegramAccount {
  id             String   @id @default(cuid())
  userId         String   @unique
  telegramUserId BigInt   @unique
  chatId         BigInt
  username       String?
  isBlocked      Boolean  @default(false)
  linkedAt       DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model TelegramLinkToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique // SHA-256 одноразового токена
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, expiresAt])
}

model Broadcast {
  id             String   @id @default(cuid())
  centerId       String
  createdById    String
  title          String
  body           String
  channelsJson   Json     // ["TELEGRAM", "PUSH", "SMS", "EMAIL"]
  segmentJson    Json     // { type: "DEBTORS" | "GROUP" | "EXPIRING_3D" | "ALL", groupId? }
  status         String   @default("DRAFT") // DRAFT, SCHEDULED, SENDING, COMPLETED
  scheduledAt    DateTime?
  sentCount      Int      @default(0)
  failedCount    Int      @default(0)
  createdAt      DateTime @default(now())
}

// === P3: CRM (Лиды, Воронка, Пробные уроки, Задачи) ===

enum LeadStage {
  NEW
  CONTACTED
  TRIAL_SCHEDULED
  TRIAL_COMPLETED
  NEGOTIATION
  WON
  LOST
}

model Lead {
  id                  String    @id @default(cuid())
  centerId            String
  branchId            String?
  fullName            String
  phone               String    // Нормализованный +998XXXXXXXXX
  parentPhone         String?
  stage               LeadStage @default(NEW)
  source              String?   // INSTAGRAM, TELEGRAM, SITE, WALK_IN, REFERRAL
  utmSource           String?
  utmMedium           String?
  utmCampaign         String?
  interestedCourseId  String?
  assignedToId        String?   // CenterMembership (SALES_MANAGER / CENTER_ADMIN)
  lossReason          String?
  lossComment         String?
  convertedStudentId  String?   // CenterMembership после WON
  deletedAt           DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  activities   LeadActivity[]
  tasks        LeadTask[]
  trialLessons TrialLesson[]

  @@index([centerId, stage, deletedAt])
  @@index([centerId, phone])
  @@index([centerId, assignedToId, stage])
}

model LeadActivity {
  id        String   @id @default(cuid())
  centerId  String
  leadId    String
  authorId  String?
  type      String   // NOTE, CALL, STAGE_CHANGE, WHATSAPP_CLICK, SMS_SENT
  payload   Json?
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([centerId, leadId, createdAt])
}

model LeadTask {
  id           String    @id @default(cuid())
  centerId     String
  leadId       String
  assigneeId   String
  title        String
  dueAt        DateTime
  completedAt  DateTime?
  createdAt    DateTime  @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([centerId, assigneeId, completedAt, dueAt])
}

model TrialLesson {
  id        String   @id @default(cuid())
  centerId  String
  leadId    String
  groupId   String
  lessonId  String?
  scheduledAt DateTime
  status    String   @default("SCHEDULED") // SCHEDULED, ATTENDED, NO_SHOW, CANCELLED
  notes     String?
  createdAt DateTime @default(now())

  lead Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)

  @@index([centerId, lessonId])
  @@index([centerId, scheduledAt, status])
}

// === P4–P5: Кабинеты, Отпуска, Отработки, Документы, Сертификаты, Договоры, Чат, Геймификация ===

model Room {
  id        String   @id @default(cuid())
  centerId  String
  branchId  String
  name      String
  capacity  Int
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@unique([branchId, name])
  @@index([centerId, branchId, isActive])
}

model TeacherLeave {
  id                  String   @id @default(cuid())
  centerId            String
  teacherMembershipId String
  type                String   // VACATION, SICK, PERSONAL
  startDate           DateTime
  endDate             DateTime
  status              String   @default("PENDING") // PENDING, APPROVED, REJECTED
  createdAt           DateTime @default(now())

  @@index([centerId, teacherMembershipId, startDate, endDate])
}

model MakeupLesson {
  id                   String    @id @default(cuid())
  centerId             String
  studentMembershipId  String
  missedAttendanceId   String
  targetLessonId       String?
  teacherMembershipId  String?
  scheduledAt          DateTime?
  status               String    @default("PENDING") // PENDING, SCHEDULED, COMPLETED, CANCELLED
  createdAt            DateTime  @default(now())

  @@unique([missedAttendanceId])
  @@index([centerId, studentMembershipId, status])
}

model StudentDocument {
  id                  String    @id @default(cuid())
  centerId            String
  studentMembershipId String
  docType             String    // PASSPORT, BIRTH_CERT, MEDICAL, CONTRACT, OTHER
  title               String
  fileUrl             String
  sizeBytes           Int
  expiresAt           DateTime?
  uploadedById        String
  deletedAt           DateTime?
  createdAt           DateTime  @default(now())

  @@index([centerId, studentMembershipId, deletedAt])
}

model Certificate {
  id                  String   @id @default(cuid())
  centerId            String
  studentMembershipId String
  courseId            String
  serialNumber        String   @unique
  verifyCodeHash      String   @unique
  issuedAt            DateTime @default(now())
  pdfUrl              String?

  @@unique([centerId, studentMembershipId, courseId])
  @@index([centerId, issuedAt])
}

// Дополнительно для P4–P5 (без полной росписи полей):
// - QuestionBankItem (centerId, courseId, topic, level, type QuestionType, payloadJson) + ссылка M:N в Test
// - StudentContract + ConsentRecord (studentMembershipId, templateId, acceptedAt, acceptedVia, ipHash, fileUrl)
// - LessonComment (lessonId / courseLessonId, authorMembershipId, body, parentId)
// - ParentTeacherThread + ParentTeacherMessage (studentMembershipId, teacherMembershipId, body, attachmentUrl)
// - GamificationPointLog + BadgeDefinition + StudentBadge + ReferralAttribution
```

### 10.2 Риски миграций и индексы
1. **Денежный тип `Float` → `Int` (сумы UZS):** в `Course.priceMonthly`, `CenterPayment.amount`, `FinanceTransaction.amount` сейчас используется `Float` (`prisma/schema.prisma:336, 652+`). Для новых таблиц `GroupPricingPlan`, `Charge`, `PaymentIntent` следует использовать `Int` (целые сумы) или `BigInt`, а при сведении со старыми моделями выполнять строгое `Math.round()` во избежание расхождения `0.01` сум при проверке `amount === paymentIntent.amount` от Click.
2. **Обратная совместимость при запуске `paidUntil` и `Charge`:** у действующих учеников нет `Charge` и `paidUntil`. Миграция в P1 обязана включать идемпотентный **скрипт начальной инициализации (backfill)**: посчитать текущий баланс по `calculateStudentBalances` и выставить начальный `paidUntil` (либо открыть одно консолидированное стартовое `Charge` на текущий долг), чтобы переключение на новую модель не занулило долги или не выставило повторный счёт за уже оплаченный месяц.
3. **Защита от дублирующих начислений (`idempotency`):** для автогенерации ежемесячных `Charge` ввести уникальный индекс по `(enrollmentId, periodStart, periodEnd)` (с учётом частичного фильтра `WHERE "deletedAt" IS NULL` в PostgreSQL), чтобы повторный запуск cron не создал два счёта за один период.
4. **Soft delete и уникальность:** таблицы с `deletedAt` (`PromoCode`, `Charge`, `Lead`) лучше защищать частичными уникальными индексами PostgreSQL (`CREATE UNIQUE INDEX ... WHERE "deletedAt" IS NULL`), иначе удалённый промокод нельзя будет создать повторно с тем же `code`.
5. **Нагрузочные индексы:** на `PaymentWebhookEvent(provider, externalEventId)` и `PaymentIntent(merchantTransId)` уникальные индексы обязательны для работы `P2002` / транзакционных вставок без race conditions.

---

## БЛОК 11. БЕЗОПАСНОСТЬ ПЛАТЕЖЕЙ (Click + вебхуки + финансовые инварианты)

Учитывая продуктовое решение **«0% комиссии, деньги идут напрямую на мерчант-аккаунт центра в Click»**, каждая операция проходит в контуре конкретного `centerId`:

### 11.1 Хранение и защита ключей мерчанта центра
1. **Шифрование в БД:** `CenterMerchantConfig.encryptedSecretKey` шифруется через существующий **AES-256-GCM** хелпер `src/lib/two-factor-cipher.ts:31-75` (`TWO_FACTOR_ENC_KEY`, обязательный в production), предваряя переименованием/выносом в общий `src/lib/crypto-cipher.ts`. Формат `enc:gcm:${ivHex}:${tagHex}:${cipherHex}` уже поддерживает аутентифицированное шифрование.
2. **Принцип минимальной выдачи:** `secretKey` **никогда** не возвращается клиенту (в UI показывается только маска `••••1234`), не попадает в URL оплаты (в URL идут только публичные `service_id`, `merchant_id`, `amount`, `transaction_param = merchantTransId`, `return_url`), и **обязательно вырезается санитайзером** `sanitizeAuditDetails` (`SENSITIVE_AUDIT_KEYS` в `src/lib/tenant.ts:5-26`, расширить полями `encryptedsecretkey`/`secretkey`/`signstring`) до записи в `AuditLog`.
3. **Права доступа и имперсонация:** редактировать `CenterMerchantConfig` может **только `DIRECTOR`** своего центра с повторной проверкой 2FA/пароля. Под платформенной имперсонацией (`requireFinanceTenantAccess` в `src/lib/tenant.ts:357-435`) доступ к настройкам мерчанта и возвратам **строго запрещён**, даже с write-флагом.

### 11.2 Защита вебхуков Click (`Prepare` и `Complete`)
Click вызывает серверные POST-эндпоинты (`action=0` Prepare и `action=1` Complete, кодировка `application/x-www-form-urlencoded`):
1. **Определение центра без доверия к body:** `centerId` **никогда** не берётся из параметров формы напрямую. Роут ищет `PaymentIntent` по `merchant_trans_id` (сгенерированному сервером `cuid`/UUID) и проверяет, что `service_id` запроса совпадает с `CenterMerchantConfig.serviceId` этого `PaymentIntent`.
2. **Проверка подписи (`sign_string`) через `timingSafeEqual`:**
   - Для **Prepare (`action=0`)**: `md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)`.
   - Для **Complete (`action=1`)**: `md5(click_trans_id + service_id + secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)`.
   - Сравнение вычисленной подписи и `sign_string` выполнять **строго в constant-time** (`crypto.timingSafeEqual`, по образцу `safeCompareTokens` в `src/lib/auth.ts:72-77`), а не обычным `===`.
   - *(Попутная рекомендация: заменить `===` на `safeCompareTokens` и в `src/lib/cron-auth.ts:7`.)*
3. **Сверка суммы и валюты (anti-tampering):** на шаге Prepare и Complete сравнивать входящий `amount` с `PaymentIntent.amount` (строго целое совпадение в сумах; при несовпадении возвращать код ошибки Click `-2 Incorrect parameter amount` и логировать в `PaymentWebhookEvent`).
4. **Идемпотентность, защита от Replay и Double-Spend:**
   - Каждое обращение сохранять в `PaymentWebhookEvent` с уникальным `(provider, externalEventId = "${click_trans_id}:${action}")`.
   - Внутри `db.$transaction`: блокировать строку `PaymentIntent` (`SELECT ... FOR UPDATE`) — если `status === "PAID"` и пришёл повторный `Complete` с тем же `click_trans_id`, возвращать идемпотентный успех Click (`error: 0`), не создавая второй `CenterPayment` и не продлевая `paidUntil` повторно! Если `merchant_trans_id` уже оплачен другим `click_trans_id` — возвращать `-4 Already paid`.
   - Если `error < 0` в `Complete` (отмена платежа со стороны Click), переводить `PaymentIntent` в `CANCELLED` только если статус ещё не `PAID`.
5. **Middleware, Proxy IP и Rate-limit:**
   - Вебхуки Click идут server-to-server без заголовка `Origin`: судя по `src/middleware.ts:48, 60-85`, проверка `Origin` выполняется только при его наличии, а лимит тела составляет `1MB` — Click-вебхуки пройдут без обхода глобального CSRF, но роутам `/api/webhooks/click/*` нужны отдельный `rate-limit` (`src/lib/rate-limit.ts:94`) по IP и корректная настройка `TRUSTED_PROXY_HOPS` для `getClientIp` (`src/lib/ip.ts:76`), если дополнительно включать IP-allowlist подсетей Click.

### 11.3 Финансовые инварианты начисления и проводки
1. При успешном `Complete` в **одной атомарной БД-транзакции** выполняются:
   1) обновление `PaymentIntent.status = "PAID"`;
   2) создание `CenterPayment` (`status = "PAID"`, `paymentMethod = "ONLINE"`, `externalTxId = click_trans_id`, `paidAt = new Date()`);
   3) вызов `syncCenterPaymentToFinance` (`src/lib/finance.ts:730-840`), опирающегося на `@@unique([centerPaymentId, isReversal])` — зачисление на выбранный `targetAccountId` центра;
   4) погашение `Charge` (обновление `paidAmount`, `status`, создание `ChargePaymentAllocation`) и продление `Enrollment.paidUntil` на `periodMonths` (1/2/3 мес);
   5) инкремент `PromoCode.usesCount` (атомарным условным `UPDATE ... WHERE usesCount < maxUses`, как в `src/app/api/invites/parent-link/route.ts:147-158`).
2. **Неизменяемость:** подтверждённый онлайн-платёж нельзя удалить или отредактировать в интерфейсе — коррекция возможна только операцией возврата (`isReversal = true`), с обязательным `AuditLog` (кто, когда, причина, откат `paidUntil`).

---

## БЛОК 12. СВОДКА

### 12.1 Итоговая таблица готовности по блокам

| Блок | Общий статус | Что уже можно переиспользовать | Главный пробел |
| :--- | :---: | :--- | :--- |
| **1. ДЕНЬГИ** | **ЧАСТИЧНО** | `CenterPayment`, `FinanceTransaction` сторно, `two-factor-cipher`, отчёты Aging/P&L | Нет `Charge`/`paidUntil`, цен 1/2/3 мес на группе, промокодов и Click; 3 формулы долга |
| **2. CRM** | **НЕТ** | `EnrollmentStatus.WAITLIST`, `LeadModal.tsx` (как форма), `GroupCard` контакты | Нет `Lead`, воронки, пробных уроков, задач, роли `SALES_MANAGER`, сохранения `/api/public/leads` |
| **3. КОММУНИКАЦИИ** | **ЧАСТИЧНО** | Eskiz SMS-клиент + лимиты, `EmailOutbox` + cron, `wa.me` ссылки, `DevicePushToken` | Нет Telegram-бота, чата учитель–родитель, рассылок должникам; Push-заглушка; рассинхрон SMS UI |
| **4. ОБУЧЕНИЕ** | **ЧАСТИЧНО** | Конструктор курсов, 4 типа тестов, `SubstitutionRequest`, `onlineMeetingUrl` | Нет отработок (`MakeupLesson`), банка вопросов, сертификатов, договоров/согласий |
| **5. УПРАВЛЕНИЕ ЦЕНТРОМ** | **ЧАСТИЧНО** | Карточка ученика (9 вкл.) и сотрудника (4 вкл.), `withKeyedLock`, `storage` magic bytes | Нет `Room`, отпусков учителей, документов ученика; S3/R2 в `storage.ts` недописан |
| **6. АНАЛИТИКА** | **ЕСТЬ / ЧАСТИЧНО** | Дашборд директора, 90d тренды, P&L/CashFlow/Debtors Aging, часы учителей | Нет отчётов воронки, загрузки аудиторий, прогноза продлений `paidUntil` и скоринга оттока |
| **7. ВОВЛЕЧЁННОСТЬ** | **НЕТ** | Триггеры посещаемости/ДЗ/тестов, будущие `PromoCode` | Нет баллов, значков, рейтингов и реферальной программы |
| **8. ПЛАТФОРМА** | **ЧАСТИЧНО** | CSV-импорт учеников, `LearningCenter.slug`, `ru`/`uz-Latn` i18n | Нет `.xlsx` импорта, поддоменов, входа через Telegram/Google, `uz-Cyrl`/`en`, Public API |
| **9. ТАРИФЫ ПЛАТФОРМЫ** | **ЧАСТИЧНО** | `SubscriptionPlan`, `limits.ts`, B2B подписки + cron `PAST_DUE → PAUSED` | `featuresJson` нигде не проверяется; баг `ARCHIVED` учителей; путаница `$` vs `UZS` |

### 12.2 Топ-20 пробелов с оценкой трудоёмкости

| № | Пробел | Оценка | Влияние на продукт | Зависимости |
| :-: | :--- | :---: | :--- | :--- |
| 1 | Единое ядро `Charge`, `paidUntil` у `Enrollment`, устранение 3 формул долга + backfill | **L** | Фундамент предоплатной бизнес-модели | — |
| 2 | Цены группы на `1`, `2`, `3` месяца (`GroupPricingPlan`) + UI приёма оплаты | **M** | Соответствие выбранному продуктовому решению | #1 |
| 3 | Интеграция **Click** напрямую на мерчант центра (0% комиссии, `CenterMerchantConfig`, AES-GCM, webhook Prepare/Complete) | **L** | Самообслуживание родителей, рост собираемости оплат | #1, #2 |
| 4 | Telegram-бот + привязка аккаунтов родителей/учеников/учителей | **L** | Основной бесплатный и читаемый канал в Узбекистане | — |
| 5 | Автонапоминания об истечении `paidUntil` и долгах (Telegram / Eskiz / Email / Push) + кнопка WhatsApp из должников | **M** | Снижение кассовых разрывов без ручной рутины | #1, #4, #6 |
| 6 | Починка уведомлений: реальный `dispatchMobilePush` (Expo/FCM), `sendNotification` EMAIL-шаблоны, синхронизация `CenterSettingsManager` SMS, тихие часы | **M** | Без этого SMS/Push/Email на практике не работают целиком | — |
| 7 | CRM: модель `Lead`, канбан-воронка, источники/UTM, причины отказа, починка `/api/public/leads` | **L** | Управление продажами и конверсией заявок | — |
| 8 | Пробные уроки (`TrialLesson`), задачи менеджера (`LeadTask`), журнал касаний, роль `SALES_MANAGER` | **M** | Полноценная работа отдела продаж центра | #7 |
| 9 | Промокоды и скидки (`PromoCode`, проверка при онлайн- и оффлайн-оплате) | **M** | Маркетинг, акции на 2–3 месяца, база для рефералов | #1, #2 |
| 10 | Пауза/заморозка периода (`EnrollmentFreeze` со сдвигом `paidUntil`) и перерасчёт | **M** | Частый запрос учеников (болезнь/экзамены) | #1 |
| 11 | Feature flags по тарифам (`featuresJson` + `requirePlanFeature`), починка бага `limits.ts:53`, унификация `UZS` и периодов B2B-подписок | **M** | Монетизация платформы по тарифам | — |
| 12 | Рассылки по сегментам (должники, группы, истекающий период) по внешним каналам | **M** | Массовая коммуникация центра | #4, #6 |
| 13 | Справочник кабинетов `Room` + вместимость + шахматка занятости + `Holiday` в `ScheduleSlot` | **M** | Исключение накладок расписания филиала | — |
| 14 | Отработки пропущенных уроков (`MakeupLesson`) + уведомление родителей о переносах `RESCHEDULED`/заменах | **M** | Удержание учеников, снижение оттока | #6 |
| 15 | Переписка Учитель ↔ Родитель (`ParentTeacherThread` + уведомления) | **L** | Снижение хаоса в личных Telegram/WhatsApp чатах | #4, #6 |
| 16 | Договоры, оферта и согласия (`StudentContract` / `ConsentRecord`) + документы ученика + доработка S3/R2 в `storage.ts` | **M** | Юридическая защищённость центра и хранение файлов в проде | — |
| 17 | Публичная витрина центра по поддомену `slug.e-darschi.uz` (каталог с ценами 1/2/3 мес + форма записи лида) | **M–L** | Бесплатный мини-лендинг для каждого центра | #2, #7 |
| 18 | Сертификаты с QR-кодом верификации и PDF-квитанции об оплате | **M** | Ценность для выпускников и доверие родителей | #1 |
| 19 | Доступность/отпуска учителей + лист ожидания (`EnrollmentStatus.WAITLIST`) при заполненной группе | **M** | Операционная устойчивость расписания и дозапись | #13 |
| 20 | Импорт `.xlsx` (при миграции из других CRM), вход через Telegram/Google, словари `uz-Cyrl` / `en` | **M** | Быстрый переход новых центров и поддержка языковых школ | #4 |

### 12.3 Дорожная карта P1–P5 (с зависимостями)

```text
[P1: Деньги и Click] ──▶ [P2: Каналы и Тарифы] ──▶ [P3: CRM и Витрина] ──▶ [P4: Обучение и Операционка] ──▶ [P5: Вовлечённость и Масштаб]
```

- **P1 — Ядро монетизации центра и Click (3–4 недели):**
  - Исправление критики: единое `Charge` + `Enrollment.paidUntil` + backfill-миграция, `GroupPricingPlan` (`1/2/3` мес), `PromoCode`.
  - `CenterMerchantConfig` (AES-256-GCM) + Click Checkout + вебхуки `Prepare`/`Complete` с 0% комиссии и связкой в `syncCenterPaymentToFinance`.
  - PDF/печатные квитанции, заморозка периода (`EnrollmentFreeze`), переключение всех отчётов долга на `Charge`.
- **P2 — Коммуникации и Тарифы платформы (2–3 недели, зависит от P1 для напоминаний о долгах):**
  - Починка `notifications.ts` (`EMAIL`, тихие часы), синхронизация UI SMS-тумблера, реальный `dispatchMobilePush` (Expo/FCM).
  - Telegram-бот (привязка deep-link, кнопка «Оплатить Click», уведомления о посещаемости, долгах, переносах).
  - Сегментированные рассылки (должникам, группам) + шаблоны `ru`/`uz-Latn` + `wa.me` генератор в долгах.
  - Тарифная матрица `featuresJson` (`requirePlanFeature`), фикс бага `limits.ts:53`, B2B периоды подписки центра в UZS.
- **P3 — CRM и привлечение учеников (2–3 недели, использует уведомления из P2 и цены групп из P1):**
  - `Lead`, канбан-воронка, UTM/источники, `LeadTask`, `LeadActivity`, причины отказа, дубликаты по телефону, починка `/api/public/leads`.
  - `TrialLesson` в сетке уроков учителя, роль `SALES_MANAGER`, активация `EnrollmentStatus.WAITLIST`.
  - Публичная страница центра (`/c/[slug]` + поддомен) с расписанием, ценами 1/2/3 мес и записью в CRM; отчёты воронки.
- **P4 — Операции центра и обучение (3 недели):**
  - `Room` с вместимостью и сеткой занятости, `Holiday`-проверка в `ScheduleSlot`, `TeacherLeave`/`Availability`, `MakeupLesson` (отработки).
  - Доработка S3/R2 (`@aws-sdk/client-s3`) в `storage.ts`, реестр `StudentDocument`, `StudentContract`/`ConsentRecord`, `Certificate` с QR.
  - Расширенный `QuestionBank`, экспорт/импорт `.xlsx`, скоринг риска оттока и прогноз продлений на дашборде директора.
- **P5 — Вовлечённость, коммуникации 2.0 и экосистема (2–4 недели):**
  - Двусторонний чат Учитель ↔ Родитель (`ParentTeacherThread`) + комментарии к урокам.
  - Геймификация (баллы, значки, рейтинги) и реферальная программа на базе `PromoCode` + `Lead`.
  - Вход через Telegram/Google, полноценные переводы `uz-Cyrl` и `en`, публичное API и вебхуки для внешних интеграций центров.

### 12.4 Рекомендуемые библиотеки и сервисы под стек (`Next.js 14` + `Prisma` + `PostgreSQL`)

| Задача | Рекомендуемое решение | Зачем вместо самописа |
| :--- | :--- | :--- |
| Telegram-бот (webhook mode) | **`grammy`** (или `telegraf`) | Лёгкий webhook под Next.js App Router/API Routes, встроенные меню, команды и типобезопасность |
| Импорт/экспорт `.xlsx` | **`exceljs`** | Стриминг и создание стилизованных отчётов P&L/Aging, без уязвимостей старого `xlsx` |
| Генерация PDF (квитанции, сертификаты, договоры) | **`pdf-lib`** или **`@react-pdf/renderer`** + **`qrcode`** | Работает на Node без тяжёлого Chromium/Puppeteer и утечек памяти |
| Мобильные Push-уведомления | **`expo-server-sdk`** (для Expo в `mobile/`) или **`firebase-admin`** (FCM) | Готовый батчинг, обработка `DeviceNotRegistered` и очистка мёртвых `DevicePushToken` |
| Облачное хранилище (R2 / S3 / MinIO) | **`@aws-sdk/client-s3`** + **`@aws-sdk/s3-request-presigner`** | Закрывает текущую заглушку в `src/lib/storage.ts:478` для документов и сертификатов |
| Очередь рассылок / ретраев (опционально) | Расширение паттерна `EmailOutbox` в Postgres + cron c `pg_try_advisory_lock` или **BullMQ + Redis** | На старте (до ~50–100 центров) Postgres Outbox достаточно; Redis нужен при массовых рассылках |

### 12.5 Открытые вопросы к заказчику (блокеры проектирования P1–P3)

1. **Правило расчёта оплаченного периода (`paidUntil`) и заморозки:**
   - Покупка «1/2/3 месяца» означает **календарный месяц** (например, 15.11 → 15.12), **фиксированное число дней** (30/60/90) или **пакет занятий** (12/24/36 уроков)?
   - При паузе/заморозке переносится календарная дата `paidUntil` или генерируется денежный кредит на следующий платёж?
2. **Политика отмены урока и отработок:**
   - Если урок отменён по вине центра — сдвигается ли `paidUntil` автоматически на 1 занятие или назначается отработка `MakeupLesson` без сдвига?
   - Пропуски ученика по болезни (со справкой) дают право только на отработку или на финансовый перерасчёт?
3. **Детали Click и фискализации в Узбекистане:**
   - Работают ли центры с **ОФД / онлайн-ККМ фискализацией чеков** (передача данных чека/ИКПУ в Click Fiscal / Soliq / Multikassa), или на старте достаточно стандартного платёжного шлюза Click?
   - Комиссию эквайринга Click всегда несёт центр внутри зачисления (ученик платит ровно сумму тарифа), либо нужна настройка «переложить % на плательщика»?
   - Есть ли у одного центра с несколькими филиалами отдельные мерчант-договоры на каждый `Branch` или один мерчант на весь `LearningCenter`?
4. **Монетизация платформы (Тарифы B2B):**
   - В какой валюте будут биллинговаться тарифы платформы (`UZS` или `USD` по курсу ЦБ РУз)? В UI сейчас `$`, в финансовых отчётах и на лендинге — `so'm / сум`.
   - Как планируется продавать подписки самим центрам: только по B2B-договору/счёту вручную (как сейчас) или нужна автооплата подписки центра картой (Click/Payme)?
5. **SMS Eskiz и юридика:**
   - Отправка SMS о долгах и промо-рассылках идёт через общий альфа-ник платформы (`ESKIZ_FROM`) по тарифам платформы или крупные центры подключают свой кабинет/Sender ID Eskiz (аналогично мерчанту Click)?
   - Нужна ли строгая модерация шаблонов рассылок (антиспам-одобрение в Eskiz требует предрегистрации текстов транзакционных SMS на кириллице/латинице)?
6. **Публичный доступ и онбординг:**
   - Нужно ли оставлять self-service API `POST /api/tenant/onboarding` открытым (сейчас оно активно, хотя страница `/onboarding` говорит о закрытой регистрации), или создавать центры строго через админку платформы и CRM-заявки?
