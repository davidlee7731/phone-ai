# Bland.ai API Tools Configuration

This document explains how to configure Bland.ai to use API tools for menu queries instead of loading the entire menu as knowledge base.

## Why Use API Tools?

Large menus (like Toast POS menus with 400+ items and modifiers) are too large for Bland.ai to process efficiently as knowledge base text. Instead, we use **API Tools** to let the AI query menu information on-demand during calls.

## Benefits

- **Faster responses**: AI only fetches what it needs
- **Real-time data**: Always gets current menu from Toast API
- **Scalable**: Works with menus of any size
- **Contextual**: Can search and filter as needed

## Available API Endpoints

### 1. Get Menu Categories
**Endpoint**: `GET /voice/menu-categories/:phoneNumber`

**Purpose**: Get list of all menu categories (e.g., "Appetizers", "Entrees", "Desserts")

**Example Request**:
```
GET https://phone-ai-production.up.railway.app/voice/menu-categories/+14695178245
```

**Example Response**:
```json
{
  "categories": [
    "Breakfast Sandwiches",
    "Lunch Sandwiches",
    "Salads",
    "Sides",
    "Beverages"
  ],
  "count": 5
}
```

**When to use**: Start of conversation or when customer asks "what do you have?"

---

### 2. Get Menu Items in Category
**Endpoint**: `GET /voice/menu-items/:phoneNumber?category=CategoryName`

**Purpose**: Get all items in a specific category with full details

**Example Request**:
```
GET https://phone-ai-production.up.railway.app/voice/menu-items/+14695178245?category=Lunch%20Sandwiches
```

**Example Response**:
```json
{
  "category": "Lunch Sandwiches",
  "items": [
    {
      "name": "Turkey Club",
      "price": 12.99,
      "description": "Turkey, bacon, lettuce, tomato on whole wheat",
      "modifiers": [
        {
          "name": "Bread Choice",
          "required": true,
          "minSelections": 1,
          "maxSelections": 1,
          "multiSelect": false,
          "options": [
            { "name": "White Bread", "price": 0, "isDefault": true },
            { "name": "Whole Wheat", "price": 0, "isDefault": false },
            { "name": "Sourdough", "price": 1.00, "isDefault": false }
          ]
        },
        {
          "name": "Add Extras",
          "required": false,
          "minSelections": 0,
          "maxSelections": 5,
          "multiSelect": true,
          "options": [
            { "name": "Extra Cheese", "price": 1.50, "isDefault": false },
            { "name": "Avocado", "price": 2.00, "isDefault": false }
          ]
        }
      ]
    }
  ],
  "count": 1
}
```

**When to use**: Customer asks about items in a specific category

---

### 3. Search Menu Items
**Endpoint**: `GET /voice/menu-search/:phoneNumber?query=searchterm`

**Purpose**: Search for items by name or description across all categories

**Example Request**:
```
GET https://phone-ai-production.up.railway.app/voice/menu-search/+14695178245?query=chicken
```

**Example Response**:
```json
{
  "query": "chicken",
  "results": [
    {
      "name": "Grilled Chicken Sandwich",
      "price": 11.99,
      "description": "Grilled chicken breast with lettuce and tomato",
      "category": "Lunch Sandwiches",
      "modifiers": [...]
    },
    {
      "name": "Chicken Caesar Salad",
      "price": 10.99,
      "description": "Romaine lettuce with grilled chicken",
      "category": "Salads",
      "modifiers": [...]
    }
  ],
  "count": 2
}
```

**When to use**: Customer asks for a specific item or ingredient

---

## Configuring Tools in Bland.ai

### Step 1: Create Custom Tools

In your Bland.ai dashboard:

1. Go to **Tools** section
2. Click **Add Custom Tool**
3. Create three tools with these configurations:

#### Tool 1: Get Menu Categories

```json
{
  "name": "get_menu_categories",
  "description": "Get list of all menu categories available. Use this when customer asks 'what do you have' or to see all sections of the menu.",
  "url": "https://phone-ai-production.up.railway.app/voice/menu-categories/+14695178245",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  }
}
```

#### Tool 2: Get Items in Category

```json
{
  "name": "get_menu_items",
  "description": "Get all items in a specific menu category with prices, descriptions, and modifiers. Use this when customer asks about a specific category like 'what sandwiches do you have' or 'show me your salads'.",
  "url": "https://phone-ai-production.up.railway.app/voice/menu-items/+14695178245",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "parameters": [
    {
      "name": "category",
      "type": "string",
      "required": true,
      "description": "The category name (e.g., 'Appetizers', 'Lunch Sandwiches', 'Beverages')"
    }
  ]
}
```

#### Tool 3: Search Menu

```json
{
  "name": "search_menu",
  "description": "Search for menu items by name or ingredient across all categories. Use this when customer asks for a specific item like 'do you have chicken' or 'I want a burger'.",
  "url": "https://phone-ai-production.up.railway.app/voice/menu-search/+14695178245",
  "method": "GET",
  "headers": {
    "Content-Type": "application/json"
  },
  "parameters": [
    {
      "name": "query",
      "type": "string",
      "required": true,
      "description": "Search term (item name or ingredient)"
    }
  ]
}
```

### Step 2: Update Your Bland.ai Agent Instructions

Add this to your agent's system prompt:

```
MENU INFORMATION:

You have access to three tools to query our menu dynamically:

1. **get_menu_categories**: Get list of all menu categories
   - Use when customer asks "what do you have?" or wants to browse

2. **get_menu_items**: Get items in a specific category
   - Use when customer asks about a category: "what sandwiches do you have?"
   - Returns full details: price, description, modifiers (bread choice, toppings, etc.)

3. **search_menu**: Search for specific items
   - Use when customer asks for specific item: "do you have chicken?"
   - Searches across all categories

IMPORTANT - How to Handle Modifiers:
When an item has modifiers, you MUST ask the customer about each one:

- **REQUIRED modifiers**: Customer must choose (e.g., bread type, cooking temperature)
  - Ask: "What type of bread would you like: white, wheat, or sourdough?"

- **OPTIONAL modifiers**: Customer can add extras (e.g., cheese, avocado)
  - Ask: "Would you like to add any extras? We have cheese ($1.50) or avocado ($2.00)"

- **Multiple selections**: Some modifiers allow multiple choices
  - Example: "You can select up to 3 toppings: lettuce, tomato, onion, pickles"

Example conversation flow:
```
Customer: "What sandwiches do you have?"
AI: [Calls get_menu_categories] "We have Breakfast Sandwiches and Lunch Sandwiches. Which would you like to hear about?"

Customer: "Lunch sandwiches"
AI: [Calls get_menu_items with category="Lunch Sandwiches"] "We have Turkey Club for $12.99, Grilled Chicken for $11.99, and BLT for $9.99. What would you like?"

Customer: "I'll take the Turkey Club"
AI: [Reads modifiers from previous response] "Great choice! What type of bread: white, whole wheat, or sourdough (+$1)?"

Customer: "Whole wheat"
AI: "Perfect. Would you like to add any extras? Extra cheese is $1.50 or avocado is $2."

Customer: "Add avocado"
AI: "Got it. Turkey Club on whole wheat with avocado. That'll be $14.99. Anything else?"
```

BEST PRACTICES:
- Call get_menu_categories first to understand what's available
- Use search_menu for specific requests ("do you have vegetarian options?")
- Always read modifier information and ask customer about required modifiers
- Calculate total price including modifier costs
- Confirm the full order with all selections before processing payment
```

### Step 3: Test the Tools

Before going live, test each tool:

1. **Test Get Categories**:
   ```bash
   curl https://phone-ai-production.up.railway.app/voice/menu-categories/+14695178245
   ```

2. **Test Get Items**:
   ```bash
   curl "https://phone-ai-production.up.railway.app/voice/menu-items/+14695178245?category=Lunch%20Sandwiches"
   ```

3. **Test Search**:
   ```bash
   curl "https://phone-ai-production.up.railway.app/voice/menu-search/+14695178245?query=chicken"
   ```

### Step 4: Remove Old Knowledge Base

Since you're now using API tools, you should:
1. Remove the full menu from Bland.ai knowledge base
2. Only keep essential information like hours, location, and policies

---

## Conversation Flow Examples

### Example 1: Browsing Menu

```
Customer: "What do you have?"
AI: [get_menu_categories] "We have Breakfast Sandwiches, Lunch Sandwiches, Salads, Sides, and Beverages. What are you in the mood for?"

Customer: "Breakfast"
AI: [get_menu_items category="Breakfast Sandwiches"] "For breakfast we have:
- Egg & Cheese Croissant - $6.99
- Bacon Egg & Cheese on Bagel - $8.99
- Veggie Breakfast Wrap - $7.99
What can I get you?"
```

### Example 2: Specific Search

```
Customer: "Do you have anything with bacon?"
AI: [search_menu query="bacon"] "Yes! We have:
- Bacon Egg & Cheese Breakfast Sandwich - $8.99
- Turkey Club with bacon - $12.99
- BLT Sandwich - $9.99
Which would you like?"
```

### Example 3: Handling Modifiers

```
Customer: "I'll take a burger"
AI: [search_menu query="burger"] "We have the Classic Burger for $11.99. How would you like it cooked: rare, medium, or well-done?"

Customer: "Medium"
AI: "Great. What type of bun: regular, wheat, or gluten-free (+$2)?"

Customer: "Regular"
AI: "Perfect. Would you like to add any toppings? Cheese (+$1), bacon (+$2), avocado (+$2), or mushrooms (+$1.50)?"

Customer: "Add cheese and bacon"
AI: "Excellent. One Classic Burger, medium, on regular bun with cheese and bacon. Your total is $14.99. Will that be for pickup or delivery?"
```

---

## Troubleshooting

### Problem: API returns empty results

**Check**:
1. Is Toast API connected? Check Railway logs
2. Is menu published in Toast POS?
3. Are items marked as visible for online ordering?

### Problem: Modifiers not showing

**Check**:
1. Modifier visibility settings in Toast POS
2. Railway logs for transformation errors

### Problem: Tool not being called

**Check**:
1. Tool configuration in Bland.ai dashboard
2. Agent instructions mention when to use tools
3. Test tools manually with curl first

---

## Next Steps

1. Configure tools in Bland.ai dashboard
2. Update agent instructions with tool usage guidelines
3. Test with various customer queries
4. Monitor call logs to see tool usage
5. Refine instructions based on performance

---

## API Response Caching

All endpoints use Toast API with caching:
- **Menu data**: Cached for 1 hour
- **Availability**: Cached for 10 minutes
- **Webhook**: Auto-clears cache on menu updates

This ensures fast responses while keeping data current.
