import mongoose from 'mongoose';
import { flashSaleService } from '../../src/modules/flash-sale/flashSale.service.js';
import FlashSale from '../../src/modules/flash-sale/models/FlashSale.js';

describe('Integration Test: Flash Sale Module & State Engine (FS-01..08)', () => {
  const adminActor = { id: new mongoose.Types.ObjectId().toString(), systemRole: 'ADMIN' };
  const sampleProductId = new mongoose.Types.ObjectId();
  const sampleVariantId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Flash Sale Validation & Pricing Constraints (FS-04, FS-06)', () => {
    it('rejects flash sale item when salePrice >= originalPrice', async () => {
      const invalidData = {
        name: 'Chiến dịch giảm giá siêu hời',
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        items: [
          {
            productId: sampleProductId,
            sku: 'SKU-TEST-001',
            originalPrice: 100000,
            salePrice: 120000, // Invalid: salePrice >= originalPrice
            quantityLimit: 10,
          },
        ],
      };

      await expect(flashSaleService.createFlashSale(invalidData, adminActor))
        .rejects.toThrow('less than originalPrice');
    });

    it('rejects flash sale when startAt >= endAt', async () => {
      const invalidData = {
        name: 'Chiến dịch giờ ngược',
        startAt: new Date(Date.now() + 7200000),
        endAt: new Date(Date.now() + 3600000), // endAt before startAt
        items: [
          {
            productId: sampleProductId,
            sku: 'SKU-TEST-002',
            originalPrice: 100000,
            salePrice: 80000,
            quantityLimit: 10,
          },
        ],
      };

      await expect(flashSaleService.createFlashSale(invalidData, adminActor))
        .rejects.toThrow('startAt must be strictly before endAt');
    });

    it('rejects duplicate items within the same campaign', async () => {
      const invalidData = {
        name: 'Chiến dịch trùng SKU',
        startAt: new Date(Date.now() + 3600000),
        endAt: new Date(Date.now() + 7200000),
        items: [
          {
            productId: sampleProductId,
            sku: 'SKU-DUPLICATE-001',
            originalPrice: 100000,
            salePrice: 80000,
            quantityLimit: 10,
          },
          {
            productId: sampleProductId,
            sku: 'SKU-DUPLICATE-001',
            originalPrice: 100000,
            salePrice: 75000,
            quantityLimit: 5,
          },
        ],
      };

      await expect(flashSaleService.createFlashSale(invalidData, adminActor))
        .rejects.toThrow('is duplicated in this campaign');
    });
  });

  describe('2. Derived Campaign States Engine (FS-03)', () => {
    it('correctly derives state DRAFT, UPCOMING, RUNNING, PAUSED, ENDED', () => {
      const now = new Date('2026-11-06T12:00:00Z');

      // DRAFT
      expect(flashSaleService.deriveStatus({
        status: 'DRAFT',
        startAt: new Date('2026-11-06T10:00:00Z'),
        endAt: new Date('2026-11-06T14:00:00Z'),
      }, now)).toBe('DRAFT');

      // ENDED
      expect(flashSaleService.deriveStatus({
        status: 'PUBLISHED',
        startAt: new Date('2026-11-06T08:00:00Z'),
        endAt: new Date('2026-11-06T11:00:00Z'),
      }, now)).toBe('ENDED');

      // PAUSED
      expect(flashSaleService.deriveStatus({
        status: 'PUBLISHED',
        isPaused: true,
        startAt: new Date('2026-11-06T10:00:00Z'),
        endAt: new Date('2026-11-06T14:00:00Z'),
      }, now)).toBe('PAUSED');

      // UPCOMING
      expect(flashSaleService.deriveStatus({
        status: 'PUBLISHED',
        isPaused: false,
        startAt: new Date('2026-11-06T13:00:00Z'),
        endAt: new Date('2026-11-06T15:00:00Z'),
      }, now)).toBe('UPCOMING');

      // RUNNING
      expect(flashSaleService.deriveStatus({
        status: 'PUBLISHED',
        isPaused: false,
        startAt: new Date('2026-11-06T10:00:00Z'),
        endAt: new Date('2026-11-06T14:00:00Z'),
      }, now)).toBe('RUNNING');
    });
  });

  describe('3. Active Flash Sale Query & Overlap Prevention (FS-04, FS-07)', () => {
    it('detects product overlap with other published campaigns during time window', async () => {
      const startAt = new Date('2026-11-06T10:00:00Z');
      const endAt = new Date('2026-11-06T14:00:00Z');

      jest.spyOn(FlashSale, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            _id: new mongoose.Types.ObjectId(),
            name: 'Chiến dịch đang chạy',
            items: [{ productId: sampleProductId, variantId: sampleVariantId, sku: 'SKU-OVERLAP-001' }],
          },
        ]),
      });

      await expect(flashSaleService.validateNoOverlappingItems([
        { productId: sampleProductId, variantId: sampleVariantId, sku: 'SKU-OVERLAP-001' },
      ], startAt, endAt))
        .rejects.toThrow('đã tham gia chiến dịch Flash Sale khác');
    });
  });
});
