# Phone Agent AI - Restaurant Voice Assistant

A full-featured AI-powered phone answering system for restaurants, similar to Loman.ai. Handles order taking, reservations, payments, and customer service 24/7.

> **🚀 Quick Start:** Want to deploy right away? Check out [DEPLOYMENT.md](DEPLOYMENT.md) for a 30-minute step-by-step guide to get your phone agent live on Railway.

## Features

- **Intelligent Voice AI**: Natural conversation powered by Bland.ai
- **Order Management**: Take pickup and delivery orders with automatic POS injection
- **POS Integration**: Sync orders to Square, Toast (via Itsacheckmate), and Clover
- **Payment Processing**: Multiple options - Toast POS payment processor (via Itsacheckmate) or Stripe
- **Analytics Dashboard**: Track calls, revenue, conversion rates, and customer data
- **Multi-language Support**: Handle calls in multiple languages
- **Customer Recognition**: Identify repeat customers and preferences

## Tech Stack

- **Backend**: Node.js, TypeScript, Express
- **Database**: PostgreSQL
- **Voice AI**: Bland.ai with Twilio phone numbers
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
- Bland.ai: Pay per call (~$0.09 per minute)
- Itsacheckmate: ~$0.50-1.50 per order
- **Total: ~$50-100/month** for low volume (50-100 calls)

