const { Pool } = require('pg');

async function checkRestaurant() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const result = await pool.query(
      "SELECT id, name, phone_number, pos_system, pos_credentials FROM restaurants WHERE phone_number = '+14695178245'"
    );

    if (result.rows.length === 0) {
      console.log('No restaurant found with phone number +14695178245');
      return;
    }

    const restaurant = result.rows[0];
    console.log('\n=== Restaurant Configuration ===\n');
    console.log('ID:', restaurant.id);
    console.log('Name:', restaurant.name);
    console.log('Phone:', restaurant.phone_number);
    console.log('POS System:', restaurant.pos_system);
    console.log('\nPOS Credentials:');

    const credentials = typeof restaurant.pos_credentials === 'string'
      ? JSON.parse(restaurant.pos_credentials)
      : restaurant.pos_credentials;

    console.log('- Itsacheckmate API Key:', credentials.itsacheckmate_api_key ? '✓ Set' : '✗ Not set');
    console.log('- Itsacheckmate Restaurant GUID:', credentials.itsacheckmate_restaurant_guid ? '✓ Set' : '✗ Not set');
    console.log('- Toast API Key:', credentials.toast_api_key ? '✓ Set' : '✗ Not set');
    console.log('- Toast Restaurant GUID:', credentials.toast_restaurant_guid ? '✓ Set' : '✗ Not set');

    console.log('\n=== Diagnosis ===\n');

    if (!credentials.toast_api_key || !credentials.toast_restaurant_guid) {
      console.log('❌ Toast API credentials are NOT configured');
      console.log('   → The menu endpoint will fall back to the database menu');
      console.log('\nTo fix this:');
      console.log('1. Add TOAST_API_KEY and TOAST_RESTAURANT_GUID to Railway environment variables');
      console.log('2. Run: npm run db:seed (to update the restaurant with env vars)');
      console.log('   OR manually update the database with the SQL below\n');
    } else {
      console.log('✓ Toast API credentials are configured');
      console.log('  → The menu should be fetched from Toast API');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkRestaurant();
