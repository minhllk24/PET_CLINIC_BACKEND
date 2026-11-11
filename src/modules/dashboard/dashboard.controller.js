import { dashboardService } from './dashboard.service.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboardSummary(req.query, req.actor);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const data = await dashboardService.getRevenueAnalytics(req.query, req.actor);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getLowStockAlerts = async (req, res, next) => {
  try {
    const data = await dashboardService.getLowStockAlerts(req.query, req.actor);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getServiceStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getServiceStats(req.query, req.actor);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const getAttentionBacklog = async (req, res, next) => {
  try {
    const data = await dashboardService.getAttentionBacklog(req.query, req.actor);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
