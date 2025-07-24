const {
  PrismaClient: AuthPrismaClient,
} = require("./src/generated/prisma/auth");
const {
  PrismaClient: QueuePrismaClient,
} = require("./src/generated/prisma/queue");

async function testConnections() {
  const authPrisma = new AuthPrismaClient();
  const queuePrisma = new QueuePrismaClient();

  try {
    console.log("Testing auth database connection...");
    const userCount = await authPrisma.user.count();
    console.log(`✅ Auth DB connected! Users: ${userCount}`);

    console.log("Testing queue database connection...");
    const queueCount = await queuePrisma.queue.count();
    console.log(`✅ Queue DB connected! Queue entries: ${queueCount}`);

    // Test write operation
    console.log("Testing write operation...");
    const testEntry = await queuePrisma.queue.create({
      data: {
        userId: 999,
        chargerId: 1,
        position: 999,
        status: "waiting",
      },
    });
    console.log("✅ Write operation successful");

    // Clean up
    await queuePrisma.queue.delete({
      where: { id: testEntry.id },
    });
    console.log("✅ Test cleanup successful");

    console.log("🎉 All database operations working correctly!");
  } catch (error) {
    console.error("❌ Database test failed:", error.message);
    console.error("Full error:", error);
  } finally {
    await authPrisma.$disconnect();
    await queuePrisma.$disconnect();
  }
}

testConnections();
