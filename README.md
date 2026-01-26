# Phone Agent AI - Restaurant Voice Assistant

A full-featured AI-powered phone answering system for restaurants, similar to Loman.ai. Handles order taking, reservations, payments, and customer service 24/7.

> **🚀 Quick Start:** Want to deploy right away? Check out [DEPLOYMENT.md](DEPLOYMENT.md) for a 30-minute step-by-step guide to get your phone agent live on Railway.

## Features

- **Intelligent Voice AI**: Natural conversation powered by OpenAI GPT-4 and TTS
- **Order Management**: Take pickup and delivery orders with payment processing
- **Reservations**: Book tables and manage reservations automatically
- **POS Integration**: Sync orders to Square, Toast (via Itsacheckmate), and Clover
- **Payment Processing**: Multiple options - Toast POS payment processor (via Itsacheckmate) or Stripe
- **Analytics Dashboard**: Track calls, revenue, conversion rates, and customer data
- **Multi-language Support**: Handle calls in multiple languages
- **Customer Recognition**: Identify repeat customers and preferences

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: PostgreSQL, Redis
- **Voice**: Twilio, OpenAI Realtime API
- **Payments**: Stripe (optional) or Toast POS via Itsacheckmate
- **POS Integration**: Square API, Itsacheckmate (Toast), Clover API

## Recommended Cloud Infrastructure

This system should run on cloud infrastructure, not locally. Here are recommended services:

### Database & Cache (Pick One Bundle)

**Option 1: Railway (Easiest All-in-One)**
- PostgreSQL + Redis in one platform
- Simple deployment, great free tier
- Perfect for getting started quickly
- ~$5-10/month for production usage

**Option 2: Supabase + Upstash**
- Supabase for PostgreSQL (generous free tier)
- Upstash for serverless Redis
- Both have excellent free tiers
- Scale as you grow

**Option 3: Neon + Upstash**
- Neon for serverless PostgreSQL
- Upstash for Redis
- Pay-per-use pricing
- Great for variable traffic

### Application Hosting

Deploy your Node.js app on one of these:
- **Railway** - Easiest deployment from GitHub
- **Render** - Free tier available, simple setup
- **Fly.io** - Global edge deployment
- **AWS/DigitalOcean** - More control, requires more setup

### Cost Estimate (Monthly)

**Minimal Setup (Free Tier):**
- Railway Free Tier: $0 (limited hours)
- Twilio: ~$1-5 (depends on usage)
- OpenAI: Pay per call (~$0.10-0.50 per call)
- Itsacheckmate: ~$0.50-1.50 per order
- **Total: ~$50-100/month** for low volume (50-100 calls)

