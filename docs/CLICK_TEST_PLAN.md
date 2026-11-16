# План тестирования интеграции Click (Этап P1b)

Документ описывает настройку песочницы Click, проброс вебхуков для staging/local проверки, контрольные сценарии **Prepare** / **Complete**, обработку ошибок и периодическую сверку (reconcile).

---

## 1. Предварительная конфигурация окружения

В `.env` (или секретах staging-окружения) должны быть заданы:

- `PAYMENT_CONFIG_ENCRYPTION_KEY` — 32-байтный hex/base64 или секретная фраза (AES-256-GCM; при отсутствии в dev/test используется производный ключ от `NEXTAUTH_SECRET`). В production задавайте отдельный независимый ключ.
- `CLICK_CHECKOUT_URL` — опционально, по умолчанию `https://my.click.uz/services/pay`. Для песочницы Click может использоваться URL тестового стенда Click.
- `CLICK_ALLOWED_IPS` — опциональный список IP-адресов серверов Click через запятую. Если не задан — проверка IP не ограничивает входящие вебхуки (в production рекомендуется заполнить официальными IP-адресами Click).
- `CRON_SECRET` — секрет `Bearer` для вызова `/api/cron/click-reconcile`.

---

## 2. Подготовка стенда и проброс вебхуков (ngrok / staging)

Click отправляет серверные HTTP `POST` (`application/x-www-form-urlencoded` или `application/json`) на один единый endpoint:

```text
POST https://<your-domain>/api/webhooks/click
```

### Для локальной/staging проверки через ngrok:
1. Поднимите локальный сервер (`npm run dev` или `npm run start`).
2. Запустите туннель:
   ```bash
   ngrok http 3000
   ```
3. В кабинете мерчанта Click (тестовый сервис) укажите:
   - **Prepare URL**: `https://<ngrok-subdomain>.ngrok-free.app/api/webhooks/click`
   - **Complete URL**: `https://<ngrok-subdomain>.ngrok-free.app/api/webhooks/click`
4. В ЛК центра (`/center/settings` -> вкладка **Онлайн-оплата Click**, доступ только у роли `DIRECTOR` без режима имперсонации):
   - Введите `serviceId`, `merchantId`, `merchantUserId`, `secretKey`, выберите целевой счёт учёта (куда зачислять проводку `INCOME`), подтвердите текущим паролем (и 6-значным TOTP-кодом, если у директора включена 2FA).
   - Убедитесь, что `GET /api/center/merchant-config` возвращает только маскированный ключ (`****XXXX`) и никогда не отдаёт `encryptedSecretKey` или открытый `secretKey`.
   - Нажмите **"Проверить подключение (Тест)"** (`POST /api/center/merchant-config` с `{ "action": "test" }`) — статус должен стать `isVerified = true`.

---

## 3. Тест-кейсы (Acceptance & Security)

### 3.1. Настройка мерчанта и права доступа
| ID | Сценарий | Ожидаемый результат |
|----|----------|---------------------|
| MC-1 | Вызов `PUT /api/center/merchant-config` без `currentPassword` или с неверным паролем | `400`/`403`, ключи в БД не меняются |
| MC-2 | Вызов `PUT /api/center/merchant-config` директором с включённой 2FA без `totpCode` | `403`, требование 6-значного кода 2FA |
| MC-3 | Вызов `PUT` ролью `CENTER_ADMIN`, `ACCOUNTANT`, `TEACHER` или в режиме имперсонации | `403 Forbidden` |
| MC-4 | Создание `PaymentIntent` при `isVerified = false` | `400 MERCHANT_NOT_VERIFIED` |
| MC-5 | Попытка расшифровать `encryptedSecretKey` при изменённом теге/шифртексте | Исключение AES-GCM auth tag verification |

### 3.2. Инициация оплаты (`POST /api/payments/intent`)
| ID | Сценарий | Ожидаемый результат |
|----|----------|---------------------|
| PI-1 | Ученик/родитель/сотрудник (`payments.manage`) создаёт `PaymentIntent` на период 1/2/3 мес с опциональным промокодом | `201`, создан `PaymentIntent` (`CREATED`), возвращены `clickUrl` с параметрами `service_id`, `merchant_id`, `amount`, `transaction_param` и SVG/PNG data URL для QR |
| PI-2 | Передача `idempotencyKey` повторно | Возвращается тот же активный `PaymentIntent` без дублирования и без повторного списания промокода |
| PI-3 | Родитель за чужого ученика или сотрудник за ученика другого центра | `403` / `404`, изоляция центров |

### 3.3. Click Webhook `Prepare` (`action=0`)
Подпись MD5: `md5(click_trans_id + service_id + secret_key + merchant_trans_id + amount + action + sign_time)`

