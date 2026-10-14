import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL || process.argv[2];
  const password = process.env.OWNER_PASSWORD || process.argv[3];
  const fullName = process.env.OWNER_NAME || process.argv[4] || "Platform Superadmin";

  if (!email || !password) {
    console.error("Usage: npm run setup:first-owner <email> <password> [fullName]");
    console.error("Or provide OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME environment variables.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: Password must be at least 8 characters long.");
    process.exit(1);
  }

  const existingSuperadmin = await db.platformUser.count({
    where: { platformRole: "SUPERADMIN" },
  });

  if (existingSuperadmin > 0) {
    console.error("Error: Platform already has a SUPERADMIN. Setup command is permanently disabled.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.platformUser.upsert({
    where: { email: normalizedEmail },
    update: {
      platformRole: "SUPERADMIN",
      fullName,
      passwordHash,
      emailVerified: new Date(),
      isActive: true,
    },
    create: {
      email: normalizedEmail,
      fullName,
      passwordHash,
      platformRole: "SUPERADMIN",
      emailVerified: new Date(),
      isActive: true,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "PLATFORM_FIRST_OWNER_CREATED",
      resource: "PlatformUser",
      resourceId: user.id,
      detailsJson: JSON.stringify({
        email: user.email,
        fullName: user.fullName,
        platformRole: "SUPERADMIN",
      }),
    },
  });

  console.log(`Successfully created platform owner: ${user.email} (ID: ${user.id})`);
}

main()
  .catch((e) => {
    console.error("Setup error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
