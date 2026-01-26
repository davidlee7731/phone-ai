import { Database } from '../database/client';
import { v4 as uuidv4 } from 'uuid';

interface CreateCallData {
  callSid: string;
  fromNumber: string;
  toNumber: string;
}

interface UpdateCallData {
  status?: string;
  duration?: number;
  transcript?: string;
  recordingUrl?: string;
  intent?: string;
  outcome?: string;
}

class CallServiceClass {
  async createCall(data: CreateCallData) {
    // Find restaurant by phone number
    const restaurantResult = await Database.query(
      'SELECT id FROM restaurants WHERE phone_number = $1',
      [data.toNumber]
    );

    const restaurantId = restaurantResult.rows[0]?.id;

    if (!restaurantId) {
      throw new Error(`No restaurant found for number ${data.toNumber}`);
    }

    const result = await Database.query(
      `INSERT INTO calls (restaurant_id, call_sid, from_number, to_number, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [restaurantId, data.callSid, data.fromNumber, data.toNumber, 'in-progress']
    );

    return result.rows[0];
  }

  async updateCall(callSid: string, data: UpdateCallData) {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.duration !== undefined) {
      updates.push(`duration = $${paramIndex++}`);
      values.push(data.duration);
    }

    if (data.transcript) {
      updates.push(`transcript = $${paramIndex++}`);
      values.push(data.transcript);
    }

    if (data.recordingUrl) {
      updates.push(`recording_url = $${paramIndex++}`);
      values.push(data.recordingUrl);
    }

    if (data.intent) {
      updates.push(`intent = $${paramIndex++}`);
      values.push(data.intent);
    }

    if (data.outcome) {
      updates.push(`outcome = $${paramIndex++}`);
      values.push(data.outcome);
    }

    if (updates.length === 0) {
      return null;
    }

    values.push(callSid);

    const query = `
      UPDATE calls
      SET ${updates.join(', ')}
      WHERE call_sid = $${paramIndex}
      RETURNING *
    `;

    const result = await Database.query(query, values);
    return result.rows[0];
  }

  async updateCallStatus(callSid: string, data: { status: string; duration?: number }) {
    const updates: any = { status: data.status };

    if (data.duration) {
      updates.duration = data.duration;
    }

    if (data.status === 'completed') {
      await Database.query(
        'UPDATE calls SET ended_at = NOW() WHERE call_sid = $1',
        [callSid]
      );
    }

    return this.updateCall(callSid, updates);
  }

  async getCallById(callId: string) {
    const result = await Database.query(
      'SELECT * FROM calls WHERE id = $1',
      [callId]
    );

    return result.rows[0];
  }

  async getCallByCallSid(callSid: string) {
    const result = await Database.query(
      'SELECT * FROM calls WHERE call_sid = $1',
      [callSid]
    );

    return result.rows[0];
  }

  async getCallsForRestaurant(restaurantId: string, limit = 50, offset = 0) {
    const result = await Database.query(
      `SELECT * FROM calls
       WHERE restaurant_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [restaurantId, limit, offset]
    );

    return result.rows;
  }
}

export const CallService = new CallServiceClass();
