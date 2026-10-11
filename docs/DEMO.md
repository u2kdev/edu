# Демо-стенд: Учетные записи и роли

Данный документ содержит реестр всех демонстрационных учетных записей, создаваемых скриптом наполнения базы данных `prisma/seed.ts`.

## Пароль для входа

Для всех демонстрационных аккаунтов пароль берется из переменной окружения `DEV_SEED_PASSWORD`.
Если переменная не задана в `.env`, используется значение по умолчанию:
```
Password123!
```

> **Примечание:** Всем демо-пользователям автоматически проставлен подтвержденный статус email (`emailVerified`).

---

## Платформа

| Email | ФИО | Платформенная роль | Роль в центре | Центр |
|---|---|---|---|---|
| `admin@platform.com` | Алексей Громов (Суперадмин) | `SUPERADMIN` | — | Вся платформа |

---

## Центр 1: Toshkent IT Academy (Статус: ACTIVE)

**Slug:** `center-1`  
**Тип:** `HYBRID`  
**Тариф:** Профессиональный (`ACTIVE`)

### Руководство и преподаватели

| Email | ФИО | Роль | Центр |
|---|---|---|---|
| `director1@example.com` | Alisher Navoiyev | `DIRECTOR` | Toshkent IT Academy (`center-1`) |
| `c1-teacher1@example.com` | Anvar Qodirov | `TEACHER` | Toshkent IT Academy (`center-1`) |
| `c1-teacher2@example.com` | Dilshod Bekmurodov | `TEACHER` | Toshkent IT Academy (`center-1`) |
| `c1-teacher3@example.com` | Nargiza Fayzullayeva | `TEACHER` | Toshkent IT Academy (`center-1`) |

### Студенты и родители (Группы G1..G6)

| Студент (Email) | ФИО Студента | Группа | Родитель (Email) | ФИО Родителя |
|---|---|---|---|---|
| `c1-student1@example.com` | Jasur Abdullayev | Guruh CENTER-1-G1 | `c1-parent1@example.com` | Abdullayev (Ota/Ona) |
| `c1-student2@example.com` | Dilnoza Rahimova | Guruh CENTER-1-G1 | `c1-parent2@example.com` | Rahimova (Ota/Ona) |
| `c1-student3@example.com` | Shaxzod Karimov | Guruh CENTER-1-G1 | `c1-parent3@example.com` | Karimov (Ota/Ona) |
| `c1-student4@example.com` | Madina Yusupova | Guruh CENTER-1-G1 | `c1-parent4@example.com` | Yusupova (Ota/Ona) |
| `c1-student5@example.com` | Azizbek Normatov | Guruh CENTER-1-G1 | `c1-parent5@example.com` | Normatov (Ota/Ona) |
| `c1-student6@example.com` | Gulnoza Aliyeva | Guruh CENTER-1-G2 | `c1-parent6@example.com` | Aliyeva (Ota/Ona) |
| `c1-student7@example.com` | Bekzod Rustamov | Guruh CENTER-1-G2 | `c1-parent7@example.com` | Rustamov (Ota/Ona) |
| `c1-student8@example.com` | Shahlo Toshmatova | Guruh CENTER-1-G2 | `c1-parent8@example.com` | Toshmatova (Ota/Ona) |
| `c1-student9@example.com` | Bobur Xalilov | Guruh CENTER-1-G2 | `c1-parent9@example.com` | Xalilov (Ota/Ona) |
| `c1-student10@example.com` | Malika Ergasheva | Guruh CENTER-1-G2 | `c1-parent10@example.com` | Ergasheva (Ota/Ona) |
| `c1-student11@example.com` | Sardor Mirzayev | Guruh CENTER-1-G3 | `c1-parent11@example.com` | Mirzayev (Ota/Ona) |
| `c1-student12@example.com` | Nilufar Qosimova | Guruh CENTER-1-G3 | `c1-parent12@example.com` | Qosimova (Ota/Ona) |
| `c1-student13@example.com` | Jamshid Nazarov | Guruh CENTER-1-G3 | `c1-parent13@example.com` | Nazarov (Ota/Ona) |
| `c1-student14@example.com` | Feruza Saidova | Guruh CENTER-1-G3 | `c1-parent14@example.com` | Saidova (Ota/Ona) |
| `c1-student15@example.com` | Sherzod Usmonov | Guruh CENTER-1-G3 | `c1-parent15@example.com` | Usmonov (Ota/Ona) |
| `c1-student16@example.com` | Rayhon Ibragimova | Guruh CENTER-1-G4 | `c1-parent16@example.com` | Ibragimova (Ota/Ona) |
| `c1-student17@example.com` | Ulug'bek Jalilov | Guruh CENTER-1-G4 | `c1-parent17@example.com` | Jalilov (Ota/Ona) |
| `c1-student18@example.com` | Kamola Solihova | Guruh CENTER-1-G4 | `c1-parent18@example.com` | Solihova (Ota/Ona) |
| `c1-student19@example.com` | Farrux Mahmudov | Guruh CENTER-1-G4 | `c1-parent19@example.com` | Mahmudov (Ota/Ona) |
| `c1-student20@example.com` | Nodira Umarova | Guruh CENTER-1-G4 | `c1-parent20@example.com` | Umarova (Ota/Ona) |
| `c1-student21@example.com` | Doniyor Hasanov | Guruh CENTER-1-G5 | `c1-parent21@example.com` | Hasanov (Ota/Ona) |
| `c1-student22@example.com` | Zarina Sobirova | Guruh CENTER-1-G5 | `c1-parent22@example.com` | Sobirova (Ota/Ona) |
| `c1-student23@example.com` | Javohir Po'latov | Guruh CENTER-1-G5 | `c1-parent23@example.com` | Po'latov (Ota/Ona) |
| `c1-student24@example.com` | Nigora Davronova | Guruh CENTER-1-G5 | `c1-parent24@example.com` | Davronova (Ota/Ona) |
| `c1-student25@example.com` | Sanjar Ahmedov | Guruh CENTER-1-G5 | `c1-parent25@example.com` | Ahmedov (Ota/Ona) |
| `c1-student26@example.com` | Sevara Matyoqubova | Guruh CENTER-1-G6 | `c1-parent26@example.com` | Matyoqubova (Ota/Ona) |
| `c1-student27@example.com` | Eldor Rahmatov | Guruh CENTER-1-G6 | `c1-parent27@example.com` | Rahmatov (Ota/Ona) |
| `c1-student28@example.com` | Mohira Jo'rayeva | Guruh CENTER-1-G6 | `c1-parent28@example.com` | Jo'rayeva (Ota/Ona) |
| `c1-student29@example.com` | Otabek G'aniyev | Guruh CENTER-1-G6 | `c1-parent29@example.com` | G'aniyev (Ota/Ona) |
| `c1-student30@example.com` | Dildora Zokirova | Guruh CENTER-1-G6 | `c1-parent30@example.com` | Zokirova (Ota/Ona) |

