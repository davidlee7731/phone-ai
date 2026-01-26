import express from 'express';
import { OrderService } from '../services/orders';
import { AppError } from '../middleware/errorHandler';

export const ordersRouter = express.Router();

// Get all orders for a restaurant
ordersRouter.get('/', async (req, res, next) => {
  try {
    const { restaurantId, status, startDate, endDate } = req.query;

    if (!restaurantId) {
      throw new AppError('restaurantId is required', 400);
    }

    const orders = await OrderService.getOrders({
      restaurantId: restaurantId as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

// Get single order
ordersRouter.get('/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await OrderService.getOrderById(orderId);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

// Create order (used by AI)
ordersRouter.post('/', async (req, res, next) => {
  try {
    const orderData = req.body;
    const order = await OrderService.createOrder(orderData);

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
});

// Update order status
ordersRouter.patch('/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    const order = await OrderService.updateOrder(orderId, updates);

    if (!order) {
      throw new AppError('Order not found', 404);
    }

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

// Sync order to POS
ordersRouter.post('/:orderId/sync', async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const result = await OrderService.syncToPOS(orderId);

    res.json({ success: true, result });
  } catch (error) {
    next(error);
  }
});
