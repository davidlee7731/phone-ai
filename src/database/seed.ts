import { Database } from './client';

async function seed() {
  try {
    console.log('Starting database seeding...');

    await Database.connect();

    // Sample restaurant
    const restaurantResult = await Database.query(
      `INSERT INTO restaurants (name, phone_number, email, address, timezone, business_hours, menu, settings, pos_system, pos_credentials)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (phone_number) DO NOTHING
       RETURNING id`,
      [
        'Demo Restaurant',
        '+15555551234',
        'demo@restaurant.com',
        '123 Main St, New York, NY 10001',
        'America/New_York',
        JSON.stringify({
          monday: { open: '09:00', close: '22:00' },
          tuesday: { open: '09:00', close: '22:00' },
          wednesday: { open: '09:00', close: '22:00' },
          thursday: { open: '09:00', close: '22:00' },
          friday: { open: '09:00', close: '23:00' },
          saturday: { open: '10:00', close: '23:00' },
          sunday: { open: '10:00', close: '21:00' }
        }),
        JSON.stringify({
          categories: [
            {
              name: 'Appetizers',
              items: [
                { id: 'app1', name: 'Mozzarella Sticks', price: 8.99, description: '6 pieces with marinara sauce' },
                { id: 'app2', name: 'Wings', price: 12.99, description: '10 wings with your choice of sauce' }
              ]
            },
            {
              name: 'Entrees',
              items: [
                { id: 'ent1', name: 'Margherita Pizza', price: 14.99, description: 'Fresh mozzarella, basil, tomato sauce' },
                { id: 'ent2', name: 'Chicken Parmesan', price: 16.99, description: 'Breaded chicken with marinara and cheese' },
                { id: 'ent3', name: 'Caesar Salad', price: 10.99, description: 'Romaine, parmesan, croutons, caesar dressing' }
              ]
            },
            {
              name: 'Beverages',
              items: [
                { id: 'bev1', name: 'Soft Drink', price: 2.99, description: 'Coke, Sprite, or Fanta' },
                { id: 'bev2', name: 'Water', price: 1.99, description: 'Bottled water' }
              ]
            }
          ]
        }),
        JSON.stringify({
          greeting: 'Thank you for calling Demo Restaurant! How can I help you today?',
          language: 'en-US',
          acceptOrders: true,
          acceptReservations: false, // Quick-service restaurant - no reservations
          orderLeadTime: 30 // minutes for pickup/delivery
        }),
        'toast', // POS system
        JSON.stringify({
          itsacheckmate_api_key: process.env.ITSACHECKMATE_API_KEY || 'your_itsacheckmate_api_key',
          itsacheckmate_restaurant_guid: process.env.ITSACHECKMATE_RESTAURANT_GUID || 'your_restaurant_guid',
          // Optional: Toast API credentials for real-time availability checking
          toast_api_key: process.env.TOAST_API_KEY || '',
          toast_restaurant_guid: process.env.TOAST_RESTAURANT_GUID || ''
        })
      ]
    );

    if (restaurantResult.rows.length > 0) {
      console.log('Sample restaurant created with ID:', restaurantResult.rows[0].id);
    } else {
      console.log('Sample restaurant already exists');
    }

    console.log('Seeding completed successfully!');

    await Database.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    await Database.disconnect();
    process.exit(1);
  }
}

seed();
