# Итоговая визуальная и accessibility-приёмка (UI4 + UI5)

- Дата генерации: 2026-11-16T15:06:38.859Z
- Всего скриншотов: **116** (Stage 4: 36, Final UI5: 80)
- Горизонтальный скролл (> 1px): **0** нарушений
- Критические/серьёзные нарушения Axe-Core (WCAG 2.1 AA): **0** экранов (всего экранов с любыми замечаниями axe: 0)
- Ошибки консоли/рантайма в браузере: **0** экранов
- Совпадение ожидаемых маршрутов: 116/116

## Проверка SSR-темы без вспышки (FOUC)

| Маршрут | HTTP | `html.dark` | `data-panel-theme="dark"` | `<nav>/<aside>` | Итог |
|---|---:|:---:|:---:|:---:|:---:|
| `/center` | 200 | да | да | да | PASS |
| `/platform-admin` | 200 | да | да | да | PASS |
| `/account` | 200 | да | да | да | PASS |

## Проверка работы SSR без JavaScript (`Emulation.setScriptExecutionDisabled`)

| Маршрут | H1 заголовок | Навигационных ссылок | Длина текста | Переполнение | Итог |
|---|---|---:|---:|:---:|:---:|
| `/center` | Обзор центра · Директор | 27 | 1839 | нет | PASS |
| `/center/students` | Ученики | 27 | 716 | нет | PASS |
| `/platform-admin` | Обзор платформы | 19 | 1222 | нет | PASS |
| `/account` | Профиль и настройки аккаунта | 27 | 870 | нет | PASS |

## Матрица всех ролей (UI5 — `docs/ui/final/`)

