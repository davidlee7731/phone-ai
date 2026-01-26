import twilio from 'twilio';
import { VoiceResponse } from 'twilio/lib/twiml/VoiceResponse';
import WebSocket from 'ws';
import { AIService } from './ai';
import { Database } from '../database/client';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioClient = twilio(accountSid, authToken);

interface StreamSession {
  ws: WebSocket;
  callSid: string;
  streamSid: string;
  aiService: AIService;
}

class TwilioServiceClass {
  private activeSessions = new Map<string, StreamSession>();

  createStreamResponse(callSid: string): VoiceResponse {
    const twiml = new VoiceResponse();

    // Start media stream
    const connect = twiml.connect();
    connect.stream({
      url: `wss://${process.env.WEBHOOK_BASE_URL}/voice/stream`,
    });

    return twiml;
  }

  async handleStreamStart(ws: WebSocket, callSid: string, streamSid: string, startData: any) {
    try {
      // Get restaurant info from database based on called number
      const restaurantResult = await Database.query(
        'SELECT * FROM restaurants WHERE phone_number = $1',
        [startData.customParameters?.To || startData.to]
      );

      if (restaurantResult.rows.length === 0) {
        console.error('Restaurant not found for number:', startData.to);
        this.sendErrorResponse(ws);
        return;
      }

      const restaurant = restaurantResult.rows[0];

      // Initialize AI service for this call
      const aiService = new AIService({
        callSid,
        restaurant,
        customerPhone: startData.from,
      });

      await aiService.initialize();

      // Store session
      this.activeSessions.set(streamSid, {
        ws,
        callSid,
        streamSid,
        aiService,
      });

      // Set up AI response handler to send audio back to Twilio
      aiService.on('audio', (audioData: Buffer) => {
        this.sendAudioToTwilio(ws, streamSid, audioData);
      });

      // Set up AI event handlers
      aiService.on('intent_detected', async (intent: string) => {
        console.log(`Intent detected for call ${callSid}: ${intent}`);
        await Database.query(
          'UPDATE calls SET intent = $1 WHERE call_sid = $2',
          [intent, callSid]
        );
      });

      aiService.on('transcript', async (transcript: string) => {
        await Database.query(
          'UPDATE calls SET transcript = $1 WHERE call_sid = $2',
          [transcript, callSid]
        );
      });

      console.log(`AI service initialized for call ${callSid}`);
    } catch (error) {
      console.error('Error handling stream start:', error);
      this.sendErrorResponse(ws);
    }
  }

  async handleMediaMessage(streamSid: string, mediaData: any) {
    const session = this.activeSessions.get(streamSid);

    if (!session) {
      console.error('Session not found for stream:', streamSid);
      return;
    }

    try {
      // Decode audio payload (mulaw, base64 encoded)
      const audioBuffer = Buffer.from(mediaData.payload, 'base64');

      // Send to AI service
      await session.aiService.processAudio(audioBuffer);
    } catch (error) {
      console.error('Error processing media:', error);
    }
  }

  async handleStreamStop(streamSid: string) {
    const session = this.activeSessions.get(streamSid);

    if (session) {
      try {
        await session.aiService.cleanup();
        this.activeSessions.delete(streamSid);
        console.log(`Session cleaned up for stream ${streamSid}`);
      } catch (error) {
        console.error('Error cleaning up session:', error);
      }
    }
  }

  private sendAudioToTwilio(ws: WebSocket, streamSid: string, audioData: Buffer) {
    // Convert audio to mulaw format and base64 encode
    const payload = audioData.toString('base64');

    const message = {
      event: 'media',
      streamSid,
      media: {
        payload,
      },
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendErrorResponse(ws: WebSocket) {
    const twiml = new VoiceResponse();
    twiml.say('We apologize, but we are experiencing technical difficulties. Please try again later.');

    // Send clear and hangup
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: 'clear',
      }));
    }
  }

  async makeOutboundCall(to: string, from: string, message: string) {
    try {
      const call = await twilioClient.calls.create({
        to,
        from,
        twiml: `<Response><Say>${message}</Say></Response>`,
      });

      return call;
    } catch (error) {
      console.error('Error making outbound call:', error);
      throw error;
    }
  }

  async sendSMS(to: string, from: string, message: string) {
    try {
      const sms = await twilioClient.messages.create({
        to,
        from,
        body: message,
      });

      return sms;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }
}

export const TwilioService = new TwilioServiceClass();