---

## Центр 2: Samarqand Digital School (Статус: TRIAL)

**Slug:** `center-2`  
**Тип:** `HYBRID`  
**Тариф:** Профессиональный (`TRIAL`, 14 дней пробного периода)

### Руководство и преподаватели

| Email | ФИО | Роль | Центр |
|---|---|---|---|
| `director2@example.com` | Bobur Mirzo | `DIRECTOR` | Samarqand Digital School (`center-2`) |
| `c2-teacher1@example.com` | Temur Ismoilov | `TEACHER` | Samarqand Digital School (`center-2`) |
| `c2-teacher2@example.com` | Barno Xolmatova | `TEACHER` | Samarqand Digital School (`center-2`) |
| `c2-teacher3@example.com` | Rustam Shokirov | `TEACHER` | Samarqand Digital School (`center-2`) |

### Студенты и родители (Группы G1..G6)

| Студент (Email) | ФИО Студента | Группа | Родитель (Email) | ФИО Родителя |
|---|---|---|---|---|
| `c2-student1@example.com` | Akmal Shokirov | Guruh CENTER-2-G1 | `c2-parent1@example.com` | Shokirov (Ota/Ona) |
| `c2-student2@example.com` | Barno Ismoilova | Guruh CENTER-2-G1 | `c2-parent2@example.com` | Ismoilova (Ota/Ona) |
| `c2-student3@example.com` | Mirjalol Yoqubov | Guruh CENTER-2-G1 | `c2-parent3@example.com` | Yoqubov (Ota/Ona) |
| `c2-student4@example.com` | Zuxra Fayzullayeva | Guruh CENTER-2-G1 | `c2-parent4@example.com` | Fayzullayeva (Ota/Ona) |
| `c2-student5@example.com` | Rustam Saidov | Guruh CENTER-2-G1 | `c2-parent5@example.com` | Saidov (Ota/Ona) |
| `c2-student6@example.com` | Diyora Toxirova | Guruh CENTER-2-G2 | `c2-parent6@example.com` | Toxirova (Ota/Ona) |
| `c2-student7@example.com` | Mansur Xoliqov | Guruh CENTER-2-G2 | `c2-parent7@example.com` | Xoliqov (Ota/Ona) |
| `c2-student8@example.com` | Laylo Qurbonova | Guruh CENTER-2-G2 | `c2-parent8@example.com` | Qurbonova (Ota/Ona) |
| `c2-student9@example.com` | Anvar Begmatov | Guruh CENTER-2-G2 | `c2-parent9@example.com` | Begmatov (Ota/Ona) |
| `c2-student10@example.com` | Shaxnoza Tursunova | Guruh CENTER-2-G2 | `c2-parent10@example.com` | Tursunova (Ota/Ona) |
| `c2-student11@example.com` | Olim Vohidov | Guruh CENTER-2-G3 | `c2-parent11@example.com` | Vohidov (Ota/Ona) |
| `c2-student12@example.com` | Munisa Ashurova | Guruh CENTER-2-G3 | `c2-parent12@example.com` | Ashurova (Ota/Ona) |
| `c2-student13@example.com` | Temurbek Omonov | Guruh CENTER-2-G3 | `c2-parent13@example.com` | Omonov (Ota/Ona) |
| `c2-student14@example.com` | Gulsanam Latipova | Guruh CENTER-2-G3 | `c2-parent14@example.com` | Latipova (Ota/Ona) |
| `c2-student15@example.com` | Shohruh Qodirov | Guruh CENTER-2-G3 | `c2-parent15@example.com` | Qodirov (Ota/Ona) |
| `c2-student16@example.com` | Umida Nabiyeva | Guruh CENTER-2-G4 | `c2-parent16@example.com` | Nabiyeva (Ota/Ona) |
| `c2-student17@example.com` | Davronbek Murodov | Guruh CENTER-2-G4 | `c2-parent17@example.com` | Murodov (Ota/Ona) |
| `c2-student18@example.com` | Zilola Ikromova | Guruh CENTER-2-G4 | `c2-parent18@example.com` | Ikromova (Ota/Ona) |
| `c2-student19@example.com` | Xurshid Samadov | Guruh CENTER-2-G4 | `c2-parent19@example.com` | Samadov (Ota/Ona) |
| `c2-student20@example.com` | Nargiza Sobirova | Guruh CENTER-2-G4 | `c2-parent20@example.com` | Sobirova (Ota/Ona) |
| `c2-student21@example.com` | Ravshan Xolmatov | Guruh CENTER-2-G5 | `c2-parent21@example.com` | Xolmatov (Ota/Ona) |
| `c2-student22@example.com` | Fotima Bozorova | Guruh CENTER-2-G5 | `c2-parent22@example.com` | Bozorova (Ota/Ona) |
| `c2-student23@example.com` | Jahongir Sharipov | Guruh CENTER-2-G5 | `c2-parent23@example.com` | Sharipov (Ota/Ona) |
| `c2-student24@example.com` | Muxlisa Ochilova | Guruh CENTER-2-G5 | `c2-parent24@example.com` | Ochilova (Ota/Ona) |
| `c2-student25@example.com` | Botir Mirzo | Guruh CENTER-2-G5 | `c2-parent25@example.com` | Mirzo (Ota/Ona) |
| `c2-student26@example.com` | Saodat Kenjayeva | Guruh CENTER-2-G6 | `c2-parent26@example.com` | Kenjayeva (Ota/Ona) |
| `c2-student27@example.com` | Sarvar G'afurov | Guruh CENTER-2-G6 | `c2-parent27@example.com` | G'afurov (Ota/Ona) |
| `c2-student28@example.com` | Dilrabo Asqarova | Guruh CENTER-2-G6 | `c2-parent28@example.com` | Asqarova (Ota/Ona) |
| `c2-student29@example.com` | Sherali Normurodov | Guruh CENTER-2-G6 | `c2-parent29@example.com` | Normurodov (Ota/Ona) |
| `c2-student30@example.com` | Yulduz Xidirova | Guruh CENTER-2-G6 | `c2-parent30@example.com` | Xidirova (Ota/Ona) |
