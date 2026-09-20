import { prisma } from './src/lib/prisma';

async function test() {
  const affiliate = await prisma.affiliate.findUnique({
    where: { userEmail: 'main.belkdigital@gmail.com' },
  });
  
  if (!affiliate) {
    console.log('Affiliate not found');
    return;
  }
  
  console.log('Found affiliate:', affiliate.id);
  
  try {
    const updated = await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        status: 'suspended',
        suspendReason: 'Suspended by admin via Quick Actions'
      }
    });
    console.log('Updated successfully:', updated.status);
  } catch (err: any) {
    console.error('Update failed:', err.message);
  }
}

test().catch(console.error);
