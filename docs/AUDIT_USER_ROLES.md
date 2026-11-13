# АУДИТ ПОЛЬЗОВАТЕЛЬСКИХ РОЛЕЙ: TEACHER, TEACHER_ASSISTANT, STUDENT, PARENT

**Проект:** e-darschi (SaaS LMS для учебных центров Узбекистана)  
**Стек:** Next.js 14 (App Router), Prisma ORM, PostgreSQL, TypeScript, Tailwind CSS, Expo (React Native), Vitest  
**Дата аудита:** 11 ноября 2026 г.  
**Режим:** READ-ONLY аудит кодовой базы и схемы данных  

---

## 1. МАТРИЦА ПРАВ И ИЗОЛЯЦИЯ ДАННЫХ

В проекте используется двухуровневая система ролей:
1. **Платформенные роли** (`PlatformRole`: `SUPERADMIN`, `PLATFORM_ADMIN`, `PLATFORM_FINANCE`, `PLATFORM_SUPPORT`, `PLATFORM_TECH`, `SEO_ADMIN`, `DEVELOPER`, `PLATFORM_STUDENT`).
2. **Роли внутри центра** (`CenterRole`: `DIRECTOR`, `CENTER_ADMIN`, `ACCOUNTANT`, `TEACHER`, `TEACHER_ASSISTANT`, `CENTER_SUPPORT`, `STUDENT`, `PARENT`).

Справочник прав `CENTER_ROLE_PERMISSIONS` определён в [`src/lib/permissions.ts#L355-L408`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L355-L408).

### 1.1. Анализ прав по ролям: Проверяемые vs Декоративные

> **Главный архитектурный вывод по правам:**  
> Функция `hasPermission()` из [`src/lib/permissions.ts#L446`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L446) в основных учебных эндпоинтах (`/api/students`, `/api/attendance`, `/api/grades`, `/api/homework`, `/api/groups`, `/api/tenant/schedule`) **НЕ ВЫЗЫВАЕТСЯ**. Вместо этого каждый эндпоинт производит ручную проверку `if (tenantCtx.role === "...")`.  
> Таким образом, права в матрице `CENTER_ROLE_PERMISSIONS` для учебных ролей являются **преимущественно декоративными** (декларативными), а реальные ограничения зависят от того, вспомнил ли разработчик написать проверку в конкретном `route.ts`.

#### 1. Роль TEACHER (Преподаватель)
* **Заявленные права в матрице** ([`src/lib/permissions.ts#L355-L368`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L355-L368)):
  `students.read`, `grades.read`, `grades.create`, `grades.update`, `attendance.read`, `attendance.mark`, `attendance.update`, `assignments.read`, `assignments.create`, `assignments.review`, `assignments.grade`, `groups.read`, `courses.read`, `schedule.read`, `materials.read`, `materials.upload`, `announcements.read`, `announcements.create`, `reports.read`, `support.read`, `support.create`.
