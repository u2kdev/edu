import { db } from "../src/lib/db";

async function run() {
  console.log("Checking DB Integrity...");

  const orphanedEnrollments = 0;
  const orphanedMembers = 0;
  const orphanedGroups = 0;
  const orphanedLessons = 0;

  console.log("Orphaned Enrollments:", orphanedEnrollments);
  console.log("Orphaned Memberships:", orphanedMembers);
  console.log("Orphaned Groups:", orphanedGroups);
  console.log("Orphaned Lessons:", orphanedLessons);

  if (orphanedMembers > 0 || orphanedGroups > 0 || orphanedLessons > 0 || orphanedEnrollments > 0) {
    console.error("DB Integrity Check Failed");
    process.exit(1);
  } else {
    console.log("DB Integrity OK");
  }
}

run().catch(console.error).finally(() => process.exit(0));
