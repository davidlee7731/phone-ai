import { Database } from '../database/client';
import { v4 as uuidv4 } from 'uuid';

interface CreateReservationData {
  restaurantId: string;
  customerId: string;
  callId?: string;
  date: string;
  time: string;
  partySize: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  specialRequests?: string;
}

interface GetReservationsParams {
  restaurantId: string;
  date?: string;
  status?: string;
}

interface CheckAvailabilityParams {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
}

class ReservationServiceClass {
  async createReservation(data: CreateReservationData) {
    // Check availability first
    const available = await this.checkAvailability({
      restaurantId: data.restaurantId,
      date: data.date,
      time: data.time,
      partySize: data.partySize,
    });

    if (!available) {
      throw new Error('No availability for the requested time');
    }

    // Generate reservation number
    const reservationNumber = this.generateReservationNumber();

    const result = await Database.query(
      `INSERT INTO reservations (
        restaurant_id, customer_id, call_id, reservation_number,
        date, time, party_size, customer_name, customer_phone,
        customer_email, special_requests
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.restaurantId,
        data.customerId,
        data.callId,
        reservationNumber,
        data.date,
        data.time,
        data.partySize,
        data.customerName,
        data.customerPhone,
        data.customerEmail,
        data.specialRequests,
      ]
    );

    const reservation = result.rows[0];

    // Log analytics event
    await this.logAnalyticsEvent(data.restaurantId, 'reservation_created', {
      reservationId: reservation.id,
      partySize: data.partySize,
      date: data.date,
    });

    return reservation;
  }

  async getReservations(params: GetReservationsParams) {
    let query = 'SELECT * FROM reservations WHERE restaurant_id = $1';
    const values: any[] = [params.restaurantId];
    let paramIndex = 2;

    if (params.date) {
      query += ` AND date = $${paramIndex++}`;
      values.push(params.date);
    }

    if (params.status) {
      query += ` AND status = $${paramIndex++}`;
      values.push(params.status);
    }

    query += ' ORDER BY date DESC, time DESC';

    const result = await Database.query(query, values);
    return result.rows;
  }

  async getReservationById(reservationId: string) {
    const result = await Database.query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservationId]
    );

    return result.rows[0];
  }

  async updateReservation(reservationId: string, updates: any) {
    const allowedFields = ['status', 'party_size', 'date', 'time', 'special_requests'];
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

    values.push(reservationId);

    const query = `
      UPDATE reservations
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await Database.query(query, values);
    return result.rows[0];
  }

  async cancelReservation(reservationId: string) {
    const result = await Database.query(
      `UPDATE reservations
       SET status = 'cancelled'
       WHERE id = $1
       RETURNING *`,
      [reservationId]
    );

    return result.rows[0];
  }

  async checkAvailability(params: CheckAvailabilityParams): Promise<boolean> {
    // Get restaurant settings
    const restaurantResult = await Database.query(
      'SELECT settings FROM restaurants WHERE id = $1',
      [params.restaurantId]
    );

    const settings = restaurantResult.rows[0]?.settings || {};
    const maxPartySize = settings.maxPartySize || 12;

    // Check party size
    if (params.partySize > maxPartySize) {
      return false;
    }

    // Count existing reservations for the same time slot
    const existingResult = await Database.query(
      `SELECT COUNT(*) as count
       FROM reservations
       WHERE restaurant_id = $1
         AND date = $2
         AND time = $3
         AND status = 'confirmed'`,
      [params.restaurantId, params.date, params.time]
    );

    const existingCount = parseInt(existingResult.rows[0].count);

    // Simple availability logic - max 10 reservations per time slot
    // In production, you'd have more sophisticated logic based on table capacity
    const maxReservationsPerSlot = 10;

    return existingCount < maxReservationsPerSlot;
  }

  private generateReservationNumber(): string {
    // Generate a readable reservation number like "RES-20240125-1234"
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RES-${date}-${random}`;
  }

  private async logAnalyticsEvent(restaurantId: string, eventType: string, eventData: any) {
    await Database.query(
      `INSERT INTO analytics_events (restaurant_id, event_type, event_data)
       VALUES ($1, $2, $3)`,
      [restaurantId, eventType, JSON.stringify(eventData)]
    );
  }
}

export const ReservationService = new ReservationServiceClass();
