const { Pool } = require('pg');

async function updateToastCredentials() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('\n=== Updating Toast API Credentials ===\n');

    // Check if env vars are set
    const toastClientId = process.env.TOAST_CLIENT_ID;
    const toastClientSecret = process.env.TOAST_CLIENT_SECRET;
    const toastRestaurantGuid = process.env.TOAST_RESTAURANT_GUID;

    if (!toastClientId || !toastClientSecret || !toastRestaurantGuid) {
      console.error('❌ Toast API credentials not found in environment variables');
      console.log('\nMake sure these are set in Railway:');
      console.log('- TOAST_CLIENT_ID');
      console.log('- TOAST_CLIENT_SECRET');
      console.log('- TOAST_RESTAURANT_GUID');
      process.exit(1);
    }

    console.log('✓ Found Toast API credentials in environment variables');

    // Update the restaurant
    const result = await pool.query(
      `UPDATE restaurants
       SET pos_credentials = jsonb_set(
         jsonb_set(
           jsonb_set(
             COALESCE(pos_credentials, '{}'::jsonb),
             '{toast_client_id}',
             $1
           ),
           '{toast_client_secret}',
           $2
         ),
         '{toast_restaurant_guid}',
         $3
       )
       WHERE phone_number = '+14695178245'
       RETURNING id, name, phone_number`,
      [JSON.stringify(toastClientId), JSON.stringify(toastClientSecret), JSON.stringify(toastRestaurantGuid)]
    );

    if (result.rows.length === 0) {
      console.error('❌ No restaurant found with phone number +14695178245');
      process.exit(1);
    }

    const restaurant = result.rows[0];
    console.log(`\n✓ Updated restaurant: ${restaurant.name} (${restaurant.phone_number})`);
    console.log('  - Toast Client ID: Set');
    console.log('  - Toast Client Secret: Set');
    console.log('  - Toast Restaurant GUID: Set');

    console.log('\n=== Verification ===\n');

    // Verify the update
    const verifyResult = await pool.query(
      "SELECT pos_credentials FROM restaurants WHERE phone_number = '+14695178245'"
    );

    const credentials = verifyResult.rows[0].pos_credentials;
    console.log('Current credentials:');
    console.log('- Itsacheckmate API Key:', credentials.itsacheckmate_api_key ? '✓ Set' : '✗ Not set');
    console.log('- Itsacheckmate Restaurant GUID:', credentials.itsacheckmate_restaurant_guid ? '✓ Set' : '✗ Not set');
    console.log('- Toast Client ID:', credentials.toast_client_id ? '✓ Set' : '✗ Not set');
    console.log('- Toast Client Secret:', credentials.toast_client_secret ? '✓ Set' : '✗ Not set');
    console.log('- Toast Restaurant GUID:', credentials.toast_restaurant_guid ? '✓ Set' : '✗ Not set');

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

updateToastCredentials();
