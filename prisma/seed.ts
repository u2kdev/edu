import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Seed aborted: Cannot run seed script in production!");
    process.exit(1);
  }

  console.log("🌱 Seeding database...");

  // 1. Create Default Subscription Plans
  const planPro = await prisma.subscriptionPlan.upsert({
    where: { id: "plan-pro" },
    update: {},
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

  // DEV ONLY: Using a hardcoded test password since this seed is blocked in production
  const testPassword = process.env.DEV_SEED_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(testPassword, 10);

  // 2. Create Superadmin User
  await prisma.platformUser.upsert({
    where: { email: "admin@platform.com" },
    update: {},
    create: {
      email: "admin@platform.com",
      passwordHash,
      fullName: "Алексей Громов (Суперадмин)",
      platformRole: "SUPERADMIN",
    },
  });

  // 3. Create Centers
  for (let c = 1; c <= 2; c++) {
    const slug = `center-${c}`;
    const directorUser = await prisma.platformUser.upsert({
      where: { email: `director${c}@example.com` },
      update: {},
      create: {
        email: `director${c}@example.com`,
        passwordHash,
        fullName: `Директор Центра ${c}`,
      },
    });

    const center = await prisma.learningCenter.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: `IT Academy ${c}`,
        centerType: "HYBRID",
        status: "ACTIVE",
        ownerId: directorUser.id,
      },
    });

    await prisma.subscription.create({
      data: {
        centerId: center.id,
        planId: planPro.id,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const directorMembership = await prisma.centerMembership.create({
      data: {
        userId: directorUser.id,
        centerId: center.id,
        role: "DIRECTOR",
      },
    });

    // Teachers
    const teacherMemberships = [];
    for (let t = 1; t <= 3; t++) {
      const teacherUser = await prisma.platformUser.upsert({
        where: { email: `c${c}-teacher${t}@example.com` },
        update: {},
        create: { email: `c${c}-teacher${t}@example.com`, passwordHash, fullName: `Учитель ${t} Центра ${c}` },
      });
      const tm = await prisma.centerMembership.create({
        data: { userId: teacherUser.id, centerId: center.id, role: "TEACHER" },
      });
      teacherMemberships.push(tm);
    }

    // Students and Parents
    const studentMemberships = [];
    for (let s = 1; s <= 30; s++) {
      const studentUser = await prisma.platformUser.upsert({
        where: { email: `c${c}-student${s}@example.com` },
        update: {},
        create: { email: `c${c}-student${s}@example.com`, passwordHash, fullName: `Студент ${s} Центра ${c}` },
      });
      const sm = await prisma.centerMembership.create({
        data: { userId: studentUser.id, centerId: center.id, role: "STUDENT" },
      });
      studentMemberships.push(sm);

      // 1 Parent for every 2 students
      if (s % 2 === 1) {
        const parentUser = await prisma.platformUser.upsert({
          where: { email: `c${c}-parent${s}@example.com` },
          update: {},
          create: { email: `c${c}-parent${s}@example.com`, passwordHash, fullName: `Родитель ${s} Центра ${c}` },
        });
        const pm = await prisma.centerMembership.create({
          data: { userId: parentUser.id, centerId: center.id, role: "PARENT" },
        });
        await prisma.parentLink.create({
          data: { parentMembershipId: pm.id, studentMembershipId: sm.id, status: "CONFIRMED", confirmedAt: new Date() },
        });
      }
    }

    // Courses and Groups
    for (let i = 1; i <= 2; i++) {
      const course = await prisma.course.create({
        data: {
          centerId: center.id,
          title: `Курс ${i} Центра ${c}`,
          description: `Описание курса ${i}`,
          isPublished: true,
          createdByMembershipId: directorMembership.id,
        },
      });

      const module = await prisma.courseModule.create({
        data: {
          centerId: center.id, // NEW FIELD
          courseId: course.id,
          title: `Модуль 1 Курса ${i}`,
          orderIndex: 1,
        },
      });

      const lesson = await prisma.lesson.create({
        data: {
          centerId: center.id, // NEW FIELD
          moduleId: module.id,
          title: `Урок 1`,
          lessonType: "ONLINE",
          status: "ACTIVE",
          orderIndex: 1,
          durationMinutes: 90,
        },
      });

      const group = await prisma.group.create({
        data: {
          centerId: center.id, // NEW FIELD
          courseId: course.id,
          name: `Группа ${i} Курса ${i}`,
          teacherMembershipId: teacherMemberships[i - 1].id,
          maxStudents: 20,
          startDate: new Date(),
        },
      });

      // Enroll half of students
      for (let s = (i-1)*15; s < i*15; s++) {
        await prisma.enrollment.create({
          data: {
            centerId: center.id, // NEW FIELD
            studentMembershipId: studentMemberships[s].id,
            groupId: group.id,
            status: "ACTIVE",
          },
        });
        
        // Grades & Payments for a few
        if (s % 3 === 0) {
          await prisma.grade.create({
            data: {
              centerId: center.id,
              studentMembershipId: studentMemberships[s].id,
              groupId: group.id,
              lessonId: lesson.id,
              teacherMembershipId: teacherMemberships[i - 1].id,
              gradeType: "LESSON",
              value: 95,
            }
          });
          await prisma.centerPayment.create({
            data: {
              centerId: center.id,
              studentMembershipId: studentMemberships[s].id,
              groupId: group.id,
              amount: 150000,
              status: "PAID",
              paymentMethod: "ONLINE",
              paidAt: new Date(),
            }
          });
        }
      }
    }
  }

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
