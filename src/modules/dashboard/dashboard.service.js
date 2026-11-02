import mongoose from 'mongoose';
import Order from '../order/models/Order.js';
import Appointment from '../booking/models/Appointment.js';
import Customer from '../customer/models/Customer.js';
import InventoryStock from '../inventory/models/InventoryStock.js';
import Service from '../catalog/models/Service.js';
import Payment from '../payment/models/Payment.js';
import AppError from '../../utils/AppError.js';

/**
 * Helper parse date range from query
 */
const parseDateRange = (from, to, preset) => {
  const now = new Date();
  let startDate;
  let endDate = new Date(now.setHours(23, 59, 59, 999));

  if (preset === 'today') {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (preset === 'this_week') {
    startDate = new Date();
    const day = startDate.getDay() || 7; // 1 = Monday, 7 = Sunday
    startDate.setDate(startDate.getDate() - day + 1);
    startDate.setHours(0, 0, 0, 0);
  } else if (preset === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (preset === 'this_year') {
    startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  } else if (from || to) {
    startDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    if (to) {
      endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
    }
  } else {
    // Mặc định: 30 ngày gần nhất
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
};

/**
 * Helper validate and resolve branch scoping based on actor RBAC
 */
const resolveBranchScope = (branchId, actor) => {
  if (!actor) return null;
  const isManager = actor.systemRole === 'MANAGER';
  const assigned = Array.isArray(actor.assignedBranchIds) ? actor.assignedBranchIds.map(String) : [];

  if (isManager) {
    if (branchId) {
      if (!assigned.includes(String(branchId))) {
        throw new AppError(403, 'Bạn không có quyền truy cập dữ liệu của chi nhánh này', 'AUTHORIZATION_ERROR');
      }
      return [new mongoose.Types.ObjectId(branchId)];
    }
    // Không truyền branchId: giới hạn trong toàn bộ assignedBranchIds của Manager
    if (assigned.length === 0) {
      return [new mongoose.Types.ObjectId('000000000000000000000000')]; // Empty match
    }
    return assigned.map((id) => new mongoose.Types.ObjectId(id));
  }

  // Admin hoặc các vai trò khác
  if (branchId) {
    return [new mongoose.Types.ObjectId(branchId)];
  }
  return null; // All branches
};

export const dashboardService = {
  // =========================================================================
  // 1. DASHBOARD SUMMARY (OpenAPI dashboardSummary compliant)
  // =========================================================================

  async getDashboardSummary({ branchId, from, to, preset }, actor) {
    const { startDate, endDate } = parseDateRange(from, to, preset);
    const branchScope = resolveBranchScope(branchId, actor);

    // 1.1 Match điều kiện Order
    const orderMatch = {
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (branchScope) {
      orderMatch.fulfillmentBranchId = { $in: branchScope };
    }

    // 1.2 Match điều kiện Appointment
    const appointmentMatch = {
      scheduledStart: { $gte: startDate, $lte: endDate },
    };
    if (branchScope) {
      appointmentMatch.branchId = { $in: branchScope };
    }

    // 1.3 Match điều kiện Inventory Stock
    const stockMatch = { quantity: { $lte: 5 } };
    if (branchScope) {
      stockMatch.branchId = { $in: branchScope };
    }

    // 1.4 Thực thi song song các aggregation pipeline trên dữ liệu thực tế
    const [
      orderAgg,
      appointmentAgg,
      lowStockCount,
      newCustomersCount,
      clinicRevenueAgg,
    ] = await Promise.all([
      // Aggregation Đơn hàng: Đếm theo status & tính doanh thu thực (DELIVERED, COMPLETED)
      Order.aggregate([
        { $match: orderMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['DELIVERED', 'COMPLETED']] },
                  { $subtract: ['$pricing.finalAmount', { $ifNull: ['$totalRefundedAmount', 0] }] },
                  0,
                ],
              },
            },
          },
        },
      ]),

      // Aggregation Lịch hẹn: Đếm theo status
      Appointment.aggregate([
        { $match: appointmentMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),

      // Tồn kho thấp: Số bản ghi có quantity <= 5
      InventoryStock.countDocuments(stockMatch),

      // Khách hàng mới đăng ký trong khoảng thời gian
      Customer.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
      }),

      // Doanh thu phòng khám từ payments PAID của appointment trong kỳ
      Payment.aggregate([
        {
          $match: {
            status: 'PAID',
            targetType: 'APPOINTMENT',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: null,
            totalClinicRevenue: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    // Tổng hợp kết quả Order
    let totalOrders = 0;
    let commerceRevenue = 0;
    const orderCountsByStatus = {};
    orderAgg.forEach((item) => {
      totalOrders += item.count;
      commerceRevenue += item.revenue || 0;
      orderCountsByStatus[item._id] = item.count;
    });

    // Tổng hợp kết quả Appointment
    let totalAppointments = 0;
    const appointmentCountsByStatus = {};
    appointmentAgg.forEach((item) => {
      totalAppointments += item.count;
      appointmentCountsByStatus[item._id] = item.count;
    });

    // Tổng hợp Doanh thu phòng khám (Clinic Revenue)
    const clinicRevenue = clinicRevenueAgg[0]?.totalClinicRevenue || 0;
    const totalRevenue = Math.max(0, commerceRevenue + clinicRevenue);

    return {
      orders: totalOrders,
      appointments: totalAppointments,
      revenue: {
        amount: totalRevenue,
        currency: 'VND',
      },
      newCustomers: newCustomersCount,
      lowStockItems: lowStockCount,
      breakdown: {
        commerceRevenue,
        clinicRevenue,
        orderCountsByStatus,
        appointmentCountsByStatus,
        timeRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    };
  },

  // =========================================================================
  // 2. REVENUE ANALYTICS (Theo chuỗi thời gian)
  // =========================================================================

  async getRevenueAnalytics({ branchId, from, to, preset }, actor) {
    const { startDate, endDate } = parseDateRange(from, to, preset);
    const branchScope = resolveBranchScope(branchId, actor);

    const match = {
      status: { $in: ['DELIVERED', 'COMPLETED'] },
      createdAt: { $gte: startDate, $lte: endDate },
    };
    if (branchScope) {
      match.fulfillmentBranchId = { $in: branchScope };
    }

    const dailyRevenue = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          orderCount: { $sum: 1 },
          revenue: {
            $sum: { $subtract: ['$pricing.finalAmount', { $ifNull: ['$totalRefundedAmount', 0] }] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return dailyRevenue.map((d) => ({
      date: d._id,
      orders: d.orderCount,
      revenue: Math.max(0, d.revenue),
    }));
  },

  // =========================================================================
  // 3. LOW STOCK ALERTS (Cảnh báo tồn kho chi tiết)
  // =========================================================================

  async getLowStockAlerts({ branchId, threshold = 5, limit = 20 }, actor) {
    const branchScope = resolveBranchScope(branchId, actor);
    const query = { quantity: { $lte: Number(threshold) } };
    if (branchScope) {
      query.branchId = { $in: branchScope };
    }

    const items = await InventoryStock.find(query)
      .populate('inventoryItemId', 'sku name barcode category')
      .populate('branchId', 'name code address')
      .sort({ quantity: 1 })
      .limit(Number(limit));

    return items.map((stock) => ({
      stockId: stock._id,
      quantity: stock.quantity,
      branch: {
        id: stock.branchId?._id,
        name: stock.branchId?.name,
        code: stock.branchId?.code,
      },
      item: {
        id: stock.inventoryItemId?._id,
        sku: stock.inventoryItemId?.sku,
        name: stock.inventoryItemId?.name,
        barcode: stock.inventoryItemId?.barcode,
      },
    }));
  },

  // =========================================================================
  // 4. SERVICE POPULARITY (Xếp hạng dịch vụ khám & spa)
  // =========================================================================

  async getServiceStats({ branchId, from, to, preset }, actor) {
    const { startDate, endDate } = parseDateRange(from, to, preset);
    const branchScope = resolveBranchScope(branchId, actor);

    const match = {
      scheduledStart: { $gte: startDate, $lte: endDate },
      status: { $nin: ['CANCELLED'] },
    };
    if (branchScope) {
      match.branchId = { $in: branchScope };
    }

    const serviceStats = await Appointment.aggregate([
      { $match: match },
      { $unwind: '$services' },
      {
        $group: {
          _id: '$services.serviceId',
          serviceNameSnapshot: { $first: '$services.serviceNameSnapshot' },
          bookingsCount: { $sum: 1 },
          estimatedRevenue: { $sum: '$services.price' },
        },
      },
      { $sort: { bookingsCount: -1 } },
      { $limit: 10 },
    ]);

    return serviceStats.map((s) => ({
      serviceId: s._id,
      name: s.serviceNameSnapshot || 'Dịch vụ thú y',
      bookingsCount: s.bookingsCount,
      estimatedRevenue: s.estimatedRevenue,
    }));
  },
};

export default dashboardService;
