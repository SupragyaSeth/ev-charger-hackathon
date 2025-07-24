import { authPrisma, queuePrisma } from "../lib/prisma";

async function main() {
  try {
    console.log("🔌 Connecting to databases...");

    // Test auth database connection
    const authTest = await authPrisma.user.count();
    console.log(`✅ Auth database connected - ${authTest} users found`);

    // Test queue database connection
    const queueTest = await queuePrisma.queue.count();
    console.log(
      `✅ Queue database connected - ${queueTest} queue entries found`
    );

    console.log("🎉 Both databases are working properly!");
  } catch (error) {
    console.error("❌ Database connection error:", error);
  } finally {
    await authPrisma.$disconnect();
    await queuePrisma.$disconnect();
  }
}

main();
