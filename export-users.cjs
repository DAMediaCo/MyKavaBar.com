const { db } = require('./server/db/index.js');
const fs = require('fs');

(async () => {
  try {
    const users = await db.select().from('users');
    const data = users.map(u => ({
      id: u.id,
      email: u.email,
      username: u.username,
      password: u.password,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone_number,
      created_at: u.created_at
    }));
    
    if (!fs.existsSync('./replit-exports')) {
      fs.mkdirSync('./replit-exports');
    }
    
    fs.writeFileSync('./replit-exports/users.json', JSON.stringify(data, null, 2));
    fs.writeFileSync('./replit-exports/_summary.json', JSON.stringify({
      exportDate: new Date().toISOString(),
      stats: { users: data.length }
    }, null, 2));
    
    console.log('✅ Exported ' + data.length + ' users');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
})();
