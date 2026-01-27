/**
 * Toast POS Integration Service
 *
 * Handles real-time restaurant availability checking from Toast POS
 * Uses the Restaurant Availability API to determine if restaurant is open
 * Fetches menu data from Toast POS dynamically
 *
 * API Docs:
 * - Availability: https://doc.toasttab.com/doc/devguide/apiGettingRxOnlineOrderingAvailability.html
 * - Menus: https://doc.toasttab.com/doc/devguide/apiGettingMenuInformationFromTheMenusAPI.html
 */

interface ToastAvailabilityResponse {
  status: 'ONLINE' | 'OFFLINE';
  restaurantGuid: string;
  timestamp?: string;
}

interface CachedAvailability {
  isOnline: boolean;
  cachedAt: number;
  expiresAt: number;
}

interface ToastMenuItem {
  guid: string;
  name: string;
  description?: string;
  price?: number;
  calories?: string;
  visibility?: string;
  optionGroups?: ToastMenuOptionGroup[];
}

interface ToastMenuOptionGroup {
  guid: string;
  name: string;
  minSelections?: number;
  maxSelections?: number;
  items: ToastMenuItem[];
}

interface ToastMenuGroup {
  guid: string;
  name: string;
  description?: string;
  visibility?: string;
  items: ToastMenuItem[];
}

interface ToastMenu {
  guid: string;
  name: string;
  menuGroups: ToastMenuGroup[];
}

interface ToastMenusResponse {
  menus: ToastMenu[];
}

interface CachedMenu {
  menu: ToastMenusResponse;
  cachedAt: number;
  expiresAt: number;
}

interface ToastAuthResponse {
  '@class': string;
  token: {
    tokenType: string;
    scope: string | null;
    expiresIn: number;
    accessToken: string;
  };
}

interface CachedAuthToken {
  token: string;
  expiresAt: number;
}

class ToastServiceClass {
  private availabilityCache = new Map<string, CachedAvailability>();
  private menuCache = new Map<string, CachedMenu>();
  private authTokenCache = new Map<string, CachedAuthToken>();
  private readonly AVAILABILITY_CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes (Toast recommendation)
  private readonly MENU_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour (menus change less frequently)
  private readonly TOAST_API_BASE = 'https://ws-api.toasttab.com';

