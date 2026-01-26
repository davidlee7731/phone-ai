import { Database } from '../database/client';
import { v4 as uuidv4 } from 'uuid';
import { PaymentService } from './payments';
import { ItsacheckmateService } from './itsacheckmate';

interface CreateOrderData {
  restaurantId: string;
  customerId: string;
  callId?: string;
  items: any[];
  orderType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  specialInstructions?: string;
  scheduledFor?: Date;
}

interface GetOrdersParams {
  restaurantId: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

class OrderServiceClass {
  async createOrder(data: CreateOrderData) {
    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // 8% tax - should be configurable per restaurant
    const total = subtotal + tax;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    const result = await Database.query(
      `INSERT INTO orders (
        restaurant_id, customer_id, call_id, order_number, order_type,
        items, subtotal, tax, total, delivery_address, special_instructions, scheduled_for
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.restaurantId,
        data.customerId,
        data.callId,
        orderNumber,
        data.orderType,
        JSON.stringify(data.items),
        subtotal,
        tax,
        total,
        data.deliveryAddress,
        data.specialInstructions,
        data.scheduledFor,
      ]
    );

    const order = result.rows[0];

    // Update customer stats
    await Database.query(
      `UPDATE customers
       SET total_orders = total_orders + 1,
           lifetime_value = lifetime_value + $1
       WHERE id = $2`,
      [total, data.customerId]
    );

    // Log analytics event
    await this.logAnalyticsEvent(data.restaurantId, 'order_placed', {
      orderId: order.id,
      total,
      itemCount: data.items.length,
    });

    return order;
  }

  async getOrders(params: GetOrdersParams) {
    let query = 'SELECT * FROM orders WHERE restaurant_id = $1';
    const values: any[] = [params.restaurantId];
    let paramIndex = 2;

    if (params.status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(params.status);
    }

    if (params.startDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      values.push(params.startDate);
    }

    if (params.endDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      values.push(params.endDate);
    }

    query += ' ORDER BY created_at DESC';

    const result = await Database.query(query, values);
    return result.rows;
  }

  async getOrderById(orderId: string) {
    const result = await Database.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    return result.rows[0];
  }

  async updateOrder(orderId: string, updates: any) {
    const allowedFields = ['status', 'payment_status', 'special_instructions', 'pos_order_id'];
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return null;
    }

    values.push(orderId);

    const query = `
      UPDATE orders
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await Database.query(query, values);
    return result.rows[0];
  }

  async syncToPOS(orderId: string) {
    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Get restaurant POS info
    const restaurantResult = await Database.query(
      'SELECT pos_system, pos_credentials FROM restaurants WHERE id = $1',
      [order.restaurant_id]
    );

    const restaurant = restaurantResult.rows[0];

    if (!restaurant.pos_system) {
      throw new Error('No POS system configured for this restaurant');
    }

    // Sync to POS based on system type
    let posOrderId: string;

    switch (restaurant.pos_system) {
      case 'square':
        posOrderId = await this.syncToSquare(order, restaurant.pos_credentials);
        break;
      case 'toast':
        posOrderId = await this.syncToToast(order, restaurant.pos_credentials);
        break;
      case 'clover':
        posOrderId = await this.syncToClover(order, restaurant.pos_credentials);
        break;
      default:
        throw new Error(`Unsupported POS system: ${restaurant.pos_system}`);
    }

    // Update order with POS sync info
    await Database.query(
      `UPDATE orders
       SET pos_order_id = $1, pos_synced_at = NOW()
       WHERE id = $2`,
      [posOrderId, orderId]
    );

    return { posOrderId, syncedAt: new Date() };
  }

  private async syncToSquare(order: any, credentials: any): Promise<string> {
    // Implement Square API integration
    // This is a placeholder - you'll need to use the Square SDK
    console.log('Syncing to Square:', order.id);
    return `SQ-${order.order_number}`;
  }

  private async syncToToast(order: any, credentials: any): Promise<string> {
    // Toast POS doesn't have public API access for most restaurants
    // Using Itsacheckmate (https://www.itsacheckmate.com/) as middleware
    // Itsacheckmate provides API integration to inject orders into Toast POS
    // AND handles payment through Toast's payment processor (avoiding Stripe fees)

    try {
      const itsacheckmateCredentials = {
        api_key: credentials.itsacheckmate_api_key,
        restaurant_guid: credentials.itsacheckmate_restaurant_guid,
      };

      if (!itsacheckmateCredentials.api_key || !itsacheckmateCredentials.restaurant_guid) {
        throw new Error('Itsacheckmate credentials not configured');
      }

      // Get customer info
      const customerResult = await Database.query(
        'SELECT phone_number, name FROM customers WHERE id = $1',
        [order.customer_id]
      );

      const customer = customerResult.rows[0];

      // Prepare order payload
      const payload = {
        order,
        customer: {
          name: customer?.name,
          phone: customer?.phone_number || order.delivery_phone,
          email: '',
          address: order.delivery_address,
        },
        // Payment info would be collected during the call
        // and stored temporarily in Redis for security
        // For now, we'll assume payment is collected separately
      };

      // Submit order to Toast via Itsacheckmate
      const result = await ItsacheckmateService.createOrder(itsacheckmateCredentials, payload);

      if (!result.success) {
        throw new Error('Failed to create order in Toast');
      }

      // Update order with Toast details
      await Database.query(
        `UPDATE orders
         SET pos_order_id = $1, payment_status = $2
         WHERE id = $3`,
        [result.toastOrderId, result.paymentStatus === 'PAID' ? 'paid' : 'pending', order.id]
      );

      console.log('Successfully synced to Toast via Itsacheckmate:', result);

      return result.toastOrderId;
    } catch (error) {
      console.error('Error syncing to Toast via Itsacheckmate:', error);
      throw error;
    }
  }

  private async syncToClover(order: any, credentials: any): Promise<string> {
    // Implement Clover API integration
    console.log('Syncing to Clover:', order.id);
    return `CLV-${order.order_number}`;
  }

  private generateOrderNumber(): string {
    // Generate a readable order number like "ORD-20240125-1234"
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${date}-${random}`;
  }

  private async logAnalyticsEvent(restaurantId: string, eventType: string, eventData: any) {
    await Database.query(
      `INSERT INTO analytics_events (restaurant_id, event_type, event_data)
       VALUES ($1, $2, $3)`,
      [restaurantId, eventType, JSON.stringify(eventData)]
    );
  }
}

export const OrderService = new OrderServiceClass();
