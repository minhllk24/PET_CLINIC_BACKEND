import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Order from '../src/modules/order/models/Order';
import OrderReturn from '../src/modules/order/models/OrderReturn';
import OrderRefund from '../src/modules/order/models/OrderRefund';
import Payment from '../src/modules/payment/models/Payment';
import InventoryTransaction from '../src/modules/inventory/models/InventoryTransaction';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import * as orderService from '../src/modules/order/order.service';
import * as returnService from '../src/modules/order/return.service';
import * as voucherService from '../src/modules/order/voucher.service';

const adminId = '507f1f77bcf86cd799439001';
const managerId = '507f1f77bcf86cd799439002';
const receptionistId = '507f1f77bcf86cd799439004';
const customerId = '507f1f77bcf86cd799439003';
const branchId = '507f1f77bcf86cd799439011';

const adminToken = jwt.sign(
  { id: adminId, systemRole: 'ADMIN', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const managerToken = jwt.sign(
  { id: managerId, systemRole: 'MANAGER', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const receptionistToken = jwt.sign(
  { id: receptionistId, systemRole: 'STAFF', staffSubRole: 'RECEPTIONIST', assignedBranchIds: [branchId], authorizedBranchIds: [branchId] },
  config.jwt.accessSecret
);

const customerToken = jwt.sign(
  { id: customerId, systemRole: 'CUSTOMER' },
  config.jwt.accessSecret
);

const makeMockQuery = (doc) => ({
  session: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(Array.isArray(doc) ? doc : [doc]),
  lean: jest.fn().mockResolvedValue(doc),
  select: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  catch: (reject) => Promise.resolve(doc).catch(reject)
});

describe('Priority P0 Order & Priority P1 Return/Refund Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Model Invariants & Constraints', () => {
    it('enforces required schema constraints on OrderReturn', () => {
      const paths = OrderReturn.schema.paths;
      expect(paths.code).toBeDefined();
      expect(paths.orderId).toBeDefined();
      expect(paths.status.enumValues).toEqual([
        'REQUESTED', 'PROCESSING', 'RECEIVED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED'
      ]);
      expect(paths['refundBreakdown.merchandiseNet']).toBeDefined();
      expect(paths['refundBreakdown.shippingRefunded']).toBeDefined();
      expect(paths['refundBreakdown.total']).toBeDefined();
    });

    it('enforces required schema constraints on OrderRefund', () => {
      const paths = OrderRefund.schema.paths;
      expect(paths.code).toBeDefined();
      expect(paths.cause.enumValues).toEqual(['RETURN', 'CANCELLATION']);
      expect(paths.orderId).toBeDefined();
      expect(paths.amount).toBeDefined();
      expect(paths.status.enumValues).toEqual(['PENDING', 'REFUNDED', 'FAILED']);
    });
  });

  describe('2. Order Lifecycle & COD Delivery Transition', () => {
    it('advances Order from PENDING through COMPLETED and marks COD Payment as PAID upon delivery', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const paymentId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        code: 'ORD-TEST-001',
        customerId: new mongoose.Types.ObjectId(customerId),
        fulfillmentBranchId: new mongoose.Types.ObjectId(branchId),
        status: 'PENDING',
        paymentMethod: 'COD',
        items: [{
          orderItemId: 'ITEM-1',
          productId: new mongoose.Types.ObjectId(),
          nameSnapshot: 'Hạt dinh dưỡng',
          unitPrice: 100000,
          quantity: 2,
          lineSubtotal: 200000,
          allocatedDiscount: 20000,
          lineNet: 180000,
          returnedQty: 0
        }],
        pricing: { merchandiseSubtotal: 200000, voucherDiscount: 20000, shippingFee: 30000, totalAmount: 210000 },
        payment: { paymentId, status: 'PENDING' },
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      const mockPayment = {
        _id: paymentId,
        target: { type: 'ORDER', id: orderId },
        method: 'COD',
        status: 'PENDING',
        amount: 210000,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));

      // Confirm
      await orderService.confirmOrder(orderId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('CONFIRMED');

      // Process
      await orderService.processOrder(orderId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('PROCESSING');

      // Ship
      await orderService.shipOrder(orderId, { carrier: 'VNPost', trackingNumber: 'VN123456' }, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('SHIPPED');

      // Mark Delivered -> COMPLETED
      await orderService.markDelivered(orderId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('COMPLETED');
      expect(mockOrder.deliveredAt).toBeDefined();
      expect(mockPayment.status).toBe('PAID');
      expect(mockPayment.paidAt).toBeDefined();

      // Formatted order contains returnWindowEndsAt and REQUEST_RETURN in allowedActions
      const formatted = orderService.formatOrder(mockOrder);
      expect(formatted.status).toBe('COMPLETED');
      expect(formatted.returnWindowEndsAt).toBeDefined();
      expect(formatted.allowedActions).toContain('REQUEST_RETURN');
    });
  });

  describe('3. Return Window (7 Days Verification)', () => {
    it('allows return within 7 days of deliveredAt and rejects with 422 after 7 days', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const now = new Date();

      // Recent delivery (2 days ago)
      const recentDelivered = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      const eligibleOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: recentDelivered,
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [{
          orderItemId: 'ITEM-1',
          quantity: 2,
          lineNet: 180000,
          returnedQty: 0,
          returnReservedQty: 0
        }],
        toObject: function() { return this; }
      };

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(eligibleOrder));

      const returnable = await orderService.getReturnableItems(orderId, { id: customerId, systemRole: 'CUSTOMER' });
      expect(returnable.eligible).toBe(true);
      expect(returnable.items[0].returnableQty).toBe(2);
      expect(returnable.items[0].maxRefundEstimate).toBe(180000);

      // Expired delivery (8 days ago)
      const expiredDelivered = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      eligibleOrder.deliveredAt = expiredDelivered;

      const expiredReturnable = await orderService.getReturnableItems(orderId, { id: customerId, systemRole: 'CUSTOMER' });
      expect(expiredReturnable.eligible).toBe(false);
      expect(expiredReturnable.items[0].returnableQty).toBe(0);

      await expect(
        orderService.getReturnQuote(orderId, [{ orderItemId: 'ITEM-1', quantity: 1 }], { id: customerId, systemRole: 'CUSTOMER' })
      ).rejects.toThrow(/Return window of 7 days has expired/);
    });
  });

  describe('4. Partial Return, Two-Phase Reservation & Proportional Refund (Option A)', () => {
    it('reserves quantity on return create, computes proportional net refund without shipping, and releases on reject/cancel', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-ABC';

      const mockLineItem = {
        orderItemId: lineItemId,
        productId: new mongoose.Types.ObjectId(),
        nameSnapshot: 'Thức ăn mèo',
        quantity: 3,
        lineNet: 300000, // 100k per item after discount
        returnedQty: 0,
        returnReservedQty: 0,
        refundedNet: 0
      };

      const mockOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(),
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [mockLineItem],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      const fakeSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));

      jest.spyOn(OrderReturn.prototype, 'save').mockImplementation(function() {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });

      // 1. Create return for 1 quantity out of 3
      const ret = await returnService.createReturn({
        orderId,
        items: [{ orderItemId: lineItemId, quantity: 1 }],
        reason: 'Mèo không thích vị này'
      }, { id: customerId, systemRole: 'CUSTOMER' });

      expect(ret.status).toBe('REQUESTED');
      expect(ret.items[0].requestedQty).toBe(1);
      expect(ret.items[0].refundAmount).toBe(100000); // 300000 / 3 = 100000
      expect(ret.refundBreakdown.total).toBe(100000);
      expect(ret.refundBreakdown.shippingRefunded).toBe(0); // Shipping not refunded
      expect(mockLineItem.returnReservedQty).toBe(1); // Reserved!

      // 2. Rejecting return releases reserved quantity
      ret.status = 'PROCESSING';
      jest.spyOn(OrderReturn, 'findById').mockReturnValue(makeMockQuery(ret));

      await returnService.rejectReturn(ret._id, { reason: 'Sản phẩm đã bị mở bao bì' }, { id: managerId, systemRole: 'MANAGER' });
      expect(ret.status).toBe('REJECTED');
      expect(mockLineItem.returnReservedQty).toBe(0); // Released back!
    });
  });

  describe('5. RBAC & Single-Level Approval State Machine', () => {
    it('restricts Receptionist from approving/rejecting (403) and allows Manager/Admin to approve and process refund', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const returnId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-XYZ';

      const mockLineItem = {
        orderItemId: lineItemId,
        quantity: 2,
        lineNet: 200000,
        returnedQty: 0,
        returnReservedQty: 1,
        refundedNet: 0
      };

      const mockOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(),
        items: [mockLineItem],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockReturn = {
        _id: returnId,
        orderId,
        status: 'REQUESTED',
        items: [{
          orderItemId: lineItemId,
          productName: 'Pate lon',
          orderedQty: 2,
          alreadyReturnedQty: 0,
          requestedQty: 1,
          refundAmount: 100000
        }],
        refundBreakdown: { merchandiseNet: 100000, shippingRefunded: 0, total: 100000 },
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(OrderReturn, 'findById').mockReturnValue(makeMockQuery(mockReturn));
      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));

      // Receptionist: REQUESTED -> PROCESSING
      await returnService.processReturn(returnId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockReturn.status).toBe('PROCESSING');

      // Receptionist: PROCESSING -> RECEIVED
      await returnService.receiveReturn(returnId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockReturn.status).toBe('RECEIVED');

      // Receptionist attempts approve -> Expect 403 Forbidden
      await expect(
        returnService.approveReturn(returnId, {}, { id: receptionistId, systemRole: 'STAFF' })
      ).rejects.toThrow('Only Manager or Admin can approve returns');

      // Manager: RECEIVED -> APPROVED
      const fakeSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);

      jest.spyOn(OrderRefund.prototype, 'save').mockImplementation(function() {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });

      await returnService.approveReturn(returnId, { note: 'Approved by branch manager' }, { id: managerId, systemRole: 'MANAGER' });
      expect(mockReturn.status).toBe('APPROVED');
      expect(mockLineItem.returnedQty).toBe(1);
      expect(mockLineItem.returnReservedQty).toBe(0);

      // Process OrderRefund: PENDING -> REFUNDED, OrderReturn -> COMPLETED
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        cause: 'RETURN',
        orderReturnId: returnId,
        orderId,
        amount: 100000,
        status: 'PENDING',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(OrderRefund, 'findById').mockReturnValue(makeMockQuery(mockRefund));

      const mockPayment = {
        target: { type: 'ORDER', id: orderId },
        amount: 250000,
        refundedAmount: 0,
        status: 'PAID',
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));

      await returnService.processOrderRefund(mockRefund._id, { id: managerId, systemRole: 'MANAGER' });
      expect(mockRefund.status).toBe('REFUNDED');
      expect(mockPayment.refundedAmount).toBe(100000);
      expect(mockReturn.status).toBe('COMPLETED');
    });
  });

  describe('6. REST Endpoints via Supertest', () => {
    it('creates return request via POST /api/v1/order-returns with Idempotency-Key', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const lineItemId = new mongoose.Types.ObjectId().toString();

      const mockOrder = {
        _id: new mongoose.Types.ObjectId(orderId),
        status: 'COMPLETED',
        deliveredAt: new Date(),
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [{
          orderItemId: lineItemId,
          quantity: 2,
          lineNet: 100000,
          returnedQty: 0,
          returnReservedQty: 0
        }],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      const fakeSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));

      jest.spyOn(OrderReturn.prototype, 'save').mockImplementation(function() {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });

      const res = await request(app)
        .post('/api/v1/order-returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'ret-key-0001')
        .send({
          orderId,
          items: [{ orderItemId: lineItemId, quantity: 1 }],
          reason: 'Hang bi loi dong goi'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('status', 'REQUESTED');
      expect(res.body.refundBreakdown).toHaveProperty('merchandiseNet', 50000);
      expect(res.body.refundBreakdown).toHaveProperty('shippingRefunded', 0);
    });
  });

  describe('7. Voucher Discount Allocation Snapshot & Return Net Refund Safeguards', () => {
    it('calculates proportional voucher discount allocation across eligible items with integer VND rounding and distributes remainder to the last eligible item', async () => {
      // Setup resolved items
      const item1Id = new mongoose.Types.ObjectId();
      const item2Id = new mongoose.Types.ObjectId();
      const item3Id = new mongoose.Types.ObjectId();
      const nonEligibleItemId = new mongoose.Types.ObjectId();

      const items = [
        { productId: item1Id, unitPrice: 100000, quantity: 1 }, // subtotal 100k
        { productId: item2Id, unitPrice: 200000, quantity: 1 }, // subtotal 200k
        { productId: item3Id, unitPrice: 300000, quantity: 1 }, // subtotal 300k
        { productId: nonEligibleItemId, unitPrice: 400000, quantity: 1 } // subtotal 400k (not eligible)
      ];

      // Fixed voucher 50,000 VND scoped to product 1, 2, 3
      const voucher = {
        scope: 'PRODUCT',
        scopeRefs: [item1Id, item2Id, item3Id]
      };
      const voucherDiscount = 50000;

      const isItemEligible = (item) => {
        if (!voucher || voucherDiscount <= 0) return false;
        if (voucher.scope === 'PRODUCT' && Array.isArray(voucher.scopeRefs) && voucher.scopeRefs.length > 0) {
          return voucher.scopeRefs.some((ref) => (ref._id || ref).toString() === item.productId.toString());
        }
        return true;
      };

      const eligibleItems = items.filter(isItemEligible);
      const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      expect(eligibleSubtotal).toBe(600000);

      let lastEligibleIndex = -1;
      for (let i = items.length - 1; i >= 0; i--) {
        if (isItemEligible(items[i])) {
          lastEligibleIndex = i;
          break;
        }
      }
      expect(lastEligibleIndex).toBe(2);

      let allocatedSum = 0;
      const orderItems = items.map((item, idx) => {
        const lineSubtotal = item.unitPrice * item.quantity;
        let allocatedDiscount = 0;

        if (isItemEligible(item) && eligibleSubtotal > 0 && voucherDiscount > 0) {
          if (idx === lastEligibleIndex) {
            allocatedDiscount = Math.max(0, voucherDiscount - allocatedSum);
          } else {
            allocatedDiscount = Math.round((lineSubtotal / eligibleSubtotal) * voucherDiscount);
            allocatedSum += allocatedDiscount;
          }
          allocatedDiscount = Math.min(allocatedDiscount, lineSubtotal);
        }

        const lineNet = Math.max(0, lineSubtotal - allocatedDiscount);
        return {
          productId: item.productId,
          lineSubtotal,
          allocatedDiscount,
          lineNet
        };
      });

      // Item 1: 100k / 600k * 50k = 8,333.33 -> round = 8,333
      expect(orderItems[0].allocatedDiscount).toBe(8333);
      expect(orderItems[0].lineNet).toBe(100000 - 8333);

      // Item 2: 200k / 600k * 50k = 16,666.66 -> round = 16,667
      expect(orderItems[1].allocatedDiscount).toBe(16667);
      expect(orderItems[1].lineNet).toBe(200000 - 16667);

      // Item 3 (last eligible): 50,000 - (8,333 + 16,667) = 25,000 exactly!
      expect(orderItems[2].allocatedDiscount).toBe(25000);
      expect(orderItems[2].lineNet).toBe(300000 - 25000);

      // Item 4 (non-eligible): 0 discount
      expect(orderItems[3].allocatedDiscount).toBe(0);
      expect(orderItems[3].lineNet).toBe(400000);

      // Total discount exactly matches voucherDiscount (50,000 VND)
      const totalAllocatedDiscount = orderItems.reduce((sum, item) => sum + item.allocatedDiscount, 0);
      expect(totalAllocatedDiscount).toBe(50000);
    });

    it('refunds partial returns according to snapshotted lineNet and grants remainder on final returned unit without shipping', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-PARTIAL-1';

      // 3 units of an item with total lineNet = 200,000 VND (66,666.66 per unit)
      const mockLineItem = {
        orderItemId: lineItemId,
        productId: new mongoose.Types.ObjectId(),
        nameSnapshot: 'Thuc an cho',
        quantity: 3,
        lineSubtotal: 240000,
        allocatedDiscount: 40000,
        lineNet: 200000,
        returnedQty: 0,
        returnReservedQty: 0,
        refundedNet: 0
      };

      const mockOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(),
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [mockLineItem],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));

      // 1. Return 1 unit out of 3:
      // unitNet = Math.floor(200,000 / 3) = 66,666 VND
      const quote1 = await orderService.getReturnQuote(
        orderId,
        [{ orderItemId: lineItemId, quantity: 1 }],
        { id: customerId, systemRole: 'CUSTOMER' }
      );
      expect(quote1.refundBreakdown.merchandiseNet).toBe(66666);
      expect(quote1.refundBreakdown.shippingRefunded).toBe(0);
      expect(quote1.refundBreakdown.total).toBe(66666);

      // Simulate approval of 1 unit
      mockLineItem.returnedQty = 1;
      mockLineItem.refundedNet = 66666;

      // 2. Return the remaining 2 units (final units):
      // Current returned (1) + requested (2) === quantity (3)
      // refundAmount = lineNet - refundedNet = 200,000 - 66,666 = 133,334 VND
      const quote2 = await orderService.getReturnQuote(
        orderId,
        [{ orderItemId: lineItemId, quantity: 2 }],
        { id: customerId, systemRole: 'CUSTOMER' }
      );
      expect(quote2.refundBreakdown.merchandiseNet).toBe(133334);
      expect(quote2.refundBreakdown.shippingRefunded).toBe(0);
      expect(quote2.refundBreakdown.total).toBe(133334);

      // Total refunded across both parts: 66,666 + 133,334 = 200,000 VND (100% of lineNet)
      expect(quote1.refundBreakdown.total + quote2.refundBreakdown.total).toBe(200000);
    });

    it('enforces total refund ceiling: rejects with 422 REFUND_EXCEEDS_NET_PAID if cumulative refund exceeds net merchandise paid', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-LIMIT-1';

      const mockLineItem = {
        orderItemId: lineItemId,
        productId: new mongoose.Types.ObjectId(),
        quantity: 1,
        lineNet: 100000,
        returnedQty: 0,
        returnReservedQty: 0,
        refundedNet: 0
      };

      const mockOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(),
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [mockLineItem],
        save: jest.fn().mockResolvedValue(true),
        toObject: function() { return this; }
      };

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));

      // Mock previous refund already totaling 100,000 VND
      jest.spyOn(OrderRefund, 'find').mockReturnValue(makeMockQuery([{
        orderId,
        amount: 100000,
        status: 'REFUNDED'
      }]));

      // Attempting to quote or create another refund for 100,000 must fail with REFUND_EXCEEDS_NET_PAID
      await expect(
        orderService.getReturnQuote(orderId, [{ orderItemId: lineItemId, quantity: 1 }], { id: customerId, systemRole: 'CUSTOMER' })
      ).rejects.toThrow('Total refund cannot exceed net merchandise amount paid');
    });

    it('never restores voucher quota on return after delivery, only restores when cancelled before completion', async () => {
      const restoreSpy = jest.spyOn(voucherService, 'restoreQuotaInSession').mockResolvedValue({});

      const orderId = new mongoose.Types.ObjectId();
      const voucherId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-VOUCHER-TEST';

      const mockLineItem = {
        orderItemId: lineItemId,
        quantity: 1,
        lineNet: 150000,
        returnedQty: 0,
        returnReservedQty: 1,
        refundedNet: 0
      };

      const mockDeliveredOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(),
        voucher: { voucherId, code: 'SAVE10' },
        items: [mockLineItem],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockReturn = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        status: 'RECEIVED',
        items: [{
          orderItemId: lineItemId,
          requestedQty: 1,
          refundAmount: 150000
        }],
        refundBreakdown: { merchandiseNet: 150000, shippingRefunded: 0, total: 150000 },
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      const fakeSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);
      jest.spyOn(OrderReturn, 'findById').mockReturnValue(makeMockQuery(mockReturn));
      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockDeliveredOrder));
      jest.spyOn(OrderRefund.prototype, 'save').mockImplementation(function() {
        this._id = new mongoose.Types.ObjectId();
        return Promise.resolve(this);
      });

      // 1. Approve return after delivery -> restoreQuotaInSession MUST NOT be called!
      await returnService.approveReturn(mockReturn._id, {}, { id: managerId, systemRole: 'MANAGER' });
      expect(restoreSpy).not.toHaveBeenCalled();

      // 2. Pre-completion cancellation (order in PENDING state) -> restoreQuotaInSession MUST be called!
      const pendingOrder = {
        _id: new mongoose.Types.ObjectId(),
        status: 'PENDING',
        statusHistory: [],
        voucher: { voucherId, code: 'SAVE10' },
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(pendingOrder));
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(null));
      jest.spyOn(InventoryTransaction, 'find').mockReturnValue(makeMockQuery([]));

      await orderService.cancelOrder(pendingOrder._id, { id: customerId, systemRole: 'CUSTOMER' }, 'Customer cancelled', true);
      expect(restoreSpy).toHaveBeenCalledWith(expect.objectContaining({
        voucherId,
        targetType: 'ORDER',
        targetId: pendingOrder._id
      }));
    });
  });
});
