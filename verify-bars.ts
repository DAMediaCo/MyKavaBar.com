import { db } from '@db';
import { kavaBars } from '@db/schema';
import { eq } from 'drizzle-orm';

async function verifyBars() {
  const missingPlaceIds = [
    'ChIJK7aepRsG2YgRCXHB63USFeA', // Vapor Buy + CBD + Smoke + Kratom + Kava
    'ChIJxwlPNV8H2YgRbGNSQVZDfJ0'  // Davie Kava
  ];

  console.log('Verifying the existence of restored bars...');
  
  for (const placeId of missingPlaceIds) {
    const bar = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      verificationStatus: kavaBars.verificationStatus
    })
    .from(kavaBars)
    .where(eq(kavaBars.placeId, placeId));
    
    if (bar.length > 0) {
      console.log(`Found bar: ${bar[0].name} (ID: ${bar[0].id}) - Status: ${bar[0].verificationStatus}`);
    } else {
      console.log(`Bar with placeId ${placeId} not found!`);
    }
  }
}

verifyBars().catch(console.error);
