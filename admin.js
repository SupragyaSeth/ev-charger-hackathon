const { PrismaClient: QueuePrismaClient } = require('./src/generated/prisma/queue');
const { PrismaClient: AuthPrismaClient } = require('./src/generated/prisma/auth');

async function showMenu() {
  console.log('\n🔧 Database Admin Tool');
  console.log('====================');
  console.log('1. Clear all queue entries');
  console.log('2. Clear only waiting entries (keep charging)');
  console.log('3. Show current database status');
  console.log('4. Reset queue positions');
  console.log('5. Exit');
  console.log('====================');
}

async function showStatus() {
  const queuePrisma = new QueuePrismaClient();
  const authPrisma = new AuthPrismaClient();
  
  try {
    const queueEntries = await queuePrisma.queue.findMany({
      orderBy: [{ chargerId: 'asc' }, { position: 'asc' }]
    });
    
    const users = await authPrisma.user.findMany({
      select: { id: true, name: true, email: true }
    });
    
    console.log('\n📊 Current Database Status:');
    console.log(`Total users: ${users.length}`);
    console.log(`Total queue entries: ${queueEntries.length}`);
    
    const waiting = queueEntries.filter(e => e.status === 'waiting');
    const charging = queueEntries.filter(e => e.status === 'charging');
    const overtime = queueEntries.filter(e => e.status === 'overtime');
    
    console.log(`Waiting: ${waiting.length}`);
    console.log(`Charging: ${charging.length}`);
    console.log(`Overtime: ${overtime.length}`);
    
    if (queueEntries.length > 0) {
      console.log('\nQueue by Charger:');
      for (let i = 1; i <= 8; i++) {
        const chargerEntries = queueEntries.filter(e => e.chargerId === i);
        if (chargerEntries.length > 0) {
          console.log(`  Charger ${i}: ${chargerEntries.map(e => `${e.status}(${e.userId})`).join(', ')}`);
        }
      }
    }
    
    console.log('\nUsers:');
    users.forEach(user => {
      console.log(`  ${user.id}: ${user.name || user.email}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queuePrisma.$disconnect();
    await authPrisma.$disconnect();
  }
}

async function clearAll() {
  const queuePrisma = new QueuePrismaClient();
  
  try {
    const count = await queuePrisma.queue.count();
    if (count === 0) {
      console.log('✅ Database is already empty!');
      return;
    }
    
    const result = await queuePrisma.queue.deleteMany({});
    console.log(`✅ Cleared ${result.count} queue entries`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queuePrisma.$disconnect();
  }
}

async function clearWaiting() {
  const queuePrisma = new QueuePrismaClient();
  
  try {
    const result = await queuePrisma.queue.deleteMany({
      where: { status: 'waiting' }
    });
    console.log(`✅ Cleared ${result.count} waiting entries`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queuePrisma.$disconnect();
  }
}

async function resetPositions() {
  const queuePrisma = new QueuePrismaClient();
  
  try {
    for (let chargerId = 1; chargerId <= 8; chargerId++) {
      const entries = await queuePrisma.queue.findMany({
        where: { chargerId, status: 'waiting' },
        orderBy: { position: 'asc' }
      });
      
      for (let i = 0; i < entries.length; i++) {
        await queuePrisma.queue.update({
          where: { id: entries[i].id },
          data: { position: i + 1 }
        });
      }
    }
    console.log('✅ Reset all queue positions');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queuePrisma.$disconnect();
  }
}

// Simple CLI interface
const args = process.argv.slice(2);
const action = args[0];

async function main() {
  switch (action) {
    case 'clear':
    case '1':
      await clearAll();
      break;
    case 'clear-waiting':
    case '2':
      await clearWaiting();
      break;
    case 'status':
    case '3':
      await showStatus();
      break;
    case 'reset':
    case '4':
      await resetPositions();
      break;
    default:
      await showMenu();
      console.log('\nUsage: node admin.js [action]');
      console.log('Actions: clear, clear-waiting, status, reset');
      console.log('Or just run: node admin.js');
      break;
  }
}

main().catch(console.error);
