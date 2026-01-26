# Bland.ai Setup Guide - Dynamic Menu with Knowledge Base

This guide shows how to configure Bland.ai to use a **knowledge base** for your restaurant menu instead of hardcoding it in the prompt. This approach:
- Keeps the menu always up-to-date from Toast API
- Allows Bland.ai to use RAG (Retrieval-Augmented Generation) for menu queries
- Separates conversation behavior (prompt) from menu data (knowledge base)

## Prerequisites

1. Bland.ai account at [bland.ai](https://bland.ai)
2. Twilio phone number imported into Bland.ai (BYOT - Bring Your Own Twilio)
3. Your application deployed to Railway with a public URL
4. Toast API credentials configured in Railway environment variables (optional but recommended)

## Step 1: Configure the Global Prompt (Without Menu)

In your Bland.ai dashboard:

1. Go to **Phone Numbers** → Select your number (+14695178245)
2. Find the **Global Prompt** or **Instructions** section
3. Paste the following URL to fetch the dynamic prompt:

```
https://your-railway-url.railway.app/voice/task/+14695178245?format=text
```

OR manually copy the prompt from:
```bash
curl https://your-railway-url.railway.app/voice/task/+14695178245?format=text
```

**Note:** The prompt will include:
- Restaurant information (name, address, phone)
- Business hours and current status (OPEN/CLOSED)
- Conversation guidelines and tone
- Order process steps
- Payment handling instructions
- Order data format requirements

**The menu is NOT included** - it will be in the knowledge base.

## Step 2: Set Up Knowledge Base with Dynamic Menu

### Option A: Dynamic URL (Recommended)

If Bland.ai supports dynamic knowledge base URLs:

1. Go to **Knowledge Base** section for your phone number
2. Add a new knowledge source
3. Set the source type to **URL** or **API Endpoint**
4. Enter the menu endpoint:

```
https://your-railway-url.railway.app/voice/menu/+14695178245?format=text
```

5. Set refresh interval to **1 hour** (matches our cache duration)
6. Save and sync

### Option B: Manual Upload (Temporary)

If dynamic URLs aren't supported, manually fetch and upload:

1. Get the menu text:
```bash
curl https://your-railway-url.railway.app/voice/menu/+14695178245?format=text > menu.txt
```

2. Go to **Knowledge Base** → **Upload File**
3. Upload `menu.txt`
4. Name it "Restaurant Menu"

**Note:** With this approach, you'll need to re-upload whenever the menu changes in Toast POS.

## Step 3: Configure Webhook URL

Set up the webhook to receive call completion events:

1. Go to your phone number settings in Bland.ai
2. Find **Webhook URL** or **Call Events**
3. Enter:

```
https://your-railway-url.railway.app/voice/bland-webhook
```

4. Enable these events:
   - Call completed
   - Call ended
   - Transcript available

5. Save

## Step 4: Configure Person/Agent Settings

In Bland.ai's agent configuration:

1. **Voice**: Choose a voice that matches your restaurant's brand
2. **Response Delay**: Set to 0.5-1.0 seconds (natural conversation pace)
3. **Interruption Sensitivity**: Medium (allows customers to interject naturally)
4. **Enable Knowledge Base**: Make sure this is ON
5. **Knowledge Base Priority**: High (so menu queries use the knowledge base)

## Step 5: Test the Setup

### Test 1: Verify Prompt Loads Correctly

```bash
curl https://your-railway-url.railway.app/voice/task/+14695178245?format=text
```

Should return the prompt with:
- Restaurant name and details
- Business hours
- Current status (OPEN/CLOSED)
- NO menu items (just a note saying menu is in knowledge base)

### Test 2: Verify Menu Endpoint Works

```bash
curl https://your-railway-url.railway.app/voice/menu/+14695178245?format=text
```

Should return formatted menu with:
- All categories
- All items with prices
- Descriptions
- Note about automatic updates from POS

### Test 3: Make a Test Call

1. Call your Twilio number
2. Ask: "What's on your menu?"
3. Verify the AI can answer with menu items
4. Ask about specific items and prices
5. Try placing a test order

### Test 4: Verify Order Processing

After the test call:

1. Check Railway logs for webhook reception
2. Query your database for the call record:
```sql
SELECT * FROM calls ORDER BY started_at DESC LIMIT 1;
```
3. Check if order was created (if you placed one):
```sql
SELECT * FROM orders ORDER BY created_at DESC LIMIT 1;
```

## How the System Works

```
┌─────────────┐
│   Customer  │
│    calls    │
└──────┬──────┘
       │
       ↓
┌─────────────┐         ┌──────────────┐
│   Twilio    │────────→│   Bland.ai   │
│ Phone Number│         │  (BYOT mode) │
└─────────────┘         └──────┬───────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ↓             ↓             ↓
         ┌───────────┐  ┌──────────┐  ┌──────────┐
         │  Prompt   │  │Knowledge │  │ Webhook  │
         │ (behavior)│  │Base(menu)│  │(orders)  │
         └─────┬─────┘  └────┬─────┘  └────┬─────┘
               │             │             │
               └─────────────┴─────────────┘
                             ↓
                    ┌─────────────────┐
                    │  Your Railway   │
                    │   Application   │
                    └────────┬────────┘
                             ↓
                    ┌─────────────────┐
                    │   Toast POS     │
                    │   via API       │
                    └─────────────────┘
```

### On Each Call:

1. **Bland.ai fetches prompt** from `/voice/task/:phoneNumber`
   - Gets current business hours and OPEN/CLOSED status
   - Gets conversation guidelines
   - Gets order processing instructions

2. **Bland.ai loads menu** from knowledge base
   - If dynamic URL: Fetches from `/voice/menu/:phoneNumber`
   - Menu is pulled from Toast API (1-hour cache)
   - AI uses RAG to answer menu questions

3. **Customer conversation** happens
   - AI uses prompt for behavior
   - AI uses knowledge base for menu queries
   - AI collects order information

4. **Call completes, webhook fires** to `/voice/bland-webhook`
   - Transcript is saved to database
   - Order is extracted and created
   - Order is synced to Toast POS via Itsacheckmate

## Updating Menu in Production

### Automatic Updates (Toast API)

If you configured Toast API credentials:
- Menu automatically updates every hour from Toast API
- Changes in Toast POS appear in calls within 1 hour
- No manual intervention needed

### Manual Updates (Database Menu)

If using database menu as fallback:
1. Update menu in database:
```sql
UPDATE restaurants
SET menu = '{"categories": [...] }'::jsonb
WHERE phone_number = '+14695178245';
```

2. Refresh knowledge base in Bland.ai:
   - Option A: If using dynamic URL, it will auto-refresh on next sync
   - Option B: If manually uploaded, re-fetch and re-upload menu.txt

## Troubleshooting

### Menu Not Showing in Calls

1. Check knowledge base is enabled for the phone number
2. Verify menu endpoint returns data:
```bash
curl https://your-railway-url.railway.app/voice/menu/+14695178245
```
3. Check Bland.ai logs for knowledge base errors
4. Try re-syncing or re-uploading the knowledge base

### Orders Not Being Created

1. Check Railway logs for webhook errors:
```bash
railway logs
```
2. Verify webhook URL is correct in Bland.ai
3. Check database for call records (webhook might be working but order parsing failing)
4. Look for ORDER_DATA_START/ORDER_DATA_END in call transcripts

### Stale Menu Data

1. If using Toast API, wait up to 1 hour for cache to expire
2. Or manually clear cache by restarting the Railway service
3. If using database menu, verify you updated the correct restaurant record

### Business Hours Not Updating

1. Check Toast API credentials are correct in Railway environment variables
2. Verify restaurant is configured with correct timezone
3. Check Railway logs for Toast API errors
4. Falls back to database hours if Toast API fails

## Environment Variables Checklist

Make sure these are set in Railway:

```bash
# Required
DATABASE_URL=postgresql://...
BLAND_API_KEY=sk_...
WEBHOOK_BASE_URL=https://your-app.railway.app

# For Toast POS integration
ITSACHECKMATE_API_KEY=...
ITSACHECKMATE_RESTAURANT_GUID=...

# Optional: For Toast API features (recommended)
TOAST_API_KEY=...
TOAST_RESTAURANT_GUID=...
```

## Next Steps

1. Monitor first few calls in Bland.ai dashboard
2. Review call transcripts for quality
3. Adjust prompt based on conversation patterns
4. Fine-tune voice settings (speed, interruption sensitivity)
5. Add more knowledge base documents if needed (FAQs, allergen info, etc.)

## Support

- Bland.ai Documentation: https://docs.bland.ai
- Toast API Documentation: https://doc.toasttab.com
- Itsacheckmate Support: https://www.itsacheckmate.com/support
