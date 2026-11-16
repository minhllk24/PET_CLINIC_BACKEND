import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import Service from '../src/modules/catalog/models/Service';
import Branch from '../src/modules/branch/models/Branch';
import BranchServiceConfig from '../src/modules/branch/models/BranchServiceConfig';
import InventoryItem from '../src/modules/inventory/models/InventoryItem';
import InventoryStock from '../src/modules/inventory/models/InventoryStock';
import ShiftTemplate from '../src/modules/branch/models/ShiftTemplate';
import Pet from '../src/modules/customer/models/Pet';
import Voucher from '../src/modules/order/models/Voucher';
import Appointment from '../src/modules/booking/models/Appointment';
import SlotReservation from '../src/modules/booking/models/SlotReservation';
import Payment from '../src/modules/payment/models/Payment';
import * as availabilityService from '../src/modules/booking/availability.service';
import Shift from '../src/modules/staff/models/Shift';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import * as voucherService from '../src/modules/order/voucher.service';
import * as serviceCatalogService from '../src/modules/catalog/serviceCatalog.service';
import * as bookingService from '../src/modules/booking/booking.service';
import { seedServiceCatalog } from '../src/seeds/serviceCatalogSeed';

const makeMockQuery = (doc) => ({
  session: jest.fn().mockResolvedValue(doc),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockImplementation(() => ({
    lean: jest.fn().mockResolvedValue(Array.isArray(doc) ? doc : doc ? [doc] : []),
    then: (resolve, reject) => Promise.resolve(Array.isArray(doc) ? doc : doc ? [doc] : []).then(resolve, reject),
  })),
  lean: jest.fn().mockResolvedValue(doc),
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve(doc).then(resolve, reject),
  catch: (reject) => Promise.resolve(doc).catch(reject),
});

const GRM01_DOC = {
  _id: new mongoose.Types.ObjectId('6aefe9ddb25c942961da0801'),
  code: 'GRM01',
  name: 'Tắm & Sấy khô',
  serviceType: 'GROOMING',
  basePrice: 70000,
  durationMinutes: 60,
  requiredStaffRole: 'CARE_STAFF_GROOMER',
  bookingMode: 'BOOKABLE',
  status: 'ACTIVE',
  priceVariants: [
    { tier: 'XS', label: 'XS (< 5 kg)', mode: 'FIXED', minWeightKg: 0, maxWeightKg: 4.999, price: 70000 },
    { tier: 'S', label: 'S (5 – <10 kg)', mode: 'FIXED', minWeightKg: 5, maxWeightKg: 9.999, price: 100000 },
    { tier: 'M', label: 'M (10 – <20 kg)', mode: 'FIXED', minWeightKg: 10, maxWeightKg: 19.999, price: 170000 },
    { tier: 'L', label: 'L (20 – 30 kg)', mode: 'FIXED', minWeightKg: 20, maxWeightKg: 30, price: 270000 },
    { tier: 'XL', label: 'XL (> 30 kg) - Liên hệ / Báo giá', mode: 'QUOTE', minWeightKg: 30.001, maxWeightKg: null, price: null },
  ],
};

const CMB02_DOC = {
  _id: new mongoose.Types.ObjectId('6aefe9ddb25c942961da0802'),
  code: 'CMB02',
  name: 'Combo Tắm cơ bản & cắt tỉa lông',
  serviceType: 'GROOMING',
  basePrice: 135000,
  durationMinutes: 150,
  requiredStaffRole: 'CARE_STAFF_GROOMER',
  bookingMode: 'BOOKABLE',
  status: 'ACTIVE',
  priceVariants: [
    { tier: 'XS', label: 'XS (< 5 kg)', mode: 'FIXED', minWeightKg: 0, maxWeightKg: 4.999, price: 135000 },
    { tier: 'S', label: 'S (5 – <10 kg)', mode: 'FIXED', minWeightKg: 5, maxWeightKg: 9.999, price: 190000 },
    { tier: 'M', label: 'M (10 – <20 kg)', mode: 'FIXED', minWeightKg: 10, maxWeightKg: 19.999, price: 325000 },
    { tier: 'L', label: 'L (20 – 30 kg)', mode: 'FIXED', minWeightKg: 20, maxWeightKg: 30, price: 485000 },
    { tier: 'XL', label: 'XL (> 30 kg) - Liên hệ / Báo giá', mode: 'QUOTE', minWeightKg: 30.001, maxWeightKg: null, price: null },
  ],
};

