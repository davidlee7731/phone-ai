import express from 'express';
import { DashboardService } from '../services/dashboard';
import { AppError } from '../middleware/errorHandler';

export const dashboardRouter = express.Router();

// Get dashboard analytics
dashboardRouter.get('/analytics', async (req, res, next) => {
  try {
    const { restaurantId, startDate, endDate } = req.query;

    if (!restaurantId) {
      throw new AppError('restaurantId is required', 400);
    }

    const analytics = await DashboardService.getAnalytics({
      restaurantId: restaurantId as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

// Get call history
dashboardRouter.get('/calls', async (req, res, next) => {
  try {
    const { restaurantId, limit, offset } = req.query;

    if (!restaurantId) {
      throw new AppError('restaurantId is required', 400);
    }

    const calls = await DashboardService.getCallHistory({
      restaurantId: restaurantId as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({ calls });
  } catch (error) {
    next(error);
  }
});

// Get call transcript
dashboardRouter.get('/calls/:callId/transcript', async (req, res, next) => {
  try {
    const { callId } = req.params;
    const transcript = await DashboardService.getCallTranscript(callId);

    if (!transcript) {
      throw new AppError('Transcript not found', 404);
    }

    res.json({ transcript });
  } catch (error) {
    next(error);
  }
});

// Get revenue metrics
dashboardRouter.get('/revenue', async (req, res, next) => {
  try {
    const { restaurantId, period } = req.query;

    if (!restaurantId) {
      throw new AppError('restaurantId is required', 400);
    }

    const revenue = await DashboardService.getRevenueMetrics({
      restaurantId: restaurantId as string,
      period: (period as string) || 'week', // 'day', 'week', 'month', 'year'
    });

    res.json(revenue);
  } catch (error) {
    next(error);
  }
});

// Update restaurant settings
dashboardRouter.patch('/settings', async (req, res, next) => {
  try {
    const { restaurantId, settings } = req.body;

    if (!restaurantId) {
      throw new AppError('restaurantId is required', 400);
    }

    const updated = await DashboardService.updateSettings(restaurantId, settings);

    res.json({ settings: updated });
  } catch (error) {
    next(error);
  }
});
