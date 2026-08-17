import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Create Default Subscription Plans
  const planStart = await prisma.subscriptionPlan.upsert({
    where: { id: "plan-start" },
    update: {},
    create: {
      id: "plan-start",
      name: "Старт",
      maxStudents: 50,
      maxTeachers: 5,
      maxCourses: 10,
      priceMonthly: 2900,
      featuresJson: JSON.stringify(["Базовая аналитика", "Поддержка по email", "Встроенная оплата"]),
    },
  });

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

  const planUnlimited = await prisma.subscriptionPlan.upsert({
    where: { id: "plan-unlimited" },
    update: {},
    create: {
      id: "plan-unlimited",
      name: "Безлимит",
      maxStudents: 10000,
      maxTeachers: 100,
      maxCourses: 500,
      priceMonthly: 19900,
      featuresJson: JSON.stringify(["Персональный менеджер", "API интеграции", "Неограниченный брендинг"]),
    },
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 2. Create Superadmin User
  const superAdmin = await prisma.platformUser.upsert({
    where: { email: "admin@platform.com" },
    update: {},
    create: {
      email: "admin@platform.com",
      passwordHash,
      fullName: "Алексей Громов (Суперадмин)",
      platformRole: "SUPERADMIN",
    },
  });

  // 3. Create Learning Center (Director User)
  const directorUser = await prisma.platformUser.upsert({
    where: { email: "director@it-academy.com" },
    update: {},
    create: {
      email: "director@it-academy.com",
      passwordHash,
      fullName: "Елена Смирнова",
      phone: "+79990001122",
    },
  });

  const center = await prisma.learningCenter.upsert({
    where: { slug: "it-academy" },
    update: {},
    create: {
      slug: "it-academy",
      name: "Akademiya Raqamli Texnologiyalar",
      centerType: "HYBRID",
      status: "ACTIVE",
      defaultLanguage: "uz-Latn",
      ownerId: directorUser.id,
      brandingConfig: JSON.stringify({ primaryColor: "#4f6ef7", subtitle: "Dasturlash va dizayn markazi" }),
    },
  });

  // Subscription for center
  await prisma.subscription.create({
    data: {
      centerId: center.id,
      planId: planPro.id,
      status: "ACTIVE",
      currentPeriodStartsAt: new Date(),
      currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Director Membership
  const directorMembership = await prisma.centerMembership.create({
    data: {
      userId: directorUser.id,
      centerId: center.id,
      role: "DIRECTOR",
    },
  });

  // 4. Create Teacher User & Membership
  const teacherUser = await prisma.platformUser.upsert({
    where: { email: "teacher@it-academy.com" },
    update: {},
    create: {
      email: "teacher@it-academy.com",
      passwordHash,
      fullName: "Михаил Петров (Преподаватель)",
      phone: "+79991112233",
    },
  });

  const teacherMembership = await prisma.centerMembership.create({
    data: {
      userId: teacherUser.id,
      centerId: center.id,
      role: "TEACHER",
    },
  });

  // 5. Create Student User & Membership
  const studentUser = await prisma.platformUser.upsert({
    where: { email: "student@it-academy.com" },
    update: {},
    create: {
      email: "student@it-academy.com",
      passwordHash,
      fullName: "Иван Иванов (Ученик)",
      phone: "+79992223344",
    },
  });

  const studentMembership = await prisma.centerMembership.create({
    data: {
      userId: studentUser.id,
      centerId: center.id,
      role: "STUDENT",
    },
  });

  // 6. Create Parent User & Membership
  const parentUser = await prisma.platformUser.upsert({
    where: { email: "parent@it-academy.com" },
    update: {},
    create: {
      email: "parent@it-academy.com",
      passwordHash,
      fullName: "Ольга Иванова (Мама)",
      phone: "+79993334455",
    },
  });

  const parentMembership = await prisma.centerMembership.create({
    data: {
      userId: parentUser.id,
      centerId: center.id,
      role: "PARENT",
    },
  });

  // Link Parent to Student
  await prisma.parentLink.create({
    data: {
      parentMembershipId: parentMembership.id,
      studentMembershipId: studentMembership.id,
      status: "CONFIRMED",
      confirmedAt: new Date(),
    },
  });

  // 7. Create Course, Modules, Lessons, Groups
  const course = await prisma.course.create({
    data: {
      centerId: center.id,
      title: "Fullstack Разработка на JavaScript & React",
      description: "Освойте современный стек веб-разработки с нуля до Junior уровня.",
      isPublished: true,
      createdByMembershipId: directorMembership.id,
    },
  });

  const module1 = await prisma.courseModule.create({
    data: {
      courseId: course.id,
      title: "Модуль 1. Основы Frontend & React",
      orderIndex: 1,
    },
  });

  const lesson1 = await prisma.lesson.create({
    data: {
      moduleId: module1.id,
      title: "Dars 1. Veb-ilovalar arxitekturasi va React komponentlari",
      lessonType: "ONLINE",
      status: "ACTIVE",
      orderIndex: 1,
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      durationMinutes: 90,
      content: "Bu darsda biz Virtual DOM, JSX va funksional komponentlarni oʻrganamiz.",
      onlineMeetingUrl: "https://meet.google.com/abc-defg-hij",
    },
  });

  const group = await prisma.group.create({
    data: {
      courseId: course.id,
      name: "Поток JS-2026-A",
      teacherMembershipId: teacherMembership.id,
      maxStudents: 25,
      startDate: new Date(),
    },
  });

  // Enroll Student in Group
  await prisma.enrollment.create({
    data: {
      studentMembershipId: studentMembership.id,
      groupId: group.id,
      status: "ACTIVE",
    },
  });

  // Invite Code for students
  await prisma.inviteCode.create({
    data: {
      centerId: center.id,
      code: "JOIN-JS2026",
      targetRole: "STUDENT",
      courseId: course.id,
      groupId: group.id,
      maxUses: 20,
      createdByMembershipId: directorMembership.id,
    },
  });

  // Sample Student Payment
  await prisma.centerPayment.create({
    data: {
      centerId: center.id,
      studentMembershipId: studentMembership.id,
      groupId: group.id,
      amount: 15000,
      status: "PAID",
      paymentMethod: "ONLINE",
      paidAt: new Date(),
    },
  });

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