| Роль | Экран | Тема | Viewport | Axe (crit) | Переполнение | Скриншот |
|---|---|---|---:|---:|:---:|---|
| SUPERADMIN | `/platform-admin` | light | 1440x900 | 0 (0) | нет | [PNG](./superadmin-dashboard-light-1440.png) |
| SUPERADMIN | `/platform-admin` | light | 390x844 | 0 (0) | нет | [PNG](./superadmin-dashboard-light-390.png) |
| SUPERADMIN | `/platform-admin` | dark | 1440x900 | 0 (0) | нет | [PNG](./superadmin-dashboard-dark-1440.png) |
| SUPERADMIN | `/platform-admin` | dark | 390x844 | 0 (0) | нет | [PNG](./superadmin-dashboard-dark-390.png) |
| SUPERADMIN | `/platform-admin/centers` | light | 1440x900 | 0 (0) | нет | [PNG](./superadmin-centers-light-1440.png) |
| SUPERADMIN | `/platform-admin/centers` | light | 390x844 | 0 (0) | нет | [PNG](./superadmin-centers-light-390.png) |
| SUPERADMIN | `/platform-admin/centers` | dark | 1440x900 | 0 (0) | нет | [PNG](./superadmin-centers-dark-1440.png) |
| SUPERADMIN | `/platform-admin/centers` | dark | 390x844 | 0 (0) | нет | [PNG](./superadmin-centers-dark-390.png) |
| SUPERADMIN | `/platform-admin/support` | light | 1440x900 | 0 (0) | нет | [PNG](./superadmin-support-light-1440.png) |
| SUPERADMIN | `/platform-admin/support` | light | 390x844 | 0 (0) | нет | [PNG](./superadmin-support-light-390.png) |
| SUPERADMIN | `/platform-admin/support` | dark | 1440x900 | 0 (0) | нет | [PNG](./superadmin-support-dark-1440.png) |
| SUPERADMIN | `/platform-admin/support` | dark | 390x844 | 0 (0) | нет | [PNG](./superadmin-support-dark-390.png) |
| DIRECTOR | `/center` | light | 1440x900 | 0 (0) | нет | [PNG](./director-dashboard-light-1440.png) |
| DIRECTOR | `/center` | light | 390x844 | 0 (0) | нет | [PNG](./director-dashboard-light-390.png) |
| DIRECTOR | `/center` | dark | 1440x900 | 0 (0) | нет | [PNG](./director-dashboard-dark-1440.png) |
| DIRECTOR | `/center` | dark | 390x844 | 0 (0) | нет | [PNG](./director-dashboard-dark-390.png) |
| DIRECTOR | `/center/finance` | light | 1440x900 | 0 (0) | нет | [PNG](./director-finance-light-1440.png) |
| DIRECTOR | `/center/finance` | light | 390x844 | 0 (0) | нет | [PNG](./director-finance-light-390.png) |
| DIRECTOR | `/center/finance` | dark | 1440x900 | 0 (0) | нет | [PNG](./director-finance-dark-1440.png) |
| DIRECTOR | `/center/finance` | dark | 390x844 | 0 (0) | нет | [PNG](./director-finance-dark-390.png) |
| DIRECTOR | `/center/announcements` | light | 1440x900 | 0 (0) | нет | [PNG](./director-announcements-light-1440.png) |
| DIRECTOR | `/center/announcements` | light | 390x844 | 0 (0) | нет | [PNG](./director-announcements-light-390.png) |
| DIRECTOR | `/center/announcements` | dark | 1440x900 | 0 (0) | нет | [PNG](./director-announcements-dark-1440.png) |
| DIRECTOR | `/center/announcements` | dark | 390x844 | 0 (0) | нет | [PNG](./director-announcements-dark-390.png) |
| DIRECTOR | `/center/branches` | light | 1440x900 | 0 (0) | нет | [PNG](./director-branches-light-1440.png) |
| DIRECTOR | `/center/branches` | light | 390x844 | 0 (0) | нет | [PNG](./director-branches-light-390.png) |
| DIRECTOR | `/center/branches` | dark | 1440x900 | 0 (0) | нет | [PNG](./director-branches-dark-1440.png) |
| DIRECTOR | `/center/branches` | dark | 390x844 | 0 (0) | нет | [PNG](./director-branches-dark-390.png) |
| DIRECTOR | `/center/audit` | light | 1440x900 | 0 (0) | нет | [PNG](./director-audit-light-1440.png) |
| DIRECTOR | `/center/audit` | light | 390x844 | 0 (0) | нет | [PNG](./director-audit-light-390.png) |
| DIRECTOR | `/center/audit` | dark | 1440x900 | 0 (0) | нет | [PNG](./director-audit-dark-1440.png) |
| DIRECTOR | `/center/audit` | dark | 390x844 | 0 (0) | нет | [PNG](./director-audit-dark-390.png) |
| CENTER_ADMIN | `/center` | light | 1440x900 | 0 (0) | нет | [PNG](./center-admin-dashboard-light-1440.png) |
| CENTER_ADMIN | `/center` | light | 390x844 | 0 (0) | нет | [PNG](./center-admin-dashboard-light-390.png) |
| CENTER_ADMIN | `/center` | dark | 1440x900 | 0 (0) | нет | [PNG](./center-admin-dashboard-dark-1440.png) |
| CENTER_ADMIN | `/center` | dark | 390x844 | 0 (0) | нет | [PNG](./center-admin-dashboard-dark-390.png) |
| CENTER_ADMIN | `/center/schedule` | light | 1440x900 | 0 (0) | нет | [PNG](./center-admin-schedule-light-1440.png) |
| CENTER_ADMIN | `/center/schedule` | light | 390x844 | 0 (0) | нет | [PNG](./center-admin-schedule-light-390.png) |
| CENTER_ADMIN | `/center/schedule` | dark | 1440x900 | 0 (0) | нет | [PNG](./center-admin-schedule-dark-1440.png) |
| CENTER_ADMIN | `/center/schedule` | dark | 390x844 | 0 (0) | нет | [PNG](./center-admin-schedule-dark-390.png) |
| ACCOUNTANT | `/center/reports` | light | 1440x900 | 0 (0) | нет | [PNG](./accountant-reports-light-1440.png) |
| ACCOUNTANT | `/center/reports` | light | 390x844 | 0 (0) | нет | [PNG](./accountant-reports-light-390.png) |
| ACCOUNTANT | `/center/reports` | dark | 1440x900 | 0 (0) | нет | [PNG](./accountant-reports-dark-1440.png) |
| ACCOUNTANT | `/center/reports` | dark | 390x844 | 0 (0) | нет | [PNG](./accountant-reports-dark-390.png) |
| TEACHER | `/center` | light | 1440x900 | 0 (0) | нет | [PNG](./teacher-dashboard-light-1440.png) |
| TEACHER | `/center` | light | 390x844 | 0 (0) | нет | [PNG](./teacher-dashboard-light-390.png) |
| TEACHER | `/center` | dark | 1440x900 | 0 (0) | нет | [PNG](./teacher-dashboard-dark-1440.png) |
| TEACHER | `/center` | dark | 390x844 | 0 (0) | нет | [PNG](./teacher-dashboard-dark-390.png) |
| TEACHER | `/center/attendance` | light | 1440x900 | 0 (0) | нет | [PNG](./teacher-attendance-light-1440.png) |
| TEACHER | `/center/attendance` | light | 390x844 | 0 (0) | нет | [PNG](./teacher-attendance-light-390.png) |
| TEACHER | `/center/attendance` | dark | 1440x900 | 0 (0) | нет | [PNG](./teacher-attendance-dark-1440.png) |
| TEACHER | `/center/attendance` | dark | 390x844 | 0 (0) | нет | [PNG](./teacher-attendance-dark-390.png) |
| TEACHER | `/center/grades` | light | 1440x900 | 0 (0) | нет | [PNG](./teacher-grades-light-1440.png) |
| TEACHER | `/center/grades` | light | 390x844 | 0 (0) | нет | [PNG](./teacher-grades-light-390.png) |
| TEACHER | `/center/grades` | dark | 1440x900 | 0 (0) | нет | [PNG](./teacher-grades-dark-1440.png) |
| TEACHER | `/center/grades` | dark | 390x844 | 0 (0) | нет | [PNG](./teacher-grades-dark-390.png) |
| TEACHER_ASSISTANT | `/center/homework` | light | 1440x900 | 0 (0) | нет | [PNG](./teacher-assistant-homework-light-1440.png) |
| TEACHER_ASSISTANT | `/center/homework` | light | 390x844 | 0 (0) | нет | [PNG](./teacher-assistant-homework-light-390.png) |
| TEACHER_ASSISTANT | `/center/homework` | dark | 1440x900 | 0 (0) | нет | [PNG](./teacher-assistant-homework-dark-1440.png) |
| TEACHER_ASSISTANT | `/center/homework` | dark | 390x844 | 0 (0) | нет | [PNG](./teacher-assistant-homework-dark-390.png) |
| STUDENT | `/center` | light | 1440x900 | 0 (0) | нет | [PNG](./student-dashboard-light-1440.png) |
| STUDENT | `/center` | light | 390x844 | 0 (0) | нет | [PNG](./student-dashboard-light-390.png) |
| STUDENT | `/center` | dark | 1440x900 | 0 (0) | нет | [PNG](./student-dashboard-dark-1440.png) |
| STUDENT | `/center` | dark | 390x844 | 0 (0) | нет | [PNG](./student-dashboard-dark-390.png) |
| STUDENT | `/center/grades` | light | 1440x900 | 0 (0) | нет | [PNG](./student-grades-light-1440.png) |
| STUDENT | `/center/grades` | light | 390x844 | 0 (0) | нет | [PNG](./student-grades-light-390.png) |
| STUDENT | `/center/grades` | dark | 1440x900 | 0 (0) | нет | [PNG](./student-grades-dark-1440.png) |
| STUDENT | `/center/grades` | dark | 390x844 | 0 (0) | нет | [PNG](./student-grades-dark-390.png) |
| PARENT | `/center` | light | 1440x900 | 0 (0) | нет | [PNG](./parent-dashboard-light-1440.png) |
| PARENT | `/center` | light | 390x844 | 0 (0) | нет | [PNG](./parent-dashboard-light-390.png) |
| PARENT | `/center` | dark | 1440x900 | 0 (0) | нет | [PNG](./parent-dashboard-dark-1440.png) |
| PARENT | `/center` | dark | 390x844 | 0 (0) | нет | [PNG](./parent-dashboard-dark-390.png) |
| DEVELOPER | `/developer` | light | 1440x900 | 0 (0) | нет | [PNG](./developer-health-light-1440.png) |
| DEVELOPER | `/developer` | light | 390x844 | 0 (0) | нет | [PNG](./developer-health-light-390.png) |
| DEVELOPER | `/developer` | dark | 1440x900 | 0 (0) | нет | [PNG](./developer-health-dark-1440.png) |
| DEVELOPER | `/developer` | dark | 390x844 | 0 (0) | нет | [PNG](./developer-health-dark-390.png) |
| DIRECTOR | `/account` | light | 1440x900 | 0 (0) | нет | [PNG](./account-unified-light-1440.png) |
| DIRECTOR | `/account` | light | 390x844 | 0 (0) | нет | [PNG](./account-unified-light-390.png) |
| DIRECTOR | `/account` | dark | 1440x900 | 0 (0) | нет | [PNG](./account-unified-dark-1440.png) |
| DIRECTOR | `/account` | dark | 390x844 | 0 (0) | нет | [PNG](./account-unified-dark-390.png) |