**Production Setup:**
- Railway/Render: $20-40/month
- Twilio: $20-50/month (100-300 calls)
- OpenAI: $50-200/month
- Itsacheckmate: Variable based on orders
- **Total: ~$150-400/month** for medium volume (500-1000 calls)

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- **Cloud Database**: Choose one of these PostgreSQL providers:
  - [Supabase](https://supabase.com/) - Free tier available, includes Redis alternative
  - [Neon](https://neon.tech/) - Serverless PostgreSQL, generous free tier
  - [Railway](https://railway.app/) - Easy setup, includes PostgreSQL + Redis
  - [Render](https://render.com/) - Free PostgreSQL tier available
- **Redis**: Use [Upstash Redis](https://upstash.com/) (serverless, free tier) or include with Railway/Render
- Twilio account with phone number
- OpenAI API key
- **For Toast POS users**: Itsacheckmate account (handles both orders AND payments through Toast)
- **For other POS systems**: Stripe account for payment processing
- (Optional) Square or Clover POS credentials

## Installation

### 1. Clone and Install Dependencies

```bash
cd phone-agent
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/phone_agent
REDIS_URL=redis://localhost:6379

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Application URLs
APP_URL=http://localhost:3000
WEBHOOK_BASE_URL=https://your-domain.ngrok.io
```

### 3. Set Up Cloud Database

Choose and set up your cloud database:

#### Option A: Supabase (Recommended - Easiest Setup)

1. Create account at https://supabase.com/
2. Create new project
3. Copy the connection string (Settings → Database → Connection String → URI)
4. Update `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
   ```
5. For Redis, use Supabase's built-in Realtime or Upstash Redis

#### Option B: Neon (Serverless PostgreSQL)

1. Create account at https://neon.tech/
2. Create new project
3. Copy connection string
4. Update `.env` with the connection string
5. Use Upstash Redis for caching

#### Option C: Railway (PostgreSQL + Redis together)

1. Create account at https://railway.app/
2. Create new project
3. Add PostgreSQL and Redis services
4. Copy both connection strings to `.env`

#### Run Migrations

Once your cloud database is configured:

```bash
npm run db:migrate
```

Seed with sample data (optional):

```bash
npm run db:seed
```

### 4. Configure Twilio Webhooks

You'll need to expose your local server to the internet. Use ngrok:

```bash
ngrok http 3000
```

Then configure Twilio webhooks:

1. Go to your Twilio phone number settings
2. Set "A Call Comes In" webhook to: `https://your-domain.ngrok.io/voice/incoming`
3. Set "Call Status Changes" webhook to: `https://your-domain.ngrok.io/voice/status`

Update `WEBHOOK_BASE_URL` in `.env` with your ngrok URL.

## Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## Payment Processing Options

You have two options for processing payments:

### Option 1: Toast POS Payment Processor (Recommended for Toast users)

If you're using Toast POS, use Itsacheckmate for both order injection AND payment processing:

**Advantages:**
- Lower fees - use your existing Toast payment processor
- Single integration for orders and payments
- Seamless flow - orders appear directly in Toast with payment already processed
- No need for Stripe account

**How it works:**
1. Customer provides card details over the phone
2. AI securely collects card info
3. Itsacheckmate processes payment through Toast's payment processor
4. Order is injected into Toast POS with payment already completed

**Cost:** Itsacheckmate charges a per-order fee (~$0.50-1.50), but you save on Stripe fees (2.9% + $0.30)

### Option 2: Stripe (For non-Toast POS systems)

If you're using Square, Clover, or no POS integration:

**Advantages:**
- Works with any POS system
- Well-documented API
- Flexible payment options

**Disadvantages:**
- Higher fees: 2.9% + $0.30 per transaction
- Separate integration from POS

**Which should you choose?**

- **Use Toast via Itsacheckmate if:** You have Toast POS and want to minimize fees
- **Use Stripe if:** You use Square, Clover, or another POS system

You can configure Stripe as optional in your `.env` file. If using Toast with Itsacheckmate, you can skip the Stripe configuration entirely.

## POS Integration Setup

### Toast POS (via Itsacheckmate) - Handles Orders AND Payments

Since Toast doesn't provide public API access, we use Itsacheckmate as middleware. This integration handles BOTH order injection and payment processing through your Toast payment processor.

1. Sign up for Itsacheckmate: https://www.itsacheckmate.com/
2. Connect your Toast account through their dashboard
3. Set up your Toast payment processor integration in Itsacheckmate
4. Get your API credentials:
   - API Key
   - Restaurant GUID
5. Update restaurant settings in database:

```sql
UPDATE restaurants
SET
  pos_system = 'toast',
  pos_credentials = jsonb_build_object(
    'itsacheckmate_api_key', 'your_api_key',
    'itsacheckmate_restaurant_guid', 'your_restaurant_guid'
  )
WHERE id = 'your_restaurant_id';
```

### Square POS

1. Create Square developer account: https://developer.squareup.com/
2. Get your Access Token
3. Update restaurant settings:

```sql
UPDATE restaurants
SET
  pos_system = 'square',
  pos_credentials = jsonb_build_object(
    'access_token', 'your_square_access_token',
    'location_id', 'your_location_id'
  )
WHERE id = 'your_restaurant_id';
```

### Clover POS

1. Create Clover developer account: https://www.clover.com/developers
2. Get API credentials
3. Update restaurant settings similarly

## API Endpoints

### Voice Endpoints
- `POST /voice/incoming` - Handle incoming calls
- `POST /voice/status` - Call status updates
- `WS /voice/stream` - Media stream WebSocket

### Order Endpoints
- `GET /api/orders?restaurantId={id}` - Get all orders
- `GET /api/orders/:orderId` - Get single order
- `POST /api/orders` - Create order
- `PATCH /api/orders/:orderId` - Update order
- `POST /api/orders/:orderId/sync` - Sync to POS

### Reservation Endpoints
- `GET /api/reservations?restaurantId={id}` - Get all reservations
- `GET /api/reservations/:id` - Get single reservation
- `POST /api/reservations` - Create reservation
- `PATCH /api/reservations/:id` - Update reservation
- `DELETE /api/reservations/:id` - Cancel reservation
- `POST /api/reservations/check-availability` - Check availability

### Dashboard Endpoints
- `GET /api/dashboard/analytics?restaurantId={id}` - Get analytics
- `GET /api/dashboard/calls?restaurantId={id}` - Get call history
- `GET /api/dashboard/calls/:id/transcript` - Get call transcript
- `GET /api/dashboard/revenue?restaurantId={id}&period={day|week|month|year}` - Get revenue metrics
- `PATCH /api/dashboard/settings` - Update restaurant settings

## Project Structure

```
phone-agent/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── database/
│   │   ├── client.ts            # Database connection
│   │   ├── schema.sql           # Database schema
│   │   ├── migrate.ts           # Migration script
│   │   └── seed.ts              # Seed data
│   ├── middleware/
│   │   └── errorHandler.ts     # Error handling middleware
│   ├── routes/
│   │   ├── voice.ts             # Voice call routes
│   │   ├── orders.ts            # Order management routes
│   │   ├── reservations.ts     # Reservation routes
│   │   └── dashboard.ts         # Dashboard/analytics routes
│   └── services/
│       ├── ai.ts                # AI conversation logic
│       ├── twilio.ts            # Twilio integration
│       ├── calls.ts             # Call management
│       ├── orders.ts            # Order management
│       ├── reservations.ts     # Reservation management
│       ├── payments.ts          # Stripe payment processing
│       └── dashboard.ts         # Analytics and metrics
├── package.json
├── tsconfig.json
└── README.md
```

## How It Works

### Call Flow

1. **Incoming Call**: Customer calls restaurant phone number
2. **Twilio Routes**: Call routed to your server via webhook
3. **Stream Setup**: Twilio establishes WebSocket media stream
4. **AI Processing**:
   - Audio streamed to OpenAI for transcription
   - GPT-4 processes intent (order, reservation, question)
   - Response generated and converted to speech
5. **Action Execution**:
   - Orders: Collect items, process payment, sync to POS
   - Reservations: Check availability, book table, send confirmation
   - Questions: Answer from menu/hours database
6. **Completion**: Call ends, transcript saved, analytics updated

### AI Conversation Design

The AI uses function calling to:
- Detect customer intent
- Add items to orders
- Confirm order details
- Create reservations
- Process payments

The system maintains conversation context and can handle multi-turn dialogues naturally.

### Payment Security

- Credit card data never touches your server
- Stripe handles PCI compliance
- Payment tokens used for processing
- Full encryption in transit

## Customization

### Customize Restaurant Greeting

Update the restaurant settings:

```sql
UPDATE restaurants
SET settings = settings || jsonb_build_object(
  'greeting', 'Welcome to Your Restaurant! How may I help you today?',
  'language', 'en-US'
)
WHERE id = 'your_restaurant_id';
```

### Update Menu

```sql
UPDATE restaurants
SET menu = '{
  "categories": [
    {
      "name": "Appetizers",
      "items": [
        {
          "id": "app1",
          "name": "Spring Rolls",
          "price": 7.99,
          "description": "Crispy vegetable spring rolls"
        }
      ]
    }
  ]
}'::jsonb
WHERE id = 'your_restaurant_id';
```

## Testing

### Test Incoming Call

1. Ensure server is running: `npm run dev`
2. Call your Twilio phone number
3. Speak naturally with the AI
4. Check database for call record and transcript

### Test Order Creation

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "your-restaurant-id",
    "customerId": "customer-id",
    "items": [{"itemId": "app1", "itemName": "Spring Rolls", "quantity": 2, "price": 7.99}],
    "orderType": "pickup"
  }'
```

## Production Deployment

### Deploy to Railway (Recommended - Easiest)

Railway is the fastest way to deploy:

1. **Connect GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo>
   git push -u origin main
   ```

2. **Deploy to Railway:**
   - Go to https://railway.app/
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway auto-detects Node.js and builds

3. **Add PostgreSQL + Redis:**
   - In Railway project, click "+ New"
   - Add PostgreSQL service
   - Add Redis service
   - Railway automatically injects `DATABASE_URL` and `REDIS_URL`

4. **Set Environment Variables:**
   - Go to your service → Variables
   - Add all variables from `.env.example`
   - Railway will automatically restart on changes

5. **Get Public URL:**
   - Railway provides a public URL automatically
   - Update `WEBHOOK_BASE_URL` with your Railway URL
   - Configure Twilio webhooks with this URL

### Deploy to Render

1. **Connect GitHub repo**
2. **Create Web Service:**
   - Build Command: `npm run build`
   - Start Command: `npm start`
3. **Add PostgreSQL database** from Render dashboard
4. **Set environment variables** in Render dashboard
5. **Deploy** - Render builds and deploys automatically

### Deploy to Fly.io (Global Edge)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Initialize and Deploy:**
   ```bash
   fly launch
   fly postgres create
   fly redis create
   fly deploy
   ```

### Environment Variables for Production

Required environment variables:
- `NODE_ENV=production`
- `DATABASE_URL` - From your cloud provider
- `REDIS_URL` - From your cloud provider
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
- `WEBHOOK_BASE_URL` - Your deployed app URL
- For Toast: `itsacheckmate_api_key`, `itsacheckmate_restaurant_guid` (in database)
- For Stripe users: `STRIPE_SECRET_KEY`

### Post-Deployment Checklist

- [ ] Update Twilio webhooks with production URL
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Seed sample restaurant: `npm run db:seed`
- [ ] Test incoming call
- [ ] Configure restaurant settings in database
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Configure custom domain (optional)

## Troubleshooting

### WebSocket Connection Issues

- Ensure `WEBHOOK_BASE_URL` uses `wss://` for secure WebSocket
- Check ngrok or hosting firewall allows WebSocket connections

### Database Connection Errors

- Verify your cloud database connection string is correct in `.env`
- Check if your database provider is having issues (status page)
- Ensure IP allowlisting is configured (if required by provider)
- For Railway/Render: Check service logs for connection errors
- Verify SSL settings match your provider's requirements

### Twilio Webhook Errors

- Check Twilio debugger console for webhook failures
- Verify webhook URLs are publicly accessible
- Ensure endpoints return valid TwiML

### POS Sync Failures

- Verify POS credentials are correct
- Check API rate limits
- Review POS system logs

## Next Steps

1. Build frontend dashboard (React/Next.js)
2. Add SMS confirmations for orders/reservations
3. Implement advanced analytics
4. Add multi-location support
5. Build mobile app for restaurant staff
6. Add voice analytics (sentiment, keywords)
7. Implement A/B testing for AI responses

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

## Credits

Built with:
- [Twilio](https://www.twilio.com/) - Voice infrastructure
- [OpenAI](https://openai.com/) - AI conversation engine
- [Stripe](https://stripe.com/) - Payment processing
- [Itsacheckmate](https://www.itsacheckmate.com/) - Toast POS integration