const MED05_DOC = {
  _id: new mongoose.Types.ObjectId('6aefe9ddb25c942961da0805'),
  code: 'MED05',
  name: 'Thay băng / Chăm sóc sau điều trị',
  serviceType: 'MEDICAL',
  basePrice: 120000,
  durationMinutes: 30,
  requiredStaffRole: 'NURSE',
  bookingMode: 'BOOKABLE',
  status: 'ACTIVE',
  priceVariants: [],
};

const MED07_DOC = {
  _id: new mongoose.Types.ObjectId('6aefe9ddb25c942961da0807'),
  code: 'MED07',
  name: 'Cấp cứu 24/7',
  serviceType: 'MEDICAL',
  basePrice: 0,
  durationMinutes: 60,
  requiredStaffRole: 'VETERINARIAN',
  bookingMode: 'CONTACT_ONLY',
  status: 'ACTIVE',
  priceVariants: [],
};

describe('Catalog Sync & Grooming Weight-Tier Pricing Suite (docs/catalog (2).xlsx)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Canonical Weight Tiers & Helper Boundary Resolution', () => {
    it('defines all 5 system weight tiers XS / S / M / L / XL', () => {
      const { GROOMING_WEIGHT_TIERS, resolveWeightTierCode } = serviceCatalogService;
      expect(GROOMING_WEIGHT_TIERS.map((t) => t.tier)).toEqual(['XS', 'S', 'M', 'L', 'XL']);

      expect(resolveWeightTierCode(0.5)).toBe('XS');
      expect(resolveWeightTierCode(4.99)).toBe('XS');
      expect(resolveWeightTierCode(5)).toBe('S');
      expect(resolveWeightTierCode(9.99)).toBe('S');
      expect(resolveWeightTierCode(10)).toBe('M');
      expect(resolveWeightTierCode(19.99)).toBe('M');
      expect(resolveWeightTierCode(20)).toBe('L');
      expect(resolveWeightTierCode(30)).toBe('L');
      expect(resolveWeightTierCode(30.01)).toBe('XL');
      expect(resolveWeightTierCode(null)).toBeNull();
      expect(resolveWeightTierCode(undefined)).toBeNull();
      expect(resolveWeightTierCode(0)).toBeNull();
      expect(resolveWeightTierCode(-2)).toBeNull();
    });

    it('resolves exact per-tier prices for GROOMING and stays flat for MEDICAL', () => {
      const { resolveServiceWeightPricing } = serviceCatalogService;

      expect(resolveServiceWeightPricing(GRM01_DOC, 3)).toMatchObject({
        weightMissing: false,
        tier: 'XS',
        mode: 'FIXED',
        price: 70000,
        requiresQuote: false,
      });
      expect(resolveServiceWeightPricing(GRM01_DOC, 7)).toMatchObject({
        tier: 'S',
        price: 100000,
        requiresQuote: false,
      });
      expect(resolveServiceWeightPricing(GRM01_DOC, 15)).toMatchObject({
        tier: 'M',
        price: 170000,
        requiresQuote: false,
      });
      expect(resolveServiceWeightPricing(GRM01_DOC, 30)).toMatchObject({
        tier: 'L',
        price: 270000,
        requiresQuote: false,
      });
      expect(resolveServiceWeightPricing(GRM01_DOC, 35)).toMatchObject({
        tier: 'XL',
        mode: 'QUOTE',
        price: null,
        requiresQuote: true,
        priceDisplay: 'Liên hệ / Báo giá',
      });
      expect(resolveServiceWeightPricing(GRM01_DOC, null)).toMatchObject({
        weightMissing: true,
        tier: null,
        mode: 'WEIGHT_REQUIRED',
        price: null,
      });

      // MEDICAL services do not apply weight surcharge or tier
      expect(resolveServiceWeightPricing(MED05_DOC, 25)).toMatchObject({
        weightMissing: false,
        tier: null,
        mode: 'FIXED',
        price: 120000,
        requiresQuote: false,
      });
      expect(resolveServiceWeightPricing(MED07_DOC, 10)).toMatchObject({
        mode: 'QUOTE',
        price: null,
        requiresQuote: true,
        priceDisplay: 'Báo giá sau tiếp nhận',
      });
    });
  });

  describe('2. Catalog Endpoints (/services, /services/:id, /services/pricing-matrix)', () => {
    it('resolves tier prices dynamically on GET /api/v1/services?petWeightKg=7', async () => {
      jest.spyOn(Service, 'countDocuments').mockResolvedValue(2);
      jest.spyOn(Service, 'find').mockReturnValue(makeMockQuery([GRM01_DOC, CMB02_DOC]));
      jest.spyOn(Branch, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(BranchServiceConfig, 'aggregate').mockResolvedValue([
        { _id: GRM01_DOC._id, count: 3 },
        { _id: CMB02_DOC._id, count: 3 },
      ]);

      const res = await request(app)
        .get('/api/v1/services?serviceType=GROOMING&petWeightKg=7&limit=20')
        .set('X-Forwarded-For', '10.10.1.1');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0]).toMatchObject({
        code: 'GRM01',
        resolvedTier: 'S',
        resolvedPrice: 100000,
        requiresQuote: false,
        weightMissing: false,
      });
      expect(res.body.items[1]).toMatchObject({
        code: 'CMB02',
        serviceType: 'GROOMING',
        resolvedTier: 'S',
        resolvedPrice: 190000,
      });
    });

    it('resolves weight tier from Pet.weightKg on GET /api/v1/services/:id?petId=...', async () => {
      const petId = new mongoose.Types.ObjectId();
      jest.spyOn(Service, 'findById').mockReturnValue(makeMockQuery(GRM01_DOC));
      jest.spyOn(Branch, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(BranchServiceConfig, 'countDocuments').mockResolvedValue(3);
      jest.spyOn(Pet, 'findById').mockReturnValue(makeMockQuery({ _id: petId, weightKg: 25 }));

      const res = await request(app)
        .get(`/api/v1/services/${GRM01_DOC._id}?petId=${petId}`)
        .set('X-Forwarded-For', '10.10.1.2');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        code: 'GRM01',
        resolvedTier: 'L',
        resolvedPrice: 270000,
        requiresQuote: false,
      });
    });

    it('returns canonical 5-tier pricing matrix (XS/S/M/L/XL) on GET /api/v1/services/pricing-matrix', async () => {
      jest.spyOn(Service, 'find').mockReturnValue(
        makeMockQuery([MED05_DOC, MED07_DOC, GRM01_DOC, CMB02_DOC])
      );

      const res = await request(app)
        .get('/api/v1/services/pricing-matrix')
        .set('X-Forwarded-For', '10.10.1.3');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const medicalGroup = res.body.data.find((g) => g.category_name.includes('Khám'));
      const groomingGroup = res.body.data.find((g) => g.category_name.includes('Grooming'));

      expect(medicalGroup.services.map((s) => s.code)).toEqual([
        'MED01',
        'MED02',
        'MED03',
        'MED04',
        'MED05',
        'MED06',
        'MED07',
      ]);
      expect(groomingGroup.weight_ranges.map((w) => w.tier)).toEqual(['XS', 'S', 'M', 'L', 'XL']);
      const grmRow = groomingGroup.services.find((s) => s.code === 'GRM01');
      expect(grmRow.prices.map((p) => p.price)).toEqual([70000, 100000, 170000, 270000, null]);
      expect(grmRow.prices[4].is_contact).toBe(true);
    });
  });

  describe('3. Preview Pricing & Quote Endpoints (/preview-pricing, /quote)', () => {
    it('computes exact multi-service Grooming tier sum without legacy +30k/+50k surcharge and applies voucher after resolution', async () => {
      jest.spyOn(Service, 'find').mockReturnValue(makeMockQuery([GRM01_DOC, CMB02_DOC]));
      jest.spyOn(voucherService, 'validateVoucherEligibility').mockResolvedValue({
        valid: true,
        voucher: {
          _id: new mongoose.Types.ObjectId(),
          code: 'TEST50K',
          discountType: 'FIXED',
          discountValue: 50000,
        },
        discount: 50000,
      });

      // Tier M (15kg): GRM01 (170k) + CMB02 (325k) = 495,000đ; minus 50k voucher = 445,000đ
      // Pay at store 30% deposit: round(445000 * 0.3) = 133,500đ; balance = 311,500đ
      const res = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('X-Forwarded-For', '10.10.1.4')
        .send({
          serviceIds: [GRM01_DOC._id.toString(), CMB02_DOC._id.toString()],
          petWeightKg: 15,
          voucherCode: 'TEST50K',
        });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        weightTier: 'M',
        weightMissing: false,
        requiresQuote: false,
        surchargeTotal: 0,
        subtotal: 495000,
        voucherDiscount: 50000,
        finalAmount: 445000,
        depositAmount: 133500,
        balanceAmount: 311500,
      });

      // Legacy alias /appointments/quote must hit the exact same tier-resolved engine
      jest.spyOn(Service, 'find').mockReturnValue(makeMockQuery([GRM01_DOC]));
      const resQuote = await request(app)
        .post('/api/v1/appointments/quote')
        .set('X-Forwarded-For', '10.10.1.5')
        .send({
          serviceIds: [GRM01_DOC._id.toString()],
          petWeightKg: 7,
        });

      expect(resQuote.status).toBe(200);
      expect(resQuote.body).toMatchObject({
        weightTier: 'S',
        subtotal: 100000,
        surchargeTotal: 0,
        finalAmount: 100000,
      });
    });

    it('flags weightMissing when Grooming weight omitted and flags requiresQuote for >30kg XL', async () => {
      jest.spyOn(Service, 'find').mockReturnValue(makeMockQuery([GRM01_DOC]));

      const resMissing = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('X-Forwarded-For', '10.10.1.6')
        .send({
          serviceIds: [GRM01_DOC._id.toString()],
        });

      expect(resMissing.status).toBe(200);
      expect(resMissing.body).toMatchObject({
        weightMissing: true,
        requiresQuote: false,
        weightTier: null,
      });

      const resXL = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('X-Forwarded-For', '10.10.1.7')
        .send({
          serviceIds: [GRM01_DOC._id.toString()],
          petWeightKg: 35,
        });

      expect(resXL.status).toBe(200);
      expect(resXL.body).toMatchObject({
        weightMissing: false,
        requiresQuote: true,
        weightTier: 'XL',
        finalAmount: null,
      });
    });
  });

  describe('4. Appointment Booking Weight Enforcement & Price Snapshot', () => {
    const branchId = '507f1f77bcf86cd799439011';
    const customerId = '507f1f77bcf86cd799439003';
    const mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };

    const setupCreateMocks = () => {
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Branch, 'findById').mockReturnValue(makeMockQuery({
        _id: new mongoose.Types.ObjectId(branchId),
        name: 'CN Q1',
        status: 'ACTIVE',
      }));
      jest.spyOn(Service, 'find').mockReturnValue(makeMockQuery([GRM01_DOC]));
      jest.spyOn(BranchServiceConfig, 'find').mockReturnValue(makeMockQuery([
        { branchId, serviceId: GRM01_DOC._id, enabled: true, capacity: 2 },
      ]));
      jest.spyOn(Shift, 'find').mockReturnValue(
        makeMockQuery([
          {
            _id: new mongoose.Types.ObjectId(),
            branchId: new mongoose.Types.ObjectId(branchId),
            status: 'ACTIVE',
            startAt: new Date(Date.now() + 24 * 3600000),
            endAt: new Date(Date.now() + 72 * 3600000),
            staffId: {
              _id: new mongoose.Types.ObjectId(),
              status: 'ACTIVE',
              staffSubRole: 'CARE_STAFF_GROOMER',
              serviceIds: [GRM01_DOC._id],
            },
          },
        ])
      );
      jest.spyOn(StaffProfile, 'find').mockReturnValue(makeMockQuery([]));
      jest.spyOn(Appointment, 'countDocuments').mockReturnValue(makeMockQuery(0));
      jest.spyOn(Appointment, 'distinct').mockReturnValue(makeMockQuery([]));
      jest.spyOn(Appointment, 'aggregate').mockReturnValue(makeMockQuery([]));
      jest.spyOn(SlotReservation, 'distinct').mockReturnValue(makeMockQuery([]));
      jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({});
      jest.spyOn(SlotReservation.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(Appointment.prototype, 'save').mockResolvedValue(true);
      jest.spyOn(Payment.prototype, 'save').mockResolvedValue(true);
    };

    it('rejects online Grooming booking without pet weight (422 WEIGHT_REQUIRED)', async () => {
      setupCreateMocks();

      await expect(
        bookingService.createAppointment(
          {
            branchId,
            serviceIds: [GRM01_DOC._id.toString()],
            slotStart: new Date(Date.now() + 48 * 3600000).toISOString(),
            paymentMethod: 'PAY_AT_STORE',
            pet: { name: 'Bông', species: 'DOG' },
            contact: { name: 'Minh', phone: '0901234567' },
          },
          { id: customerId, systemRole: 'CUSTOMER' }
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'WEIGHT_REQUIRED',
      });
    });

    it('rejects online Grooming booking >30kg XL (422 REQUIRES_QUOTE)', async () => {
      setupCreateMocks();

      await expect(
        bookingService.createAppointment(
          {
            branchId,
            serviceIds: [GRM01_DOC._id.toString()],
            slotStart: new Date(Date.now() + 48 * 3600000).toISOString(),
            paymentMethod: 'PAY_AT_STORE',
            pet: { name: 'Alaska', species: 'DOG', weightKg: 35 },
            contact: { name: 'Minh', phone: '0901234567' },
          },
          { id: customerId, systemRole: 'CUSTOMER' }
        )
      ).rejects.toMatchObject({
        status: 422,
        code: 'REQUIRES_QUOTE',
      });
    });

    it('snapshots tier-resolved unitPrice and subtotal into Appointment', async () => {
      setupCreateMocks();

      const created = await bookingService.createAppointment(
        {
          branchId,
          serviceIds: [GRM01_DOC._id.toString()],
          slotStart: new Date(Date.now() + 48 * 3600000).toISOString(),
          paymentMethod: 'PAY_AT_STORE',
          pet: { name: 'Corgi', species: 'DOG', weightKg: 15 },
          contact: { name: 'Minh', phone: '0901234567' },
        },
        { id: customerId, systemRole: 'CUSTOMER' }
      );

      expect(created.services[0]).toMatchObject({
        serviceName: 'Tắm & Sấy khô',
        unitPrice: 170000,
        variantLabel: 'M (10 – <20 kg)',
      });
      expect(created.pricing).toMatchObject({
        subtotal: 170000,
        finalAmount: 170000,
        depositAmount: 51000,
        balanceAmount: 119000,
      });
    });
  });

  describe('5. Canonical Seed Integrity (19 Services & 28 Materials from docs/catalog (2).xlsx)', () => {
    it('upserts exact canonical services (incl. MED05 NURSE, CMB01-03 GROOMING) and 28 materials', async () => {
      const upsertedMaterials = [];
      const upsertedServices = [];

      jest.spyOn(Branch, 'findOneAndUpdate').mockImplementation(async (filter, update) => ({
        _id: new mongoose.Types.ObjectId(),
        code: filter.code,
        ...update.$set,
      }));
      jest.spyOn(InventoryItem, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        const doc = { _id: new mongoose.Types.ObjectId(), sku: filter.sku, ...update.$set };
        upsertedMaterials.push(doc);
        return doc;
      });
      jest.spyOn(InventoryStock, 'findOneAndUpdate').mockResolvedValue({});
      jest.spyOn(Service, 'find').mockResolvedValue([]);
      jest.spyOn(Service, 'findOneAndUpdate').mockImplementation(async (filter, update) => {
        const doc = { _id: new mongoose.Types.ObjectId(), code: filter.code, ...update.$set };
        upsertedServices.push(doc);
        return doc;
      });
      jest.spyOn(BranchServiceConfig, 'findOneAndUpdate').mockResolvedValue({});
      jest.spyOn(ShiftTemplate, 'findOneAndUpdate').mockResolvedValue({});

      await seedServiceCatalog();

      expect(upsertedMaterials).toHaveLength(28);
      expect(upsertedMaterials.map((m) => m.sku)).toEqual(
        Array.from({ length: 28 }, (_, i) => `MAT${String(i + 1).padStart(3, '0')}`)
      );

      expect(upsertedServices).toHaveLength(19);
      const byCode = Object.fromEntries(upsertedServices.map((s) => [s.code, s]));

      expect(byCode.MED01).toMatchObject({ name: 'Khám sức khỏe tổng quát', basePrice: 150000, requiredStaffRole: 'VETERINARIAN', bookingMode: 'BOOKABLE' });
      expect(byCode.MED02).toMatchObject({ name: 'Tiêm phòng', basePrice: 200000, durationMinutes: 20, requiredStaffRole: 'VETERINARIAN' });
      expect(byCode.MED03).toMatchObject({ name: 'Xét nghiệm máu / Test nhanh', basePrice: 250000, durationMinutes: 30 });
      expect(byCode.MED04).toMatchObject({ name: 'Siêu âm', basePrice: 250000, durationMinutes: 30 });
      expect(byCode.MED05).toMatchObject({ name: 'Thay băng / Chăm sóc sau điều trị', basePrice: 120000, requiredStaffRole: 'NURSE', bookingMode: 'BOOKABLE' });
      expect(byCode.MED06).toMatchObject({ name: 'Phẫu thuật / Triệt sản', basePrice: 800000, bookingMode: 'REQUEST_ONLY', durationMinutes: 120 });
      expect(byCode.MED07).toMatchObject({ name: 'Cấp cứu 24/7', basePrice: 0, bookingMode: 'CONTACT_ONLY', defaultMaterials: [] });

      ['CMB01', 'CMB02', 'CMB03'].forEach((code) => {
        expect(byCode[code].serviceType).toBe('GROOMING');
        expect(byCode[code].requiredStaffRole).toBe('CARE_STAFF_GROOMER');
        expect(byCode[code].priceVariants.map((v) => v.tier)).toEqual(['XS', 'S', 'M', 'L', 'XL']);
      });

      expect(byCode.CMB01.priceVariants.map((v) => v.price)).toEqual([180000, 230000, 385000, 525000, null]);
      expect(byCode.CMB02.priceVariants.map((v) => v.price)).toEqual([135000, 190000, 325000, 485000, null]);
      expect(byCode.CMB03.priceVariants.map((v) => v.price)).toEqual([100000, 135000, 210000, 300000, null]);
    });
  });
});