## Ключевые списки, формы и карточки Stage 4 (`docs/ui/stage-4/`)

| Экран | Маршрут | Тема | Viewport | Axe (crit) | Переполнение | Скриншот |
|---|---|---|---:|---:|:---:|---|
| director-students | `/center/students` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-students-light-1440.png) |
| director-students | `/center/students` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-students-light-390.png) |
| director-students | `/center/students` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-students-dark-1440.png) |
| director-students | `/center/students` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-students-dark-390.png) |
| director-student-detail | `/center/students/c75bbbc4-8115-4342-a435-e72c5ec81258` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-student-detail-light-1440.png) |
| director-student-detail | `/center/students/c75bbbc4-8115-4342-a435-e72c5ec81258` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-student-detail-light-390.png) |
| director-student-detail | `/center/students/c75bbbc4-8115-4342-a435-e72c5ec81258` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-student-detail-dark-1440.png) |
| director-student-detail | `/center/students/c75bbbc4-8115-4342-a435-e72c5ec81258` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-student-detail-dark-390.png) |
| director-staff | `/center/staff` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-staff-light-1440.png) |
| director-staff | `/center/staff` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-staff-light-390.png) |
| director-staff | `/center/staff` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-staff-dark-1440.png) |
| director-staff | `/center/staff` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-staff-dark-390.png) |
| director-staff-detail | `/center/staff/a8c58ecc-10c9-47ab-8a61-7cdabded9571` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-staff-detail-light-1440.png) |
| director-staff-detail | `/center/staff/a8c58ecc-10c9-47ab-8a61-7cdabded9571` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-staff-detail-light-390.png) |
| director-staff-detail | `/center/staff/a8c58ecc-10c9-47ab-8a61-7cdabded9571` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-staff-detail-dark-1440.png) |
| director-staff-detail | `/center/staff/a8c58ecc-10c9-47ab-8a61-7cdabded9571` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-staff-detail-dark-390.png) |
| director-groups | `/center/groups` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-groups-light-1440.png) |
| director-groups | `/center/groups` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-groups-light-390.png) |
| director-groups | `/center/groups` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-groups-dark-1440.png) |
| director-groups | `/center/groups` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-groups-dark-390.png) |
| director-payments | `/center/payments` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-payments-light-1440.png) |
| director-payments | `/center/payments` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-payments-light-390.png) |
| director-payments | `/center/payments` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-payments-dark-1440.png) |
| director-payments | `/center/payments` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-payments-dark-390.png) |
| director-communications | `/center/communications` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-communications-light-1440.png) |
| director-communications | `/center/communications` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-communications-light-390.png) |
| director-communications | `/center/communications` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-communications-dark-1440.png) |
| director-communications | `/center/communications` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-communications-dark-390.png) |
| director-settings | `/center/settings` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-settings-light-1440.png) |
| director-settings | `/center/settings` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-settings-light-390.png) |
| director-settings | `/center/settings` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/director-settings-dark-1440.png) |
| director-settings | `/center/settings` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/director-settings-dark-390.png) |
| superadmin-center-detail | `/platform-admin/centers/215cc748-5a95-4cce-afbe-1ea764ee8ccd` | light | 1440x900 | 0 (0) | нет | [PNG](../stage-4/superadmin-center-detail-light-1440.png) |
| superadmin-center-detail | `/platform-admin/centers/215cc748-5a95-4cce-afbe-1ea764ee8ccd` | light | 390x844 | 0 (0) | нет | [PNG](../stage-4/superadmin-center-detail-light-390.png) |
| superadmin-center-detail | `/platform-admin/centers/215cc748-5a95-4cce-afbe-1ea764ee8ccd` | dark | 1440x900 | 0 (0) | нет | [PNG](../stage-4/superadmin-center-detail-dark-1440.png) |
| superadmin-center-detail | `/platform-admin/centers/215cc748-5a95-4cce-afbe-1ea764ee8ccd` | dark | 390x844 | 0 (0) | нет | [PNG](../stage-4/superadmin-center-detail-dark-390.png) |
