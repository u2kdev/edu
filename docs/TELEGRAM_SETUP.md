# Настройка Telegram-бота e-darschi (`grammy`)

## 1. Создание бота через `@BotFather`
1. Откройте `@BotFather` в Telegram и выполните `/newbot`.
2. Укажите отображаемое имя (например, `e-darschi LMS`) и username (например, `edarschi_bot`, без `@`).
3. Скопируйте выданный токен (`TELEGRAM_BOT_TOKEN`).
4. (Опционально) Установите список команд через `/setcommands`:
   ```
   start - Привязать аккаунт и открыть меню
   balance - Баланс, задолженность и оплата Click
   schedule - Расписание на сегодня и завтра
   payments - История последних платежей
   lang - Переключить язык (RU / UZ)
   help - Справка по командам
   stop - Отключить Telegram-уведомления
   ```

## 2. Переменные окружения
Добавьте в `.env` / Vercel / Railway Environment Variables:
- `TELEGRAM_BOT_TOKEN="<токен из @BotFather>"`
- `TELEGRAM_BOT_USERNAME="edarschi_bot"` (без `@`, используется для deep-link `https://t.me/<username>?start=<token>` и QR-кода)
- `TELEGRAM_WEBHOOK_SECRET="<случайный секрет >= 16 символов>"` (например: `openssl rand -hex 24`)

**Безопасность (fail-closed):**
В режиме `production`, если задан `TELEGRAM_BOT_TOKEN`, проверка `validateProductionStartupEnv` (`src/lib/startup-checks.ts`) запрещает запуск без корректного `TELEGRAM_WEBHOOK_SECRET` (минимум 16 символов). Заголовок `X-Telegram-Bot-Api-Secret-Token` проверяется через constant-time `timingSafeEqual`.

## 3. Регистрация Webhook
После деплоя на HTTPS-домен выполните `setWebhook`:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.uz/api/webhooks/telegram",
    "secret_token": "'"${TELEGRAM_WEBHOOK_SECRET}"'",
    "allowed_updates": ["message"]
  }'
```

Проверить состояние webhook:
```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

## 4. Как работает привязка и защита данных
- В профиле веб-приложения и мобильного приложения `POST /api/account/telegram` создаёт одноразовый 15-минутный токен (в БД хранится только SHA-256 `tokenHash`).
- Команда `/start <token>` принимается **только в личном (`private`) чате** с ботом. В групповых чатах бот отказывает в выдаче персональных данных.
- Один `chat_id` может быть привязан только к одному пользователю (`TelegramAccount.chatId @unique`).
- Родитель видит данные **только подтверждённых** учеников (`ParentLink.status === "CONFIRMED"`), только в активных центрах (`status === "ACTIVE"`).
- Отвязать аккаунт можно через `/stop` в Telegram или кнопкой **Отключить** (`DELETE /api/account/telegram`).
- При ошибке Telegram `403 Forbidden: bot was blocked by the user` система автоматически ставит `TelegramAccount.isBlocked = true` и `isActive = false`, чтобы рассылки и напоминания переключались на Push/SMS.
