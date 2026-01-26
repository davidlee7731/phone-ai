import express from 'express';
import { ReservationService } from '../services/reservations';
import { AppError } from '../middleware/errorHandler';

export const reservationsRouter = express.Router();

// Get all reservations for a restaurant
reservationsRouter.get('/', async (req, res, next) => {
  try {
    const { restaurantId, date, status } = req.query;

    if (!restaurantId) {
      throw new AppError('restaurantId is required', 400);
    }

    const reservations = await ReservationService.getReservations({
      restaurantId: restaurantId as string,
      date: date as string,
      status: status as string,
    });

    res.json({ reservations });
  } catch (error) {
    next(error);
  }
});

// Get single reservation
reservationsRouter.get('/:reservationId', async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const reservation = await ReservationService.getReservationById(reservationId);

    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    res.json({ reservation });
  } catch (error) {
    next(error);
  }
});

// Create reservation (used by AI)
reservationsRouter.post('/', async (req, res, next) => {
  try {
    const reservationData = req.body;
    const reservation = await ReservationService.createReservation(reservationData);

    res.status(201).json({ reservation });
  } catch (error) {
    next(error);
  }
});

// Update reservation
reservationsRouter.patch('/:reservationId', async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    const updates = req.body;

    const reservation = await ReservationService.updateReservation(reservationId, updates);

    if (!reservation) {
      throw new AppError('Reservation not found', 404);
    }

    res.json({ reservation });
  } catch (error) {
    next(error);
  }
});

// Cancel reservation
reservationsRouter.delete('/:reservationId', async (req, res, next) => {
  try {
    const { reservationId } = req.params;
    await ReservationService.cancelReservation(reservationId);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Check availability
reservationsRouter.post('/check-availability', async (req, res, next) => {
  try {
    const { restaurantId, date, time, partySize } = req.body;

    if (!restaurantId || !date || !time || !partySize) {
      throw new AppError('Missing required fields', 400);
    }

    const available = await ReservationService.checkAvailability({
      restaurantId,
      date,
      time,
      partySize,
    });

    res.json({ available });
  } catch (error) {
    next(error);
  }
});
