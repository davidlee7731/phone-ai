# Quick Deployment Guide

This guide will get your phone agent AI running in production in under 30 minutes using Railway (recommended).

## Prerequisites Checklist

Before starting, sign up for these free accounts:

- [ ] [GitHub](https://github.com/) - To store your code
- [ ] [Railway](https://railway.app/) - Database + hosting ($5 free credit)
- [ ] [Twilio](https://www.twilio.com/) - Phone number ($15 trial credit)
- [ ] [OpenAI](https://platform.openai.com/) - AI voice ($5 free credit)
- [ ] [Itsacheckmate](https://www.itsacheckmate.com/) - Toast POS integration

**Estimated monthly cost after free credits:** ~$50-100 for low volume (50-100 calls/month)

## Step-by-Step Deployment

### 1. Push Code to GitHub (5 minutes)

```bash
cd phone-agent
git init
git add .
git commit -m "Initial commit"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/phone-agent.git
git push -u origin main
```

### 2. Deploy to Railway (5 minutes)

1. Go to https://railway.app/ and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `phone-agent` repository
5. Railway will detect Node.js and start building

### 3. Add PostgreSQL Database (2 minutes)

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway automatically creates `DATABASE_URL` environment variable
4. Your app will restart and connect to the database

### 4. Add Redis (2 minutes)

1. Click **"+ New"** again
2. Select **"Database"** → **"Add Redis"**
3. Railway automatically creates `REDIS_URL` environment variable

### 5. Configure Environment Variables (5 minutes)

1. Click on your web service (not the database)
2. Go to **"Variables"** tab
3. Click **"Raw Editor"** and paste:

```env
NODE_ENV=production
PORT=3000

# These will be auto-filled by Railway:
# DATABASE_URL=...
# REDIS_URL=...

# Add these (get from respective services):
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567
OPENAI_API_KEY=sk-your-openai-api-key
APP_URL=https://your-app.railway.app
WEBHOOK_BASE_URL=https://your-app.railway.app
```

4. Click **"Update Variables"**

### 6. Get Your Railway App URL (1 minute)

1. Go to **"Settings"** tab
2. Scroll to **"Networking"**
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `your-app.railway.app`)
5. Update `WEBHOOK_BASE_URL` variable with this URL

### 7. Run Database Migrations (2 minutes)

Railway doesn't have a built-in way to run one-time commands, so we'll do this locally connected to the cloud database:

1. Copy the `DATABASE_URL` from Railway
2. Run locally:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

### 8. Configure Twilio Webhooks (5 minutes)

1. Get a phone number from Twilio:
   - Go to https://console.twilio.com/
   - Phone Numbers → Buy a number
   - Choose a number with Voice capability

2. Configure webhooks:
   - Click on your phone number
   - Under "Voice Configuration":
     - **"A call comes in"**: `https://your-app.railway.app/voice/incoming`
     - HTTP POST
     - **"Call status changes"**: `https://your-app.railway.app/voice/status`
     - HTTP POST
   - Click **"Save"**

### 9. Set Up Itsacheckmate for Toast (10 minutes)

1. Go to https://www.itsacheckmate.com/
2. Sign up and connect your Toast POS account
3. Get your API credentials:
   - API Key
   - Restaurant GUID
4. Update your restaurant in the database:
   ```bash
   # Connect to Railway PostgreSQL
   DATABASE_URL="postgresql://..." psql

   # Update restaurant settings
   UPDATE restaurants
   SET
     pos_system = 'toast',
     pos_credentials = jsonb_build_object(
       'itsacheckmate_api_key', 'your_api_key',
       'itsacheckmate_restaurant_guid', 'your_restaurant_guid'
     )
   WHERE phone_number = '+15551234567';
   ```

### 10. Test Your System (5 minutes)

1. **Check Railway Logs:**
   - In Railway, click on your service
   - Go to **"Deployments"** tab
   - Check latest deployment logs for errors

2. **Test the API:**
   ```bash
   curl https://your-app.railway.app/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

3. **Make a Test Call:**
   - Call your Twilio phone number
   - The AI should answer and greet you
   - Try placing an order

4. **Check Call Logs:**
   - Check Railway deployment logs
   - Check Twilio debugger: https://console.twilio.com/debugger
   - Check your database for the call record

## Customizing Your Restaurant

### Update Menu

```sql
UPDATE restaurants
SET menu = '{
  "categories": [
    {
      "name": "Pizza",
      "items": [
        {
          "id": "pizza1",
          "name": "Margherita Pizza",
          "price": 12.99,
          "description": "Fresh mozzarella, basil, tomato sauce"
        },
        {
          "id": "pizza2",
          "name": "Pepperoni Pizza",
          "price": 14.99,
          "description": "Pepperoni, mozzarella, tomato sauce"
        }
      ]
    },
    {
      "name": "Drinks",
      "items": [
        {
          "id": "drink1",
          "name": "Coke",
          "price": 2.50
        }
      ]
    }
  ]
}'::jsonb
WHERE id = 'your-restaurant-id';
```

### Update Greeting

```sql
UPDATE restaurants
SET settings = settings || jsonb_build_object(
  'greeting', 'Thank you for calling Pizza Palace! How can I help you today?',
  'language', 'en-US'
)
WHERE id = 'your-restaurant-id';
```

### Update Business Hours

```sql
UPDATE restaurants
SET business_hours = '{
  "monday": {"open": "11:00", "close": "22:00"},
  "tuesday": {"open": "11:00", "close": "22:00"},
  "wednesday": {"open": "11:00", "close": "22:00"},
  "thursday": {"open": "11:00", "close": "22:00"},
  "friday": {"open": "11:00", "close": "23:00"},
  "saturday": {"open": "11:00", "close": "23:00"},
  "sunday": {"open": "12:00", "close": "21:00"}
}'::jsonb
WHERE id = 'your-restaurant-id';
```

## Monitoring Your System

### Railway Dashboard

- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: History and rollback

### Twilio Console

- **Debugger**: See all webhook calls and errors
- **Call Logs**: Every call with duration and status
- **Usage**: Track minutes and costs

### Database Queries

Check recent calls:
```sql
SELECT * FROM calls ORDER BY started_at DESC LIMIT 10;
```

Check today's orders:
```sql
SELECT * FROM orders WHERE created_at::date = CURRENT_DATE;
```

Check revenue:
```sql
SELECT SUM(total) as revenue FROM orders WHERE payment_status = 'paid';
```

## Troubleshooting

### "Server not responding" when calling

- Check Railway deployment logs for errors
- Verify `WEBHOOK_BASE_URL` is set correctly
- Check Twilio debugger for webhook errors

### "Database connection failed"

- Verify `DATABASE_URL` is set in Railway
- Check Railway database service is running
- Try restarting your web service

### "No menu items found"

- Verify you ran `npm run db:seed`
- Check restaurant menu in database
- Ensure menu is valid JSON

### "Payment processing failed"

- Verify Itsacheckmate credentials are correct
- Check Itsacheckmate dashboard for errors
- Test API credentials manually

## Scaling Up

### Add Custom Domain

1. In Railway, go to Settings → Networking
2. Add custom domain
3. Configure DNS records as shown
4. Update `WEBHOOK_BASE_URL` to use custom domain
5. Update Twilio webhooks

### Upgrade Railway Plan

Railway free tier includes $5 credit. For production:
- **Hobby Plan**: $5/month + usage (~$20-40 total)
- Gives you more resources and priority support

### Add Monitoring

Add error tracking:
```bash
npm install @sentry/node
```

Update `src/index.ts`:
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});
```

## Next Steps

- [ ] Build a dashboard frontend (React/Next.js)
- [ ] Add SMS confirmations
- [ ] Implement voice analytics
- [ ] Add multiple restaurant support
- [ ] Create admin panel for menu management
- [ ] Set up automated backups

## Cost Breakdown (Monthly)

**Low Volume (50-100 calls):**
- Railway: $20-30
- Twilio: $5-10 (phone + minutes)
- OpenAI: $20-40
- Itsacheckmate: $25-50 (50 orders × $0.50)
- **Total: ~$70-130/month**

**Medium Volume (500-1000 calls):**
- Railway: $40-60
- Twilio: $30-50
- OpenAI: $150-300
- Itsacheckmate: $250-500
- **Total: ~$470-910/month**

**ROI Calculation:**
- Average order value: $40
- If you capture 30% of missed calls (30 orders/month)
- Revenue: 30 × $40 = $1,200
- Cost: ~$130
- **Net profit: ~$1,070/month**

## Support

- Railway: https://railway.app/help
- Twilio: https://www.twilio.com/help
- OpenAI: https://help.openai.com/
- Itsacheckmate: https://www.itsacheckmate.com/contact

Happy calling! 📞🤖
