import { Database } from '../database/client';

interface GetAnalyticsParams {
  restaurantId: string;
  startDate?: string;
  endDate?: string;
}

interface GetCallHistoryParams {
  restaurantId: string;
  limit: number;
  offset: number;
}

interface GetRevenueMetricsParams {
  restaurantId: string;
  period: 'day' | 'week' | 'month' | 'year';
}

class DashboardServiceClass {
  async getAnalytics(params: GetAnalyticsParams) {
    const startDate = params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = params.endDate || new Date().toISOString();

    // Get call statistics
    const callStats = await Database.query(
      `SELECT
         COUNT(*) as total_calls,
         COUNT(CASE WHEN intent = 'order' THEN 1 END) as order_calls,
         COUNT(CASE WHEN intent = 'reservation' THEN 1 END) as reservation_calls,
         COUNT(CASE WHEN intent = 'question' THEN 1 END) as question_calls,
         AVG(duration) as avg_duration
       FROM calls
       WHERE restaurant_id = $1
         AND started_at >= $2
         AND started_at <= $3`,
      [params.restaurantId, startDate, endDate]
    );

    // Get order statistics
    const orderStats = await Database.query(
      `SELECT
         COUNT(*) as total_orders,
         SUM(total) as total_revenue,
         AVG(total) as avg_order_value,
         COUNT(CASE WHEN order_type = 'pickup' THEN 1 END) as pickup_orders,
         COUNT(CASE WHEN order_type = 'delivery' THEN 1 END) as delivery_orders
       FROM orders
       WHERE restaurant_id = $1
         AND created_at >= $2
         AND created_at <= $3`,
      [params.restaurantId, startDate, endDate]
    );

    // Get reservation statistics
    const reservationStats = await Database.query(
      `SELECT
         COUNT(*) as total_reservations,
         COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
         COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
         AVG(party_size) as avg_party_size
       FROM reservations
       WHERE restaurant_id = $1
         AND created_at >= $2
         AND created_at <= $3`,
      [params.restaurantId, startDate, endDate]
    );

    // Get peak call times
    const peakTimes = await Database.query(
      `SELECT
         EXTRACT(HOUR FROM started_at) as hour,
         COUNT(*) as call_count
       FROM calls
       WHERE restaurant_id = $1
         AND started_at >= $2
         AND started_at <= $3
       GROUP BY hour
       ORDER BY call_count DESC
       LIMIT 5`,
      [params.restaurantId, startDate, endDate]
    );

    // Calculate conversion rate
    const totalCalls = parseInt(callStats.rows[0].total_calls) || 0;
    const orderCalls = parseInt(callStats.rows[0].order_calls) || 0;
    const conversionRate = totalCalls > 0 ? (orderCalls / totalCalls) * 100 : 0;

    return {
      period: {
        startDate,
        endDate,
      },
      calls: {
        total: totalCalls,
        byIntent: {
          order: parseInt(callStats.rows[0].order_calls) || 0,
          reservation: parseInt(callStats.rows[0].reservation_calls) || 0,
          question: parseInt(callStats.rows[0].question_calls) || 0,
        },
        avgDuration: parseFloat(callStats.rows[0].avg_duration) || 0,
      },
      orders: {
        total: parseInt(orderStats.rows[0].total_orders) || 0,
        revenue: parseFloat(orderStats.rows[0].total_revenue) || 0,
        avgValue: parseFloat(orderStats.rows[0].avg_order_value) || 0,
        byType: {
          pickup: parseInt(orderStats.rows[0].pickup_orders) || 0,
          delivery: parseInt(orderStats.rows[0].delivery_orders) || 0,
        },
      },
      reservations: {
        total: parseInt(reservationStats.rows[0].total_reservations) || 0,
        confirmed: parseInt(reservationStats.rows[0].confirmed) || 0,
        cancelled: parseInt(reservationStats.rows[0].cancelled) || 0,
        avgPartySize: parseFloat(reservationStats.rows[0].avg_party_size) || 0,
      },
      performance: {
        conversionRate: conversionRate.toFixed(2),
        peakHours: peakTimes.rows.map(row => ({
          hour: parseInt(row.hour),
          callCount: parseInt(row.call_count),
        })),
      },
    };
  }

  async getCallHistory(params: GetCallHistoryParams) {
    const result = await Database.query(
      `SELECT c.*, cu.name as customer_name
       FROM calls c
       LEFT JOIN customers cu ON c.customer_id = cu.id
       WHERE c.restaurant_id = $1
       ORDER BY c.started_at DESC
       LIMIT $2 OFFSET $3`,
      [params.restaurantId, params.limit, params.offset]
    );

    return result.rows;
  }

  async getCallTranscript(callId: string) {
    const result = await Database.query(
      'SELECT transcript, started_at, ended_at, duration FROM calls WHERE id = $1',
      [callId]
    );

    return result.rows[0];
  }

  async getRevenueMetrics(params: GetRevenueMetricsParams) {
    let interval: string;
    let dateFormat: string;

    switch (params.period) {
      case 'day':
        interval = '24 hours';
        dateFormat = 'HH24:00';
        break;
      case 'week':
        interval = '7 days';
        dateFormat = 'Day';
        break;
      case 'month':
        interval = '30 days';
        dateFormat = 'YYYY-MM-DD';
        break;
      case 'year':
        interval = '365 days';
        dateFormat = 'YYYY-MM';
        break;
      default:
        interval = '7 days';
        dateFormat = 'Day';
    }

    const result = await Database.query(
      `SELECT
         TO_CHAR(created_at, $2) as period,
         COUNT(*) as order_count,
         SUM(total) as revenue,
         AVG(total) as avg_order_value
       FROM orders
       WHERE restaurant_id = $1
         AND created_at >= NOW() - INTERVAL '${interval}'
         AND payment_status = 'paid'
       GROUP BY period
       ORDER BY period`,
      [params.restaurantId, dateFormat]
    );

    // Calculate total revenue for the period
    const totalResult = await Database.query(
      `SELECT
         SUM(total) as total_revenue,
         COUNT(*) as total_orders
       FROM orders
       WHERE restaurant_id = $1
         AND created_at >= NOW() - INTERVAL '${interval}'
         AND payment_status = 'paid'`,
      [params.restaurantId]
    );

    return {
      period: params.period,
      total: {
        revenue: parseFloat(totalResult.rows[0].total_revenue) || 0,
        orders: parseInt(totalResult.rows[0].total_orders) || 0,
      },
      breakdown: result.rows.map(row => ({
        period: row.period,
        revenue: parseFloat(row.revenue),
        orderCount: parseInt(row.order_count),
        avgOrderValue: parseFloat(row.avg_order_value),
      })),
    };
  }

  async updateSettings(restaurantId: string, settings: any) {
    const result = await Database.query(
      `UPDATE restaurants
       SET settings = settings || $1::jsonb
       WHERE id = $2
       RETURNING settings`,
      [JSON.stringify(settings), restaurantId]
    );

    return result.rows[0]?.settings;
  }
}

export const DashboardService = new DashboardServiceClass();
