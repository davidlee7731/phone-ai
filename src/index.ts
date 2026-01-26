import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import expressWs from 'express-ws';
import { voiceRouter } from './routes/voice';
import { ordersRouter } from './routes/orders';
import { reservationsRouter } from './routes/reservations';
import { dashboardRouter } from './routes/dashboard';
import { errorHandler } from './middleware/errorHandler';
import { Database } from './database/client';
import { TwilioService } from './services/twilio';

dotenv.config();

const { app } = expressWs(express());
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/voice', voiceRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/dashboard', dashboardRouter);

// WebSocket endpoint for Twilio media streams
app.ws('/voice/stream', (ws, req) => {
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
          if (streamSid) {
            await TwilioService.handleMediaMessage(streamSid, data.media);
          }
          break;

        case 'stop':
          console.log(`Stream stopped: ${streamSid}`);
          if (streamSid) {
            await TwilioService.handleStreamStop(streamSid);
          }
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

// Error handling
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Initialize database connection
    await Database.connect();
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await Database.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await Database.disconnect();
  process.exit(0);
});

start();
