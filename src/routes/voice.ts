import express from 'express';
import { BlandService } from '../services/bland';
import { CallService } from '../services/calls';

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
