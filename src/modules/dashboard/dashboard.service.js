import mongoose from 'mongoose';
import Order from '../order/models/Order.js';
import OrderRefund from '../order/models/OrderRefund.js';
import OrderReturn from '../order/models/OrderReturn.js';
import Appointment from '../booking/models/Appointment.js';
import InventoryStock from '../inventory/models/InventoryStock.js';
import InventoryItem from '../inventory/models/InventoryItem.js';
import Product from '../catalog/models/Product.js';
import Branch from '../branch/models/Branch.js';
import AppError from '../../utils/AppError.js';
import {
  APPOINTMENT_STATUS_CATALOG,
  DASHBOARD_TIMEZONE,
  MS_PER_DAY,
  ORDER_STATUS_CATALOG,
  PAYMENT_STATUS_CATALOG,
  computeKpiComparison,
  generateBucketKeys,
  mapRawTimeKeyToBucket,
  normalizeNonNegativeZero,
  resolveVnDateRange,
} from './dashboard.utils.js';

const getBucketDateFormat = (granularity) => (
  granularity === 'hour' ? '%Y-%m-%dT%H:00:00+07:00' : '%Y-%m-%d'
);

const extractActorBranchIds = (actor) => {
  const raw = Array.isArray(actor?.assignedBranchIds) && actor.assignedBranchIds.length > 0
    ? actor.assignedBranchIds
    : (Array.isArray(actor?.authorizedBranchIds) ? actor.authorizedBranchIds : []);

  const seen = new Set();
  const ids = [];
  for (const entry of raw) {
    const str = entry ? (entry._id || entry).toString().trim() : '';
    if (str && mongoose.Types.ObjectId.isValid(str) && !seen.has(str)) {
      seen.add(str);
      ids.push(str);
    }
  }
  return ids;
};

/**
 * Resolve effective branch filter with strict RBAC and validation order:
 * 400 (malformed branchId) -> 403 (role/manager scope violation, hides non-assigned branch existence) -> 404 (ADMIN nonexistent branch)
 */
export const resolveBranchScope = async (rawBranchId, actor) => {
  const branchId = rawBranchId !== undefined && rawBranchId !== null ? String(rawBranchId).trim() : '';
  if (branchId && !mongoose.Types.ObjectId.isValid(branchId)) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'Invalid branchId format');
  }

  const role = actor?.systemRole || actor?.role;
  if (role !== 'ADMIN' && role !== 'MANAGER') {
    throw new AppError(403, 'Forbidden', 'FORBIDDEN', 'Dashboard access requires ADMIN or MANAGER role');
  }

  if (role === 'MANAGER') {
    const allowedIds = extractActorBranchIds(actor);
    if (allowedIds.length === 0) {
      throw new AppError(403, 'Forbidden', 'BRANCH_SCOPE_EMPTY', 'Manager account is not assigned to any branch');
    }

    if (branchId) {
      if (!allowedIds.includes(branchId)) {
        throw new AppError(403, 'Forbidden', 'BRANCH_ACCESS_DENIED', 'You do not have access to this branch');
      }
      return {
        branchIds: [new mongoose.Types.ObjectId(branchId)],
        branchIdStrings: [branchId],
      };
    }

    return {
      branchIds: allowedIds.map((id) => new mongoose.Types.ObjectId(id)),
      branchIdStrings: allowedIds,
    };
  }

  // ADMIN role
  if (!branchId) {
    return { branchIds: null, branchIdStrings: [] };
  }

  const branchQuery = Branch.findById(branchId);
  const existingBranch = typeof branchQuery?.select === 'function'
    ? await branchQuery.select('_id').lean()
    : await branchQuery;

  if (!existingBranch) {
    throw new AppError(404, 'Not Found', 'BRANCH_NOT_FOUND', 'Branch not found');
  }

  return {
    branchIds: [new mongoose.Types.ObjectId(branchId)],
    branchIdStrings: [branchId],
  };
};

const validateLimit = (rawLimit, defaultLimit, maxLimit) => {
  if (rawLimit === undefined || rawLimit === null || String(rawLimit).trim() === '') {
    return defaultLimit;
  }
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(400, 'Validation Error', 'VALIDATION_ERROR', 'limit must be a positive integer');
  }
  return Math.min(parsed, maxLimit);
};

// --- Shared Aggregation Expressions ---

const buildOrderEffectiveCompletedExpr = () => ({
  $ifNull: [
    '$deliveredAt',
    {
      $ifNull: [
        {
          $max: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ['$statusHistory', []] },
                  as: 'h',
                  cond: { $eq: ['$$h.status', 'COMPLETED'] },
                },
              },
              as: 'ch',
              in: '$$ch.at',
            },
          },
        },
        '$updatedAt',
      ],
    },
  ],
});