**Production Setup:**
- Railway/Render: $20-40/month
- Twilio: $20-50/month (100-300 calls)
- Bland.ai: ~$50-150/month
- Itsacheckmate: Variable based on orders
- **Total: ~$150-350/month** for medium volume (500-1000 calls)

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- **Cloud Database**: Choose one of these PostgreSQL providers:
  - [Supabase](https://supabase.com/) - Free tier available
  - [Neon](https://neon.tech/) - Serverless PostgreSQL, generous free tier
  - [Railway](https://railway.app/) - Easy setup, includes PostgreSQL
  - [Render](https://render.com/) - Free PostgreSQL tier available
- Twilio account with phone number
- **Bland.ai account** - Sign up at [bland.ai](https://bland.ai)
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

# Bland AI Configuration
BLAND_API_KEY=your_bland_api_key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/phone_agent

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

### 4. Configure Bland.ai with Your Twilio Number

1. **Get your public URL** (for local development, use ngrok):
   ```bash
   ngrok http 3000
   ```

2. **Set up Bland.ai:**
   - Go to [bland.ai](https://bland.ai) dashboard
   - Import your Twilio phone number using "Bring Your Own Twilio" (BYOT)
   - Configure webhook URL: `https://your-domain.ngrok.io/voice/bland-webhook`
   - The system will automatically generate task instructions from your restaurant database

3. Update `WEBHOOK_BASE_URL` in `.env` with your ngrok URL.

Your Twilio number will now route calls through Bland.ai for voice processing, then send webhooks to your server for order processing and POS integration.

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

## How Order Injection Works

When a customer places an order over the phone, the system automatically:

1. **AI Collects Order Details**: Bland.ai conversation collects:
   - Menu items and quantities
   - Customer name and phone
   - Pickup or delivery preference
   - Delivery address (if applicable)
   - Payment information (if provided)

2. **Structured Data Extraction**: The AI formats order data in a structured JSON format at the end of the call

3. **Webhook Processing**: When the call ends, Bland.ai sends a webhook to your server with the full transcript

4. **Order Parsing**: Your server extracts the structured order data from the transcript

5. **Database Creation**: The order is saved to your PostgreSQL database with:
   - Order items, pricing, and totals
   - Customer information
   - Link to the call transcript

6. **POS Injection**: The order is automatically synced to your POS:
   - **Toast**: Via Itsacheckmate API (includes payment processing)
   - **Square**: Via Square Orders API
   - **Clover**: Via Clover Orders API

7. **Payment Processing**:
   - **Toast users**: Payment processed through Toast's payment processor via Itsacheckmate
   - **Others**: Payment processed through Stripe

8. **Confirmation**: Order appears in your POS system ready for kitchen preparation

All of this happens automatically within seconds after the call ends, with no manual intervention required.

## API Endpoints

### Voice Endpoints
- `POST /voice/bland-webhook` - Receive call events from Bland.ai
- `GET /voice/task/:phoneNumber` - Get AI task instructions for a restaurant
- `POST /voice/status` - Call status updates (legacy)

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

1. **Incoming Call**: Customer calls restaurant phone number (Twilio)
2. **AI Processing**: Bland.ai handles the entire conversation:
   - Speech-to-text transcription
   - AI understands intent (order, question, etc.)
   - Text-to-speech response generation
   - Natural conversation flow
3. **Webhook Notification**: When call completes, Bland.ai sends webhook to your server with:
   - Full call transcript
   - Call duration and metadata
   - Structured order data (if order was placed)
4. **Order Processing**:
   - Server parses order from transcript
   - Creates order in database
   - Syncs to Toast POS via Itsacheckmate
   - Processes payment through Toast payment processor
5. **Completion**: Transcript and analytics saved to database

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

### Configure Business Hours

The system supports **two methods** for checking if your restaurant is open:

#### Option 1: Dynamic Toast API Integration (Recommended for Toast users)

If you have a Toast Standard API key, the system will automatically check Toast's real-time availability API to see if your restaurant is open. This is perfect for handling early closures or unexpected changes.

```sql
UPDATE restaurants
SET
  timezone = 'America/New_York',
  pos_system = 'toast',
  pos_credentials = jsonb_build_object(
    'itsacheckmate_api_key', 'your_itsacheckmate_key',
    'itsacheckmate_restaurant_guid', 'your_itsacheckmate_guid',
    'toast_api_key', 'your_toast_standard_api_key',  -- Add this for real-time checking
    'toast_restaurant_guid', 'your_toast_restaurant_guid'  -- Add this too
  )
WHERE id = 'your_restaurant_id';
```

**How it works:**
- Every call checks Toast's `/restaurant-availability/v1/availability` endpoint
- Returns `ONLINE` or `OFFLINE` status in real-time
- Caches result for 10 minutes (Toast recommendation)
- Falls back to database hours if Toast API is unavailable

**Benefits:**
- Handles early closures automatically (close at 8 PM instead of scheduled 10 PM)
- No manual updates needed when you close unexpectedly
- Always reflects your current Toast POS status

#### Option 2: Database Business Hours (Fallback)

If you don't have Toast API access or use a different POS, configure static hours in the database:

```sql
UPDATE restaurants
SET
  timezone = 'America/New_York',  -- Your restaurant's timezone
  business_hours = jsonb_build_object(
    'monday', jsonb_build_object('open', '09:00', 'close', '22:00'),
    'tuesday', jsonb_build_object('open', '09:00', 'close', '22:00'),
    'wednesday', jsonb_build_object('open', '09:00', 'close', '22:00'),
    'thursday', jsonb_build_object('open', '09:00', 'close', '22:00'),
    'friday', jsonb_build_object('open', '09:00', 'close', '23:00'),
    'saturday', jsonb_build_object('open', '10:00', 'close', '23:00'),
    'sunday', jsonb_build_object('open', '10:00', 'close', '21:00')
  )
WHERE id = 'your_restaurant_id';
```

**When closed, the AI will:**
- Politely inform callers the restaurant is closed
- Provide business hours and next opening time
- Answer questions about menu and location
- Refuse to take orders or process payments

**Priority:** Toast API (if configured) → Database hours (fallback)

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

### Configure Restaurant Menu

The system supports **two methods** for managing your restaurant menu:

#### Option 1: Dynamic Toast API Menu (Recommended for Toast users)

If you have a Toast Standard API key, the system will automatically fetch your menu from Toast POS. This ensures the AI always has your latest menu with current prices, items, and descriptions.

**Setup:** Just configure your Toast API credentials (see Business Hours section above). The menu will be fetched automatically.

**How it works:**
- Every call fetches menu from Toast's `/config/v2/menus` endpoint
- Returns complete menu structure with categories (menu groups), items, modifiers, and prices
- Caches result for 1 hour (menus change less frequently than availability)
- Falls back to database menu if Toast API is unavailable

**Benefits:**
- Always up-to-date menu - no manual updates needed
- Price changes in Toast POS are immediately reflected
- New items appear automatically
- Menu items removed from Toast won't be offered

#### Option 2: Database Menu (Fallback)

If you don't have Toast API access or use a different POS, configure your menu in the database:

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
    },
    {
      "name": "Entrees",
      "items": [
        {
          "id": "ent1",
          "name": "Pad Thai",
          "price": 14.99,
          "description": "Rice noodles with peanuts and tamarind sauce"
        }
      ]
    }
  ]
}'::jsonb
WHERE id = 'your_restaurant_id';
```

**Priority:** Toast API (if configured) → Database menu (fallback)

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
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` - For Bland.ai BYOT
- `BLAND_API_KEY` - From bland.ai dashboard
- `WEBHOOK_BASE_URL` - Your deployed app URL
- For Toast: `ITSACHECKMATE_API_KEY`, `ITSACHECKMATE_RESTAURANT_GUID` (or in database)
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

### Bland.ai Configuration Issues

- Ensure your Twilio number is properly imported in Bland.ai dashboard
- Verify webhook URL is correct and publicly accessible
- Check Bland.ai logs for call processing errors
- Make sure task instructions are configured in Bland.ai agent

### Database Connection Errors

- Verify your cloud database connection string is correct in `.env`
- Check if your database provider is having issues (status page)
- Ensure IP allowlisting is configured (if required by provider)
- For Railway/Render: Check service logs for connection errors
- Verify SSL settings match your provider's requirements

### Webhook Errors

- Check Railway/hosting logs for webhook errors
- Verify `/voice/bland-webhook` endpoint is accessible
- Ensure your server can parse Bland.ai webhook payloads
- Check Bland.ai dashboard for webhook delivery failures

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
- [Twilio](https://www.twilio.com/) - Phone number infrastructure
- [Bland.ai](https://bland.ai/) - AI voice conversation engine
- [Stripe](https://stripe.com/) - Payment processing (optional)
- [Itsacheckmate](https://www.itsacheckmate.com/) - Toast POS integration and payment processing