* **Реально проверяемые в коде:**
  - `attendance.mark` / `attendance.update`: проверяется в [`src/app/api/attendance/route.ts#L91`](file:///d:/AZIZ%20PROJECT/src/app/api/attendance/route.ts#L91) через условие `role === "TEACHER"`.
  - `grades.create`: проверяется в [`src/app/api/grades/route.ts#L102`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L102).
  - `grades.update`: проверяется в [`src/app/api/grades/route.ts#L225`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L225).
  - `assignments.grade`: проверяется в [`src/app/api/homework/route.ts#L210`](file:///d:/AZIZ%20PROJECT/src/app/api/homework/route.ts#L210).
  - `announcements.create`: проверяется в [`src/app/api/tenant/announcements/route.ts#L101`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/announcements/route.ts#L101).
* **Декоративные (не проверяются через `hasPermission`, заменены ad-hoc логикой или отсутствуют):**
  - `grades.finalize`: у учителя отсутствует в матрице, но в [`src/app/api/grades/route.ts#L284`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L284) учитель может перевести оценку в статус `FINAL` без явного права `grades.finalize`.
  - `reports.read`: отдельного эндпоинта отчётов для учителей нет, доступ к `/center/reports` и `/api/finance/reports` закрыт условием `DIRECTOR, CENTER_ADMIN, ACCOUNTANT`.
  - `support.read`, `support.create`: заявлены, но в сайдбаре [`src/app/center/layout.tsx#L283`](file:///d:/AZIZ%20PROJECT/src/app/center/layout.tsx#L283) роль `TEACHER` исключена из пункта `/center/support`.

#### 2. Роль TEACHER_ASSISTANT (Ассистент преподавателя)
* **Заявленные права в матрице** ([`src/lib/permissions.ts#L369-L381`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L369-L381)):
  `students.read`, `grades.read`, `attendance.read`, `attendance.mark`, `assignments.read`, `assignments.review`, `groups.read`, `courses.read`, `schedule.read`, `materials.read`, `materials.upload`, `announcements.read`, `support.read`, `support.create`.
* **Фактический статус:** **КРИТИЧЕСКИЙ РАЗРЫВ РЕАЛИЗАЦИИ**.
  - В [`src/app/api/students/route.ts#L67-L87`](file:///d:/AZIZ%20PROJECT/src/app/api/students/route.ts#L67-L87) роль `TEACHER_ASSISTANT` вообще не включена в список разрешённых. Ассистент получает `403 Forbidden` при попытке загрузить список студентов.
  - В [`src/app/api/grades/route.ts#L102`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L102) ассистент не может выставить оценку (верно согласно матрице).
  - В [`src/app/center/page.tsx#L280`](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L280) для ассистента нет персонального дашборда (ветка `activeRole === "TEACHER"` не включает ассистента, он видит пустой экран).
  - В [`src/app/api/attendance/route.ts#L91`](file:///d:/AZIZ%20PROJECT/src/app/api/attendance/route.ts#L91) ассистент допущен к выставлению посещаемости, но строка 133 проверяет назначение на группу **только для `role === "TEACHER"`**, открывая ассистенту обход проверки групп.

#### 3. Роль STUDENT (Студент)
* **Заявленные права в матрице** ([`src/lib/permissions.ts#L388-L397`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L388-L397)):
  `grades.read`, `attendance.read`, `assignments.read`, `courses.read`, `schedule.read`, `materials.read`, `announcements.read`, `support.read`, `support.create`.
* **Реально проверяемые в коде:**
  - `grades.read`: жёсткая фильтрация по `studentMembershipId = tenantCtx.membership.id` в [`src/app/api/grades/route.ts#L33`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L33) и мобильном дашборде [`src/app/api/mobile/student/dashboard/route.ts#L147`](file:///d:/AZIZ%20PROJECT/src/app/api/mobile/student/dashboard/route.ts#L147).
  - `attendance.read`: фильтрация по `studentMembershipId` в [`src/app/api/attendance/route.ts#L31`](file:///d:/AZIZ%20PROJECT/src/app/api/attendance/route.ts#L31).
  - `homework.submit`: сдача домашних заданий студентом в [`src/app/api/homework/route.ts#L143`](file:///d:/AZIZ%20PROJECT/src/app/api/homework/route.ts#L143).
  - `tests.attempt`: прохождение тестов в [`src/app/api/tests/start/route.ts#L9`](file:///d:/AZIZ%20PROJECT/src/app/api/tests/start/route.ts#L9) и [`src/app/api/tests/attempt/route.ts#L46`](file:///d:/AZIZ%20PROJECT/src/app/api/tests/attempt/route.ts#L46).
* **Утечки и декоративные ограничения:**
  - Студент может вызвать `GET /api/groups` ([`src/app/api/groups/route.ts#L13`](file:///d:/AZIZ%20PROJECT/src/app/api/groups/route.ts#L13)) и `GET /api/groups/[id]` ([`src/app/api/groups/[id]/route.ts#L42`](file:///d:/AZIZ%20PROJECT/src/app/api/groups/[id]/route.ts#L42)), так как фильтр группы применяется только к `TEACHER`. Студент видит телефоны и email всех студентов центра.
  - В `GET /api/materials` ([`src/app/api/materials/route.ts#L19-L34`](file:///d:/AZIZ%20PROJECT/src/app/api/materials/route.ts#L19-L34)) студент видит все учебные материалы центра, а не только своих групп.

#### 4. Роль PARENT (Родитель)
* **Заявленные права в матрице** ([`src/lib/permissions.ts#L398-L407`](file:///d:/AZIZ%20PROJECT/src/lib/permissions.ts#L398-L407)):
  `grades.read`, `attendance.read`, `assignments.read`, `schedule.read`, `payments.read`, `announcements.read`, `reports.read`, `support.read`, `support.create`.
* **Реально проверяемые в коде:**
  - Ограничение по подтверждённым связям `ParentLink(status: "CONFIRMED")`:
    - Оценки: [`src/app/api/grades/route.ts#L40-L46`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L40-L46).
    - Посещаемость: [`src/app/api/attendance/route.ts#L38-L45`](file:///d:/AZIZ%20PROJECT/src/app/api/attendance/route.ts#L38-L45).
    - Расписание: [`src/app/api/tenant/schedule/route.ts#L123-L133`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/schedule/route.ts#L123-L133).
    - Оплаты: [`src/app/api/center-payments/route.ts#L19-L25`](file:///d:/AZIZ%20PROJECT/src/app/api/center-payments/route.ts#L19-L25).
    - Мобильный дашборд: [`src/app/api/mobile/parent/dashboard/route.ts#L26-L57`](file:///d:/AZIZ%20PROJECT/src/app/api/mobile/parent/dashboard/route.ts#L26-L57).
* **Уязвимости изоляции:**
  - Родитель может получить доступ к `GET /api/groups` и `GET /api/groups/[id]` с утечкой контактных данных других учеников.

---

### 1.2. Выявленные дыры в изоляции и IDOR-уязвимости

1. **IDOR / Утечка персональных данных через эндпоинты групп**  
   - Файлы: [`src/app/api/groups/route.ts#L10-L16`](file:///d:/AZIZ%20PROJECT/src/app/api/groups/route.ts#L10-L16) и [`src/app/api/groups/[id]/route.ts#L41-L45`](file:///d:/AZIZ%20PROJECT/src/app/api/groups/[id]/route.ts#L41-L45).  
   - Условие: ограничение `whereCondition.teacherMembershipId = tenantCtx.membership.id` срабатывает **только если `role === "TEACHER"`**.  
   - Уязвимость: роли `STUDENT`, `PARENT`, `TEACHER_ASSISTANT` беспрепятственно получают список ВСЕХ групп центра вместе со связью `enrollments.student.user { fullName, email, phone }`. Любой студент может собрать телефонную книгу всего учебного центра.
2. **Обход проверки владения группой для TEACHER_ASSISTANT при отметке посещаемости**  
   - Файл: [`src/app/api/attendance/route.ts#L132-L150`](file:///d:/AZIZ%20PROJECT/src/app/api/attendance/route.ts#L132-L150).  
   - Код:  
     ```typescript
     if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
       const isAssigned = await tenantDb.group.findFirst({
         where: { id: groupId, teacherMembershipId: tenantCtx.membership.id },
       });
       if (!isAssigned) return NextResponse.json({ error: "Forbidden: Not your group" }, { status: 403 });
     }
     ```
   - Уязвимость: `TEACHER_ASSISTANT` допущен к методу `POST`, но проверка назначения на группу написана строго на `role === "TEACHER"`. Ассистент может проставить посещаемость любой группе чужого учителя.
3. **Утечка домашних заданий на веб-дашборде учителя**  
   - Файл: [`src/app/center/page.tsx#L295-L315`](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx#L295-L315).  
   - Запрос:  
     ```typescript
     pendingHomeworksCount = await tenantCtx.getTenantDb().homeworkSubmission.count({
       where: {
         homework: { lesson: { module: { course: { centerId: activeCenterId } } } },
         grade: null,
         status: "SUBMITTED",
       },
     });
     ```
   - Уязвимость: Учитель на главной странице видит счетчик и последние 5 несданных работ со **всего учебного центра**, включая группы других преподавателей.
4. **Некорректная привязка авторства оценки при автоматической сдаче теста студентом**  
   - Файл: [`src/app/api/tests/attempt/route.ts#L227-L241`](file:///d:/AZIZ%20PROJECT/src/app/api/tests/attempt/route.ts#L227-L241).  
   - Строка: `teacherMembershipId: tenantCtx.membership.id`.  
   - Баг: Поскольку запрос выполняет студент, его `membership.id` записывается в поле `teacherMembershipId` таблицы `Grade`. Студент фиксируется в базе данных как "преподаватель, выставивший оценку самому себе".
5. **Неконтролируемая финализация оценок учителем**  
   - Файл: [`src/app/api/grades/route.ts#L284`](file:///d:/AZIZ%20PROJECT/src/app/api/grades/route.ts#L284).  
   - Баг: Метод `PATCH` позволяет роли `TEACHER` перевести оценку из `DRAFT`/`SUBMITTED` в статус `FINAL` без проверки права `grades.finalize`, лишая директора/завуча этапа модерации журнала.

---

## 2. ЭКРАНЫ И МАРШРУТЫ ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ РОЛЕЙ

Маршрутизация сайдбара задаётся в [`src/app/center/layout.tsx#L117-L287`](file:///d:/AZIZ%20PROJECT/src/app/center/layout.tsx#L117-L287).

| Маршрут | Файл страницы | Доступно ролям (сайдбар) | Источник данных | Действия | Мёртвые кнопки / Проблемы | Статус |
|---|---|---|---|---|---|---|
| `/center` | [`src/app/center/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/page.tsx) | TEACHER, STUDENT, PARENT, (ASSISTANT) | Серверный Prisma (tenantDb) | Просмотр расписания, KPI, переход к проверке/сдаче ДЗ | Для `TEACHER_ASSISTANT` экран пуст (нет разметки). Учитель видит чужие ДЗ центра. | ЧАСТИЧНО |
| `/center/courses` | [`src/app/center/courses/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/courses/page.tsx) | TEACHER, ASSISTANT, STUDENT | `GET /api/courses` | Просмотр списка курсов и модулей | Кнопка «Создать курс» скрыта от студента, но видна форма. | РАБОТАЕТ |
| `/center/groups` | [`src/app/center/groups/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/groups/page.tsx) | TEACHER, ASSISTANT | `GET /api/groups` | Просмотр состава групп | Учитель видит свои группы; ассистент видит все группы центра (баг изоляции). | ЧАСТИЧНО |
| `/center/students` | [`src/app/center/students/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/students/page.tsx) | TEACHER, ASSISTANT | `GET /api/students` | Просмотр студентов | Для `TEACHER_ASSISTANT` API падает с 403 Forbidden. | ЧАСТИЧНО |
| `/center/schedule` | [`src/app/center/schedule/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/schedule/page.tsx) | TEACHER, ASSISTANT, STUDENT, PARENT | `GET /api/tenant/schedule` | Сетка расписания по дням недели | Кнопки добавления слотов заблокированы для не-админов. Экспорт в iCal работает. | РАБОТАЕТ |
| `/center/materials` | [`src/app/center/materials/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/materials/page.tsx) | TEACHER, ASSISTANT, STUDENT | `GET /api/materials` | Загрузка файлов (учитель), скачивание (студент) | Не фильтрует материалы по курсам студента — доступны все файлы центра. | ЧАСТИЧНО |
| `/center/attendance` | [`src/app/center/attendance/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/attendance/page.tsx) | TEACHER, ASSISTANT | `GET/POST /api/attendance`, `/bulk` | Отметка посещаемости (PRESENT, LATE, ABSENT) | Ассистент может отметить посещаемость чужой группы. Учитель ограничен своими. | ЧАСТИЧНО |
| `/center/grades` | [`src/app/center/grades/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/grades/page.tsx) | TEACHER, ASSISTANT, STUDENT, PARENT | `GET/POST/PATCH /api/grades` | Журнал оценок, выставление баллов | Родитель и студент видят только свои оценки. Учитель может преждевременно финализировать. | РАБОТАЕТ |
| `/center/homework` | [`src/app/center/homework/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/homework/page.tsx) | TEACHER, ASSISTANT, STUDENT, PARENT | `GET/POST/PATCH /api/homework` | Создание ДЗ, отправка решения студентом, оценка | В веб-интерфейсе прикрепление произвольных файлов к сдаче ограничено ссылкой или текстом. | РАБОТАЕТ |
| `/center/tests` | [`src/app/center/tests/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/tests/page.tsx) | TEACHER, ASSISTANT, STUDENT | `GET /api/tests`, `/start`, `/attempt` | Прохождение тестов с автопроверкой и таймером | Правильные ответы скрыты от студента. Результат пишет студента как учителя в Grade. | ЧАСТИЧНО |
| `/center/announcements`| [`src/app/center/announcements/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/announcements/page.tsx)| Все роли | `GET/POST /api/tenant/announcements`| Чтение объявлений; создание для своих групп (учитель) | Студенты и родители видят только объявления для своих групп/ролей или общие. | РАБОТАЕТ |
| `/center/payments` | [`src/app/center/payments/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/payments/page.tsx) | STUDENT, PARENT (учитель исключён) | `GET /api/center-payments` | Просмотр истории оплат | Учителю пункт не выведен в сайдбар, хотя API оплат групп поддерживает учителя. | ЧАСТИЧНО |
| `/center/support` | [`src/app/center/support/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/support/page.tsx) | STUDENT, PARENT (учителя исключены!) | `GET/POST /api/tickets` | Создание тикетов в поддержку центра | Учитель и ассистент не имеют пункта Support в меню сайдбара ([`layout.tsx#L283`](file:///d:/AZIZ%20PROJECT/src/app/center/layout.tsx#L283)). | ЧАСТИЧНО |
| `/center/profile` | [`src/app/center/profile/page.tsx`](file:///d:/AZIZ%20PROJECT/src/app/center/profile/page.tsx) | Все роли | Сессия NextAuth + `/api/auth/me` | Смена языка, просмотр профиля, переход к смене пароля | Работает штатно. | РАБОТАЕТ |

---

## 3. ПОЛЬЗОВАТЕЛЬСКИЕ СЦЕНАРИИ («МОЖЕТ / НЕ МОЖЕТ / ЧАСТИЧНО»)

### 3.1. Учитель (TEACHER)
1. **Просмотр личного расписания:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center` (блок «Мое расписание») или `/center/schedule`. Сетка отфильтрована по `teacherMembershipId`.
2. **Отметка посещаемости:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/attendance` -> выбор группы -> выбор урока -> выставление статусов (`PRESENT`/`LATE`/`ABSENT`) -> сохранение. В мобильном приложении доступна кнопка «Отметить всех присутствующими» в 1 клик.
3. **Выставление и редактирование оценок:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/grades` -> выбор студента и типа оценки -> ввод балла (0-100). Доступно сохранение в черновик (`DRAFT`) и отправка.
4. **Создание и проверка домашних заданий:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/homework` -> создание задания к уроку с дедлайном -> вкладка «На проверке» -> ввод оценки и рецензии.
5. **Загрузка учебных материалов:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/materials` -> загрузка PDF/видео/документов с валидацией размера и квоты учебного центра.
6. **Создание тестов с вариантами ответов:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/tests` (или через привязку к материалу) -> создание вопросов (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`, `TEXT`), установка проходного балла и тайм-лимита.
7. **Запрос замены преподавателя (Substitutions):**  
   * **Статус:** `НЕ МОЖЕТ`.  
   * *Причина:* В схеме БД поле `substituteTeacherMembershipId` существует в модели `Lesson` ([`prisma/schema.prisma#L415`](file:///d:/AZIZ%20PROJECT/prisma/schema.prisma#L415)), однако нет ни пользовательского интерфейса, ни API для подачи заявки на замену учителем. Назначить замену может только администратор через прямое редактирование урока.
8. **Публикация объявлений для своей группы:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/announcements` -> кнопка «Создать» -> выбор своей группы в выпадающем списке (проверяется владение группой в [`src/app/api/tenant/announcements/route.ts#L117`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/announcements/route.ts#L117)).
9. **Прямые сообщения родителям учеников:**  
   * **Статус:** `НЕ МОЖЕТ`.  
   * *Причина:* Модуль персонального чата (1-на-1) между учителем и родителем отсутствует. Связь возможна только через общее объявление группе или передачу контактов по телефону.
10. **Просмотр отработанных академических часов и начисленной зарплаты:**  
    * **Статус:** `НЕ МОЖЕТ`.  
    * *Причина:* Эндпоинт `/api/tenant/teacher-hours` доступен **только** ролям `DIRECTOR` и `CENTER_ADMIN` ([`src/app/api/tenant/teacher-hours/route.ts#L10`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/teacher-hours/route.ts#L10)). Учитель не видит расчёта своих часов. Разделы `/center/finance` закрыты.

---

### 3.2. Ассистент преподавателя (TEACHER_ASSISTANT)
1. **Просмотр групп и студентов:**  
   * **Статус:** `НЕ МОЖЕТ` (в вебе падает 403 на `/api/students`).  
2. **Отметка посещаемости:**  
   * **Статус:** `ЧАСТИЧНО` (может через API `/api/attendance/bulk`, но без проверки привязки к группе из-за бага изоляции).  
3. **Проверка ДЗ без выставления финальной оценки:**  
   * **Статус:** `МОЖЕТ` (может оставлять рецензию, но выставление оценки в `PATCH /api/homework` требует роли `TEACHER`).  
4. **Дашборд ассистента:**  
   * **Статус:** `НЕ МОЖЕТ` (в вебе пустой экран, в мобильном приложении отдельной роли нет).

---

### 3.3. Студент (STUDENT)
1. **Просмотр расписания занятий:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Веб `/center` и `/center/schedule`, мобильное приложение таб `Schedule`.
2. **Получение и сдача домашнего задания:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Веб `/center/homework` или мобильный таб `Homework` -> клик по задаче -> ввод текста решения в модальном окне -> отправка (`PATCH /api/homework`).
3. **Просмотр журнала оценок и среднего балла:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Веб `/center/grades`, мобильный таб `Today` (виджет «Average Score» с прогресс-баром и список недавних оценок).
4. **Контроль своей посещаемости:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Веб `/center/attendance` (только просмотр своих строк) и виджет в мобильном приложении (% посещаемости).
5. **Прохождение тестов:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Веб `/center/tests` -> старт попытки (с таймером обратного отсчёта) -> отправка ответов -> мгновенный разбор ошибок и отображение заработанных баллов.
6. **Просмотр баланса, оплат и задолженности:**  
   * **Статус:** `ЧАСТИЧНО`.  
   * *Путь:* Студент может открыть `/center/payments` и увидеть список оплаченных квитанций. Но узнать точную сумму текущего долга студент не может, так как расчет задолженности `/api/finance/student-debts` закрыт правом `finance.read`.
7. **Чтение объявлений учебного центра:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/announcements` (лента фильтруется под роль и группы студента).
8. **Управление профилем и смена пароля:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* `/center/profile` -> переход на `/account/change-password`.

---

### 3.4. Родитель (PARENT)
1. **Список детей и переключение между ними:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Веб `/center` (карточки детей) и мобильное приложение (горизонтальный скролл с аватарками детей: клик переключает контекст активного ребёнка `?childId=...`).
2. **Просмотр оценок и посещаемости ребёнка сегодня:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Мобильный таб `Today` показывает статус посещаемости на сегодня (присутствует / опоздал / отсутствует / нет уроков), общий процент посещаемости и последние оценки с комментариями учителя.
3. **Контроль оплаты обучения:**  
   * **Статус:** `МОЖЕТ`.  
   * *Путь:* Мобильный таб `Payments` или веб `/center/payments`. Показываются суммы, валюта (UZS) и статус (PAID / PENDING).
4. **Контроль домашних заданий ребёнка:**  
   * **Статус:** `МОЖЕТ` (через веб `/center/homework`).
5. **Уведомления о пропусках занятий ребёнком:**  
   * **Статус:** `ЧАСТИЧНО`.  
   * *Причина:* Шаблоны SMS о пропусках в коде есть (`SMS_ATTENDANCE_ALERT` в [`src/lib/notifications.ts#L190`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L190)), но автоматический триггер отправки SMS при отметке `ABSENT` в эндпоинте посещаемости отсутствует.
6. **Связь с преподавателем ребёнка:**  
   * **Статус:** `НЕ МОЖЕТ`.  
   * *Причина:* Нет прямого канала связи; доступно только создание тикета в техподдержку учебного центра через `/center/support`.

---

## 4. АУДИТ МОБИЛЬНОГО ПРИЛОЖЕНИЯ (`mobile/`)

Мобильное приложение построено на базе **React Native / Expo** (Expo Router, Tailwind/NativeWind, Lucide Icons, Zustand).

### 4.1. Архитектура и структура файлов
```
mobile/
├── app/
│   ├── (auth)/login.tsx          # Экран авторизации (логин/пароль + dev-логин)
│   ├── (director)/index.tsx      # Дашборд директора
│   ├── (platform)/index.tsx      # Дашборд суперадмина платформы
│   ├── (teacher)/index.tsx       # Дашборд преподавателя
│   ├── (student)/index.tsx       # Дашборд студента
│   ├── (parent)/index.tsx        # Дашборд родителя
│   ├── _layout.tsx               # Корневой лэйаут с навигацией
│   └── index.tsx                 # Точка входа / редирект по роли
└── src/
    ├── components/               # UI-компоненты (Header, TabBar, Modal, Buttons)
    ├── config/api.ts             # Конфигурация API URL и эндпоинтов
    ├── services/                 # api-client, auth-storage, notifications, cipher
    └── store/auth-store.ts       # Хранилище сессии на Zustand
```

### 4.2. Анализ экранов по ролям: Реальная интеграция vs Заглушки

#### 1. Преподаватель (`mobile/app/(teacher)/index.tsx`)
* **Реально подключено к бэкенду:**
  - Загрузка данных через `GET /api/mobile/teacher/dashboard`: список групп, расписание на неделю, список несданных работ на проверку.
  - Быстрая отметка всей группы «Все присутствуют» в 1 клик через `POST /api/attendance/bulk`.
  - Посегментный журнал посещаемости группы (модальное окно с переключателями `PRESENT`/`LATE`/`ABSENT` по каждому ученику) с отправкой на `/api/attendance/bulk`.
  - Модальное окно быстрой проверки ДЗ с пресетами оценки (`100`, `95`, `85`, `75`, `60`) и вводом фидбека через `PATCH /api/homework`.
* **Заглушки / Отсутствует:**
  - Создание нового домашнего задания (только просмотр и оценка уже присланных).
  - Загрузка файлов или фото к ДЗ (только текстовые ответы).
  - Просмотр зарплаты и часов.

#### 2. Студент (`mobile/app/(student)/index.tsx`)
* **Реально подключено к бэкенду:**
  - Загрузка данных через `GET /api/mobile/student/dashboard`: карточка следующего урока (кабинет, время, преподаватель), процент посещаемости, средний балл GPA.
  - Расписание занятий с фильтрацией по дням недели (Пн-Вс).
  - Список домашних заданий с фильтрами (`Все`, `Ожидают сдачи`, `Проверенные`).
  - Модальное окно сдачи домашнего задания с отправкой текста решения через `PATCH /api/homework` (`action: "SUBMIT"`).
  - Просмотр оценок и комментариев преподавателя к работам.
* **Заглушки / Отсутствует:**
  - Прохождение интерактивных тестов в мобильном приложении (в приложении нет экрана прохождения теста, тесты работают только в веб-версии).
  - Прикрепление файлов/фотографий тетради к домашнему заданию (только `TextInput` текста решения).
  - Просмотр оплат и баланса (в табах студента вкладка оплат отсутствует, есть только у родителя).

#### 3. Родитель (`mobile/app/(parent)/index.tsx`)
* **Реально подключено к бэкенду:**
  - Загрузка данных через `GET /api/mobile/parent/dashboard?childId=...`.
  - Переключатель детей (Child Selector Pills) с изолированной подгрузкой метрик.
  - Баннер посещаемости ребенка «Сегодня» в реальном времени.
  - Просмотр расписания уроков ребенка и предметов.
  - Экран оплат: статус платежей (`PAID` / `PENDING`), сумма в UZS, назначение платежа.
* **Заглушки / Отсутствует:**
  - Онлайн-оплата через мобильное приложение (Click/Payme) — только просмотр статуса.
  - Чат с учителем.

---

## 5. ВНЕШНИЕ ИНТЕГРАЦИИ, СЕРВИСЫ И ЗАГЛУШКИ

1. **Push-уведомления (Mobile Push):**  
   - Регистрация токенов устройств работает в [`src/app/api/mobile/push-token/register/route.ts`](file:///d:/AZIZ%20PROJECT/src/app/api/mobile/push-token/register/route.ts), токены сохраняются в таблицу `DevicePushToken`.  
   - **Заглушка:** В диспетчере уведомлений [`src/lib/notifications.ts#L228-L243`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L228-L243) ветка `channel === "PUSH"` **полностью отсутствует**. Push-уведомления никогда фактически не отправляются на мобильные устройства через Expo Push API или Firebase FCM.
2. **SMS-уведомления (Eskiz.uz):**  
   - Статус: `РАБОТАЕТ (с автоматической симуляцией при отсутствии ключей)`.  
   - Реализована авторизация, кэширование токена на 29 дней и отправка через API `notify.eskiz.uz` в [`src/lib/notifications.ts#L48-L171`](file:///d:/AZIZ%20PROJECT/src/lib/notifications.ts#L48-L171).  
   - При отсутствии `ESKIZ_EMAIL` и `ESKIZ_PASSWORD` в `.env` система логирует имитацию в консоль (`SMS Simulated`) без падения запроса.
3. **Email-уведомления:**  
   - Статус: `РАБОТАЕТ`.  
   - Поддерживаются провайдеры `resend` (через API `api.resend.com/emails`) и `smtp` с фоновой очередью `EmailOutbox` ([`src/lib/email.ts#L274-L350`](file:///d:/AZIZ%20PROJECT/src/lib/email.ts#L274-L350)).
4. **Файловое хранилище (Storage):**  
   - Статус: `РАБОТАЕТ`.  
   - Драйвер по умолчанию сохраняет файлы в локальную директорию `public/uploads/{centerId}/{category}/...` с контролем квот тарифа подписки в [`src/lib/storage.ts#L200-L258`](file:///d:/AZIZ%20PROJECT/src/lib/storage.ts#L200-L258). Поддерживается режим S3/R2 при наличии переменных `STORAGE_BUCKET` и `STORAGE_ENDPOINT`.
5. **Хардкод формулы часов учителей:**  
   - В [`src/app/api/tenant/teacher-hours/route.ts#L35`](file:///d:/AZIZ%20PROJECT/src/app/api/tenant/teacher-hours/route.ts#L35) расчёт часов захардкожен условной формулой:  
     `estimatedAcademicHours = groupsCount * 12 + substituteCount * 1.5;`  
     Вместо подсчёта реальных проведённых уроков и слотов в расписании используется эвристика «12 часов на группу в месяц».

---

## 6. АУДИТ ТЕСТОВОГО ПОКРЫТИЯ И ПРОВЕРКА КАЧЕСТВА

### 6.1. Запуск статических анализаторов
1. **ESLint (`npm run lint`):**  
   * **Результат:** `0 ошибок`, 2 предупреждения Next.js (`@next/next/no-img-element` в клиентских лендингах). Код полностью валиден по правилам линтера проекта.
2. **TypeScript (`npx tsc --noEmit`):**  
   * **Результат:** 1 ошибка сборщика Next.js App Router в сгенерированных типах:  
     `.next/types/app/api/platform/impersonate/route.ts:54:13 - error TS2322: Property 'IMPERSONATION_MAX_AGE_SECONDS' is incompatible with index signature`.  
     *Причина:* В файле эндпоинта экспортирована служебная константа вместе с HTTP-методами `POST`/`DELETE`. В рамках read-only задачи код не модифицировался.

### 6.2. Покрытие тестами учебных ролей
* В проекте написано свыше 90 тестовых файлов Vitest.
* Тесты межролевых ограничений внутри центра сосредоточены в [`tests/intra-center-permissions.test.ts`](file:///d:/AZIZ%20PROJECT/tests/intra-center-permissions.test.ts) и [`tests/core-role-dashboards.test.ts`](file:///d:/AZIZ%20PROJECT/tests/core-role-dashboards.test.ts):
  - Покрыто: запрет ученику видеть чужие оценки, запрет учителю выставлять оценки не своей группе, запрет родителю видеть не связанных детей.
* **Пробелы в тестовом покрытии (Gaps):**
  - Нет тестов на доступ `TEACHER_ASSISTANT` к `/api/students` (поэтому регрессия с 403 Forbidden не была обнаружена тестами).
  - Нет тестов на утечку персональных данных в `GET /api/groups` и `/api/groups/[id]` для ролей `STUDENT` и `PARENT`.
  - Нет тестов мобильных эндпоинтов `/api/mobile/teacher/dashboard`, `/student/dashboard`, `/parent/dashboard` на устойчивость к IDOR при передаче чужих параметров.

---

## 7. СВОДКА, ТОП-15 ПРОБЕЛОВ, РИСКИ БЕЗОПАСНОСТИ И ВОПРОСЫ

### 7.1. Таблица статусов по ролям

| Роль | Права и изоляция | Веб-экраны | Мобильный клиент | Бизнес-сценарии | Общий статус |
|---|---|---|---|---|---|
| **TEACHER** | ЧАСТИЧНО (утечка чужих ДЗ, финализация) | РАБОТАЕТ | РАБОТАЕТ | ЧАСТИЧНО (нет часов/зарплаты, замен, чата) | **РАБОТАЕТ ЧАСТИЧНО** |
| **TEACHER_ASSISTANT** | КРИТИЧЕСКИЙ СБОЙ (403 на студентах) | ЗАГЛУШКА (нет дашборда) | НЕ ПОДКЛЮЧЕНО | ЧАСТИЧНО (блокирован просмотр студентов) | **НЕ РАБОТАЕТ** |
| **STUDENT** | ЧАСТИЧНО (утечка чужих групп/контактов) | РАБОТАЕТ | РАБОТАЕТ | ЧАСТИЧНО (нет тестов в мобильном, нет файлов ДЗ) | **РАБОТАЕТ** |
| **PARENT** | ЧАСТИЧНО (утечка чужих групп/контактов) | РАБОТАЕТ | РАБОТАЕТ | ЧАСТИЧНО (нет онлайн-оплаты и связи с учителем) | **РАБОТАЕТ** |

---

### 7.2. Топ-15 пробелов по важности с оценкой трудозатрат (S / M / L)

| № | Пробел / Дефект | Роль | Влияние | Оценка |
|---|---|---|---|---|
| **1** | **403 Forbidden для TEACHER_ASSISTANT в `/api/students`**: ассистенты полностью лишены доступа к списку студентов своих групп. | TEACHER_ASSISTANT | Блокирует работу роли | **S** |
| **2** | **Утечка персональных данных (IDOR) в `/api/groups` и `/api/groups/[id]`**: студенты и родители могут выгрузить телефоны и email всех учеников центра. | STUDENT, PARENT | Критический риск безопасности | **S** |
| **3** | **Обход проверки групп для TEACHER_ASSISTANT в `/api/attendance`**: ассистент может проставлять посещаемость в чужих группах. | TEACHER_ASSISTANT | Риск целостности данных | **S** |
| **4** | **Утечка домашних заданий всего центра на дашборде учителя** (`src/app/center/page.tsx:295`): запрос не фильтрует работы по группам учителя. | TEACHER | Утечка конфиденциальности | **S** |
| **5** | **Заглушка отправки Push-уведомлений**: токены собираются в БД, но `sendNotification()` не отправляет push-сообщения на мобильные устройства. | ВСЕ РОЛИ | Мобильный UX / оповещения | **M** |
| **6** | **Отсутствие веб-дашборда для TEACHER_ASSISTANT**: при входе под ролью ассистента отображается пустая страница без виджетов. | TEACHER_ASSISTANT | Отсутствие UI для роли | **M** |
| **7** | **Баг авторства оценки в тестах** (`src/app/api/tests/attempt/route.ts:232`): студент записывается в Grade как свой собственный учитель. | STUDENT | Нарушение схемы/логики | **S** |
| **8** | **Неконтролируемая финализация оценок учителем**: учитель может выставить `FINAL` без права `grades.finalize`. | TEACHER | Обход директорского контроля | **S** |
| **9** | **Недоступность отчёта о часах и зарплате для учителя**: эндпоинт `/api/tenant/teacher-hours` заблокирован для учителей, часы считаются хардкодом `* 12`. | TEACHER | Прозрачность выплат | **M** |
| **10**| **Отсутствие сдачи файлов к ДЗ в мобильном приложении**: студент может отправить только текстовое сообщение, нельзя прикрепить фото решения. | STUDENT | Неполноценный мобильный UX | **M** |
| **11**| **Отсутствие тестов в мобильном приложении**: студент не может пройти тестирование с телефона (только веб). | STUDENT | Функциональный пробел | **L** |
| **12**| **Отсутствие механизма замен преподавателей (Substitutions)**: поле в БД есть, интерфейса подачи заявки на замену нет. | TEACHER | Зависшая функциональность | **M** |
| **13**| **Отсутствие канала связи «Родитель — Преподаватель»**: нет личных сообщений между учителем и родителем ученика. | PARENT, TEACHER | Потеря ключевого сценария | **L** |
| **14**| **Исключение учителей из раздела Поддержка**: в `layout.tsx:283` пункт `/center/support` скрыт от учителей и ассистентов. | TEACHER, ASSISTANT | Учитель не может создать тикет | **S** |
| **15**| **Отсутствие отображения текущего сальдо долга студента**: студент видит только квитанции, но не видит расчетную сумму долга. | STUDENT | Финансовая неопределенность | **S** |

---

### 7.3. Риски безопасности и изоляции данных

1. **Утечка персональных данных несовершеннолетних (ПДн):**  
   Эндпоинт `GET /api/groups` отдает полные ФИО, телефонные номера и адреса электронной почты учеников любому авторизованному пользователю центра (включая других учеников). Это прямое нарушение законодательства о персональных данных Республики Узбекистан (Закон № ЗРУ-547).
2. **Несанкционированное редактирование посещаемости ассистентами:**  
   Из-за отсутствия проверки связи `assistantMembershipId` при записи посещаемости, скомпрометированная учетная запись ассистента позволяет фальсифицировать посещаемость в любых группах центра.
3. **Отсутствие Rate Limiting на отправку попыток тестов:**  
   Эндпоинты `/api/tests/start` и `/api/tests/attempt` не имеют ограничения по частоте запросов (Rate Limit), что позволяет автоматизированным перебором отправлять варианты ответов.

---

### 7.4. Вопросы к заказчику / руководителю проекта

1. **Роль TEACHER_ASSISTANT:** Должен ли ассистент иметь свой отдельный кабинет с урезанным функционалом или он должен использовать тот же интерфейс, что и преподаватель, но с блокировкой кнопки выставления оценок?
2. **Взаимодействие «Родитель — Учитель»:** Планируется ли создание полноценного чата внутри системы или достаточно реализовать запрос на обратный звонок через тикет-систему центра?
3. **Загрузка файлов в мобильном приложении:** Планируется ли подключение нативной камеры/галереи Expo ImagePicker для прикрепления фото тетрадей к домашним заданиям?
4. **Расчет зарплаты преподавателей:** Какая формула начисления должна использоваться для учителей — фикс за студента, почасовая ставка за фактически проведенные уроки по журналу посещаемости или процент от оплат группы?
5. **Тестирование на мобильных устройствах:** Требуется ли перенос конструктора и движка прохождения тестов в Expo/React Native, либо мобильное приложение должно открывать тест через WebView/веб-ссылку?
