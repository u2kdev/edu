import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const uzbekStudentNamesC1 = [
  "Jasur Abdullayev",
  "Dilnoza Rahimova",
  "Shaxzod Karimov",
  "Madina Yusupova",
  "Azizbek Normatov",
  "Gulnoza Aliyeva",
  "Bekzod Rustamov",
  "Shahlo Toshmatova",
  "Bobur Xalilov",
  "Malika Ergasheva",
  "Sardor Mirzayev",
  "Nilufar Qosimova",
  "Jamshid Nazarov",
  "Feruza Saidova",
  "Sherzod Usmonov",
  "Rayhon Ibragimova",
  "Ulug'bek Jalilov",
  "Kamola Solihova",
  "Farrux Mahmudov",
  "Nodira Umarova",
  "Doniyor Hasanov",
  "Zarina Sobirova",
  "Javohir Po'latov",
  "Nigora Davronova",
  "Sanjar Ahmedov",
  "Sevara Matyoqubova",
  "Eldor Rahmatov",
  "Mohira Jo'rayeva",
  "Otabek G'aniyev",
  "Dildora Zokirova",
];

const uzbekStudentNamesC2 = [
  "Akmal Shokirov",
  "Barno Ismoilova",
  "Mirjalol Yoqubov",
  "Zuxra Fayzullayeva",
  "Rustam Saidov",
  "Diyora Toxirova",
  "Mansur Xoliqov",
  "Laylo Qurbonova",
  "Anvar Begmatov",
  "Shaxnoza Tursunova",
  "Olim Vohidov",
  "Munisa Ashurova",
  "Temurbek Omonov",
  "Gulsanam Latipova",
  "Shohruh Qodirov",
  "Umida Nabiyeva",
  "Davronbek Murodov",
  "Zilola Ikromova",
  "Xurshid Samadov",
  "Nargiza Sobirova",
  "Ravshan Xolmatov",
  "Fotima Bozorova",
  "Jahongir Sharipov",
  "Muxlisa Ochilova",
  "Botir Mirzo",
  "Saodat Kenjayeva",
  "Sarvar G'afurov",
  "Dilrabo Asqarova",
  "Sherali Normurodov",
  "Yulduz Xidirova",
];

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Seed aborted: Cannot run seed script in production!");
    process.exit(1);
  }

  console.log("🌱 Starting idempotent database seed...");

  const testPassword = process.env.DEV_SEED_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const now = new Date();

  // 1. Subscription Plans
  const planPro = await prisma.subscriptionPlan.upsert({
    where: { id: "plan-pro" },
    update: {
      name: "Профессиональный",
      maxStudents: 250,
      maxTeachers: 20,
      maxCourses: 50,
      priceMonthly: 7900,
    },
    create: {
      id: "plan-pro",
      name: "Профессиональный",
      maxStudents: 250,
      maxTeachers: 20,
      maxCourses: 50,
      priceMonthly: 7900,
      featuresJson: JSON.stringify(["Кастомный брендинг", "Приоритетный саппорт", "Расширенные отчеты", "Уведомления"]),
    },
  });

  // 2. Superadmin User
  await prisma.platformUser.upsert({
    where: { email: "admin@platform.com" },
    update: {
      passwordHash,
      fullName: "Алексей Громов (Суперадмин)",
      platformRole: "SUPERADMIN",
      emailVerified: now,
      isActive: true,
    },
    create: {
      email: "admin@platform.com",
      passwordHash,
      fullName: "Алексей Громов (Суперадмин)",
      platformRole: "SUPERADMIN",
      emailVerified: now,
      isActive: true,
    },
  });

  // 3. Setup Centers Configuration
  const centersConfig = [
    {
      cIndex: 1,
      slug: "center-1",
      name: "Toshkent IT Academy",
      status: "ACTIVE",
      subStatus: "ACTIVE",
      directorEmail: "director1@example.com",
      directorName: "Alisher Navoiyev",
      studentNames: uzbekStudentNamesC1,
      teachers: [
        { email: "c1-teacher1@example.com", name: "Anvar Qodirov" },
        { email: "c1-teacher2@example.com", name: "Dilshod Bekmurodov" },
        { email: "c1-teacher3@example.com", name: "Nargiza Fayzullayeva" },
      ],
      courses: [
        { title: "Frontend Bootcamp (React & TypeScript)", desc: "Zamonaviy veb dasturlash" },
        { title: "Backend Engineering (Node.js & Postgres)", desc: "Katta yuklamali tizimlar" },
        { title: "Python Data Science & AI", desc: "Ma'lumotlar tahlili va mashinali o'rganish" },
        { title: "UI/UX Design Fundamentals", desc: "Interfeys dizayni va Figma" },
        { title: "Cybersecurity & Network Defense", desc: "Axborot xavfsizligi asoslari" },
      ],
    },
    {
      cIndex: 2,
      slug: "center-2",
      name: "Samarqand Digital School",
      status: "TRIAL",
      subStatus: "TRIAL",
      directorEmail: "director2@example.com",
      directorName: "Bobur Mirzo",
      studentNames: uzbekStudentNamesC2,
      teachers: [
        { email: "c2-teacher1@example.com", name: "Temur Ismoilov" },
        { email: "c2-teacher2@example.com", name: "Barno Xolmatova" },
        { email: "c2-teacher3@example.com", name: "Rustam Shokirov" },
      ],
      courses: [
        { title: "Mobile App Development (Flutter)", desc: "iOS va Android uchun dasturlar" },
        { title: "Fullstack Web Development", desc: "Next.js va Prisma platformasi" },
        { title: "DevOps & Cloud Infrastructure", desc: "Docker, Kubernetes va CI/CD" },
        { title: "Algorithm & Data Structures", desc: "Dasturlash musobaqalari va algoritmlar" },
        { title: "English for Software Engineers", desc: "Xalqaro IT jamoalarda ishlash uchun ingliz tili" },
      ],
    },
  ];

  for (const cfg of centersConfig) {
    const { cIndex, slug, name, status, subStatus, directorEmail, directorName, studentNames, teachers, courses } = cfg;

    // Director
    const directorUser = await prisma.platformUser.upsert({
      where: { email: directorEmail },
      update: {
        passwordHash,
        fullName: directorName,
        emailVerified: now,
        isActive: true,
      },
      create: {
        email: directorEmail,
        passwordHash,
        fullName: directorName,
        emailVerified: now,
        isActive: true,
      },
    });

    // Learning Center
    const center = await prisma.learningCenter.upsert({
      where: { slug },
      update: {
        name,
        centerType: "HYBRID",
        status,
        ownerId: directorUser.id,
      },
      create: {
        slug,
        name,
        centerType: "HYBRID",
        status,
        ownerId: directorUser.id,
      },
    });

    // Subscription
    await prisma.subscription.upsert({
      where: { id: `sub-${slug}` },
      update: {
        status: subStatus,
        trialEndsAt: subStatus === "TRIAL" ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
        currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
      create: {
        id: `sub-${slug}`,
        centerId: center.id,
        planId: planPro.id,
        status: subStatus,
        trialEndsAt: subStatus === "TRIAL" ? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) : null,
        currentPeriodStartsAt: now,
        currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Director Membership
    const directorMembership = await prisma.centerMembership.upsert({
      where: {
        userId_centerId_role: {
          userId: directorUser.id,
          centerId: center.id,
          role: "DIRECTOR",
        },
      },
      update: { status: "ACTIVE" },
      create: {
        userId: directorUser.id,
        centerId: center.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // 3 Teachers
    const teacherMemberships = [];
    for (let t = 0; t < teachers.length; t++) {
      const tInfo = teachers[t];
      const teacherUser = await prisma.platformUser.upsert({
        where: { email: tInfo.email },
        update: {
          passwordHash,
          fullName: tInfo.name,
          emailVerified: now,
          isActive: true,
        },
        create: {
          email: tInfo.email,
          passwordHash,
          fullName: tInfo.name,
          emailVerified: now,
          isActive: true,
        },
      });

      const tm = await prisma.centerMembership.upsert({
        where: {
          userId_centerId_role: {
            userId: teacherUser.id,
            centerId: center.id,
            role: "TEACHER",
          },
        },
        update: { status: "ACTIVE" },
        create: {
          userId: teacherUser.id,
          centerId: center.id,
          role: "TEACHER",
          status: "ACTIVE",
        },
      });
      teacherMemberships.push(tm);
    }

    // 30 Students and Parents
    const studentMemberships = [];
    for (let s = 0; s < 30; s++) {
      const studentNum = s + 1;
      const studentName = studentNames[s];
      const studentEmail = `c${cIndex}-student${studentNum}@example.com`;

      const studentUser = await prisma.platformUser.upsert({
        where: { email: studentEmail },
        update: {
          passwordHash,
          fullName: studentName,
          emailVerified: now,
          isActive: true,
        },
        create: {
          email: studentEmail,
          passwordHash,
          fullName: studentName,
          emailVerified: now,
          isActive: true,
        },
      });

      const sm = await prisma.centerMembership.upsert({
        where: {
          userId_centerId_role: {
            userId: studentUser.id,
            centerId: center.id,
            role: "STUDENT",
          },
        },
        update: { status: "ACTIVE" },
        create: {
          userId: studentUser.id,
          centerId: center.id,
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
      studentMemberships.push(sm);

      // Parent for student
      const parentEmail = `c${cIndex}-parent${studentNum}@example.com`;
      const parentName = `${studentName.split(" ")[1] || "Ota-ona"} (Ota/Ona)`;

      const parentUser = await prisma.platformUser.upsert({
        where: { email: parentEmail },
        update: {
          passwordHash,
          fullName: parentName,
          emailVerified: now,
          isActive: true,
        },
        create: {
          email: parentEmail,
          passwordHash,
          fullName: parentName,
          emailVerified: now,
          isActive: true,
        },
      });

      const pm = await prisma.centerMembership.upsert({
        where: {
          userId_centerId_role: {
            userId: parentUser.id,
            centerId: center.id,
            role: "PARENT",
          },
        },
        update: { status: "ACTIVE" },
        create: {
          userId: parentUser.id,
          centerId: center.id,
          role: "PARENT",
          status: "ACTIVE",
        },
      });

      await prisma.parentLink.upsert({
        where: {
          parentMembershipId_studentMembershipId: {
            parentMembershipId: pm.id,
            studentMembershipId: sm.id,
          },
        },
        update: { status: "CONFIRMED", confirmedAt: now },
        create: {
          parentMembershipId: pm.id,
          studentMembershipId: sm.id,
          status: "CONFIRMED",
          confirmedAt: now,
        },
      });
    }

    // 5 Courses with Modules and Lessons
    const createdCourses = [];
    for (let c = 0; c < 5; c++) {
      const cInfo = courses[c];
      const courseId = `course-${slug}-${c + 1}`;
      const course = await prisma.course.upsert({
        where: { id: courseId },
        update: {
          title: cInfo.title,
          description: cInfo.desc,
          isPublished: true,
          priceMonthly: 500000,
        },
        create: {
          id: courseId,
          centerId: center.id,
          title: cInfo.title,
          description: cInfo.desc,
          isPublished: true,
          priceMonthly: 500000,
          createdByMembershipId: directorMembership.id,
        },
      });
      createdCourses.push(course);

      // 2 Modules per course
      for (let m = 1; m <= 2; m++) {
        const moduleId = `mod-${slug}-${c + 1}-${m}`;
        await prisma.courseModule.upsert({
          where: { id: moduleId },
          update: {
            title: m === 1 ? "1-Modul: Nazariy asoslar" : "2-Modul: Amaliy loyihalar",
            orderIndex: m,
          },
          create: {
            id: moduleId,
            courseId: course.id,
            centerId: center.id,
            title: m === 1 ? "1-Modul: Nazariy asoslar" : "2-Modul: Amaliy loyihalar",
            orderIndex: m,
          },
        });
      }
    }

    // 6 Groups (2 per teacher)
    // Distributed among first 3 courses
    const createdGroups = [];
    for (let g = 0; g < 6; g++) {
      const gIndex = g + 1;
      const teacherIdx = Math.floor(g / 2); // 0, 0, 1, 1, 2, 2 -> 3 teachers
      const courseIdx = Math.floor(g / 2); // course 0, 1, 2
      const assignedTeacher = teacherMemberships[teacherIdx];
      const assignedCourse = createdCourses[courseIdx];

      const groupId = `group-${slug}-${gIndex}`;
      const group = await prisma.group.upsert({
        where: { id: groupId },
        update: {
          name: `Guruh ${slug.toUpperCase()}-G${gIndex}`,
          teacherMembershipId: assignedTeacher.id,
          maxStudents: 25,
        },
        create: {
          id: groupId,
          centerId: center.id,
          courseId: assignedCourse.id,
          name: `Guruh ${slug.toUpperCase()}-G${gIndex}`,
          teacherMembershipId: assignedTeacher.id,
          maxStudents: 25,
          startDate: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000), // started 4 weeks ago
        },
      });
      createdGroups.push({ group, teacher: assignedTeacher, course: assignedCourse, gIndex });

      // Enroll 5 students per group (6 groups * 5 = 30 students)
      const groupStudents = studentMemberships.slice(g * 5, (g + 1) * 5);
      for (const sm of groupStudents) {
        await prisma.enrollment.upsert({
          where: {
            studentMembershipId_groupId: {
              studentMembershipId: sm.id,
              groupId: group.id,
            },
          },
          update: { status: "ACTIVE" },
          create: {
            centerId: center.id,
            studentMembershipId: sm.id,
            groupId: group.id,
            status: "ACTIVE",
          },
        });
      }

      // Schedule Slots (Mon & Wed, or Tue & Thu)
      const day1 = (g % 2 === 0) ? 1 : 2; // Mon or Tue
      const day2 = (g % 2 === 0) ? 3 : 4; // Wed or Thu
      const slotTimeStart = g < 2 ? "09:00" : (g < 4 ? "11:00" : "14:00");
      const slotTimeEnd = g < 2 ? "10:30" : (g < 4 ? "12:30" : "15:30");

      const slot1 = await prisma.scheduleSlot.upsert({
        where: { id: `slot-${slug}-${gIndex}-1` },
        update: {
          startTime: slotTimeStart,
          endTime: slotTimeEnd,
          teacherMembershipId: assignedTeacher.id,
        },
        create: {
          id: `slot-${slug}-${gIndex}-1`,
          centerId: center.id,
          groupId: group.id,
          teacherMembershipId: assignedTeacher.id,
          dayOfWeek: day1,
          startTime: slotTimeStart,
          endTime: slotTimeEnd,
          isRecurring: true,
        },
      });

      await prisma.scheduleSlot.upsert({
        where: { id: `slot-${slug}-${gIndex}-2` },
        update: {
          startTime: slotTimeStart,
          endTime: slotTimeEnd,
          teacherMembershipId: assignedTeacher.id,
        },
        create: {
          id: `slot-${slug}-${gIndex}-2`,
          centerId: center.id,
          groupId: group.id,
          teacherMembershipId: assignedTeacher.id,
          dayOfWeek: day2,
          startTime: slotTimeStart,
          endTime: slotTimeEnd,
          isRecurring: true,
        },
      });

      // 4 Weeks of Lessons (Week -3, -2, -1, +1)
      // Weeks -3, -2, -1 have attendances and grades
      const moduleId = `mod-${slug}-${courseIdx + 1}-1`;
      const weekOffsets = [-21, -14, -7, 7]; // in days

      for (let w = 0; w < 4; w++) {
        const offsetDays = weekOffsets[w];
        const isPastWeek = w < 3; // first 3 weeks are past weeks
        const lessonDate = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

        const lessonId = `lesson-${slug}-g${gIndex}-w${w + 1}`;
        const lesson = await prisma.lesson.upsert({
          where: { id: lessonId },
          update: {
            title: `${w + 1}-dars: Guruh G${gIndex} mashg'uloti`,
            scheduledAt: lessonDate,
            scheduleSlotId: slot1.id,
            status: "ACTIVE",
          },
          create: {
            id: lessonId,
            centerId: center.id,
            moduleId,
            scheduleSlotId: slot1.id,
            title: `${w + 1}-dars: Guruh G${gIndex} mashg'uloti`,
            lessonType: "OFFLINE",
            status: "ACTIVE",
            orderIndex: w + 1,
            scheduledAt: lessonDate,
            durationMinutes: 90,
          },
        });

        // If in past 3 weeks -> Attendance and Grades for all enrolled students
        if (isPastWeek) {
          for (let stIdx = 0; stIdx < groupStudents.length; stIdx++) {
            const sm = groupStudents[stIdx];
            const attStatus = (stIdx === 4 && w === 1) ? "LATE" : "PRESENT";

            await prisma.attendance.upsert({
              where: {
                lessonId_studentMembershipId: {
                  lessonId: lesson.id,
                  studentMembershipId: sm.id,
                },
              },
              update: {
                status: attStatus,
                markedAt: lessonDate,
              },
              create: {
                lessonId: lesson.id,
                studentMembershipId: sm.id,
                groupId: group.id,
                status: attStatus,
                markedByMembershipId: assignedTeacher.id,
                markedAt: lessonDate,
              },
            });

            // Grade for the lesson
            const gradeVal = 80 + ((stIdx + w) % 4) * 5; // 80, 85, 90, 95
            const gradeId = `grade-${slug}-g${gIndex}-w${w + 1}-s${stIdx + 1}`;
            await prisma.grade.upsert({
              where: { id: gradeId },
              update: {
                value: gradeVal,
                lifecycle: "FINAL",
                finalizedAt: lessonDate,
              },
              create: {
                id: gradeId,
                centerId: center.id,
                studentMembershipId: sm.id,
                groupId: group.id,
                lessonId: lesson.id,
                teacherMembershipId: assignedTeacher.id,
                gradeType: "HOMEWORK",
                value: gradeVal,
                maxValue: 100,
                lifecycle: "FINAL",
                finalizedAt: lessonDate,
              },
            });
          }
        }
      }
    }
  }

  console.log("✅ Idempotent seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
