import { db } from '@db';
import { kavaBars } from '@db/schema';
import { eq } from 'drizzle-orm';

async function verifyBarsExist() {
  const targetBars = [
    {
      name: 'Vapor Buy + CBD + Smoke + Kratom + Kava',
      placeId: 'ChIJK7aepRsG2YgRCXHB63USFeA'
    },
    {
      name: 'Davie Kava',
      placeId: 'ChIJxwlPNV8H2YgRbGNSQVZDfJ0'
    }
  ];
  
  console.log('=== Broward & Palm Beach Kava Bar Status Report ===');
  
  for (const bar of targetBars) {
    const result = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      verificationStatus: kavaBars.verificationStatus
    })
    .from(kavaBars)
    .where(eq(kavaBars.placeId, bar.placeId));
    
    if (result.length > 0) {
      console.log(`✅ Found: ${bar.name}`);
      console.log(`   ID: ${result[0].id}`);
      console.log(`   Address: ${result[0].address}`);
      console.log(`   Status: ${result[0].verificationStatus}`);
    } else {
      console.log(`❌ Missing: ${bar.name}`);
    }
    console.log('---');
  }
  
  // Count all Broward and Palm Beach bars
  const allBars = await db.select({
    id: kavaBars.id,
    address: kavaBars.address
  })
  .from(kavaBars);
  
  const browardPalmBeachBars = allBars.filter(bar => {
    if (!bar.address) return false;
    const addr = bar.address.toLowerCase();
    return addr.includes('broward') || 
           addr.includes('fort lauderdale') || 
           addr.includes('pompano') ||
           addr.includes('deerfield') ||
           addr.includes('palm beach') ||
           addr.includes('boca raton') ||
           addr.includes('delray') || 
           addr.includes('boynton');
  });
  
  console.log(`Total Broward/Palm Beach bars: ${browardPalmBeachBars.length}`);
}

verifyBarsExist().catch(console.error);
