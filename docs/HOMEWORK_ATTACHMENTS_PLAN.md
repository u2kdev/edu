# Архитектурный план реализации вложений к домашним заданиям (Homework Attachments)

**Статус:** черновик, не утверждён  
**Целевой сервис хранения:** Amazon S3 / Cloudflare R2 / MinIO (S3-compatible API).

---

## 1. Архитектурный процесс (Presigned Flow с карантинным префиксом)

Мобильный клиент **не загружает** тяжелые бинарные файлы напрямую на сервер приложений Next.js во избежание перегрузки памяти Worker-потоков и блокировки Event Loop. Загрузка производится напрямую в объектное хранилище с использованием Presigned POST (или PUT) с обязательным размещением во временном карантинном префиксе.

```
[Mobile App]                         [Next.js API Server]                     [S3 Storage]
     |                                        |                                     |
     |-- 1. POST /api/homework/upload/sign -->|                                     |
     |      { homeworkId, filename,           |-- 2. Проверка RBAC & членства       |
     |        contentType, sizeBytes }        |-- 3. Генерация Presigned POST/PUT ->|
     |                                        |      (в карантинный префикс)        |
     |<-- 4. { uploadUrl, s3Key, expiresAt } -|                                     |
     |                                                                              |
     |-- 5. HTTP POST/PUT (binary body) ------------------------------------------->|
     |<-- 6. HTTP 200/204 OK -------------------------------------------------------|
     |                                                                              |
     |-- 7. PATCH /api/homework (action: "SUBMIT", attachments: [{ s3Key }]) ------>|
     |                                        |-- 8. Сверка s3Key с префиксом       |
     |                                        |-- 9. HEAD Object & Magic Bytes check|
     |                                        |-- 10. Перенос из карантина          |
     |<-- 11. HTTP 200 { success: true } -----|
```

---

## 2. Изоляция арендатора и привязка центра строго из членства

1. **Источник `centerId`**:
   - `centerId` определяется **строго и исключительно** на сервере из активного членства пользователя (`CenterMembership`), подтверждённого в JWT-сессии:
     - `membership.centerId === session.centerId`
     - `membership.status === 'ACTIVE'`
     - `center.isBlocked === false`
   - Категорически запрещено доверять параметрам клиента (`body.centerId`, `query.centerId`, либо неподписанным заголовкам `x-center-id` без верификации активного членства). При несовпадении или попытке подмены — немедленный возврат `403 FORBIDDEN`.

