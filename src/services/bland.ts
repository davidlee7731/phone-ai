import axios from 'axios';
import { Database } from '../database/client';

const BLAND_API_KEY = process.env.BLAND_API_KEY!;
const BLAND_API_URL = 'https://api.bland.ai/v1';

interface BlandCallParams {
  phone_number: string;
  task?: string;
  pathway_id?: string;
  voice?: string;
  max_duration?: number;
  webhook?: string;
  from?: string;
}

interface Restaurant {
  id: string;
  name: string;
  phone_number: string;
  address: string;
  menu: any;
  settings: any;
}

class BlandServiceClass {
  private apiClient = axios.create({
    baseURL: BLAND_API_URL,
    headers: {
      'Authorization': BLAND_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  /**
   * Generate AI task instructions for a restaurant
   */
  private generateTaskInstructions(restaurant: Restaurant): string {
    const menu = typeof restaurant.menu === 'string'
      ? JSON.parse(restaurant.menu)
      : restaurant.menu;

    const settings = typeof restaurant.settings === 'string'
      ? JSON.parse(restaurant.settings)
      : restaurant.settings;

    const menuText = this.formatMenuForAI(menu);

    return `You are an AI phone assistant for ${restaurant.name}, a quick-service restaurant.

IMPORTANT: We are a quick-service restaurant - we do NOT take reservations or have table service. We only handle takeout and delivery orders.

Your role:
1. Take food orders for pickup or delivery
2. Answer questions about menu items, hours, and location
3. Process payments over the phone
4. Provide excellent customer service

Restaurant Information:
- Name: ${restaurant.name}
- Address: ${restaurant.address}
- Phone: ${restaurant.phone_number}

${menuText}

Order Process:
1. Greet the customer warmly: "${settings.greeting || `Thank you for calling ${restaurant.name}! How can I help you today?`}"
2. Take their order, confirming each item and quantity
3. Ask if it's for pickup or delivery
4. If delivery, get their address
5. Repeat the complete order back to confirm
6. Provide total price
7. Ask for payment information
8. Confirm estimated ready time (${settings.orderLeadTime || 30} minutes)
9. Thank them and end the call

Important Guidelines:
- Be friendly, professional, and concise
- Speak naturally like a real person
- Confirm order details to ensure accuracy
- If asked about reservations or dine-in, politely explain we're a quick-service restaurant and only offer pickup/delivery
- For questions about allergens, provide information from the menu
- If you don't know something, offer to transfer them or have someone call back
- Keep the conversation moving - this is a phone call, not a chat

Payment:
- Let customers know we accept credit/debit cards over the phone
- For security, don't repeat card numbers back
- Confirm the payment went through

Remember: You're representing ${restaurant.name}. Be helpful and make ordering easy!`;
  }

  private formatMenuForAI(menu: any): string {
    if (!menu || !menu.categories) return '';

    let menuText = 'MENU:\n\n';

    for (const category of menu.categories) {
      menuText += `${category.name}:\n`;
      for (const item of category.items) {
        menuText += `- ${item.name} - $${item.price.toFixed(2)}`;
        if (item.description) {
          menuText += ` (${item.description})`;
        }
        menuText += '\n';
      }
      menuText += '\n';
    }

    return menuText;
  }

  /**
   * Make an outbound call using Bland.ai
   */
  async makeOutboundCall(params: BlandCallParams) {
    try {
      const response = await this.apiClient.post('/calls', params);
      return response.data;
    } catch (error: any) {
      console.error('Error making Bland.ai call:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get task instructions for a restaurant to use with inbound calls
   */
  async getRestaurantTask(phoneNumber: string): Promise<string> {
    // Get restaurant from database
    const result = await Database.query(
      'SELECT * FROM restaurants WHERE phone_number = $1',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      throw new Error(`No restaurant found for number ${phoneNumber}`);
    }

    const restaurant = result.rows[0];
    return this.generateTaskInstructions(restaurant);
  }

  /**
   * Handle webhook from Bland.ai after call completes
   */
  async handleCallWebhook(webhookData: any) {
    try {
      // Bland.ai can send different field names depending on the event
      const callId = webhookData.call_id || webhookData.c_id;
      const toNumber = webhookData.to || webhookData.to_number;
      const fromNumber = webhookData.from || webhookData.from_number;
      const callStatus = webhookData.status || webhookData.call_status || 'completed';
      const callDuration = webhookData.call_length || webhookData.duration || 0;
      const callTranscript = webhookData.concatenated_transcript || webhookData.transcript || '';

      console.log(`Bland.ai webhook received:`, {
        callId,
        toNumber,
        fromNumber,
        callStatus,
        callDuration,
        hasTranscript: !!callTranscript
      });

      // If no call_id, this might be a test webhook or different event type
      if (!callId) {
        console.warn('No call_id in webhook, skipping database insert:', webhookData);
        return { success: true, message: 'Webhook received but no call_id present' };
      }

      // Save or update call in database
      await Database.query(
        `INSERT INTO calls (call_sid, from_number, to_number, status, duration, transcript, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (call_sid)
         DO UPDATE SET
           status = $4,
           duration = $5,
           transcript = $6,
           ended_at = NOW()`,
        [callId, fromNumber, toNumber, callStatus, callDuration, callTranscript]
      );

      // Parse transcript for analytics if available
      if (callTranscript) {
        await this.analyzeCallTranscript(callId, callTranscript);
      }

      return { success: true, call_id: callId };
    } catch (error) {
      console.error('Error handling Bland.ai webhook:', error);
      throw error;
    }
  }

  /**
   * Analyze call transcript for insights
   */
  private async analyzeCallTranscript(callId: string, transcript: string) {
    try {
      // Simple keyword-based intent detection
      const lowerTranscript = transcript.toLowerCase();

      let intent = 'question';
      if (lowerTranscript.includes('order') || lowerTranscript.includes('delivery') || lowerTranscript.includes('pickup')) {
        intent = 'order';
      } else if (lowerTranscript.includes('reservation') || lowerTranscript.includes('table')) {
        intent = 'reservation';
      } else if (lowerTranscript.includes('complaint') || lowerTranscript.includes('problem')) {
        intent = 'complaint';
      }

      // Update call record with detected intent
      await Database.query(
        'UPDATE calls SET intent = $1 WHERE call_sid = $2',
        [intent, callId]
      );

      console.log(`Call ${callId} intent detected: ${intent}`);
    } catch (error) {
      console.error('Error analyzing transcript:', error);
    }
  }

  /**
   * Get call details from Bland.ai
   */
  async getCallDetails(callId: string) {
    try {
      const response = await this.apiClient.get(`/calls/${callId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting call details:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const BlandService = new BlandServiceClass();