| ID | Условие | Ожидаемый ответ Click JSON |
|----|---------|-----------------------------|
| WH-P1 | Валидный `Prepare`, точная сумма, валидный `sign_string`, подходящий `service_id` | `{ error: 0, click_trans_id, merchant_trans_id, merchant_prepare_id, error_note: "Success" }`, `PaymentIntent -> PREPARED` |
| WH-P2 | Неверная `sign_string` (подмена подписи) | `{ error: -1, error_note: "Sign check failed" }` |
| WH-P3 | Изменённый `amount` (`amount != intent.amount`) | `{ error: -2, error_note: "Incorrect parameter amount" }` |
| WH-P4 | Неизвестный `merchant_trans_id` или принадлежащий другому `service_id` другого центра | `{ error: -5, error_note: "Order not found" }` |
| WH-P5 | Заказ уже в статусе `CONFIRMED` | `{ error: -4, error_note: "Already paid" }` |
| WH-P6 | Заказ в статусе `CANCELLED` или просрочен (`expiresAt < now`) | `{ error: -9 }` |

### 3.4. Click Webhook `Complete` (`action=1`)
Подпись MD5: `md5(click_trans_id + service_id + secret_key + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)`

| ID | Условие | Ожидаемый ответ и состояние БД |
|----|---------|--------------------------------|
| WH-C1 | Валидный `Complete` с `error=0` и корректным `merchant_prepare_id` | `{ error: 0, merchant_confirm_id }`; `PaymentIntent -> CONFIRMED`; создаётся ровно 1 `CenterPayment` (`PAID`, `ONLINE`) + 1 `FinanceTransaction` (`INCOME`) на `targetAccountId`; продляется `paidUntil` по правилам `Asia/Tashkent` (0% комиссии платформы) |
| WH-C2 | Передан внешний параметр `error < 0` от Click (отмена на стороне Click) | `{ error: -9 }`, `PaymentIntent -> CANCELLED`, оплата не зачисляется |
| WH-C3 | Повторный (replay) `Complete` тем же запросом | Безопасный ответ `{ error: -4 }` / idempotent response без создания дубля `CenterPayment` и без повторного продления `paidUntil` |
| WH-C4 | Параллельная гонка (`Promise.all`) двух одновременных `Complete` | Row-level lock (`FOR UPDATE`): ровно 1 `CenterPayment`, ровно 1 `FinanceTransaction`, 1 успешный `0` и 1 ответ `-4` |
| WH-C5 | Несовпадающий `merchant_prepare_id` | `{ error: -6, error_note: "Transaction does not exist" }` |
| WH-C6 | Неподдерживаемый `action` (не `"0"` и не `"1"`) | `{ error: -3, error_note: "Action not found" }` |
| WH-C7 | Аудит вебхуков `PaymentWebhookEvent` | Запись сохраняется даже при отказе (`-1`, `-2`, `-5`); чувствительные поля (`sign_string`, `secret_key`, `token`, `authorization`) в `payloadRedactedJson` заменены на `"[REDACTED]"` |

---

## 4. Сверка и закрытие зависших счетов (`/api/cron/click-reconcile`)

Рекомендуемое расписание cron: каждые 10–15 минут:
```bash
curl -X POST https://<your-domain>/api/cron/click-reconcile \
  -H "Authorization: Bearer $CRON_SECRET"
```

Проверяемое поведение:
1. Счета `CREATED`, у которых `expiresAt < now`, переводятся в `EXPIRED`.
2. Счета `PREPARED`, висящие дольше 30 минут без `Complete` (и без привязанного `CenterPayment`), помечаются примечанием `STALE_PREPARED_TIMEOUT` (или `EXPIRED`, если истёк `expiresAt`) для ручного разбора/перевода в `FAILED` на вкладке **Финансы -> Онлайн-оплаты Click** (`GET/POST /api/finance/online-payments`). Если `CenterPayment` уже создан — счёт автоматически восстанавливается (`CONFIRMED`).
3. Advisory lock (`8804`) предотвращает одновременное выполнение двух cron-процессов.

---

## 5. Чек-лист перед выходом в production с живым Click
1. Проверить в кабинете Click тестовую оплату на минимальную сумму (например, 1 000 UZS) с реальной карты Uzcard/Humo через `Prepare` + `Complete`.
2. Убедиться, что сумма 100% зачислена на мерчант-счёт центра без комиссии со стороны платформы (`FinanceTransaction` совпадает с `CenterPayment.amount`).
3. Проверить скачивание PDF-квитанции (`/api/payments/[id]/receipt`) и публичную проверку QR (`/verify/receipt/[code]`).
4. Оформить частичный или полный возврат в UI (вручную через баланс кассы / акт возврата в Click) — убедиться в откате `paidUntil`.
5. Задать `CLICK_ALLOWED_IPS` и убедиться, что HTTPS + TLS включены на балансировщике.
