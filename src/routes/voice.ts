import express from 'express';
import { TwilioService } from '../services/twilio';
import { CallService } from '../services/calls';
import VoiceResponse = require('twilio/lib/twiml/VoiceResponse');

export const voiceRouter = express.Router();

// Handle incoming calls
voiceRouter.post('/incoming', async (req, res) => {
  try {
    const { CallSid, From, To } = req.body;

    console.log(`Incoming call: ${CallSid} from ${From} to ${To}`);

    // Create call record
    await CallService.createCall({
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
    });

    // Return TwiML to connect to WebSocket stream
    const response = TwilioService.createStreamResponse(CallSid);

    res.type('text/xml');
    res.send(response.toString());
  } catch (error) {
    console.error('Error handling incoming call:', error);

    const twiml = new VoiceResponse();
    twiml.say('We apologize, but we are experiencing technical difficulties. Please try again later.');

    res.type('text/xml');
    res.send(twiml.toString());
  }
});

// Handle call status updates
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

// Handle recording callback
voiceRouter.post('/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl } = req.body;

    console.log(`Recording available for call ${CallSid}: ${RecordingUrl}`);

    await CallService.updateCall(CallSid, {
      recordingUrl: RecordingUrl,
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling recording callback:', error);
    res.sendStatus(500);
  }
});

// WebSocket endpoint for media streams
voiceRouter.ws('/stream', (ws, req) => {
  console.log('WebSocket connection established');

  let callSid: string | null = null;
  let streamSid: string | null = null;

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          callSid = data.start.callSid;
          streamSid = data.start.streamSid;
          console.log(`Stream started: ${streamSid} for call ${callSid}`);

          // Initialize AI conversation handler
          await TwilioService.handleStreamStart(ws, callSid, streamSid, data.start);
          break;

        case 'media':
          // Forward audio to AI
          await TwilioService.handleMediaMessage(streamSid!, data.media);
          break;

        case 'stop':
          console.log(`Stream stopped: ${streamSid}`);
          await TwilioService.handleStreamStop(streamSid!);
          break;

        default:
          console.log('Received unknown event:', data.event);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
    if (streamSid) {
      TwilioService.handleStreamStop(streamSid);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});
