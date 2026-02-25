import { pool, runMigrations } from '../src/schema.js';
import bcrypt from 'bcryptjs';

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding database...');
    
    // Seed Achievements
    const achievements = [
      {
        key: 'first_checkin',
        title: 'First Steps',
        description: 'Complete your first check-in',
        icon: 'footsteps',
        category: 'explorer',
        requirement: JSON.stringify({ total_checkins: 1 }),
        shell_reward: 10,
      },
      {
        key: 'explorer_5',
        title: 'Local Explorer',
        description: 'Visit 5 different kava bars',
        icon: 'map',
        category: 'explorer',
        requirement: JSON.stringify({ unique_bars: 5 }),
        shell_reward: 50,
      },
      {
        key: 'explorer_10',
        title: 'Bar Hopper',
        description: 'Visit 10 different kava bars',
        icon: 'compass',
        category: 'explorer',
        requirement: JSON.stringify({ unique_bars: 10 }),
        shell_reward: 100,
      },
      {
        key: 'explorer_25',
        title: 'Kava Connoisseur',
        description: 'Visit 25 different kava bars',
        icon: 'star',
        category: 'explorer',
        requirement: JSON.stringify({ unique_bars: 25 }),
        shell_reward: 250,
      },
      {
        key: 'streak_3',
        title: 'Consistent',
        description: 'Maintain a 3-day check-in streak',
        icon: 'flame',
        category: 'streak',
        requirement: JSON.stringify({ streak: 3 }),
        shell_reward: 30,
      },
      {
        key: 'streak_7',
        title: 'Weekly Regular',
        description: 'Maintain a 7-day check-in streak',
        icon: 'fire',
        category: 'streak',
        requirement: JSON.stringify({ streak: 7 }),
        shell_reward: 75,
      },
      {
        key: 'streak_30',
        title: 'Month Master',
        description: 'Maintain a 30-day check-in streak',
        icon: 'trophy',
        category: 'streak',
        requirement: JSON.stringify({ streak: 30 }),
        shell_reward: 300,
      },
      {
        key: 'checkin_10',
        title: 'Getting Started',
        description: 'Complete 10 check-ins',
        icon: 'check-circle',
        category: 'checkins',
        requirement: JSON.stringify({ total_checkins: 10 }),
        shell_reward: 25,
      },
      {
        key: 'checkin_50',
        title: 'Regular Patron',
        description: 'Complete 50 check-ins',
        icon: 'award',
        category: 'checkins',
        requirement: JSON.stringify({ total_checkins: 50 }),
        shell_reward: 100,
      },
      {
        key: 'checkin_100',
        title: 'Kava Enthusiast',
        description: 'Complete 100 check-ins',
        icon: 'medal',
        category: 'checkins',
        requirement: JSON.stringify({ total_checkins: 100 }),
        shell_reward: 250,
      },
    ];
    
    for (const a of achievements) {
      await client.query(
        `INSERT INTO achievements (key, title, description, icon, category, requirement, shell_reward)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (key) DO NOTHING`,
        [a.key, a.title, a.description, a.icon, a.category, a.requirement, a.shell_reward]
      );
    }
    console.log('✓ Seeded achievements');
    
    // Seed Missions
    const missions = [
      {
        title: 'Daily Explorer',
        description: 'Check in at any bar today',
        mission_type: 'daily',
        criteria: JSON.stringify({ checkins: 1 }),
        shell_reward: 15,
      },
      {
        title: 'Weekly Wanderer',
        description: 'Check in 3 times this week',
        mission_type: 'weekly',
        criteria: JSON.stringify({ checkins: 3 }),
        shell_reward: 50,
      },
      {
        title: 'New Bar Discovery',
        description: 'Visit a bar you\'ve never been to',
        mission_type: 'special',
        criteria: JSON.stringify({ unique_bars: 1 }),
        shell_reward: 25,
      },
      {
        title: 'Triple Threat',
        description: 'Check in at 3 different bars',
        mission_type: 'weekly',
        criteria: JSON.stringify({ unique_bars: 3 }),
        shell_reward: 75,
      },
    ];
    
    for (const m of missions) {
      await client.query(
        `INSERT INTO missions (title, description, mission_type, criteria, shell_reward, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT DO NOTHING`,
        [m.title, m.description, m.mission_type, m.criteria, m.shell_reward]
      );
    }
    console.log('✓ Seeded missions');
    
    // Create test user
    const passwordHash = await bcrypt.hash('password123', 10);
    await client.query(
      `INSERT INTO users (email, username, password_hash, shells)
       VALUES ($1, $2, $3, 10)
       ON CONFLICT (email) DO NOTHING`,
      ['test@mykavabar.com', 'testuser', passwordHash]
    );
    console.log('✓ Created test user');
    
    console.log('✅ Seed complete!');
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Export for use in migrations
export { seed };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed();
}
