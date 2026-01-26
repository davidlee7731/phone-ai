const { Pool } = require('pg');

async function fixPosSystem() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('\n=== Fixing POS System Field ===\n');

    // Update the restaurant to set pos_system to 'toast'
    const result = await pool.query(
      `UPDATE restaurants
       SET pos_system = 'toast'
       WHERE phone_number = '+14695178245'
       RETURNING id, name, phone_number, pos_system`,
    );

    if (result.rows.length === 0) {
      console.error('❌ No restaurant found with phone number +14695178245');
      process.exit(1);
    }

    const restaurant = result.rows[0];
    console.log(`✓ Updated restaurant: ${restaurant.name} (${restaurant.phone_number})`);
    console.log(`  - POS System: ${restaurant.pos_system}`);

    console.log('\n✅ Done! The menu endpoint should now fetch from Toast API.');
    console.log('\nTest it:');
    console.log('curl https://phone-ai-production.up.railway.app/voice/menu/+14695178245?format=text');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixPosSystem();
