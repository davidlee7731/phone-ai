import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { Database } from '../database/client';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

interface RealtimeServiceConfig {
  callSid: string;
  restaurant: any;
  customerPhone: string;
}

export class OpenAIRealtimeService extends EventEmitter {
  private callSid: string;
  private restaurant: any;
  private customerPhone: string;
  private ws: WebSocket | null = null;
  private isReady: boolean = false;
  private customerId: string | null = null;
  private conversationId: string | null = null;
  private audioBuffer: Buffer[] = [];

  constructor(config: RealtimeServiceConfig) {
    super();
    this.callSid = config.callSid;
    this.restaurant = config.restaurant;
    this.customerPhone = config.customerPhone;
  }

  async initialize() {
    try {
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

      // Connect to OpenAI Realtime API
      await this.connectToOpenAI();

      console.log(`OpenAI Realtime service initialized for call ${this.callSid}`);
    } catch (error) {
      console.error('Error in OpenAI Realtime initialization:', error);
      throw error;
    }
  }

  private async connectToOpenAI() {
    return new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      this.ws.on('open', () => {
        console.log('Connected to OpenAI Realtime API');

        // Configure the session
        this.sendToOpenAI({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: this.getSystemInstructions(),
            voice: 'alloy',
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            temperature: 0.8,
          },
        });

        // Send initial greeting
        const greeting = this.restaurant.settings?.greeting ||
          `Thank you for calling ${this.restaurant.name}! How can I help you today?`;

        this.sendToOpenAI({
          type: 'response.create',
          response: {
            modalities: ['audio', 'text'],
            instructions: `Start the conversation with: "${greeting}"`,
          },
        });

        this.isReady = true;

        // Process any buffered audio
        for (const buffer of this.audioBuffer) {
          this.processAudioInternal(buffer);
        }
        this.audioBuffer = [];

        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleOpenAIEvent(event);
        } catch (error) {
          console.error('Error parsing OpenAI message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('OpenAI WebSocket connection closed');
        this.isReady = false;
      });
    });
  }

  private sendToOpenAI(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleOpenAIEvent(event: any) {
    switch (event.type) {
      case 'session.created':
        console.log('OpenAI session created:', event.session.id);
        break;

      case 'session.updated':
        console.log('OpenAI session updated');
        break;

      case 'conversation.created':
        this.conversationId = event.conversation.id;
        break;

      case 'input_audio_buffer.speech_started':
        console.log('Speech started');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('Speech stopped');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        console.log('Customer said:', event.transcript);
        this.emit('transcript_update', {
          role: 'user',
          content: event.transcript,
        });
        break;

      case 'response.audio.delta':
        // Receive audio from OpenAI (mulaw format, same as Twilio!)
        const audioDelta = Buffer.from(event.delta, 'base64');
        // Send directly to Twilio without conversion
        this.emit('audio', audioDelta);
        break;

      case 'response.audio.done':
        console.log('Response audio completed');
        break;

      case 'response.text.delta':
        // Text response from OpenAI (for logging/transcripts)
        break;

      case 'response.done':
        console.log('Response completed');
        this.emit('transcript_update', {
          role: 'assistant',
          content: event.response.output?.[0]?.content?.[0]?.text || '',
        });
        break;

      case 'error':
        console.error('OpenAI error:', event.error);
        break;

      default:
        // Log unknown events for debugging
        if (event.type && !event.type.startsWith('rate_limits')) {
          console.log('OpenAI event:', event.type);
        }
    }
  }

  async processAudio(audioBuffer: Buffer) {
    if (!this.isReady) {
      // Buffer audio until connected
      this.audioBuffer.push(audioBuffer);
      return;
    }

    this.processAudioInternal(audioBuffer);
  }

  private processAudioInternal(audioBuffer: Buffer) {
    try {
      // Send mulaw directly to OpenAI (no conversion needed!)
      this.sendToOpenAI({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      });
    } catch (error) {
      console.error('Error processing audio:', error);
    }
  }


  private getSystemInstructions(): string {
    const menu = JSON.stringify(this.restaurant.menu, null, 2);

    return `You are an AI phone assistant for ${this.restaurant.name}.

Your role is to:
1. Take food orders for pickup or delivery
2. Book reservations
3. Answer questions about the menu, hours, and location
4. Provide excellent customer service

Restaurant Information:
- Name: ${this.restaurant.name}
- Address: ${this.restaurant.address}
- Phone: ${this.restaurant.phone_number}

Menu:
${menu}

Guidelines:
- Be friendly, professional, and concise
- Speak naturally like a real person having a phone conversation
- Confirm all order details before finalizing
- For reservations, confirm date, time, party size, and contact info
- Keep responses brief - this is a phone call, not a chat
- If asked about allergens or ingredients, provide accurate information from the menu
- After taking an order, summarize it clearly and ask for confirmation`;
  }

  async cleanup() {
    try {
      // Close OpenAI connection
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      // Save to database if needed
      await Database.query(
        'UPDATE calls SET ended_at = NOW() WHERE call_sid = $1',
        [this.callSid]
      );

      console.log(`Cleaned up OpenAI Realtime service for call ${this.callSid}`);
    } catch (error) {
      console.error('Error cleaning up OpenAI Realtime service:', error);
    }
  }
}
