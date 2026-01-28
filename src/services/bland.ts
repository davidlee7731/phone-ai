import axios from 'axios';
import { Database } from '../database/client';
import { OrderService } from './orders';
import { ToastService } from './toast';

const BLAND_API_KEY = process.env.BLAND_API_KEY!;
const BLAND_API_URL = 'https://api.bland.ai/v1';

interface BlandCallParams {
  phone_number: string;
  task?: string;
  pathway_id?: string;
  voice?: string;
  max_duration?: number;
  webhook?: string;
  from?: string;
}

interface Restaurant {
  id: string;
  name: string;
  phone_number: string;
  address: string;
  menu: any;
  settings: any;
  business_hours?: any;
  timezone?: string;
  pos_system?: string;
  pos_credentials?: any;
}

class BlandServiceClass {
  private apiClient = axios.create({
    baseURL: BLAND_API_URL,
    headers: {
      'Authorization': BLAND_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  /**
   * Generate AI task instructions for a restaurant
   */
  private async generateTaskInstructions(restaurant: Restaurant): Promise<string> {
    const settings = typeof restaurant.settings === 'string'
      ? JSON.parse(restaurant.settings)
      : restaurant.settings;

    const businessHours = typeof restaurant.business_hours === 'string'
      ? JSON.parse(restaurant.business_hours)
      : restaurant.business_hours;

    const hoursText = this.formatBusinessHoursForAI(businessHours, restaurant.timezone || 'America/New_York');
    const isOpen = await this.isRestaurantOpenDynamic(restaurant, businessHours);

    return `You are an AI phone assistant for ${restaurant.name}, a quick-service restaurant.

IMPORTANT: We are a quick-service restaurant - we do NOT take reservations or have table service. We only handle takeout and delivery orders.

Restaurant Information:
- Name: ${restaurant.name}
- Address: ${restaurant.address}
- Phone: ${restaurant.phone_number}

${hoursText}

CURRENT STATUS: ${isOpen ? '🟢 WE ARE OPEN' : '🔴 WE ARE CLOSED'}

${isOpen ? `Your role:
1. Take food orders for pickup or delivery
2. Answer questions about menu items, hours, and location
3. Process payments over the phone
4. Provide excellent customer service` : `IMPORTANT - WE ARE CURRENTLY CLOSED:
- DO NOT take orders or process payments
- Politely inform the caller we are closed
- Provide our business hours and let them know when we reopen
- Offer to answer questions about menu or location
- Thank them for calling and invite them to call back during business hours`}

MENU INFORMATION:
The complete menu with all items, prices, and descriptions is available in your knowledge base. Use it to:
- Answer questions about menu items and prices
- Suggest items based on customer preferences
- Provide accurate pricing for orders
- Describe ingredients and allergen information

${isOpen ? `Order Process (ONLY when open):
1. Greet the customer warmly: "${settings.greeting || `Thank you for calling ${restaurant.name}! How can I help you today?`}"
2. Take their order, confirming each item and quantity
3. Ask if it's for pickup or delivery
4. If delivery, get their address
5. Repeat the complete order back to confirm
6. Provide total price
7. Ask for payment information
8. Confirm estimated ready time (${settings.orderLeadTime || 30} minutes)
9. Thank them and end the call` : `When Closed - Greeting:
"Thank you for calling ${restaurant.name}. I apologize, but we're currently closed. We're open ${this.getNextOpenTime(businessHours, restaurant.timezone || 'America/New_York')}. How can I help you?"`}

Important Guidelines:
- Be friendly, professional, and concise
- Speak naturally like a real person
${isOpen ? '- Confirm order details to ensure accuracy' : '- DO NOT take orders when closed - be apologetic but firm'}
- If asked about reservations or dine-in, politely explain we're a quick-service restaurant and only offer pickup/delivery
- For questions about allergens, provide information from the menu
- If you don't know something, offer to transfer them or have someone call back
- Keep the conversation moving - this is a phone call, not a chat

Payment:
- Let customers know we accept credit/debit cards over the phone
- For security, don't repeat card numbers back
- Confirm the payment went through

Remember: You're representing ${restaurant.name}. Be helpful and make ordering easy!

CRITICAL - Order Data Format:
When an order is placed, you MUST include this exact structured data at the end of the call in this format:

ORDER_DATA_START
{
  "order_placed": true,
  "order_type": "pickup" or "delivery",
  "items": [
    {
      "itemName": "exact menu item name",
      "quantity": number,
      "price": number,
      "modifiers": ["modifier1", "modifier2"],
      "specialInstructions": "any special requests"
    }
  ],
  "customer": {
    "phone": "customer phone number",
    "name": "customer name if provided"
  },
  "delivery_address": "full address if delivery order",
  "special_instructions": "overall order notes",
  "payment_method": "card",
  "card_last4": "last 4 digits of card if provided"
}
ORDER_DATA_END

This structured data is required for order processing. Include it even if the customer doesn't complete payment.`;
  }

  /**
   * Format business hours for AI understanding
   */
  private formatBusinessHoursForAI(businessHours: any, timezone: string): string {
    if (!businessHours) {
      return 'Business Hours: Not specified';
    }

    let hoursText = 'BUSINESS HOURS:\n';
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      const dayHours = businessHours[day];
      if (dayHours && dayHours.open && dayHours.close) {
        hoursText += `${day.charAt(0).toUpperCase() + day.slice(1)}: ${dayHours.open} - ${dayHours.close}\n`;
      } else {
        hoursText += `${day.charAt(0).toUpperCase() + day.slice(1)}: Closed\n`;
      }
    }

    hoursText += `\nTimezone: ${timezone}\n`;
    return hoursText;
  }

  /**
   * Get restaurant menu - uses Toast API if available
   * Falls back to database menu if Toast API unavailable
   */
  private async getRestaurantMenuDynamic(restaurant: Restaurant): Promise<any> {
    // If restaurant uses Toast POS, fetch menu from Toast API
    if (restaurant.pos_system === 'toast' && restaurant.pos_credentials) {
      try {
        const credentials = typeof restaurant.pos_credentials === 'string'
          ? JSON.parse(restaurant.pos_credentials)
          : restaurant.pos_credentials;

        // Check if we have Toast API credentials (clientId and clientSecret)
        if (credentials.toast_client_id && credentials.toast_client_secret && credentials.toast_restaurant_guid) {
          console.log(`Fetching menu from Toast API for restaurant ${restaurant.id}`);
          const toastMenu = await ToastService.getRestaurantMenu(
            credentials.toast_restaurant_guid,
            credentials.toast_client_id,
            credentials.toast_client_secret
          );

          // Transform Toast menu format to internal format
          return this.transformToastMenuToInternalFormat(toastMenu);
        } else {
          console.log(`Restaurant ${restaurant.id} doesn't have Toast API credentials - using database menu`);
        }
      } catch (error) {
        console.error(`Error fetching menu from Toast API for restaurant ${restaurant.id}:`, error);
        console.log('Falling back to database menu');
      }
    }

    // Fall back to database menu
    const menu = typeof restaurant.menu === 'string'
      ? JSON.parse(restaurant.menu)
      : restaurant.menu;

    return menu;
  }

  /**
   * Transform Toast API menu format to internal format expected by AI
   * Filters out hidden/unavailable items and includes modifiers
   */
  private transformToastMenuToInternalFormat(toastMenu: any): any {
    if (!toastMenu || !toastMenu.menus || toastMenu.menus.length === 0) {
      return { categories: [] };
    }

    // Build lookup maps for modifiers
    const modifierGroupsMap = toastMenu.modifierGroupReferences || {};
    const modifierOptionsMap = toastMenu.modifierOptionReferences || {};

    const categories: any[] = [];

    // Filter menus by whitelist if configured
    const menuWhitelist = process.env.TOAST_MENU_WHITELIST
      ? process.env.TOAST_MENU_WHITELIST.split(',').map((name: string) => name.trim().toLowerCase())
      : null;

    const filteredMenus = menuWhitelist
      ? toastMenu.menus.filter((menu: any) => menuWhitelist.includes(menu.name?.toLowerCase()))
      : toastMenu.menus;

    if (menuWhitelist) {
      const allMenuNames = toastMenu.menus.map((m: any) => m.name);
      console.log(`Toast menu whitelist active. All menus: [${allMenuNames.join(', ')}]. Using: [${filteredMenus.map((m: any) => m.name).join(', ')}]`);
    } else {
      const allMenuNames = toastMenu.menus.map((m: any) => m.name);
      console.log(`No TOAST_MENU_WHITELIST set. Available menus: [${allMenuNames.join(', ')}]`);
    }

    for (const menu of filteredMenus) {
      if (!menu.menuGroups) continue;

      // Each menuGroup becomes a category
      for (const group of menu.menuGroups) {
        // Skip groups with no items (note: Toast uses 'menuItems' not 'items')
        if (!group.menuItems || group.menuItems.length === 0) continue;

        // Filter and map items
        const visibleItems = group.menuItems
          .filter((item: any) => {
            // Skip items without visibility array (hidden from ordering)
            if (!item.visibility || !Array.isArray(item.visibility) || item.visibility.length === 0) {
              return false;
            }

            // Only include items visible for online ordering
            const isVisibleOnline = item.visibility.includes('TOAST_ONLINE_ORDERING') ||
                                   item.visibility.includes('ORDERING_PARTNERS');

            return isVisibleOnline && item.name && item.price !== undefined;
          })
          .map((item: any) => {
            const mappedItem: any = {
              name: item.name,
              price: item.price || 0,
              description: item.description?.trim() || '',
            };

            // Resolve modifiers
            if (item.modifierGroupReferences && item.modifierGroupReferences.length > 0) {
              mappedItem.modifiers = [];

              for (const groupRef of item.modifierGroupReferences) {
                const modGroup = modifierGroupsMap[groupRef];
                if (!modGroup) continue;

                // Skip hidden modifier groups
                if (modGroup.visibility && modGroup.visibility.length > 0) {
                  const isGroupVisible = modGroup.visibility.includes('TOAST_ONLINE_ORDERING') ||
                                        modGroup.visibility.includes('ORDERING_PARTNERS');
                  if (!isGroupVisible) continue;
                }

                const simplifiedModGroup: any = {
                  name: modGroup.name,
                  required: modGroup.requiredMode === 'REQUIRED',
                  minSelections: modGroup.minSelections || 0,
                  maxSelections: modGroup.maxSelections || 999,
                  multiSelect: modGroup.isMultiSelect || false,
                  options: []
                };

                // Resolve modifier options
                if (modGroup.modifierOptionReferences && modGroup.modifierOptionReferences.length > 0) {
                  for (const optionRef of modGroup.modifierOptionReferences) {
                    const modOption = modifierOptionsMap[optionRef];
                    if (!modOption) continue;

                    // Skip hidden options
                    if (modOption.visibility && modOption.visibility.length > 0) {
                      const isOptionVisible = modOption.visibility.includes('TOAST_ONLINE_ORDERING') ||
                                             modOption.visibility.includes('ORDERING_PARTNERS');
                      if (!isOptionVisible) continue;
                    }

                    simplifiedModGroup.options.push({
                      name: modOption.name,
                      price: modOption.price || 0,
                      isDefault: modOption.isDefault || false
                    });
                  }
                }

                // Only add modifier group if it has options
                if (simplifiedModGroup.options.length > 0) {
                  mappedItem.modifiers.push(simplifiedModGroup);
                }
              }

              // Remove modifiers array if empty
              if (mappedItem.modifiers.length === 0) {
                delete mappedItem.modifiers;
              }
            }

            return mappedItem;
          });

        // Only add category if it has visible items
        if (visibleItems.length > 0) {
          categories.push({
            name: group.name,
            items: visibleItems
          });
        }
      }
    }

    return { categories };
  }

  /**
   * Check if restaurant is currently open - uses Toast API if available
   * Falls back to database business hours if Toast API unavailable
   */
  private async isRestaurantOpenDynamic(restaurant: Restaurant, businessHours: any): Promise<boolean> {
    // If restaurant uses Toast POS, check real-time availability from Toast API
    if (restaurant.pos_system === 'toast' && restaurant.pos_credentials) {
      try {
        const credentials = typeof restaurant.pos_credentials === 'string'
          ? JSON.parse(restaurant.pos_credentials)
          : restaurant.pos_credentials;

        // Check if we have Toast API credentials (clientId and clientSecret)
        if (credentials.toast_client_id && credentials.toast_client_secret && credentials.toast_restaurant_guid) {
          console.log(`Checking Toast API for restaurant ${restaurant.id} availability`);
          const isOpen = await ToastService.isRestaurantOpen(
            credentials.toast_restaurant_guid,
            credentials.toast_client_id,
            credentials.toast_client_secret
          );
          return isOpen;
        } else if (credentials.itsacheckmate_restaurant_guid) {
          // We have Itsacheckmate but not direct Toast API access
          // Fall back to database hours
          console.log(`Restaurant ${restaurant.id} uses Itsacheckmate - falling back to database hours`);
        }
      } catch (error) {
        console.error(`Error checking Toast availability for restaurant ${restaurant.id}:`, error);
        console.log('Falling back to database business hours');
      }
    }

    // Fall back to database business hours
    return this.isRestaurantOpen(businessHours, restaurant.timezone || 'America/New_York');
  }

  /**
   * Check if restaurant is currently open based on business hours
   */
  private isRestaurantOpen(businessHours: any, timezone: string): boolean {
    if (!businessHours) {
      return true; // If no hours specified, assume always open
    }

    try {
      // Get current time in restaurant's timezone
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);

      const weekday = parts.find(p => p.type === 'weekday')?.value.toLowerCase();
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
      const currentMinutes = hour * 60 + minute;

      if (!weekday || !businessHours[weekday]) {
        return true; // If we can't determine, assume open
      }

      const dayHours = businessHours[weekday];
      if (!dayHours.open || !dayHours.close) {
        return false; // Closed on this day
      }

      // Parse open and close times
      const parseTime = (timeStr: string): number => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const openMinutes = parseTime(dayHours.open);
      const closeMinutes = parseTime(dayHours.close);

      // Check if current time is within business hours
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } catch (error) {
      console.error('Error checking if restaurant is open:', error);
      return true; // If error, assume open to avoid blocking service
    }
  }

  /**
   * Get human-readable text for when restaurant opens next
   */
  private getNextOpenTime(businessHours: any, timezone: string): string {
    if (!businessHours) {
      return 'during our regular business hours';
    }

    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };

      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);
      const currentWeekday = parts.find(p => p.type === 'weekday')?.value.toLowerCase() || '';

      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const currentDayIndex = days.indexOf(currentWeekday);

