/**
 * Itsacheckmate Integration Service
 *
 * Itsacheckmate provides API access to Toast POS, which doesn't have public APIs.
 * This service handles:
 * - Order injection into Toast
 * - Payment processing through Toast POS payment processor
 * - Order status updates
 *
 * Benefits over Stripe:
 * - Lower fees (use your existing Toast payment processor)
 * - Seamless integration with Toast POS
 * - No need for separate payment gateway
 */

import { Database } from '../database/client';

interface ItsacheckmateCredentials {
  api_key: string;
  restaurant_guid: string;
}

interface CreateOrderPayload {
  order: any;
  customer: {
    name?: string;
    phone: string;
    email?: string;
    address?: string;
  };
  paymentInfo?: {
    cardNumber: string;
    expiryMonth: number;
    expiryYear: number;
    cvv: string;
    zipCode: string;
  };
}

class ItsacheckmateServiceClass {
  private baseUrl = 'https://api.itsacheckmate.com/v1';

  /**
   * Create and submit an order to Toast POS via Itsacheckmate
   * This includes payment processing through Toast's payment processor
   */
  async createOrder(credentials: ItsacheckmateCredentials, payload: CreateOrderPayload) {
    const { order, customer, paymentInfo } = payload;

    // Build the order payload for Itsacheckmate API
    const orderPayload = {
      restaurantGuid: credentials.restaurant_guid,
      externalOrderId: order.order_number,
      orderType: order.order_type === 'pickup' ? 'PICKUP' : 'DELIVERY',

      // Customer information
      customer: {
        name: customer.name || 'Phone Order Customer',
        phone: customer.phone,
        email: customer.email || '',
      },

      // Order items
      items: JSON.parse(order.items).map((item: any) => ({
        name: item.itemName,
        quantity: item.quantity,
        price: item.price,
        modifiers: item.modifiers || [],
        specialInstructions: item.specialInstructions || '',
      })),

      // Pricing
      subtotal: parseFloat(order.subtotal),
      tax: parseFloat(order.tax),
      tip: parseFloat(order.tip || 0),
      total: parseFloat(order.total),

      // Additional info
      specialInstructions: order.special_instructions || '',
      scheduledFor: order.scheduled_for,
    };

    // Add delivery address if delivery order
    if (order.order_type === 'delivery' && order.delivery_address) {
      orderPayload.customer.address = order.delivery_address;
    }

    // Add payment information if provided
    // Itsacheckmate will process payment through Toast's payment processor
    if (paymentInfo) {
      orderPayload.payment = {
        method: 'CARD',
        cardDetails: {
          number: paymentInfo.cardNumber,
          expiryMonth: paymentInfo.expiryMonth,
          expiryYear: paymentInfo.expiryYear,
          cvv: paymentInfo.cvv,
          zipCode: paymentInfo.zipCode,
        },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.api_key}`,
        },
        body: JSON.stringify(orderPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Itsacheckmate API error: ${error.message || response.statusText}`);
      }

      const result = await response.json();

      return {
        success: true,
        toastOrderId: result.toastOrderId,
        orderGuid: result.orderGuid,
        paymentStatus: result.paymentStatus, // 'PAID', 'PENDING', 'FAILED'
        paymentTransactionId: result.paymentTransactionId,
        message: result.message,
      };
    } catch (error) {
      console.error('Itsacheckmate order creation failed:', error);
      throw error;
    }
  }

  /**
   * Get order status from Toast via Itsacheckmate
   */
  async getOrderStatus(credentials: ItsacheckmateCredentials, orderGuid: string) {
    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderGuid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.api_key}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get order status: ${response.statusText}`);
      }

      const result = await response.json();

      return {
        orderGuid: result.orderGuid,
        toastOrderId: result.toastOrderId,
        status: result.status, // 'NEW', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED'
        paymentStatus: result.paymentStatus,
        estimatedReadyTime: result.estimatedReadyTime,
      };
    } catch (error) {
      console.error('Failed to get order status:', error);
      throw error;
    }
  }

  /**
   * Cancel an order in Toast via Itsacheckmate
   */
  async cancelOrder(credentials: ItsacheckmateCredentials, orderGuid: string) {
    try {
      const response = await fetch(`${this.baseUrl}/orders/${orderGuid}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.api_key}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to cancel order: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to cancel order:', error);
      throw error;
    }
  }

  /**
   * Refund an order through Toast payment processor
   */
  async refundOrder(credentials: ItsacheckmateCredentials, orderGuid: string, amount?: number) {
    try {
      const payload: any = {};
      if (amount) {
        payload.amount = amount;
      }

      const response = await fetch(`${this.baseUrl}/orders/${orderGuid}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${credentials.api_key}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to refund order: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        refundId: result.refundId,
        amount: result.amount,
        status: result.status,
      };
    } catch (error) {
      console.error('Failed to refund order:', error);
      throw error;
    }
  }

  /**
   * Validate credentials by testing API connection
   */
  async validateCredentials(credentials: ItsacheckmateCredentials): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/restaurants/${credentials.restaurant_guid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.api_key}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Credentials validation failed:', error);
      return false;
    }
  }

  /**
   * Get restaurant menu from Toast via Itsacheckmate
   * This can be used to sync menu items automatically
   */
  async getMenu(credentials: ItsacheckmateCredentials) {
    try {
      const response = await fetch(
        `${this.baseUrl}/restaurants/${credentials.restaurant_guid}/menu`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credentials.api_key}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get menu: ${response.statusText}`);
      }

      const menu = await response.json();
      return menu;
    } catch (error) {
      console.error('Failed to get menu:', error);
      throw error;
    }
  }
}

export const ItsacheckmateService = new ItsacheckmateServiceClass();