/**
 * Computes merchandise net revenue on a COMPLETED Order:
 * - Excludes shippingFee cleanly
 * - Never double-subtracts FREE_SHIPPING voucher discount
 * - Also reconciles admin orders where voucherDiscount was stored without per-item allocatedDiscount
 */
const buildOrderMerchandiseNetExpr = () => {
  const hasNumericLineNet = {
    $gt: [
      {
        $size: {
          $filter: {
            input: { $ifNull: ['$items', []] },
            as: 'it',
            cond: { $isNumber: '$$it.lineNet' },
          },
        },
      },
      0,
    ],
  };

  const sumLineNetExpr = {
    $sum: {
      $map: {
        input: { $ifNull: ['$items', []] },
        as: 'it',
        in: { $ifNull: ['$$it.lineNet', 0] },
      },
    },
  };

  const sumAllocatedDiscountExpr = {
    $sum: {
      $map: {
        input: { $ifNull: ['$items', []] },
        as: 'it',
        in: { $ifNull: ['$$it.allocatedDiscount', 0] },
      },
    },
  };

  const isFreeShipEquivalence = {
    $or: [
      { $eq: ['$voucher.code', 'FREESHIP'] },
      {
        $and: [
          { $gt: [{ $ifNull: ['$pricing.shippingFee', 0] }, 0] },
          { $eq: [{ $ifNull: ['$pricing.voucherDiscount', 0] }, { $ifNull: ['$pricing.shippingFee', 0] }] },
          { $eq: [{ $ifNull: ['$pricing.totalAmount', -1] }, sumLineNetExpr] },
        ],
      },
    ],
  };

  const lineNetAdjustedExpr = {
    $cond: [
      {
        $and: [
          { $eq: [sumAllocatedDiscountExpr, 0] },
          { $gt: [{ $ifNull: ['$pricing.voucherDiscount', 0] }, 0] },
          { $not: [isFreeShipEquivalence] },
        ],
      },
      { $max: [0, { $subtract: [sumLineNetExpr, { $ifNull: ['$pricing.voucherDiscount', 0] }] }] },
      sumLineNetExpr,
    ],
  };

  const fallbackExpr = {
    $cond: [
      {
        $or: [
          { $eq: ['$voucher.code', 'FREESHIP'] },
          {
            $and: [
              { $gt: [{ $ifNull: ['$pricing.shippingFee', 0] }, 0] },
              { $eq: [{ $ifNull: ['$pricing.voucherDiscount', 0] }, { $ifNull: ['$pricing.shippingFee', 0] }] },
            ],
          },
        ],
      },
      {
        $max: [
          0,
          { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$pricing.merchandiseSubtotal', 0] }] },
        ],
      },
      {
        $max: [
          0,
          { $subtract: [{ $ifNull: ['$pricing.totalAmount', 0] }, { $ifNull: ['$pricing.shippingFee', 0] }] },
        ],
      },
    ],
  };

  return {
    $cond: [hasNumericLineNet, lineNetAdjustedExpr, fallbackExpr],
  };
};

const buildAppointmentEffectiveCompletedExpr = () => ({
  $ifNull: [
    '$completedAt',
    {
      $ifNull: [
        { $max: '$services.executionCompletedAt' },
        '$updatedAt',
      ],
    },
  ],
});

/**
 * Shared revenue aggregator used identically by both GET /summary and GET /revenue-analytics
 * so KPI revenue totals always equal the sum of chart buckets to the exact VND.
 */
const aggregateRevenueWindow = async ({
  startUtc,
  endExclusiveUtc,
  branchIds,
  fromStr,
  granularity,
  bucketKeys = [],
  withBuckets = true,
}) => {
  const bucketFormat = getBucketDateFormat(granularity);
  const groupIdExpr = withBuckets
    ? { $dateToString: { format: bucketFormat, date: '$effectiveTs', timezone: DASHBOARD_TIMEZONE } }
    : 'TOTAL';

  const orderPipeline = [
    {
      $match: {
        status: 'COMPLETED',
        ...(branchIds ? { fulfillmentBranchId: { $in: branchIds } } : {}),
      },
    },
    {
      $addFields: {
        effectiveTs: buildOrderEffectiveCompletedExpr(),
        merchandiseNet: buildOrderMerchandiseNetExpr(),
      },
    },
    { $match: { effectiveTs: { $gte: startUtc, $lt: endExclusiveUtc } } },
    { $group: { _id: groupIdExpr, amount: { $sum: '$merchandiseNet' } } },
  ];

  const appointmentPipeline = [
    {
      $match: {
        status: 'COMPLETED',
        ...(branchIds ? { branchId: { $in: branchIds } } : {}),
      },
    },
    {
      $addFields: {
        effectiveTs: buildAppointmentEffectiveCompletedExpr(),
        serviceAmount: {
          $ifNull: ['$pricing.finalAmount', { $ifNull: ['$pricing.subtotal', 0] }],
        },
      },
    },
    { $match: { effectiveTs: { $gte: startUtc, $lt: endExclusiveUtc } } },
    { $group: { _id: groupIdExpr, amount: { $sum: '$serviceAmount' } } },
  ];

  const refundPipeline = [
    {
      $match: {
        status: 'REFUNDED',
        refundedAt: { $gte: startUtc, $lt: endExclusiveUtc },
      },
    },
    {
      $lookup: {
        from: Order.collection?.name || 'orders',
        localField: 'orderId',
        foreignField: '_id',
        as: 'orderDoc',
      },
    },
    { $unwind: '$orderDoc' },
    {
      $match: {
        ...(branchIds ? { 'orderDoc.fulfillmentBranchId': { $in: branchIds } } : {}),
        $or: [{ cause: 'RETURN' }, { 'orderDoc.status': 'COMPLETED' }],
      },
    },
    {
      $lookup: {
        from: OrderReturn.collection?.name || 'orderreturns',
        localField: 'orderReturnId',
        foreignField: '_id',
        as: 'returnDoc',
      },
    },
    { $unwind: { path: '$returnDoc', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        effectiveTs: '$refundedAt',
        netRefundAmount: {
          $max: [
            0,
            {
              $subtract: [
                { $ifNull: ['$amount', 0] },
                { $ifNull: ['$returnDoc.refundBreakdown.shippingRefunded', 0] },
              ],
            },
          ],
        },
      },
    },
    { $group: { _id: groupIdExpr, amount: { $sum: '$netRefundAmount' } } },
  ];

  const [orderRows, serviceRows, refundRows] = await Promise.all([
    Order.aggregate(orderPipeline),
    Appointment.aggregate(appointmentPipeline),
    OrderRefund.aggregate(refundPipeline),
  ]);

  if (!withBuckets) {
    const orderRevenue = (orderRows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const serviceRevenue = (serviceRows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const refundTotal = (refundRows || []).reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const refundAdjustment = normalizeNonNegativeZero(-refundTotal);
    const totalRevenue = normalizeNonNegativeZero(orderRevenue + serviceRevenue + refundAdjustment);
    return { orderRevenue, serviceRevenue, refundAdjustment, totalRevenue };
  }

  const bucketMap = new Map(
    bucketKeys.map((periodStart) => [
      periodStart,
      { periodStart, orderRevenue: 0, serviceRevenue: 0, refundAdjustment: 0, totalRevenue: 0 },
    ])
  );

  let totalOrder = 0;
  let totalService = 0;
  let totalRefund = 0;

  for (const row of orderRows || []) {
    const val = Number(row.amount || 0);
    totalOrder += val;
    const key = mapRawTimeKeyToBucket(row._id, fromStr, granularity);
    if (bucketMap.has(key)) bucketMap.get(key).orderRevenue += val;
  }

  for (const row of serviceRows || []) {
    const val = Number(row.amount || 0);
    totalService += val;
    const key = mapRawTimeKeyToBucket(row._id, fromStr, granularity);
    if (bucketMap.has(key)) bucketMap.get(key).serviceRevenue += val;
  }

  for (const row of refundRows || []) {
    const val = Number(row.amount || 0);
    totalRefund += val;
    const key = mapRawTimeKeyToBucket(row._id, fromStr, granularity);
    if (bucketMap.has(key)) {
      bucketMap.get(key).refundAdjustment = normalizeNonNegativeZero(
        bucketMap.get(key).refundAdjustment - val
      );
    }
  }

  const points = bucketKeys.map((key) => {
    const pt = bucketMap.get(key);
    pt.totalRevenue = normalizeNonNegativeZero(pt.orderRevenue + pt.serviceRevenue + pt.refundAdjustment);
    return pt;
  });

  const refundAdjustment = normalizeNonNegativeZero(-totalRefund);
  const totalRevenue = normalizeNonNegativeZero(totalOrder + totalService + refundAdjustment);

  return {
    orderRevenue: totalOrder,
    serviceRevenue: totalService,
    refundAdjustment,
    totalRevenue,
    points,
  };
};

const aggregateStatusAndSeriesWindow = async ({
  Model,
  branchField,
  statusCatalog,
  startUtc,
  endExclusiveUtc,
  branchIds,
  fromStr,
  granularity,
  bucketKeys,
}) => {
  const matchStage = {
    createdAt: { $gte: startUtc, $lt: endExclusiveUtc },
    ...(branchIds ? { [branchField]: { $in: branchIds } } : {}),
  };

  const bucketFormat = getBucketDateFormat(granularity);
  const pipeline = [
    { $match: matchStage },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byBucket: [
          {
            $group: {
              _id: { $dateToString: { format: bucketFormat, date: '$createdAt', timezone: DASHBOARD_TIMEZONE } },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ];

  const [facetRes] = await Model.aggregate(pipeline);
  const countsByStatus = {};
  for (const entry of statusCatalog) {
    countsByStatus[entry.code] = 0;
  }

  let total = 0;
  for (const row of facetRes?.byStatus || []) {
    const count = Number(row.count || 0);
    const key = row._id || 'UNKNOWN';
    countsByStatus[key] = (countsByStatus[key] || 0) + count;
    total += count;
  }

  const bucketTotals = new Map(bucketKeys.map((k) => [k, 0]));
  for (const row of facetRes?.byBucket || []) {
    const count = Number(row.count || 0);
    const bucketKey = mapRawTimeKeyToBucket(row._id, fromStr, granularity);
    if (bucketTotals.has(bucketKey)) {
      bucketTotals.set(bucketKey, bucketTotals.get(bucketKey) + count);
    }
  }

  const trend = bucketKeys.map((periodStart) => ({
    periodStart,
    value: bucketTotals.get(periodStart) || 0,
  }));

  return { total, countsByStatus, trend };
};

const aggregateCountOnly = async ({ Model, branchField, startUtc, endExclusiveUtc, branchIds }) => {
  const matchStage = {
    createdAt: { $gte: startUtc, $lt: endExclusiveUtc },
    ...(branchIds ? { [branchField]: { $in: branchIds } } : {}),
  };
  const rows = await Model.aggregate([{ $match: matchStage }, { $count: 'count' }]);
  return Number(rows?.[0]?.count || 0);
};

const aggregateActiveCustomersWindow = async ({
  startUtc,
  endExclusiveUtc,
  branchIds,
  fromStr,
  granularity,
  bucketKeys = [],
  withTrend = true,
}) => {
  const bucketFormat = getBucketDateFormat(granularity);
  const orderMatch = {
    createdAt: { $gte: startUtc, $lt: endExclusiveUtc },
    customerId: { $ne: null },
    ...(branchIds ? { fulfillmentBranchId: { $in: branchIds } } : {}),
  };
  const aptMatch = {
    createdAt: { $gte: startUtc, $lt: endExclusiveUtc },
    customerId: { $ne: null },
    ...(branchIds ? { branchId: { $in: branchIds } } : {}),
  };

  const pipeline = [
    { $match: orderMatch },
    {
      $project: {
        _id: 0,
        customerId: 1,
        rawKey: withTrend
          ? { $dateToString: { format: bucketFormat, date: '$createdAt', timezone: DASHBOARD_TIMEZONE } }
          : { $literal: 'TOTAL' },
      },
    },
    {
      $unionWith: {
        coll: Appointment.collection?.name || 'appointments',
        pipeline: [
          { $match: aptMatch },
          {
            $project: {
              _id: 0,
              customerId: 1,
              rawKey: withTrend
                ? { $dateToString: { format: bucketFormat, date: '$createdAt', timezone: DASHBOARD_TIMEZONE } }
                : { $literal: 'TOTAL' },
            },
          },
        ],
      },
    },
  ];

  if (!withTrend) {
    pipeline.push({ $group: { _id: '$customerId' } }, { $count: 'count' });
    const rows = await Order.aggregate(pipeline);
    return { total: Number(rows?.[0]?.count || 0) };
  }

  pipeline.push({
    $facet: {
      totalDistinct: [{ $group: { _id: '$customerId' } }, { $count: 'count' }],
      bucketPairs: [{ $group: { _id: { rawKey: '$rawKey', customerId: '$customerId' } } }],
    },
  });

  const [facetRes] = await Order.aggregate(pipeline);
  const total = Number(facetRes?.totalDistinct?.[0]?.count || 0);

  const bucketCustomerSets = new Map(bucketKeys.map((k) => [k, new Set()]));
  for (const row of facetRes?.bucketPairs || []) {
    const customerIdStr = row?._id?.customerId ? String(row._id.customerId) : null;
    if (!customerIdStr) continue;
    const bucketKey = mapRawTimeKeyToBucket(row._id.rawKey, fromStr, granularity);
    if (bucketCustomerSets.has(bucketKey)) {
      bucketCustomerSets.get(bucketKey).add(customerIdStr);
    }
  }

  const trend = bucketKeys.map((periodStart) => ({
    periodStart,
    value: bucketCustomerSets.get(periodStart)?.size || 0,
  }));

  return { total, trend };
};

/**
 * Resolves variant/primary Product images for low-stock items of kind === 'PRODUCT'.
 * MATERIAL supplies always resolve to null.
 */
const resolveProductImagesForLowStock = async (rawItems) => {
  const productRows = rawItems.filter((item) => item.kind === 'PRODUCT');
  if (productRows.length === 0) return new Map();

  const itemIds = [...new Set(productRows.map((r) => r.inventoryItemId).filter(Boolean))]
    .map((id) => new mongoose.Types.ObjectId(id));
  const skus = [...new Set(productRows.map((r) => r.sku).filter(Boolean))];

  const productQuery = Product.find({
    status: { $ne: 'ARCHIVED' },
    $or: [
      ...(itemIds.length > 0 ? [{ 'variants.inventoryItemId': { $in: itemIds } }] : []),
      ...(skus.length > 0 ? [{ 'variants.sku': { $in: skus } }] : []),
    ],
  });

  const products = typeof productQuery?.select === 'function'
    ? await productQuery.select('images variants.inventoryItemId variants.sku variants.image').lean()
    : await productQuery;

  const imageByInventoryItemId = new Map();
  const imageBySku = new Map();

  for (const product of products || []) {
    const primaryProductImg = (product.images || []).find((img) => img && img.isPrimary)?.url
      || product.images?.[0]?.url
      || null;

    for (const variant of product.variants || []) {
      const resolvedUrl = variant.image || primaryProductImg || null;
      if (variant.inventoryItemId && !imageByInventoryItemId.has(String(variant.inventoryItemId))) {
        imageByInventoryItemId.set(String(variant.inventoryItemId), resolvedUrl);
      }
      if (variant.sku && !imageBySku.has(variant.sku)) {
        imageBySku.set(variant.sku, resolvedUrl);
      }
    }
  }

  const resolvedMap = new Map();
  for (const row of productRows) {
    const key = String(row.inventoryItemId);
    const url = imageByInventoryItemId.get(key) ?? imageBySku.get(row.sku) ?? null;
    resolvedMap.set(key, url);
  }
  return resolvedMap;
};

/**
 * Shared low-stock query used by both GET /summary and GET /low-stock
 * so summary.lowStockItems always equals lowStock.total.
 */
const queryLowStockData = async ({ branchIds, limit = 10, countOnly = false }) => {
  const basePipeline = [
    { $match: branchIds ? { branchId: { $in: branchIds } } : {} },
    {
      $lookup: {
        from: Branch.collection?.name || 'branches',
        localField: 'branchId',
        foreignField: '_id',
        as: 'branchDoc',
      },
    },
    { $unwind: '$branchDoc' },
    { $match: { 'branchDoc.status': 'ACTIVE' } },
    {
      $lookup: {
        from: InventoryItem.collection?.name || 'inventoryitems',
        localField: 'inventoryItemId',
        foreignField: '_id',
        as: 'itemDoc',
      },
    },
    { $unwind: '$itemDoc' },
    { $match: { 'itemDoc.status': 'ACTIVE' } },
  ];

  const isAlertExpr = {
    $or: [
      { $eq: ['$quantity', 0] },
      {
        $and: [
          { $eq: ['$thresholdConfigured', true] },
          { $lte: ['$quantity', '$lowStockThreshold'] },
        ],
      },
    ],
  };

  if (countOnly) {
    const rows = await InventoryStock.aggregate([
      ...basePipeline,
      { $match: { $expr: isAlertExpr } },
      { $count: 'total' },
    ]);
    return { total: Number(rows?.[0]?.total || 0), items: [], unconfiguredCount: 0 };
  }

  const [facetResult] = await InventoryStock.aggregate([
    ...basePipeline,
    {
      $facet: {
        meta: [
          {
            $group: {
              _id: null,
              total: { $sum: { $cond: [isAlertExpr, 1, 0] } },
              unconfiguredCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ['$quantity', 0] },
                        { $ne: ['$thresholdConfigured', true] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ],
        items: [
          { $match: { $expr: isAlertExpr } },
          {
            $addFields: {
              severityRank: { $cond: [{ $eq: ['$quantity', 0] }, 0, 1] },
              alertStatus: { $cond: [{ $eq: ['$quantity', 0] }, 'OUT_OF_STOCK', 'LOW_STOCK'] },
            },
          },
          { $sort: { severityRank: 1, quantity: 1, 'itemDoc.sku': 1, 'branchDoc.name': 1 } },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              inventoryItemId: '$inventoryItemId',
              branchId: '$branchId',
              branchName: '$branchDoc.name',
              branchCode: '$branchDoc.code',
              sku: '$itemDoc.sku',
              name: '$itemDoc.name',
              unit: '$itemDoc.unit',
              kind: '$itemDoc.kind',
              quantity: '$quantity',
              lowStockThreshold: { $ifNull: ['$lowStockThreshold', 0] },
              thresholdConfigured: { $ifNull: ['$thresholdConfigured', false] },
              status: '$alertStatus',
            },
          },
        ],
      },
    },
  ]);

  const meta = facetResult?.meta?.[0] || {};
  const rawItems = facetResult?.items || [];
  const imageMap = await resolveProductImagesForLowStock(rawItems);

  const items = rawItems.map((row) => ({
    stockId: String(row._id),
    inventoryItemId: String(row.inventoryItemId),
    branchId: String(row.branchId),
    branchName: row.branchName,
    branchCode: row.branchCode || null,
    sku: row.sku,
    name: row.name,
    unit: row.unit || 'cái',
    kind: row.kind,
    imageUrl: row.kind === 'PRODUCT' ? (imageMap.get(String(row.inventoryItemId)) || null) : null,
    quantity: Number(row.quantity || 0),
    lowStockThreshold: Number(row.lowStockThreshold || 0),
    threshold: Number(row.lowStockThreshold || 0),
    thresholdConfigured: Boolean(row.thresholdConfigured),
    status: row.status,
  }));

  return {
    total: Number(meta.total || 0),
    unconfiguredCount: Number(meta.unconfiguredCount || 0),
    items,
  };
};

// --- Public Service Endpoints ---

/**
 * 1. GET /api/v1/dashboard/summary
 */
export const getDashboardSummary = async (query = {}, actor) => {
  const range = resolveVnDateRange({
    from: query.from,
    to: query.to,
    preset: query.preset,
    timezone: query.timezone,
  });
  const { branchIds, branchIdStrings } = await resolveBranchScope(query.branchId, actor);
  const bucketKeys = generateBucketKeys(range.from, range.to, range.granularity);

  const [
    revCurrent,
    revPrevious,
    ordersCurrent,
    ordersPreviousTotal,
    aptsCurrent,
    aptsPreviousTotal,
    customersCurrent,
    customersPrevious,
    lowStockMeta,
  ] = await Promise.all([
    aggregateRevenueWindow({
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      branchIds,
      fromStr: range.from,
      granularity: range.granularity,
      bucketKeys,
      withBuckets: true,
    }),
    aggregateRevenueWindow({
      startUtc: range.prevStartUtc,
      endExclusiveUtc: range.prevEndExclusiveUtc,
      branchIds,
      fromStr: range.previousFrom,
      granularity: range.granularity,
      withBuckets: false,
    }),
    aggregateStatusAndSeriesWindow({
      Model: Order,
      branchField: 'fulfillmentBranchId',
      statusCatalog: ORDER_STATUS_CATALOG,
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      branchIds,
      fromStr: range.from,
      granularity: range.granularity,
      bucketKeys,
    }),
    aggregateCountOnly({
      Model: Order,
      branchField: 'fulfillmentBranchId',
      startUtc: range.prevStartUtc,
      endExclusiveUtc: range.prevEndExclusiveUtc,
      branchIds,
    }),
    aggregateStatusAndSeriesWindow({
      Model: Appointment,
      branchField: 'branchId',
      statusCatalog: APPOINTMENT_STATUS_CATALOG,
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      branchIds,
      fromStr: range.from,
      granularity: range.granularity,
      bucketKeys,
    }),
    aggregateCountOnly({
      Model: Appointment,
      branchField: 'branchId',
      startUtc: range.prevStartUtc,
      endExclusiveUtc: range.prevEndExclusiveUtc,
      branchIds,
    }),
    aggregateActiveCustomersWindow({
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      branchIds,
      fromStr: range.from,
      granularity: range.granularity,
      bucketKeys,
      withTrend: true,
    }),
    aggregateActiveCustomersWindow({
      startUtc: range.prevStartUtc,
      endExclusiveUtc: range.prevEndExclusiveUtc,
      branchIds,
      fromStr: range.previousFrom,
      granularity: range.granularity,
      withTrend: false,
    }),
    queryLowStockData({ branchIds, countOnly: true }),
  ]);

  const revenueKpi = {
    ...computeKpiComparison(revCurrent.totalRevenue, revPrevious.totalRevenue),
    currency: 'VND',
    trend: revCurrent.points.map((pt) => ({
      periodStart: pt.periodStart,
      value: pt.totalRevenue,
    })),
  };

  const ordersKpi = {
    ...computeKpiComparison(ordersCurrent.total, ordersPreviousTotal),
    trend: ordersCurrent.trend,
  };

  const appointmentsKpi = {
    ...computeKpiComparison(aptsCurrent.total, aptsPreviousTotal),
    trend: aptsCurrent.trend,
  };

  const activeCustomersKpi = {
    ...computeKpiComparison(customersCurrent.total, customersPrevious.total),
    trend: customersCurrent.trend,
  };

  const commerceRevenue = normalizeNonNegativeZero(revCurrent.orderRevenue + revCurrent.refundAdjustment);

  return {
    range: {
      from: range.from,
      to: range.to,
      previousFrom: range.previousFrom,
      previousTo: range.previousTo,
      granularity: range.granularity,
      timezone: DASHBOARD_TIMEZONE,
      branchIds: branchIdStrings,
    },
    kpis: {
      revenue: revenueKpi,
      orders: ordersKpi,
      appointments: appointmentsKpi,
      activeCustomers: activeCustomersKpi,
    },
    orderCountsByStatus: ordersCurrent.countsByStatus,
    appointmentCountsByStatus: aptsCurrent.countsByStatus,
    statusCatalog: {
      order: ORDER_STATUS_CATALOG,
      appointment: APPOINTMENT_STATUS_CATALOG,
      payment: PAYMENT_STATUS_CATALOG,
    },
    // Backward-compatible legacy root keys preserved with corrected values
    orders: ordersCurrent.total,
    appointments: aptsCurrent.total,
    revenue: {
      amount: revCurrent.totalRevenue,
      currency: 'VND',
    },
    newCustomers: customersCurrent.total,
    lowStockItems: lowStockMeta.total,
    breakdown: {
      commerceRevenue,
      clinicRevenue: revCurrent.serviceRevenue,
      orderRevenue: revCurrent.orderRevenue,
      serviceRevenue: revCurrent.serviceRevenue,
      refundAdjustment: revCurrent.refundAdjustment,
      orderCountsByStatus: ordersCurrent.countsByStatus,
      appointmentCountsByStatus: aptsCurrent.countsByStatus,
      timeRange: {
        startDate: range.startUtc,
        endDate: range.endExclusiveUtc,
      },
    },
  };
};

/**
 * 2. GET /api/v1/dashboard/revenue-analytics
 */
export const getRevenueAnalytics = async (query = {}, actor) => {
  const range = resolveVnDateRange({
    from: query.from,
    to: query.to,
    preset: query.preset,
    timezone: query.timezone,
  });
  const { branchIds, branchIdStrings } = await resolveBranchScope(query.branchId, actor);
  const bucketKeys = generateBucketKeys(range.from, range.to, range.granularity);

  const [current, previous] = await Promise.all([
    aggregateRevenueWindow({
      startUtc: range.startUtc,
      endExclusiveUtc: range.endExclusiveUtc,
      branchIds,
      fromStr: range.from,
      granularity: range.granularity,
      bucketKeys,
      withBuckets: true,
    }),
    aggregateRevenueWindow({
      startUtc: range.prevStartUtc,
      endExclusiveUtc: range.prevEndExclusiveUtc,
      branchIds,
      fromStr: range.previousFrom,
      granularity: range.granularity,
      withBuckets: false,
    }),
  ]);

  const comparison = computeKpiComparison(current.totalRevenue, previous.totalRevenue);

  return {
    currency: 'VND',
    granularity: range.granularity,
    range: {
      from: range.from,
      to: range.to,
      previousFrom: range.previousFrom,
      previousTo: range.previousTo,
      timezone: DASHBOARD_TIMEZONE,
      branchIds: branchIdStrings,
    },
    totalRevenue: comparison.current,
    previousRevenue: comparison.previous,
    delta: comparison.delta,
    changePercent: comparison.changePercent,
    totals: {
      orderRevenue: current.orderRevenue,
      serviceRevenue: current.serviceRevenue,
      refundAdjustment: current.refundAdjustment,
    },
    points: current.points,
  };
};

/**
 * 3. GET /api/v1/dashboard/low-stock
 */
export const getLowStockAlerts = async (query = {}, actor) => {
  const { branchIds } = await resolveBranchScope(query.branchId, actor);
  const limit = validateLimit(query.limit, 10, 20);
  return queryLowStockData({ branchIds, limit, countOnly: false });
};

/**
 * 4. GET /api/v1/dashboard/service-stats
 */
export const getServiceStats = async (query = {}, actor) => {
  const range = resolveVnDateRange({
    from: query.from,
    to: query.to,
    preset: query.preset,
    timezone: query.timezone,
  });
  const { branchIds, branchIdStrings } = await resolveBranchScope(query.branchId, actor);
  const limit = validateLimit(query.limit, 5, 10);

  const pipeline = [
    {
      $match: {
        ...(branchIds ? { branchId: { $in: branchIds } } : {}),
        status: { $nin: ['CANCELLED', 'NO_SHOW'] },
        'services.executionStatus': 'COMPLETED',
      },
    },
    { $unwind: '$services' },
    {
      $addFields: {
        effectiveSegmentCompletedAt: {
          $ifNull: [
            '$services.executionCompletedAt',
            { $ifNull: ['$completedAt', '$updatedAt'] },
          ],
        },
      },
    },
    {
      $match: {
        'services.executionStatus': 'COMPLETED',
        effectiveSegmentCompletedAt: { $gte: range.startUtc, $lt: range.endExclusiveUtc },
      },
    },
    {
      $group: {
        _id: { $ifNull: ['$services.serviceId', '$services.serviceName'] },
        serviceId: { $first: '$services.serviceId' },
        name: { $first: '$services.serviceName' },
        serviceType: { $first: '$services.serviceType' },
        completedCount: { $sum: 1 },
      },
    },
    { $sort: { completedCount: -1, name: 1, serviceId: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        serviceId: {
          $cond: [{ $ifNull: ['$serviceId', false] }, { $toString: '$serviceId' }, null],
        },
        name: '$name',
        serviceType: '$serviceType',
        completedCount: '$completedCount',
        revenue: { $literal: null },
      },
    },
  ];

  const items = await Appointment.aggregate(pipeline);

  return {
    range: {
      from: range.from,
      to: range.to,
      timezone: DASHBOARD_TIMEZONE,
      branchIds: branchIdStrings,
    },
    items: items || [],
  };
};

/**
 * 5. GET /api/v1/dashboard/attention
 * Global backlog & next-24h appointment schedule (ignores from/to filters; respects branch RBAC).
 */
export const getAttentionBacklog = async (query = {}, actor) => {
  const { branchIds, branchIdStrings } = await resolveBranchScope(query.branchId, actor);
  const limit = validateLimit(query.limit, 5, 10);
  const includeShipped = String(query.includeShipped || 'false').toLowerCase() === 'true';

  const now = new Date();
  const next24h = new Date(now.getTime() + MS_PER_DAY);

  const orderStatuses = includeShipped
    ? ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED']
    : ['PENDING', 'CONFIRMED', 'PROCESSING'];

  const orderFilter = {
    status: { $in: orderStatuses },
    ...(branchIds ? { fulfillmentBranchId: { $in: branchIds } } : {}),
  };

  const aptFilter = {
    status: { $in: ['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'IN_PROGRESS'] },
    scheduledStart: { $gte: now, $lte: next24h },
    ...(branchIds ? { branchId: { $in: branchIds } } : {}),
  };

  const [ordersTotal, rawOrders, appointmentsTotal, rawAppointments] = await Promise.all([
    Order.countDocuments(orderFilter),
    Order.find(orderFilter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .populate('fulfillmentBranchId', 'name code')
      .select('code contactSnapshot pricing.totalAmount createdAt status fulfillmentBranchId')
      .lean(),
    Appointment.countDocuments(aptFilter),
    Appointment.find(aptFilter)
      .sort({ scheduledStart: 1 })
      .limit(limit)
      .populate('branchId', 'name code')
      .select('code contactSnapshot customerSnapshot petSnapshot scheduledStart status serviceType branchId')
      .lean(),
  ]);

  const orders = (rawOrders || []).map((o) => ({
    id: String(o._id),
    code: o.code,
    customerName: o.contactSnapshot?.fullName || o.contactSnapshot?.name || 'Khách hàng',
    totalAmount: Number(o.pricing?.totalAmount || 0),
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
    status: o.status,
    branchId: o.fulfillmentBranchId ? String(o.fulfillmentBranchId._id || o.fulfillmentBranchId) : null,
    branchName: o.fulfillmentBranchId?.name || null,
  }));

  const appointments = (rawAppointments || []).map((a) => ({
    id: String(a._id),
    code: a.code,
    customerName: a.contactSnapshot?.fullName
      || a.contactSnapshot?.name
      || a.customerSnapshot?.fullName
      || a.customerSnapshot?.name
      || 'Khách hàng',
    petName: a.petSnapshot?.name || null,
    scheduledStart: a.scheduledStart ? new Date(a.scheduledStart).toISOString() : null,
    status: a.status,
    serviceType: a.serviceType,
    branchId: a.branchId ? String(a.branchId._id || a.branchId) : null,
    branchName: a.branchId?.name || null,
  }));

  return {
    branchIds: branchIdStrings,
    ordersTotal: Number(ordersTotal || 0),
    appointmentsTotal: Number(appointmentsTotal || 0),
    orders,
    appointments,
  };
};

export const dashboardService = {
  resolveBranchScope,
  getDashboardSummary,
  getRevenueAnalytics,
  getLowStockAlerts,
  getServiceStats,
  getAttentionBacklog,
};

export default dashboardService;