      // Check next 7 days for next opening
      for (let i = 0; i < 7; i++) {
        const dayIndex = (currentDayIndex + i) % 7;
        const day = days[dayIndex];
        const dayHours = businessHours[day];

        if (dayHours && dayHours.open) {
          if (i === 0) {
            return `today at ${dayHours.open}`;
          } else if (i === 1) {
            return `tomorrow at ${dayHours.open}`;
          } else {
            return `on ${day.charAt(0).toUpperCase() + day.slice(1)} at ${dayHours.open}`;
          }
        }
      }

      return 'during our regular business hours';
    } catch (error) {
      console.error('Error getting next open time:', error);
      return 'during our regular business hours';
    }
  }

  /**
   * Make an outbound call using Bland.ai
   */
  async makeOutboundCall(params: BlandCallParams) {
    try {
      const response = await this.apiClient.post('/calls', params);
      return response.data;
    } catch (error: any) {
      console.error('Error making Bland.ai call:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get task instructions for a restaurant to use with inbound calls
   */
  async getRestaurantTask(phoneNumber: string): Promise<string> {
    // Get restaurant from database
    const result = await Database.query(
      'SELECT * FROM restaurants WHERE phone_number = $1',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      throw new Error(`No restaurant found for number ${phoneNumber}`);
    }

    const restaurant = result.rows[0];
    return await this.generateTaskInstructions(restaurant);
  }

  /**
   * Get restaurant menu for knowledge base
   * Returns formatted menu text suitable for Bland.ai knowledge base
   */
  async getRestaurantMenu(phoneNumber: string): Promise<string> {
    // Get restaurant from database
    const result = await Database.query(
      'SELECT * FROM restaurants WHERE phone_number = $1',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      throw new Error(`No restaurant found for number ${phoneNumber}`);
    }

    const restaurant = result.rows[0];

    // Fetch menu dynamically from Toast API if available
    const menu = await this.getRestaurantMenuDynamic(restaurant);

    // Format menu for knowledge base
    return this.formatMenuForKnowledgeBase(menu, restaurant.name);
  }

  /**
   * Get menu categories for a restaurant
   * API Tool: Returns list of category names for Bland.ai to query
   */
  async getMenuCategories(phoneNumber: string): Promise<string[]> {
    const result = await Database.query(
      'SELECT * FROM restaurants WHERE phone_number = $1',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      throw new Error(`No restaurant found for number ${phoneNumber}`);
    }

    const restaurant = result.rows[0];
    const menu = await this.getRestaurantMenuDynamic(restaurant);

    if (!menu || !menu.categories) {
      return [];
    }

    return menu.categories.map((cat: any) => cat.name);
  }

  /**
   * Get menu items in a specific category
   * API Tool: Returns items with full details (name, price, description, modifiers)
   */
  async getMenuItems(phoneNumber: string, categoryName: string): Promise<any[]> {
    const result = await Database.query(
      'SELECT * FROM restaurants WHERE phone_number = $1',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      throw new Error(`No restaurant found for number ${phoneNumber}`);
    }

    const restaurant = result.rows[0];
    const menu = await this.getRestaurantMenuDynamic(restaurant);

    if (!menu || !menu.categories) {
      return [];
    }

    // Find category (case-insensitive)
    const category = menu.categories.find(
      (cat: any) => cat.name.toLowerCase() === categoryName.toLowerCase()
    );

    if (!category) {
      return [];
    }

    // Return items with all details
    return category.items.map((item: any) => ({
      name: item.name,
      price: item.price,
      description: item.description || '',
      modifiers: item.modifiers || []
    }));
  }

  /**
   * Search menu items by name
   * API Tool: Returns matching items across all categories
   */
  async searchMenuItems(phoneNumber: string, searchQuery: string): Promise<any[]> {
    const result = await Database.query(
      'SELECT * FROM restaurants WHERE phone_number = $1',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      throw new Error(`No restaurant found for number ${phoneNumber}`);
    }

    const restaurant = result.rows[0];
    const menu = await this.getRestaurantMenuDynamic(restaurant);

    if (!menu || !menu.categories) {
      return [];
    }

    const results: any[] = [];
    const query = searchQuery.toLowerCase();

    // Search across all categories
    for (const category of menu.categories) {
      for (const item of category.items) {
        // Match on item name or description
        if (
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query))
        ) {
          results.push({
            name: item.name,
            price: item.price,
            description: item.description || '',
            category: category.name,
            modifiers: item.modifiers || []
          });
        }
      }
    }

    return results;
  }

  /**
   * Format menu for Bland.ai knowledge base
   * Creates a compact, easy-to-parse format optimized for AI understanding
   */
  private formatMenuForKnowledgeBase(menu: any, restaurantName: string): string {
    if (!menu || !menu.categories || menu.categories.length === 0) {
      return `${restaurantName} Menu\n\nNo menu items available at this time.`;
    }

    let menuText = `${restaurantName} MENU\n\n`;
    let totalItems = 0;
    let totalModifiers = 0;

    for (const category of menu.categories) {
      menuText += `${category.name.toUpperCase()}:\n`;

      for (const item of category.items) {
        totalItems++;
        const price = typeof item.price === 'number' ? item.price.toFixed(2) : item.price;

        // Item name and price
        menuText += `\n  • ${item.name} - $${price}\n`;

        // Description (truncated to 80 chars)
        // if (item.description && item.description.trim()) {
        //   let description = item.description.trim();
        //   if (description.length > 80) {
        //     description = description.substring(0, 77) + '...';
        //   }
        //   menuText += `    ${description}\n`;
        // }

        // Modifiers - compact format
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modGroup of item.modifiers) {
            totalModifiers++;
            if (modGroup.required) {
              if (modGroup.minSelections === modGroup.maxSelections) {
                menuText += `    '[${modGroup.minSelections} REQUIRED selection]' ${modGroup.name}:\n`;
              } else {
              menuText += `    '[REQUIRED selections. At least ${modGroup.minSelections} and up to ${modGroup.maxSelections} selections]' ${modGroup.name}:\n`;
            }
            } else {
              if (modGroup.minSelections === modGroup.maxSelections) {
                menuText += `    '[Up to ${modGroup.maxSelections} OPTIONAL selection]' ${modGroup.name}:\n`;
              } else {
                menuText += `    '[OPTIONAL selections. At least ${modGroup.minSelections} and up to ${modGroup.maxSelections} selections]' ${modGroup.name}:\n`;
              }
            }
            // const required = modGroup.required ? '[REQUIRED]' : '[OPTIONAL]';
            // // const selections = modGroup.multiSelect ?
            // const selections = modGroup.multiSelect
            //   ? `(${modGroup.minSelections}-${modGroup.maxSelections})`
            //   : '(1)';

            // menuText += `    ${required} ${modGroup.name} ${selections}:\n`;

            // Only show first few options to save space, indicate if there are more
            const maxOptionsToShow = 50;
            const optionsToShow = modGroup.options.slice(0, maxOptionsToShow);
            const hasMore = modGroup.options.length > maxOptionsToShow;

            for (const option of optionsToShow) {
              const optPrice = option.price || 0;
              //const priceStr = optPrice === 0 ? '' : ` (+$${Math.abs(optPrice).toFixed(2)})`;
              const priceStr = optPrice > 0 ? ` (+$${Math.abs(optPrice).toFixed(2)})` : optPrice < 0 ? ` (-$${Math.abs(optPrice).toFixed(2)})` : ''

              menuText += `      - ${option.name}${priceStr}\n`;
            }

            if (hasMore) {
              menuText += `      ... and ${modGroup.options.length - maxOptionsToShow} more options\n`;
            }
          }
        }
      }

      menuText += `\n`;
    }

    // Log menu size for monitoring
    const menuSizeKB = Math.round(menuText.length / 1024);
    console.log(`Menu formatted: ${totalItems} items, ${totalModifiers} modifier groups, ${menuSizeKB}KB`);

    // Warn if menu is very large
    if (menuSizeKB > 100) {
      console.warn(`⚠️  Menu is large (${menuSizeKB}KB). May be difficult for AI to process.`);
    } else if (menuSizeKB > 50) {
      console.log(`ℹ️  Menu is moderately large (${menuSizeKB}KB) but should be OK.`);
    }

    return menuText;
  }

  /**
   * Handle webhook from Bland.ai after call completes
   */
  async handleCallWebhook(webhookData: any) {
    try {
      // Bland.ai can send different field names depending on the event
      const callId = webhookData.call_id || webhookData.c_id;
      const toNumber = webhookData.to || webhookData.to_number;
      const fromNumber = webhookData.from || webhookData.from_number;
      const callStatus = webhookData.status || webhookData.call_status || 'completed';
      const callDuration = webhookData.call_length || webhookData.duration || 0;
      const callTranscript = webhookData.concatenated_transcript || webhookData.transcript || '';

      console.log(`Bland.ai webhook received:`, {
        callId,
        toNumber,
        fromNumber,
        callStatus,
        callDuration,
        hasTranscript: !!callTranscript
      });

      // If no call_id, this might be a test webhook or different event type
      if (!callId) {
        console.warn('No call_id in webhook, skipping database insert:', webhookData);
        return { success: true, message: 'Webhook received but no call_id present' };
      }

      // Save or update call in database
      await Database.query(
        `INSERT INTO calls (call_sid, from_number, to_number, status, duration, transcript, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (call_sid)
         DO UPDATE SET
           status = $4,
           duration = $5,
           transcript = $6,
           ended_at = NOW()`,
        [callId, fromNumber, toNumber, callStatus, callDuration, callTranscript]
      );

      // Parse transcript for analytics if available
      if (callTranscript) {
        await this.analyzeCallTranscript(callId, callTranscript);

        // Process order if one was placed during the call
        await this.processOrderFromTranscript(callId, toNumber, fromNumber, callTranscript);
      }

      return { success: true, call_id: callId };
    } catch (error) {
      console.error('Error handling Bland.ai webhook:', error);
      throw error;
    }
  }

  /**
   * Analyze call transcript for insights
   */
  private async analyzeCallTranscript(callId: string, transcript: string) {
    try {
      // Simple keyword-based intent detection
      const lowerTranscript = transcript.toLowerCase();

      let intent = 'question';
      if (lowerTranscript.includes('order') || lowerTranscript.includes('delivery') || lowerTranscript.includes('pickup')) {
        intent = 'order';
      } else if (lowerTranscript.includes('reservation') || lowerTranscript.includes('table')) {
        intent = 'reservation';
      } else if (lowerTranscript.includes('complaint') || lowerTranscript.includes('problem')) {
        intent = 'complaint';
      }

      // Update call record with detected intent
      await Database.query(
        'UPDATE calls SET intent = $1 WHERE call_sid = $2',
        [intent, callId]
      );

      console.log(`Call ${callId} intent detected: ${intent}`);
    } catch (error) {
      console.error('Error analyzing transcript:', error);
    }
  }

  /**
   * Process order from call transcript
   */
  private async processOrderFromTranscript(
    callId: string,
    restaurantPhoneNumber: string,
    customerPhoneNumber: string,
    transcript: string
  ) {
    try {
      // Extract structured order data from transcript
      const orderDataMatch = transcript.match(/ORDER_DATA_START\s*(\{[\s\S]*?\})\s*ORDER_DATA_END/);

      if (!orderDataMatch) {
        console.log(`No order data found in transcript for call ${callId}`);
        return;
      }

      const orderData = JSON.parse(orderDataMatch[1]);

      if (!orderData.order_placed) {
        console.log(`Order not completed in call ${callId}`);
        return;
      }

      console.log('Order detected in call:', callId, orderData);

      // Get restaurant from database
      const restaurantResult = await Database.query(
        'SELECT id, pos_system, business_hours, timezone FROM restaurants WHERE phone_number = $1',
        [restaurantPhoneNumber]
      );

      if (restaurantResult.rows.length === 0) {
        console.error(`Restaurant not found for phone number ${restaurantPhoneNumber}`);
        return;
      }

      const restaurant = restaurantResult.rows[0];

      // Safety check: Don't process orders if restaurant is closed
      const businessHours = typeof restaurant.business_hours === 'string'
        ? JSON.parse(restaurant.business_hours)
        : restaurant.business_hours;

      const isOpen = await this.isRestaurantOpenDynamic(restaurant, businessHours);
      if (!isOpen) {
        console.warn(`Order attempted while restaurant ${restaurant.id} is closed. Skipping order creation.`);
        return;
      }

      // Find or create customer
      let customer;
      const customerResult = await Database.query(
        'SELECT id FROM customers WHERE phone_number = $1',
        [customerPhoneNumber]
      );

      if (customerResult.rows.length > 0) {
        customer = customerResult.rows[0];
      } else {
        // Create new customer
        const newCustomerResult = await Database.query(
          `INSERT INTO customers (phone_number, name, restaurant_id)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [customerPhoneNumber, orderData.customer.name || 'Phone Order Customer', restaurant.id]
        );
        customer = newCustomerResult.rows[0];
      }

      // Create order in database
      const order = await OrderService.createOrder({
        restaurantId: restaurant.id,
        customerId: customer.id,
        callId: callId,
        items: orderData.items,
        orderType: orderData.order_type,
        deliveryAddress: orderData.delivery_address,
        specialInstructions: orderData.special_instructions,
      });

      console.log('Order created in database:', order.id);

      // Sync to POS if configured
      if (restaurant.pos_system) {
        try {
          const posSync = await OrderService.syncToPOS(order.id);
          console.log(`Order ${order.id} synced to ${restaurant.pos_system}:`, posSync);
        } catch (error) {
          console.error(`Failed to sync order ${order.id} to POS:`, error);
          // Order is still created in database, POS sync can be retried
        }
      } else {
        console.warn(`No POS system configured for restaurant ${restaurant.id}`);
      }

      return order;
    } catch (error) {
      console.error('Error processing order from transcript:', error);
      // Don't throw - we don't want to fail the webhook if order processing fails
    }
  }

  /**
   * Get call details from Bland.ai
   */
  async getCallDetails(callId: string) {
    try {
      const response = await this.apiClient.get(`/calls/${callId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting call details:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const BlandService = new BlandServiceClass();
