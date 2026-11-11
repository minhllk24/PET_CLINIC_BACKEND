import express from 'express';
import { requireRole } from '../../shared/authMiddleware.js';
import * as dashboardController from './dashboard.controller.js';

const router = express.Router();

// Tất cả dashboard routes yêu cầu quyền ADMIN hoặc MANAGER
router.use(requireRole(['ADMIN', 'MANAGER']));

// 1. Tổng quan KPI Dashboard (Khớp chuẩn OpenAPI operationId: dashboardSummary)
router.get('/summary', dashboardController.getDashboardSummary);

// 2. Biểu đồ doanh thu thực tế theo chuỗi ngày/tháng
router.get('/revenue-analytics', dashboardController.getRevenueAnalytics);

// 3. Cảnh báo tồn kho thấp (Low stock items)
router.get('/low-stock', dashboardController.getLowStockAlerts);

// 4. Bảng xếp hạng dịch vụ phổ biến (Service Popularity)
router.get('/service-stats', dashboardController.getServiceStats);

// 5. Backlog cần xử lý ngay & lịch hẹn 24h tới (Action / Attention Needed)
router.get('/attention', dashboardController.getAttentionBacklog);

export default router;