2. **Карантинный префикс и сверка `s3Key`**:
   - Первичная загрузка разрешается только во временный изолированный карантинный префикс:
     `quarantine/{centerId}/homework/{homeworkId}/{userId}/{randomUuid}.{ext}`
   - При подтверждении сдачи задания (`SUBMIT`) сервер выполняет строгую сверку:
     - `s3Key` клиента обязан строго начинаться с ожидаемого префикса:
       `quarantine/${session.centerId}/homework/${homeworkId}/${session.userId}/`
     - Проверка на отсутствие Path Traversal (`..`, `//`, `\`).
     - Если префикс не совпадает, `centerId`, `homeworkId` или `userId` не принадлежат текущей подтвержденной сессии — запрос отклоняется со статусом `403 FORBIDDEN` / `400 BAD_REQUEST`.
   - После успешной валидации метаданных и сигнатуры файл переносится (или помечается проверенным) в постоянный путь:
     `centers/{centerId}/homework/{homeworkId}/{role}/{userId}/{randomUuid}.{ext}`

3. **Presigned POST / Policy Constraints**:
   - При использовании Presigned POST ссылка ограничивается строгой S3 Policy:
     - `["starts-with", "$key", "quarantine/" + centerId + "/homework/" + homeworkId + "/"]`
     - `["content-length-range", 1, 15728640]` (максимум 15 МБ)
     - `{"Content-Type": contentType}` (только разрешенные MIME-типы)
     - Время жизни presigned-ссылки: не более **15 минут** (`expiresIn: 900`).

---

## 3. Валидация типов и серверная проверка сигнатур (Magic Bytes)

Клиентским MIME-типам (`Content-Type`) и расширениям файлов сервер не доверяет. Перед принятием файла сервер считывает первые байты объекта из S3 и верифицирует magic bytes сигнатуры:

- **JPEG (`image/jpeg`)**:
  - Сигнатура: `FF D8 FF`
- **PNG (`image/png`)**:
  - Сигнатура: `89 50 4E 47 0D 0A 1A 0A`
- **PDF (`application/pdf`)**:
  - Сигнатура: `25 50 44 46` (`%PDF`)
- **WebP (`image/webp`)**:
  - Сигнатура:
    - Байты 0..3: `52 49 46 46` (`RIFF`)
    - Байты 8..11: `57 45 42 50` (`WEBP`)
    - Байты 12..15: `56 50 38` (`VP8 `, `VP8L` или `VP8X`)
- **HEIC / HEIF (`image/heic`, `image/heif`)**:
  - ISO Base Media File Format:
    - Байты 4..7: `66 74 79 70` (`ftyp`)
    - Байты 8..11 (major brand) или совместимые бренды: `heic`, `heix`, `mif1`, `msf1`.

**Запрещенные типы**: исполняемые файлы (`.exe`, `.bat`, `.cmd`, `.sh`, `.apk`, `.jar`), скрипты (`.js`, `.ts`, `.py`, `.php`), архивы (`.zip`, `.rar`, `.tar`, `.gz` во избежание zip-bomb) и веб-разметка (`.html`, `.svg` во избежание Stored XSS).

---

## 4. Матрица прав доступа на скачивание (Download Authorization Matrix)

Любой доступ к скачиванию файлов осуществляется **только** через серверный эндпоинт генерации кратковременных Presigned GET URL (время жизни: не более **5 минут** / 300 секунд). Прямой публичный доступ к S3 бакету полностью закрыт (`Block Public Access: enabled`).

Сервер проверяет следующие правила разграничения доступа перед генерацией GET URL:

| Роль | Разрешенный контекст скачивания | Условие проверки в БД |
|---|---|---|
| **Учитель (`TEACHER`)** | Только работы учеников групп, где учитель назначен преподавателем | `group.teacherMembershipId === caller.membershipId` в том же активном `centerId` |
| **Родитель (`PARENT`)** | Только работы и условия заданий своих подтвержденных детей | `ParentLink.status === 'CONFIRMED' && ParentLink.parentId === caller.userId && ParentLink.childId === studentId` |
| **Ученик (`STUDENT`)** | Только свои собственные сданные работы и задания своих активных групп | `submission.studentId === caller.userId` и `Enrollment.status === 'ACTIVE'` |
| **Директор / Администратор (`DIRECTOR` / `ADMIN`)** | Любые материалы и сдачи в рамках своего центра | `caller.membership.role IN ['DIRECTOR', 'ADMIN'] && caller.membership.centerId === target.centerId` |
| **Чужой пользователь / Чужой центр** | Запрещено | `403 FORBIDDEN` / `404 NOT_FOUND` |

---

## 5. Спецификация серверных эндпоинтов

### `POST /api/homework/attachments/sign-upload`
- **Аутентификация**: Bearer JWT (активная мобильная сессия).
- **Входные данные**:
  ```json
  {
    "homeworkId": "hw_abc123",
    "filename": "math_solution.heic",
    "contentType": "image/heic",
    "sizeBytes": 2450120
  }
  ```
- **Серверная проверка**:
  1. Извлечение `centerId` из активного членства пользователя.
  2. Проверка зачисления студента или назначения учителя на группу этого ДЗ.
  3. Проверка дедлайна и лимитов (размер < 15 МБ, разрешенный MIME).
- **Успешный ответ (200)**:
  ```json
  {
    "success": true,
    "uploadUrl": "https://s3.edarschi.uz/bucket/quarantine/c1/homework/hw_abc123/u1/file_xyz.heic?X-Amz-Signature=...",
    "s3Key": "quarantine/c1/homework/hw_abc123/u1/file_xyz.heic",
    "expiresAt": "2026-11-09T18:30:00.000Z"
  }
  ```

### `GET /api/homework/attachments/:attachmentId/download-url`
- **Аутентификация**: Bearer JWT.
- **Серверная проверка**: строго по Матрице прав доступа (Раздел 4).
- **Успешный ответ (200)**:
  ```json
  {
    "success": true,
    "downloadUrl": "https://s3.edarschi.uz/bucket/centers/c1/homework/hw_abc123/student/u1/file_xyz.heic?X-Amz-Signature=...",
    "expiresAt": "2026-11-09T18:20:00.000Z"
  }
  ```
