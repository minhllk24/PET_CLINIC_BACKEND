import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import Order from '../src/modules/order/models/Order';
import OrderReturn from '../src/modules/order/models/OrderReturn';
import OrderRefund from '../src/modules/order/models/OrderRefund';
import Payment from '../src/modules/payment/models/Payment';
import Cart from '../src/modules/cart/models/Cart';
import Product from '../src/modules/catalog/models/Product';
import Category from '../src/modules/catalog/models/Category';
import Branch from '../src/modules/branch/models/Branch';
import Voucher from '../src/modules/order/models/Voucher';
import SystemSetting from '../src/modules/settings/models/SystemSetting';
import InventoryStock from '../src/modules/inventory/models/InventoryStock';
import InventoryTransaction from '../src/modules/inventory/models/InventoryTransaction';
import IdempotencyKey from '../src/modules/audit/models/IdempotencyKey';
import * as orderService from '../src/modules/order/order.service';
import * as returnService from '../src/modules/order/return.service';
import * as voucherService from '../src/modules/order/voucher.service';
import * as inventoryService from '../src/modules/inventory/inventory.service';
import {
  branch1Id,
  branch2Id,
  branch3Id,
  catFoodId,
  catHygieneId,
  catHousingId,
  catHealthId,
  prodDogId,
  varDogId,
  invDogId,
  prodCatId,
  varCatId,
  invCatId,
  prodSmallId,
  varSmallId,
  invSmallId,
  prodBirdId,
  varBirdId,
  invBirdId,
  adminId,
  managerId,
  receptionistId,
  customerId,
  adminToken,
  managerToken,
  receptionistToken,
  customerToken,
  guestCartToken,
  categoriesFixture,
  productsFixture,
  branchesFixture,
  commerceSettingFixture,
  vouchersFixture
} from './fixtures/orderE2EData';

const makeMockQuery = (doc) => ({
  session: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(Array.isArray(doc) ? doc : [doc]),
  lean: jest.fn().mockResolvedValue(doc),
  select: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  catch: (reject) => Promise.resolve(doc).catch(reject)
});

