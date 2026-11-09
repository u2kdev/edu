# Архитектурный план реализации вложений к домашним заданиям (Homework Attachments)

**Статус:** План утвержден, реализация запланирована на следующий этап (MOBILE-2).  
**Целевой сервис хранения:** Amazon S3 / Cloudflare R2 / MinIO (S3-compatible API).

---

## 1. Архитектурный процесс (Presigned Upload Flow)

Мобильный клиент **не загружает** тяжелые бинарные файлы напрямую на сервер приложений Next.js во избежание перегрузки памяти Worker-потоков и блокировки Event Loop. Загрузка производится напрямую в объектное хранилище по строго подписанным одноразовым ссылкам (Presigned PUT URLs).

```
[Mobile App]                         [Next.js API Server]                     [S3 Storage]
     |                                        |                                     |
     |-- 1. POST /api/homework/upload/sign -->|                                     |
     |      { homeworkId, filename,           |-- 2. Проверка RBAC & валидация      |
     |        contentType, sizeBytes }        |-- 3. Генерация S3 Presigned URL --->|
     |<-- 4. { uploadUrl, s3Key, expiresAt } -|                                     |
     |                                                                              |
     |-- 5. HTTP PUT (binary body) ------------------------------------------------>|
     |<-- 6. HTTP 200 OK -----------------------------------------------------------|
     |                                                                              |
     |-- 7. PATCH /api/homework (action: "SUBMIT", attachments: [{ s3Key }]) ------>|
     |                                        |-- 8. HEAD Object & Magic Bytes check|
     |<-- 9. HTTP 200 { success: true } ------|
```

---

## 2. Ролевая модель и проверка прав (RBAC)

1. **Для Ученика (`STUDENT`)**:
   - Разрешено запрашивать подпись только на уроки групп, в которых ученик имеет активную запись (`Enrollment.status === 'ACTIVE'`).
   - Проверка срока сдачи: если `dueDate` прошел и в настройках курса включен запрет поздней сдачи — возврат `403 DEADLINE_EXPIRED`.
   - Запрещено прикреплять файлы к уже проверенным и принятым заданиям (`status === 'ACCEPTED'`).
2. **Для Преподавателя (`TEACHER`)**:
   - Разрешено прикреплять файлы только к урокам групп, назначенным данному преподавателю (`teacherMembershipId`).
3. **Изоляция арендаторов (Tenant Isolation)**:
   - Ключ объекта в S3 обязательно содержит `centerId`:
     `centers/{centerId}/homework/{homeworkId}/{role}/{userId}/{uuid}.{ext}`.
   - Доступ к чтению/скачиванию также выдается только через presigned GET URL с проверкой принадлежности пользователя к центру.

---

## 3. Валидация типов и ограничения безопасности

- **Белый список MIME-типов**:
  - Изображения: `image/jpeg`, `image/png`, `image/webp`, `image/heic`.
  - Документы: `application/pdf`.
- **Черный список**: исполняемые файлы (`.exe`, `.bat`, `.sh`, `.apk`, `.js`, `.py`, `.html`, `.svg` с потенциальным XSS).
- **Лимиты**:
  - Максимальный размер одного файла: **15 MB**.
  - Максимальное количество файлов на одно ДЗ: **5 штук**.
  - Время жизни presigned PUT URL: **15 минут** (`expiresIn: 900`).
- **Серверная проверка сигнатур (Magic Bytes)**:
  - Перед фиксацией файла в БД сервер делает `HeadObject` в S3 для проверки реального размера (`Content-Length`) и читает первые 16 байт объекта:
    - JPEG: `FF D8 FF`
    - PNG: `89 50 4E 47 0D 0A 1A 0A`
    - PDF: `25 50 44 46` (`%PDF`)

---

## 4. Спецификация серверных эндпоинтов

### `POST /api/homework/attachments/sign-upload`
- **Заголовки**: `Authorization: Bearer <token>`, `x-center-id: <centerId>`.
- **Тело запроса**:
  ```json
  {
    "homeworkId": "hw_abc123",
    "filename": "math_solution.jpg",
    "contentType": "image/jpeg",
    "sizeBytes": 2450120
  }
  ```
- **Успешный ответ (200)**:
  ```json
  {
    "success": true,
    "uploadUrl": "https://s3.edarschi.uz/bucket/centers/c1/homework/hw_abc123/student/u1/file_xyz.jpg?X-Amz-Signature=...",
    "s3Key": "centers/c1/homework/hw_abc123/student/u1/file_xyz.jpg",
    "expiresAt": "2026-11-09T18:30:00.000Z"
  }
  ```
