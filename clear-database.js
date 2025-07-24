const { PrismaClient: QueuePrismaClient } = require('./src/generated/prisma/queue');

async function clearDatabase() {
  const queuePrisma = new QueuePrismaClient();
  
  try {
    console.log('🗑️  Clearing database...');
    
    // Get current count
    const currentCount = await queuePrisma.queue.count();
    console.log(`Current queue entries: ${currentCount}`);
    
    if (currentCount === 0) {
      console.log('✅ Database is already empty!');
      return;
    }
    
    // Clear all entries
    const result = await queuePrisma.queue.deleteMany({});
    console.log(`✅ Successfully deleted ${result.count} queue entries`);
    
    // Verify it's empty
    const finalCount = await queuePrisma.queue.count();
    console.log(`Final queue entries: ${finalCount}`);
    
    console.log('🎉 Database cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await queuePrisma.$disconnect();
  }
}

clearDatabase();
