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
    const response = TwilioService.createStreamResponse(CallSid, To, From);

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

// WebSocket handler is now in index.ts to access express-ws instance