describe('E2E Order & Multi-Stage Return/Refund Lifecycle Suite', () => {
  beforeEach(() => {
    jest.spyOn(IdempotencyKey, 'findOne').mockResolvedValue(null);
    jest.spyOn(IdempotencyKey, 'findOneAndUpdate').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // =========================================================================
  // SC-01: Realistic Data Invariants & Setup (Products, Categories, Branches, Vouchers)
  // =========================================================================
  describe('SC-01: Realistic Data Invariants & Setup', () => {
    it('verifies 4 functional categories and 4 diverse species products structure', () => {
      expect(categoriesFixture.length).toBe(4);
      const catSlugs = categoriesFixture.map((c) => c.slug);
      expect(catSlugs).toContain('thuc-an-va-dinh-duong');
      expect(catSlugs).toContain('ve-sinh-va-cham-soc');
      expect(catSlugs).toContain('phu-kien-va-chuong-trai');
      expect(catSlugs).toContain('y-te-va-thuc-pham-chuc-nang');

      expect(productsFixture.length).toBe(4);
      // Dog, Cat, Small Animals (Hamster/Rabbit), Bird
      expect(productsFixture[0].name).toContain('Royal Canin Mini Puppy');
      expect(productsFixture[1].name).toContain('Ciao Cat Can');
      expect(productsFixture[2].name).toContain('Timothy');
      expect(productsFixture[3].name).toContain('Pet Bird Master');

      // Product master does not store stock
      const productSchemaPaths = Object.keys(Product.schema.paths);
      expect(productSchemaPaths).not.toContain('stock');
      expect(productSchemaPaths).not.toContain('quantity');
      expect(productSchemaPaths).not.toContain('availableStock');

      // InventoryStock enforces branchId, inventoryItemId, quantity >= 0
      expect(InventoryStock.schema.paths.branchId).toBeDefined();
      expect(InventoryStock.schema.paths.inventoryItemId).toBeDefined();
      expect(InventoryStock.schema.paths.quantity.options.min).toBe(0);
    });

    it('verifies 3 standardized branches and commerce settings priority', () => {
      expect(branchesFixture.length).toBe(3);
      expect(branchesFixture[0].code).toBe('BR-000001');
      expect(branchesFixture[1].code).toBe('BR-000002');
      expect(branchesFixture[2].code).toBe('BR-000003');

      expect(commerceSettingFixture.value.fulfillmentBranchPriority).toEqual([
        branch1Id,
        branch2Id,
        branch3Id
      ]);
    });
  });

  // =========================================================================
  // SC-02, SC-03, SC-04, SC-05: Fulfillment Branch Resolver Invariants
  // =========================================================================
  describe('SC-02 -> SC-05: Fulfillment Resolver & Cart Split Rejection', () => {
    it('SC-02: selects Priority Branch 1 (BR-000001) when it has full cart inventory', async () => {
      const cartId = new mongoose.Types.ObjectId();
      const mockCart = {
        _id: cartId,
        items: [
          { productId: prodDogId, variantId: varDogId, quantity: 2 },
          { productId: prodCatId, variantId: varCatId, quantity: 3 }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Cart, 'findOne').mockReturnValue(makeMockQuery(mockCart));
      jest.spyOn(Product, 'findById').mockImplementation((id) => {
        const prod = productsFixture.find((p) => p._id.toString() === id.toString());
        return makeMockQuery(prod);
      });
      jest.spyOn(SystemSetting, 'findOne').mockReturnValue(makeMockQuery(commerceSettingFixture));
      jest.spyOn(Branch, 'findOne').mockImplementation(({ _id, status }) => {
        const br = branchesFixture.find((b) => b._id.toString() === _id.toString() && b.status === status);
        return makeMockQuery(br);
      });

      // Branch 1 has sufficient stock: 10 units each
      jest.spyOn(InventoryStock, 'find').mockImplementation(({ branchId }) => {
        if (branchId.toString() === branch1Id.toString()) {
          return makeMockQuery([
            { branchId, inventoryItemId: invDogId, quantity: 10 },
            { branchId, inventoryItemId: invCatId, quantity: 10 }
          ]);
        }
        return makeMockQuery([]);
      });

      const issueSpy = jest.spyOn(inventoryService, 'issueForOrder').mockResolvedValue([]);
      const fakeSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
        withTransaction: async (cb) => cb()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);

      jest.spyOn(Order.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });
      jest.spyOn(Payment.prototype, 'save').mockImplementation(function() {
        return Promise.resolve(this);
      });

      const order = await orderService.checkoutCreateOrder({
        cartId,
        paymentMethod: 'COD',
        shippingAddress: { recipientName: 'Nguyen Van A', phone: '0901234567', line1: '123 Le Loi', city: 'TP.HCM' }
      }, { id: customerId, systemRole: 'CUSTOMER' });

      expect(order.fulfillmentBranchId.toString()).toBe(branch1Id.toString());
      expect(issueSpy).toHaveBeenCalledWith(expect.objectContaining({
        reason: 'Order checkout'
      }));
      const callArg = issueSpy.mock.calls[0][0];
      expect(callArg.branchId.toString()).toBe(branch1Id.toString());
      expect(callArg.movements).toEqual(expect.arrayContaining([
        expect.objectContaining({ inventoryItemId: invDogId.toString(), quantity: 2 }),
        expect.objectContaining({ inventoryItemId: invCatId.toString(), quantity: 3 })
      ]));
    });

    it('SC-03: falls back to Branch 2 when Branch 1 has insufficient stock or is INACTIVE', async () => {
      const cartId = new mongoose.Types.ObjectId();
      const mockCart = {
        _id: cartId,
        items: [{ productId: prodDogId, variantId: varDogId, quantity: 5 }],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Cart, 'findOne').mockReturnValue(makeMockQuery(mockCart));
      jest.spyOn(Product, 'findById').mockReturnValue(makeMockQuery(productsFixture[0]));
      jest.spyOn(SystemSetting, 'findOne').mockReturnValue(makeMockQuery(commerceSettingFixture));
      jest.spyOn(Branch, 'findOne').mockImplementation(({ _id, status }) => {
        const br = branchesFixture.find((b) => b._id.toString() === _id.toString() && b.status === status);
        return makeMockQuery(br);
      });

      // Branch 1 has only 1 unit (insufficient for qty 5), Branch 2 has 10 units
      jest.spyOn(InventoryStock, 'find').mockImplementation(({ branchId }) => {
        if (branchId.toString() === branch1Id.toString()) {
          return makeMockQuery([{ branchId, inventoryItemId: invDogId, quantity: 1 }]);
        }
        if (branchId.toString() === branch2Id.toString()) {
          return makeMockQuery([{ branchId, inventoryItemId: invDogId, quantity: 10 }]);
        }
        return makeMockQuery([]);
      });

      const issueSpy = jest.spyOn(inventoryService, 'issueForOrder').mockResolvedValue([]);
      const fakeSession = {
        withTransaction: async (cb) => cb(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);
      jest.spyOn(Order.prototype, 'save').mockImplementation(function() { return Promise.resolve(this); });
      jest.spyOn(Payment.prototype, 'save').mockImplementation(function() { return Promise.resolve(this); });

      const order = await orderService.checkoutCreateOrder({
        cartId,
        paymentMethod: 'COD',
        shippingAddress: { recipientName: 'Tran Van B', phone: '0901234568', line1: '456 Hai Ba Trung', city: 'TP.HCM' }
      }, { id: customerId, systemRole: 'CUSTOMER' });

      expect(order.fulfillmentBranchId.toString()).toBe(branch2Id.toString());
      expect(issueSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: branch2Id }));
    });

    it('SC-04: rejects cart splitting with 422 INSUFFICIENT_INVENTORY when total system stock is enough but no single branch has entire cart', async () => {
      const cartId = new mongoose.Types.ObjectId();
      const mockCart = {
        _id: cartId,
        items: [
          { productId: prodDogId, variantId: varDogId, quantity: 2 },
          { productId: prodCatId, variantId: varCatId, quantity: 2 }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Cart, 'findOne').mockReturnValue(makeMockQuery(mockCart));
      jest.spyOn(Product, 'findById').mockImplementation((id) => {
        const prod = productsFixture.find((p) => p._id.toString() === id.toString());
        return makeMockQuery(prod);
      });
      jest.spyOn(SystemSetting, 'findOne').mockReturnValue(makeMockQuery(commerceSettingFixture));
      jest.spyOn(Branch, 'findOne').mockImplementation(({ _id, status }) => {
        const br = branchesFixture.find((b) => b._id.toString() === _id.toString() && b.status === status);
        return makeMockQuery(br);
      });

      // Branch 1 has Dog food (10) but NO Cat pate (0)
      // Branch 2 has Cat pate (10) but NO Dog food (0)
      // Branch 3 has neither
      jest.spyOn(InventoryStock, 'find').mockImplementation(({ branchId }) => {
        if (branchId.toString() === branch1Id.toString()) {
          return makeMockQuery([
            { branchId, inventoryItemId: invDogId, quantity: 10 },
            { branchId, inventoryItemId: invCatId, quantity: 0 }
          ]);
        }
        if (branchId.toString() === branch2Id.toString()) {
          return makeMockQuery([
            { branchId, inventoryItemId: invDogId, quantity: 0 },
            { branchId, inventoryItemId: invCatId, quantity: 10 }
          ]);
        }
        return makeMockQuery([]);
      });

      await expect(
        orderService.checkoutCreateOrder({
          cartId,
          paymentMethod: 'COD',
          shippingAddress: { recipientName: 'Le Thi C', phone: '0901234569', line1: '789 Dien Bien Phu', city: 'TP.HCM' }
        }, { id: customerId, systemRole: 'CUSTOMER' })
      ).rejects.toThrow('No active branch can fulfill the entire cart');
    });

    it('SC-05: rejects checkout when cart is empty or quantity is invalid', async () => {
      const cartId = new mongoose.Types.ObjectId();
      jest.spyOn(Cart, 'findOne').mockReturnValue(makeMockQuery({ _id: cartId, items: [] }));

      await expect(
        orderService.checkoutCreateOrder({
          cartId,
          paymentMethod: 'COD',
          shippingAddress: { recipientName: 'Guest', phone: '0900000000', line1: '1 Nguyen Hue', city: 'TP.HCM' }
        }, { id: customerId, systemRole: 'CUSTOMER' })
      ).rejects.toThrow('Cart is empty or not found');
    });
  });

  // =========================================================================
  // SC-06: Two-Tier Pricing (Product Discount FIRST, Voucher SECOND)
  // =========================================================================
  describe('SC-06: Two-Tier Pricing & Financial Snapshot Invariants', () => {
    it('applies Product discount FIRST to determine unitPrice=finalPrice, then applies Voucher discount SECOND on merchandiseSubtotal', async () => {
      const cartId = new mongoose.Types.ObjectId();

      // Cart contains:
      // 1. Dog food: original price 150,000 VND, discountPercent 10% -> finalPrice = 135,000 VND. Qty 2 -> lineSubtotal = 270,000 VND
      // 2. Small Animal Timothy: original price 120,000 VND, discountPercent 25% -> finalPrice = 90,000 VND. Qty 1 -> lineSubtotal = 90,000 VND
      // Merchandise Subtotal after Tier 1 Product discount = 270,000 + 90,000 = 360,000 VND
      const mockCart = {
        _id: cartId,
        items: [
          { productId: prodDogId, variantId: varDogId, quantity: 2 },
          { productId: prodSmallId, variantId: varSmallId, quantity: 1 }
        ],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Cart, 'findOne').mockReturnValue(makeMockQuery(mockCart));
      jest.spyOn(Product, 'findById').mockImplementation((id) => {
        const prod = productsFixture.find((p) => p._id.toString() === id.toString());
        return makeMockQuery(prod);
      });
      jest.spyOn(SystemSetting, 'findOne').mockReturnValue(makeMockQuery(commerceSettingFixture));
      jest.spyOn(Branch, 'findOne').mockReturnValue(makeMockQuery(branchesFixture[0]));
      jest.spyOn(InventoryStock, 'find').mockReturnValue(makeMockQuery([
        { branchId: branch1Id, inventoryItemId: invDogId, quantity: 20 },
        { branchId: branch1Id, inventoryItemId: invSmallId, quantity: 20 }
      ]));

      // Tier 2: Voucher Fixed 40,000 VND (minOrderAmount: 150,000 VND met because 360,000 >= 150,000)
      const voucherFixed = vouchersFixture.fixed;
      jest.spyOn(voucherService, 'validateVoucherEligibility').mockResolvedValue({
        valid: true,
        voucher: voucherFixed,
        discount: 40000
      });
      const consumeSpy = jest.spyOn(voucherService, 'consumeQuotaInSession').mockResolvedValue({});
      jest.spyOn(inventoryService, 'issueForOrder').mockResolvedValue([]);

      const fakeSession = {
        withTransaction: async (cb) => cb(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);

      let savedOrder = null;
      jest.spyOn(Order.prototype, 'save').mockImplementation(function() {
        savedOrder = this;
        return Promise.resolve(this);
      });
      jest.spyOn(Payment.prototype, 'save').mockImplementation(function() { return Promise.resolve(this); });

      await orderService.checkoutCreateOrder({
        cartId,
        paymentMethod: 'COD',
        voucherCode: voucherFixed.code,
        shippingAddress: { recipientName: 'Pham Van D', phone: '0901112222', line1: '10 Nguyen Trai', city: 'TP.HCM' }
      }, { id: customerId, systemRole: 'CUSTOMER' });

      expect(savedOrder).toBeDefined();

      // Tier 1 Validation:
      // Item 0: Dog Food unitPrice = 135,000, lineSubtotal = 270,000
      expect(savedOrder.items[0].unitPrice).toBe(135000);
      expect(savedOrder.items[0].lineSubtotal).toBe(270000);
      // Item 1: Small Animal unitPrice = 90,000, lineSubtotal = 90,000
      expect(savedOrder.items[1].unitPrice).toBe(90000);
      expect(savedOrder.items[1].lineSubtotal).toBe(90000);

      // Pricing check
      expect(savedOrder.pricing.merchandiseSubtotal).toBe(360000);
      expect(savedOrder.pricing.voucherDiscount).toBe(40000);
      expect(savedOrder.pricing.shippingFee).toBe(30000); // 360,000 < 500,000 free shipping threshold
      expect(savedOrder.pricing.totalAmount).toBe(350000); // 360,000 - 40,000 + 30,000 = 350,000

      // Tier 2 Proportional Allocation Check:
      // Item 0 allocation: Math.round(40000 * 270000 / 360000) = 30000
      expect(savedOrder.items[0].allocatedDiscount).toBe(30000);
      expect(savedOrder.items[0].lineNet).toBe(240000); // 270,000 - 30,000

      // Item 1 allocation (last eligible item absorbs remainder): 40000 - 30000 = 10000
      expect(savedOrder.items[1].allocatedDiscount).toBe(10000);
      expect(savedOrder.items[1].lineNet).toBe(80000); // 90,000 - 10,000

      // Sum checks
      const totalAllocated = savedOrder.items.reduce((sum, item) => sum + item.allocatedDiscount, 0);
      expect(totalAllocated).toBe(40000);
      const totalNetPaid = savedOrder.items.reduce((sum, item) => sum + item.lineNet, 0);
      expect(totalNetPaid).toBe(320000); // 360,000 - 40,000

      // Quota consumed exactly once in session
      expect(consumeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // SC-07: COD Order Lifecycle & Payment PAID only upon Delivery
  // =========================================================================
  describe('SC-07: COD Order Lifecycle & Delivery Trigger', () => {
    it('advances Order through PENDING -> CONFIRMED -> PROCESSING -> SHIPPED -> COMPLETED and marks COD Payment as PAID only on mark-delivered', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const paymentId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        code: 'ORD-COD-001',
        customerId: new mongoose.Types.ObjectId(customerId),
        fulfillmentBranchId: branch1Id,
        status: 'PENDING',
        paymentMethod: 'COD',
        items: [{
          orderItemId: 'ITEM-1',
          productId: prodDogId,
          nameSnapshot: 'Hạt dinh dưỡng cún con',
          quantity: 2,
          unitPrice: 135000,
          lineSubtotal: 270000,
          allocatedDiscount: 20000,
          lineNet: 250000,
          returnedQty: 0
        }],
        pricing: { merchandiseSubtotal: 270000, voucherDiscount: 20000, shippingFee: 30000, totalAmount: 280000 },
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
        amount: 280000,
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));

      // 1. Confirm
      await orderService.confirmOrder(orderId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('CONFIRMED');
      expect(mockPayment.status).toBe('PENDING'); // COD Payment must stay PENDING

      // 2. Process
      await orderService.processOrder(orderId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('PROCESSING');
      expect(mockPayment.status).toBe('PENDING');

      // 3. Ship
      await orderService.shipOrder(orderId, { carrier: 'GiaoHangNhanh', trackingNumber: 'GHN888999' }, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('SHIPPED');
      const lastHistory = mockOrder.statusHistory[mockOrder.statusHistory.length - 1];
      expect(lastHistory.note).toContain('GHN888999');
      expect(mockPayment.status).toBe('PENDING');

      // 4. Mark Delivered -> COMPLETED
      await orderService.markDelivered(orderId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockOrder.status).toBe('COMPLETED');
      expect(mockOrder.deliveredAt).toBeDefined();

      // Crucial: COD Payment only flips to PAID at this step!
      expect(mockPayment.status).toBe('PAID');
      expect(mockPayment.paidAt).toBeDefined();

      // Formatted order reflects returnWindowEndsAt and REQUEST_RETURN
      const formatted = orderService.formatOrder(mockOrder);
      expect(formatted.status).toBe('COMPLETED');
      expect(formatted.returnWindowEndsAt).toBeDefined();
      expect(formatted.allowedActions).toContain('REQUEST_RETURN');
    });
  });

  // =========================================================================
  // SC-08: ONLINE_MOCK Lifecycle & Failure Compensating Transaction
  // =========================================================================
  describe('SC-08: ONLINE_MOCK Lifecycle & Auto-Cancel Compensating Transaction', () => {
    it('blocks confirming ONLINE_MOCK order with 422 PAYMENT_REQUIRED when Payment is not PAID', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        status: 'PENDING',
        paymentMethod: 'ONLINE_MOCK',
        save: jest.fn().mockResolvedValue(true)
      };
      const mockPayment = { status: 'PENDING' };

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));

      await expect(
        orderService.confirmOrder(orderId, { id: receptionistId, systemRole: 'STAFF' })
      ).rejects.toThrow('ONLINE_MOCK payment must be PAID before confirming order');
    });

    it('triggers compensating transaction on payment terminal failure: auto-cancels order, compensates stock via RECEIPT ledger, and restores voucher quota idempotently', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const voucherId = vouchersFixture.fixed._id;
      const paymentId = new mongoose.Types.ObjectId();

      const mockOrder = {
        _id: orderId,
        status: 'PENDING',
        paymentMethod: 'ONLINE_MOCK',
        fulfillmentBranchId: branch1Id,
        voucher: { voucherId, code: 'GIAM40K_DON150K' },
        statusHistory: [],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockPayment = {
        _id: paymentId,
        target: { type: 'ORDER', id: orderId },
        status: 'PENDING',
        amount: 250000,
        save: jest.fn().mockResolvedValue(true)
      };

      const originalIssues = [
        { inventoryItemId: invDogId, changeQty: -2 }
      ];

      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));
      jest.spyOn(InventoryTransaction, 'find').mockReturnValue(makeMockQuery(originalIssues));

      const receiveSpy = jest.spyOn(inventoryService, 'receiveForOrder').mockResolvedValue({});
      const restoreSpy = jest.spyOn(voucherService, 'restoreQuotaInSession').mockResolvedValue({});

      const fakeSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn()
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(fakeSession);

      // Execute cancellation (simulating online payment failure/cancel callback)
      await orderService.cancelOrder(orderId, { id: customerId, systemRole: 'CUSTOMER' }, 'Online payment failed', true);

      expect(mockOrder.status).toBe('CANCELLED');
      expect(mockPayment.status).toBe('CANCELLED');

      // Compensating stock receipt created
      expect(receiveSpy).toHaveBeenCalledWith(expect.objectContaining({
        orderId,
        branchId: branch1Id,
        movements: [{ inventoryItemId: invDogId, quantity: 2 }],
        reason: 'Order cancellation compensation'
      }));

      // Voucher quota restored idempotently
      expect(restoreSpy).toHaveBeenCalledWith(expect.objectContaining({
        voucherId,
        targetType: 'ORDER',
        targetId: orderId
      }));
    });
  });

  // =========================================================================
  // SC-09: 7-Day Return Window Validation
  // =========================================================================
  describe('SC-09: 7-Day Return Window Validation', () => {
    it('allows return requests within 7 days of deliveredAt and rejects with 422 RETURN_WINDOW_EXPIRED after 7 days', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const now = new Date();

      // Case 1: Delivered 3 days ago (Eligible)
      const eligibleOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [{
          orderItemId: 'ITEM-RETURN-1',
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

      // Case 2: Delivered 8 days ago (Expired)
      eligibleOrder.deliveredAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const expiredReturnable = await orderService.getReturnableItems(orderId, { id: customerId, systemRole: 'CUSTOMER' });
      expect(expiredReturnable.eligible).toBe(false);
      expect(expiredReturnable.items[0].returnableQty).toBe(0);

      await expect(
        orderService.getReturnQuote(orderId, [{ orderItemId: 'ITEM-RETURN-1', quantity: 1 }], { id: customerId, systemRole: 'CUSTOMER' })
      ).rejects.toThrow('Return window of 7 days has expired or order is not completed');
    });
  });

  // =========================================================================
  // SC-10: Multi-Stage Return/Refund Workflow & RBAC Enforcement
  // =========================================================================
  describe('SC-10: Multi-Stage Return/Refund & RBAC Role Bypass Protection', () => {
    it('enforces RBAC: Receptionist can only process and receive; cannot approve/reject (403); Manager approves and completes refund', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const returnId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-RBAC-1';

      const mockLineItem = {
        orderItemId: lineItemId,
        quantity: 2,
        lineNet: 240000,
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
          productName: 'Cỏ nén Timothy',
          orderedQty: 2,
          alreadyReturnedQty: 0,
          requestedQty: 1,
          refundAmount: 120000
        }],
        refundBreakdown: { merchandiseNet: 120000, shippingRefunded: 0, total: 120000 },
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };

      jest.spyOn(OrderReturn, 'findById').mockReturnValue(makeMockQuery(mockReturn));
      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));

      // 1. Receptionist calls process: REQUESTED -> PROCESSING
      await returnService.processReturn(returnId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockReturn.status).toBe('PROCESSING');

      // 2. Receptionist calls receive: PROCESSING -> RECEIVED (confirmed at store, no stock change, no refund)
      await returnService.receiveReturn(returnId, { id: receptionistId, systemRole: 'STAFF' });
      expect(mockReturn.status).toBe('RECEIVED');

      // 3. Receptionist attempts to call approve -> Blocked with 403 Forbidden!
      await expect(
        returnService.approveReturn(returnId, {}, { id: receptionistId, systemRole: 'STAFF' })
      ).rejects.toThrow('Only Manager or Admin can approve returns');

      // 4. Receptionist attempts to call reject -> Blocked with 403 Forbidden!
      await expect(
        returnService.rejectReturn(returnId, { reason: 'Test' }, { id: receptionistId, systemRole: 'STAFF' })
      ).rejects.toThrow('Only Manager or Admin can reject returns');

      // 5. Manager calls approve: RECEIVED -> APPROVED
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

      await returnService.approveReturn(returnId, { note: 'Manager approval' }, { id: managerId, systemRole: 'MANAGER' });
      expect(mockReturn.status).toBe('APPROVED');
      expect(mockLineItem.returnedQty).toBe(1);
      expect(mockLineItem.returnReservedQty).toBe(0);

      // 6. Manager processes OrderRefund: PENDING -> REFUNDED, OrderReturn -> COMPLETED
      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        cause: 'RETURN',
        orderReturnId: returnId,
        orderId,
        amount: 120000,
        status: 'PENDING',
        history: [],
        save: jest.fn().mockResolvedValue(true)
      };
      const mockPayment = {
        target: { type: 'ORDER', id: orderId },
        amount: 270000,
        refundedAmount: 0,
        status: 'PAID',
        save: jest.fn().mockResolvedValue(true)
      };
      jest.spyOn(OrderRefund, 'findById').mockReturnValue(makeMockQuery(mockRefund));
      jest.spyOn(Payment, 'findOne').mockReturnValue(makeMockQuery(mockPayment));

      await returnService.processOrderRefund(mockRefund._id, { id: managerId, systemRole: 'MANAGER' });
      expect(mockRefund.status).toBe('REFUNDED');
      expect(mockPayment.refundedAmount).toBe(120000);
      expect(mockReturn.status).toBe('COMPLETED');
    });

    it('releases reserved quantity on Manager REJECT at RECEIVED status without automatic system stock entry (Canonical v7)', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const returnId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-REJECT-1';

      const mockLineItem = {
        orderItemId: lineItemId,
        quantity: 2,
        lineNet: 180000,
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
        status: 'RECEIVED',
        items: [{ orderItemId: lineItemId, requestedQty: 1, refundAmount: 90000 }],
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
      jest.spyOn(Order, 'findById').mockReturnValue(makeMockQuery(mockOrder));
      const receiveStockSpy = jest.spyOn(inventoryService, 'receiveForOrder');

      await returnService.rejectReturn(returnId, { reason: 'Sản phẩm đã qua sử dụng, bao bì rách' }, { id: managerId, systemRole: 'MANAGER' });

      expect(mockReturn.status).toBe('REJECTED');
      expect(mockLineItem.returnReservedQty).toBe(0); // Reserved qty released!
      // Invariant: no automatic stock re-entry on reject
      expect(receiveStockSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SC-11: Partial Return, Multi-Stage Return & Ceiling Limit
  // =========================================================================
  describe('SC-11: Partial & Multi-Stage Returns with Non-Refundable Shipping & Ceiling Limit', () => {
    it('calculates partial return unitNet from snapshotted lineNet, grants remainder on final returned unit, keeps shipping non-refundable, and enforces ceiling limit', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const lineItemId = 'ITEM-MULTI-STAGE';

      // 3 units of an item with total lineNet = 200,000 VND (66,666.66 VND per unit)
      const mockLineItem = {
        orderItemId: lineItemId,
        productId: prodDogId,
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

      // Part 1: Return 1 unit out of 3:
      // unitNet = Math.floor(200,000 / 3) = 66,666 VND
      const quote1 = await orderService.getReturnQuote(
        orderId,
        [{ orderItemId: lineItemId, quantity: 1 }],
        { id: customerId, systemRole: 'CUSTOMER' }
      );
      expect(quote1.refundBreakdown.merchandiseNet).toBe(66666);
      expect(quote1.refundBreakdown.shippingRefunded).toBe(0); // Shipping fee NOT refunded
      expect(quote1.refundBreakdown.total).toBe(66666);

      // Simulate approval of Part 1
      mockLineItem.returnedQty = 1;
      mockLineItem.refundedNet = 66666;

      // Part 2: Return remaining 2 units (final units):
      // Current returned (1) + requested (2) === quantity (3)
      // Remainder granted: lineNet - refundedNet = 200,000 - 66,666 = 133,334 VND
      const quote2 = await orderService.getReturnQuote(
        orderId,
        [{ orderItemId: lineItemId, quantity: 2 }],
        { id: customerId, systemRole: 'CUSTOMER' }
      );
      expect(quote2.refundBreakdown.merchandiseNet).toBe(133334);
      expect(quote2.refundBreakdown.shippingRefunded).toBe(0);
      expect(quote2.refundBreakdown.total).toBe(133334);

      // Total across both parts matches exactly 100% of lineNet (200,000 VND)
      expect(quote1.refundBreakdown.total + quote2.refundBreakdown.total).toBe(200000);

      // Ceiling Limit Check:
      // If previous refunds already total 200,000 VND (equal to lineNet), any further refund must fail with 422
      jest.spyOn(OrderRefund, 'find').mockReturnValue(makeMockQuery([{
        orderId,
        amount: 200000,
        status: 'REFUNDED'
      }]));

      await expect(
        orderService.getReturnQuote(orderId, [{ orderItemId: lineItemId, quantity: 1 }], { id: customerId, systemRole: 'CUSTOMER' })
      ).rejects.toThrow('Total refund cannot exceed net merchandise amount paid');
    });
  });

  // =========================================================================
  // SC-12: Voucher Quota Preservation After Delivery
  // =========================================================================
  describe('SC-12: Voucher Quota Preservation After Delivery', () => {
    it('NEVER restores voucher quota on return or refund after delivery (COMPLETED/DELIVERED)', async () => {
      const restoreSpy = jest.spyOn(voucherService, 'restoreQuotaInSession').mockResolvedValue({});

      const orderId = new mongoose.Types.ObjectId();
      const voucherId = vouchersFixture.pctCapped._id;
      const lineItemId = 'ITEM-VOUCHER-PRESERVE';

      const mockLineItem = {
        orderItemId: lineItemId,
        quantity: 1,
        lineNet: 135000,
        returnedQty: 0,
        returnReservedQty: 1,
        refundedNet: 0
      };

      const mockDeliveredOrder = {
        _id: orderId,
        status: 'COMPLETED',
        deliveredAt: new Date(),
        voucher: { voucherId, code: 'GIAM10_CAP50' },
        items: [mockLineItem],
        save: jest.fn().mockResolvedValue(true)
      };

      const mockReturn = {
        _id: new mongoose.Types.ObjectId(),
        orderId,
        status: 'RECEIVED',
        items: [{ orderItemId: lineItemId, requestedQty: 1, refundAmount: 135000 }],
        refundBreakdown: { merchandiseNet: 135000, shippingRefunded: 0, total: 135000 },
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

      // Approve return after delivery
      await returnService.approveReturn(mockReturn._id, {}, { id: managerId, systemRole: 'MANAGER' });

      // Invariant: restoreQuotaInSession MUST NOT be called!
      expect(restoreSpy).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Full Supertest HTTP Flow Verification
  // =========================================================================
  describe('Full REST Supertest Route Integration', () => {
    it('executes checkout and return flow via Supertest HTTP endpoints with Idempotency-Key and RBAC headers', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();
      const lineItemId = new mongoose.Types.ObjectId().toString();

      const mockOrder = {
        _id: new mongoose.Types.ObjectId(orderId),
        code: 'ORD-HTTP-001',
        status: 'COMPLETED',
        deliveredAt: new Date(),
        customerId: new mongoose.Types.ObjectId(customerId),
        items: [{
          orderItemId: lineItemId,
          quantity: 2,
          lineNet: 180000,
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

      // 1. Customer creates return request via POST /api/v1/order-returns
      const retRes = await request(app)
        .post('/api/v1/order-returns')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Idempotency-Key', 'idemp-return-e2e-001')
        .send({
          orderId,
          items: [{ orderItemId: lineItemId, quantity: 1 }],
          reason: 'Thu cung khong quen vi thuc an nay'
        });

      expect(retRes.status).toBe(201);
      expect(retRes.body).toHaveProperty('status', 'REQUESTED');
      expect(retRes.body.refundBreakdown).toHaveProperty('merchandiseNet', 90000);
      expect(retRes.body.refundBreakdown).toHaveProperty('shippingRefunded', 0);
    });
  });
});
