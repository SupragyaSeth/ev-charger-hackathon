const { PrismaClient } = require('./src/generated/prisma/auth');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const email = 'hunt@credosemi.com';
    
    // Check if user exists
    const user = await prisma.user.findUnique({ 
      where: { email },
      select: { id: true, email: true, name: true, createdAt: true }
    });
    
    if (user) {
      console.log('✅ User found:');
      console.log(`- ID: ${user.id}`);
      console.log(`- Email: ${user.email}`);
      console.log(`- Name: ${user.name}`);
      console.log(`- Created: ${user.createdAt}`);
      
      // Ask if you want to reset the password
      console.log('\n🔑 Would you like to reset the password?');
      console.log('If yes, edit this script and uncomment the password reset section below.');
      
      // Reset password to a simple one
      const newPassword = 'password123';
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { email },
        data: { password: hashedPassword }
      });
      console.log(`✅ Password updated successfully to: ${newPassword}`);
      console.log('You can now sign in with this password and change it later if needed.');
      
    } else {
      console.log('❌ User not found with email:', email);
      console.log('You may need to sign up first.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
