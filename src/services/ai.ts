import { EventEmitter } from 'events';
import OpenAI from 'openai';
import { Database } from '../database/client';
import { OrderService } from './orders';
import { ReservationService } from './reservations';
import { PaymentService } from './payments';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface AIServiceConfig {
  callSid: string;
  restaurant: any;
  customerPhone: string;
}

export class AIService extends EventEmitter {
  private callSid: string;
  private restaurant: any;
  private customerPhone: string;
  private conversationHistory: any[] = [];
  private currentIntent: string | null = null;
  private orderContext: any = {};
  private reservationContext: any = {};
  private customerId: string | null = null;

  constructor(config: AIServiceConfig) {
    super();
    this.callSid = config.callSid;
    this.restaurant = config.restaurant;
    this.customerPhone = config.customerPhone;
  }

  async initialize() {
    // Get or create customer
    const customerResult = await Database.query(
      `INSERT INTO customers (restaurant_id, phone_number)
       VALUES ($1, $2)
       ON CONFLICT (restaurant_id, phone_number)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [this.restaurant.id, this.customerPhone]
    );

    this.customerId = customerResult.rows[0].id;

    // Start conversation with greeting
    const greeting = this.restaurant.settings?.greeting ||
      `Thank you for calling ${this.restaurant.name}! How can I help you today?`;

    await this.speak(greeting);
  }

  async processAudio(audioBuffer: Buffer) {
    try {
      // Transcribe audio using Whisper
      const transcription = await this.transcribeAudio(audioBuffer);

      if (!transcription || transcription.trim().length === 0) {
        return;
      }

      console.log(`Customer said: ${transcription}`);

      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: transcription,
      });

      // Process with GPT to understand intent and generate response
      const response = await this.generateResponse(transcription);

      console.log(`AI response: ${response.text}`);

      // Execute any actions
      if (response.action) {
        await this.executeAction(response.action);
      }

      // Speak the response
      await this.speak(response.text);

      // Emit transcript update
      this.emit('transcript', this.formatTranscript());
    } catch (error) {
      console.error('Error processing audio:', error);
      await this.speak("I'm sorry, I didn't catch that. Could you please repeat?");
    }
  }

  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    // Note: In production, you'd use OpenAI Realtime API which handles this automatically
    // This is a placeholder for the standard Whisper API approach

    // For now, return empty - in real implementation:
    // 1. Use OpenAI Realtime API (recommended) - handles STT, conversation, TTS in one
    // 2. Or use Whisper API with proper audio format conversion

    return '';
  }

  private async generateResponse(userInput: string): Promise<{ text: string; action?: any }> {
    // Build system prompt with restaurant context
    const systemPrompt = this.buildSystemPrompt();

    // Call GPT-4 with conversation history
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
      ],
      functions: this.getFunctionDefinitions(),
      function_call: 'auto',
    });

    const message = completion.choices[0].message;

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: message.content || '',
    });

    // Check if function call was made
    if (message.function_call) {
      const functionResult = await this.handleFunctionCall(
        message.function_call.name,
        JSON.parse(message.function_call.arguments)
      );

      return functionResult;
    }

    return {
      text: message.content || "I'm sorry, I didn't understand that.",
    };
  }

  private buildSystemPrompt(): string {
    const menu = JSON.stringify(this.restaurant.menu, null, 2);
    const settings = this.restaurant.settings || {};

    return `You are an AI phone assistant for ${this.restaurant.name}.

Your role is to:
1. Take food orders for pickup or delivery
2. Book reservations
3. Answer questions about the menu, hours, and location
4. Process payments securely
5. Provide excellent customer service

Restaurant Information:
- Name: ${this.restaurant.name}
- Address: ${this.restaurant.address}
- Phone: ${this.restaurant.phone_number}

Menu:
${menu}

Guidelines:
- Be friendly, professional, and concise
- Confirm all order details before processing payment
- For reservations, confirm date, time, party size, and contact info
- If you detect an intent (order, reservation, question), use the appropriate function
- Always repeat back orders to confirm accuracy
- Keep responses brief and natural, like a real phone conversation
- If asked about allergens or ingredients, provide accurate information from the menu

Current conversation intent: ${this.currentIntent || 'unknown'}
`;
  }

  private getFunctionDefinitions() {
    return [
      {
        name: 'detect_intent',
        description: 'Detect the customer intent (order, reservation, question, complaint)',
        parameters: {
          type: 'object',
          properties: {
            intent: {
              type: 'string',
              enum: ['order', 'reservation', 'question', 'complaint', 'other'],
            },
          },
          required: ['intent'],
        },
      },
      {
        name: 'add_item_to_order',
        description: 'Add an item to the current order',
        parameters: {
          type: 'object',
          properties: {
            itemId: { type: 'string' },
            itemName: { type: 'string' },
            quantity: { type: 'number' },
            price: { type: 'number' },
            specialInstructions: { type: 'string' },
          },
          required: ['itemId', 'itemName', 'quantity', 'price'],
        },
      },
      {
        name: 'confirm_order',
        description: 'Confirm the order and proceed to payment',
        parameters: {
          type: 'object',
          properties: {
            orderType: {
              type: 'string',
              enum: ['pickup', 'delivery'],
            },
            deliveryAddress: { type: 'string' },
          },
          required: ['orderType'],
        },
      },
      {
        name: 'create_reservation',
        description: 'Create a reservation',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            time: { type: 'string' },
            partySize: { type: 'number' },
            customerName: { type: 'string' },
            specialRequests: { type: 'string' },
          },
          required: ['date', 'time', 'partySize', 'customerName'],
        },
      },
    ];
  }

  private async handleFunctionCall(functionName: string, args: any): Promise<{ text: string; action?: any }> {
    switch (functionName) {
      case 'detect_intent':
        this.currentIntent = args.intent;
        this.emit('intent_detected', args.intent);
        return { text: 'How can I help you with that?' };

      case 'add_item_to_order':
        if (!this.orderContext.items) {
          this.orderContext.items = [];
        }
        this.orderContext.items.push(args);
        return {
          text: `I've added ${args.quantity} ${args.itemName} to your order. Anything else?`,
        };

      case 'confirm_order':
        const orderSummary = this.generateOrderSummary();
        this.orderContext.orderType = args.orderType;
        if (args.deliveryAddress) {
          this.orderContext.deliveryAddress = args.deliveryAddress;
        }
        return {
          text: `Great! Your order is: ${orderSummary}. I'll need your credit card information to complete the order.`,
          action: { type: 'collect_payment' },
        };

      case 'create_reservation':
        const reservation = await ReservationService.createReservation({
          restaurantId: this.restaurant.id,
          customerId: this.customerId!,
          callId: await this.getCallId(),
          date: args.date,
          time: args.time,
          partySize: args.partySize,
          customerName: args.customerName,
          customerPhone: this.customerPhone,
          specialRequests: args.specialRequests,
        });

        return {
          text: `Perfect! I've booked a table for ${args.partySize} on ${args.date} at ${args.time}. Your reservation number is ${reservation.reservation_number}. We'll send you a confirmation via text.`,
          action: { type: 'send_confirmation', reservationId: reservation.id },
        };

      default:
        return { text: "I'm not sure how to help with that." };
    }
  }

  private async executeAction(action: any) {
    switch (action.type) {
      case 'collect_payment':
        // In a real implementation, you'd collect payment info securely
        // For now, we'll simulate successful payment
        const order = await OrderService.createOrder({
          restaurantId: this.restaurant.id,
          customerId: this.customerId!,
          callId: await this.getCallId(),
          items: this.orderContext.items,
          orderType: this.orderContext.orderType,
          deliveryAddress: this.orderContext.deliveryAddress,
        });

        await this.speak(`Your order has been placed successfully. Your order number is ${order.order_number}. We'll have it ready in about 30 minutes. Thank you!`);
        break;

      case 'send_confirmation':
        // Send SMS confirmation
        break;
    }
  }

  private generateOrderSummary(): string {
    const items = this.orderContext.items || [];
    return items.map((item: any) => `${item.quantity} ${item.itemName}`).join(', ');
  }

  private async speak(text: string) {
    // Convert text to speech using OpenAI TTS
    const audioBuffer = await this.textToSpeech(text);

    // Emit audio to be sent back to Twilio
    this.emit('audio', audioBuffer);
  }

  private async textToSpeech(text: string): Promise<Buffer> {
    // Note: In production with OpenAI Realtime API, this is handled automatically
    // This is a placeholder for the standard TTS API approach

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  }

  private formatTranscript(): string {
    return this.conversationHistory
      .map((msg) => `${msg.role === 'user' ? 'Customer' : 'AI'}: ${msg.content}`)
      .join('\n');
  }

  private async getCallId(): Promise<string> {
    const result = await Database.query(
      'SELECT id FROM calls WHERE call_sid = $1',
      [this.callSid]
    );
    return result.rows[0]?.id;
  }

  async cleanup() {
    // Save final transcript
    const transcript = this.formatTranscript();
    await Database.query(
      'UPDATE calls SET transcript = $1, ended_at = NOW() WHERE call_sid = $2',
      [transcript, this.callSid]
    );

    // Clear conversation history
    this.conversationHistory = [];
    this.orderContext = {};
    this.reservationContext = {};
  }
}
