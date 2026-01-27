import express from 'express';
import { BlandService } from '../services/bland';
import { CallService } from '../services/calls';
import { ToastService } from '../services/toast';
import { Database } from '../database/client';

export const voiceRouter = express.Router();

// Webhook endpoint for Bland.ai to send call events
voiceRouter.post('/bland-webhook', async (req, res) => {
  try {
    console.log('Received Bland.ai webhook:', JSON.stringify(req.body, null, 2));

    const result = await BlandService.handleCallWebhook(req.body);

    res.json(result);
  } catch (error) {
    console.error('Error handling Bland.ai webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Endpoint to get task instructions for a phone number (without menu)
// This can be used by Bland.ai to fetch dynamic prompts
voiceRouter.get('/task/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const task = await BlandService.getRestaurantTask(phoneNumber);

    // If requesting as plain text (for copy-paste), return text
    if (req.query.format === 'text') {
      res.type('text/plain').send(task);
    } else {
      // Otherwise return JSON (for Bland.ai API consumption)
      res.json({ task });
    }
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Endpoint to get menu for a phone number (for Bland.ai knowledge base)
voiceRouter.get('/menu/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const menu = await BlandService.getRestaurantMenu(phoneNumber);

    // If requesting as plain text (for Bland.ai knowledge base), return formatted text
    if (req.query.format === 'text') {
      res.type('text/plain').send(menu);
    } else {
      // Otherwise return JSON
      res.json({ menu });
    }
  } catch (error) {
    console.error('Error getting menu:', error);
    res.status(500).json({ error: 'Failed to get menu' });
  }
});

// Webhook endpoint for Toast menu updates
// Toast will call this when a restaurant publishes menu changes
voiceRouter.post('/toast-menu-webhook', async (req, res) => {
  try {
    console.log('Received Toast menu webhook:', JSON.stringify(req.body, null, 2));

    const { eventType, details } = req.body;

    const { restaurantGuid, publishedDate } = details

    // Verify this is a menu update event
    if (eventType !== 'menus_updated') {
      console.warn(`Unexpected Toast event type: ${eventType}`);
      return res.sendStatus(200);
    }

    if (!restaurantGuid) {
      console.error('No restaurantGuid in Toast webhook');
      return res.status(400).json({ error: 'Missing restaurantGuid' });
    }

    console.log(`Menu updated for restaurant ${restaurantGuid} at ${publishedDate}`);

    // Find the restaurant in our database
    const result = await Database.query(
      'SELECT id, name, pos_credentials FROM restaurants WHERE pos_credentials->\'toast_restaurant_guid\' = $1',
      [JSON.stringify(restaurantGuid)]
    );

    if (result.rows.length === 0) {
      console.warn(`Restaurant with Toast GUID ${restaurantGuid} not found in database`);
      return res.sendStatus(200);
    }

    const restaurant = result.rows[0];
    console.log(`Found restaurant: ${restaurant.name} (ID: ${restaurant.id})`);

    // Parse credentials
    const credentials = typeof restaurant.pos_credentials === 'string'
      ? JSON.parse(restaurant.pos_credentials)
      : restaurant.pos_credentials;

    // Check if we have the necessary credentials
    if (!credentials.toast_client_id || !credentials.toast_client_secret) {
      console.error(`Restaurant ${restaurant.id} missing Toast credentials for API access`);
      return res.sendStatus(200);
    }

    // Clear Toast API cache for this restaurant
    ToastService.clearCache(restaurantGuid);
    console.log(`Cleared Toast API cache for ${restaurantGuid}`);

    // Optionally: fetch and cache the new menu immediately (warm the cache)
    try {
      console.log('Fetching updated menu from Toast API...');
      const newMenu = await ToastService.getRestaurantMenu(
        restaurantGuid,
        credentials.toast_client_id,
        credentials.toast_client_secret
      );
      console.log(`✓ Successfully fetched updated menu with ${newMenu.menus?.length || 0} menus`);
    } catch (error) {
      console.error('Error pre-fetching updated menu:', error);
      // Don't fail the webhook - the menu will be fetched on next request
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling Toast menu webhook:', error);
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

// Handle call status updates (kept for compatibility if needed)
voiceRouter.post('/status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    console.log(`Call status update: ${CallSid} - ${CallStatus}`);

    await CallService.updateCallStatus(CallSid, {
      status: CallStatus,
      duration: CallDuration ? parseInt(CallDuration) : undefined,
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling call status:', error);
    res.sendStatus(500);
  }
});
