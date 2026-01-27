const { Pool } = require('pg');

async function diagnoseMenu() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('\n=== Diagnosing Menu Issue ===\n');

    // Check environment variables
    console.log('1. Environment Variables:');
    console.log('   TOAST_CLIENT_ID:', process.env.TOAST_CLIENT_ID ? `✓ Set (${process.env.TOAST_CLIENT_ID.substring(0, 10)}...)` : '❌ NOT SET');
    console.log('   TOAST_CLIENT_SECRET:', process.env.TOAST_CLIENT_SECRET ? `✓ Set (${process.env.TOAST_CLIENT_SECRET.substring(0, 10)}...)` : '❌ NOT SET');
    console.log('   TOAST_RESTAURANT_GUID:', process.env.TOAST_RESTAURANT_GUID ? `✓ Set (${process.env.TOAST_RESTAURANT_GUID})` : '❌ NOT SET');
    console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✓ Set' : '❌ NOT SET');

    // Check restaurant record
    console.log('\n2. Database Restaurant Record:');
    const result = await pool.query(
      `SELECT id, name, phone_number, pos_system, pos_credentials
       FROM restaurants
       WHERE phone_number = '+14695178245'`
    );

    if (result.rows.length === 0) {
      console.error('   ❌ No restaurant found with phone number +14695178245');
      process.exit(1);
    }

    const restaurant = result.rows[0];
    console.log('   Restaurant ID:', restaurant.id);
    console.log('   Name:', restaurant.name);
    console.log('   Phone:', restaurant.phone_number);
    console.log('   POS System:', restaurant.pos_system);

    // Parse and display credentials
    console.log('\n3. POS Credentials in Database:');
    let credentials;
    try {
      credentials = typeof restaurant.pos_credentials === 'string'
        ? JSON.parse(restaurant.pos_credentials)
        : restaurant.pos_credentials;

      console.log('   Raw credentials object:', JSON.stringify(credentials, null, 2));
      console.log('\n   Credential Check:');
      console.log('   - toast_client_id:', credentials.toast_client_id ? `✓ Set (${credentials.toast_client_id.substring(0, 10)}...)` : '❌ NOT SET');
      console.log('   - toast_client_secret:', credentials.toast_client_secret ? `✓ Set (${credentials.toast_client_secret.substring(0, 10)}...)` : '❌ NOT SET');
      console.log('   - toast_restaurant_guid:', credentials.toast_restaurant_guid ? `✓ Set (${credentials.toast_restaurant_guid})` : '❌ NOT SET');
      console.log('   - itsacheckmate_api_key:', credentials.itsacheckmate_api_key ? '✓ Set' : '❌ NOT SET');
      console.log('   - itsacheckmate_restaurant_guid:', credentials.itsacheckmate_restaurant_guid ? '✓ Set' : '❌ NOT SET');
    } catch (error) {
      console.error('   ❌ Error parsing credentials:', error.message);
    }

    // Check what condition is failing
    console.log('\n4. Condition Checks (why Toast API might not be used):');
    const posSystemCheck = restaurant.pos_system === 'toast';
    const hasCredentials = !!restaurant.pos_credentials;
    const hasToastClientId = credentials && !!credentials.toast_client_id;
    const hasToastClientSecret = credentials && !!credentials.toast_client_secret;
    const hasToastGuid = credentials && !!credentials.toast_restaurant_guid;

    console.log('   ✓ restaurant.pos_system === "toast":', posSystemCheck ? '✓ PASS' : '❌ FAIL');
    console.log('   ✓ restaurant.pos_credentials exists:', hasCredentials ? '✓ PASS' : '❌ FAIL');
    console.log('   ✓ credentials.toast_client_id exists:', hasToastClientId ? '✓ PASS' : '❌ FAIL');
    console.log('   ✓ credentials.toast_client_secret exists:', hasToastClientSecret ? '✓ PASS' : '❌ FAIL');
    console.log('   ✓ credentials.toast_restaurant_guid exists:', hasToastGuid ? '✓ PASS' : '❌ FAIL');

    const allChecksPass = posSystemCheck && hasCredentials && hasToastClientId && hasToastClientSecret && hasToastGuid;

    console.log('\n5. Final Diagnosis:');
    if (allChecksPass) {
      console.log('   ✅ All checks pass! Toast API should be used.');
      console.log('   If menu still shows old data, the issue might be:');
      console.log('      - Toast API credentials are invalid');
      console.log('      - Toast API is returning an error');
      console.log('      - Application needs to be restarted');
      console.log('      - Check Railway logs for Toast API errors');
    } else {
      console.log('   ❌ Some checks failed. Toast API will NOT be used.');
      console.log('   The system will fall back to database menu.');
      console.log('\n   To fix:');
      if (!posSystemCheck) {
        console.log('   1. Update pos_system to "toast"');
      }
      if (!hasCredentials || !hasToastClientId || !hasToastClientSecret || !hasToastGuid) {
        console.log('   2. Set Railway environment variables:');
        console.log('      - TOAST_CLIENT_ID');
        console.log('      - TOAST_CLIENT_SECRET');
        console.log('      - TOAST_RESTAURANT_GUID');
        console.log('   3. Run: npm run db:update-toast');
        console.log('      OR manually update pos_credentials with Toast API credentials');
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

diagnoseMenu();