  /**
   * Authenticate with Toast API and get an access token
   * Caches the token until it expires
   */
  private async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    // Check if we have a cached valid token
    const cacheKey = `${clientId}:${clientSecret}`;
    const cached = this.authTokenCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      console.log('Using cached Toast auth token');
      return cached.token;
    }

    try {
      console.log('Authenticating with Toast API...');
      const response = await fetch(
        `${this.TOAST_API_BASE}/authentication/v1/authentication/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId,
            clientSecret,
            userAccessType: 'TOAST_MACHINE_CLIENT',
          }),
        }
      );

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = errorBody ? ` - ${errorBody}` : '';
        } catch (e) {
          // Ignore
        }
        throw new Error(`Toast auth error: ${response.status} ${response.statusText}${errorDetails}`);
      }

      const data = await response.json() as ToastAuthResponse;

      // Cache the token (subtract 5 minutes for safety margin)
      const now = Date.now();
      const expiresIn = (data.token.expiresIn - 300) * 1000; // Convert to ms and subtract 5 min

      this.authTokenCache.set(cacheKey, {
        token: data.token.accessToken,
        expiresAt: now + expiresIn,
      });

      console.log(`Toast auth successful, token expires in ${data.token.expiresIn}s`);
      return data.token.accessToken;
    } catch (error) {
      console.error('Error authenticating with Toast:', error);
      throw error;
    }
  }

  /**
   * Check if a restaurant is currently open/available
   * Caches result for 10 minutes as recommended by Toast
   */
  async isRestaurantOpen(restaurantGuid: string, clientId: string, clientSecret: string): Promise<boolean> {
    // Check cache first
    const cached = this.availabilityCache.get(restaurantGuid);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`Using cached availability for ${restaurantGuid}: ${cached.isOnline}`);
      return cached.isOnline;
    }

    try {
      // Get access token
      const accessToken = await this.getAccessToken(clientId, clientSecret);

      // Fetch from Toast API
      const response = await fetch(
        `${this.TOAST_API_BASE}/restaurant-availability/v1/availability/${restaurantGuid}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantGuid,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = errorBody ? ` - ${errorBody}` : '';
        } catch (e) {
          // Ignore if we can't read the error body
        }
        throw new Error(`Toast API error: ${response.status} ${response.statusText}${errorDetails}`);
      }

      const data = await response.json() as ToastAvailabilityResponse;
      const isOnline = data.status === 'ONLINE';

      // Cache the result
      const now = Date.now();
      this.availabilityCache.set(restaurantGuid, {
        isOnline,
        cachedAt: now,
        expiresAt: now + this.AVAILABILITY_CACHE_DURATION_MS,
      });

      console.log(`Toast API: Restaurant ${restaurantGuid} is ${data.status}`);
      return isOnline;
    } catch (error) {
      console.error('Error fetching Toast availability:', error);
      // Return cached value if available, even if expired
      if (cached) {
        console.warn(`Using expired cache for ${restaurantGuid} due to API error`);
        return cached.isOnline;
      }
      throw error;
    }
  }

  /**
   * Get restaurant menu from Toast POS
   * Caches result for 1 hour since menus change less frequently
   * Returns fully resolved menu with groups, items, and modifiers
   */
  async getRestaurantMenu(restaurantGuid: string, clientId: string, clientSecret: string): Promise<ToastMenusResponse> {
    // Check cache first
    const cached = this.menuCache.get(restaurantGuid);
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`Using cached menu for ${restaurantGuid}`);
      return cached.menu;
    }

    try {
      // Get access token
      const accessToken = await this.getAccessToken(clientId, clientSecret);

      // Fetch from Toast API
      // Note: restaurantGuid is passed as query parameter for Config API v2
      const response = await fetch(
        `${this.TOAST_API_BASE}/config/v2/menus?restaurantGuid=${restaurantGuid}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantGuid,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // Try to get error details from response body
        let errorDetails = '';
        try {
          const errorBody = await response.text();
          errorDetails = errorBody ? ` - ${errorBody}` : '';
        } catch (e) {
          // Ignore if we can't read the error body
        }
        throw new Error(`Toast API error: ${response.status} ${response.statusText}${errorDetails}`);
      }

      const data = await response.json() as ToastMenusResponse;

      // Cache the result
      const now = Date.now();
      this.menuCache.set(restaurantGuid, {
        menu: data,
        cachedAt: now,
        expiresAt: now + this.MENU_CACHE_DURATION_MS,
      });

      console.log(`Toast API: Fetched menu for ${restaurantGuid} with ${data.menus?.length || 0} menus`);
      return data;
    } catch (error) {
      console.error('Error fetching Toast menu:', error);
      // Return cached value if available, even if expired
      if (cached) {
        console.warn(`Using expired menu cache for ${restaurantGuid} due to API error`);
        return cached.menu;
      }
      throw error;
    }
  }

  /**
   * Get restaurant schedules and business hours
   * Returns detailed schedule information for the week
   */
  async getRestaurantSchedules(restaurantGuid: string, clientId: string, clientSecret: string) {
    try {
      // Get access token
      const accessToken = await this.getAccessToken(clientId, clientSecret);

      const response = await fetch(
        `${this.TOAST_API_BASE}/restaurants/v1/restaurants/${restaurantGuid}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Toast-Restaurant-External-ID': restaurantGuid,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Toast API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      return {
        schedules: data.schedules,
        timeZone: data.timeZone,
        closeoutHour: data.closeoutHour,
      };
    } catch (error) {
      console.error('Error fetching Toast restaurant schedules:', error);
      throw error;
    }
  }

  /**
   * Get online ordering schedule
   * Returns takeout and delivery hours
   */
  async getOnlineOrderingSchedule(restaurantGuid: string, apiKey: string) {
    try {
      const response = await fetch(
        `${this.TOAST_API_BASE}/config/v2/orderingSchedule`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Toast-Restaurant-External-ID': restaurantGuid,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Toast API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching Toast ordering schedule:', error);
      throw error;
    }
  }

  /**
   * Clear availability and menu cache for a specific restaurant or all restaurants
   */
  clearCache(restaurantGuid?: string) {
    if (restaurantGuid) {
      this.availabilityCache.delete(restaurantGuid);
      this.menuCache.delete(restaurantGuid);
      console.log(`Cleared caches for ${restaurantGuid}`);
    } else {
      this.availabilityCache.clear();
      this.menuCache.clear();
      console.log('Cleared all caches');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const availabilityEntries = Array.from(this.availabilityCache.entries());
    const menuEntries = Array.from(this.menuCache.entries());

    return {
      availability: {
        totalEntries: availabilityEntries.length,
        entries: availabilityEntries.map(([guid, cached]) => ({
          restaurantGuid: guid,
          isOnline: cached.isOnline,
          cachedAt: new Date(cached.cachedAt).toISOString(),
          expiresAt: new Date(cached.expiresAt).toISOString(),
          isExpired: Date.now() >= cached.expiresAt,
        })),
      },
      menu: {
        totalEntries: menuEntries.length,
        entries: menuEntries.map(([guid, cached]) => ({
          restaurantGuid: guid,
          menuCount: cached.menu.menus?.length || 0,
          cachedAt: new Date(cached.cachedAt).toISOString(),
          expiresAt: new Date(cached.expiresAt).toISOString(),
          isExpired: Date.now() >= cached.expiresAt,
        })),
      },
    };
  }
}

export const ToastService = new ToastServiceClass();
