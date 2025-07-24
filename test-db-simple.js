const { PrismaClient } = require("./src/generated/prisma/queue/client");

async function testConnection() {
  const queuePrisma = new PrismaClient();

  try {
    console.log("Testing queue database connection...");

    // Try to query the Queue table
    const queueCount = await queuePrisma.queue.count();
    console.log(
      `✅ Successfully connected to queue database. Current queue entries: ${queueCount}`
    );

    // Try to create a test entry (and then delete it)
    console.log("Testing write permissions...");
    const testEntry = await queuePrisma.queue.create({
      data: {
        userId: 999,
        chargerId: 1,
        position: 999,
        status: "waiting",
      },
    });
    console.log("✅ Successfully created test entry");

    // Delete the test entry
    await queuePrisma.queue.delete({
      where: { id: testEntry.id },
    });
    console.log("✅ Successfully deleted test entry");

    console.log(
      "🎉 Database connection and write permissions are working correctly!"
    );
  } catch (error) {
    console.error("❌ Database connection test failed:", error);
  } finally {
    await queuePrisma.$disconnect();
  }
}

testConnection();
