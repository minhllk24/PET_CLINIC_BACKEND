import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app';
import config from '../src/shared/config';
import Appointment from '../src/modules/booking/models/Appointment';

describe('Deposit & Refund Policy Suite (B04 & AP05)', () => {
  const customerId = '507f1f77bcf86cd799439003';
  const customerToken = jwt.sign(
    { id: customerId, systemRole: 'CUSTOMER' },
    config.jwt.accessSecret
  );

  describe('1. Preview Pricing & Deposit (B04 / CF06)', () => {
    it('returns subtotal, finalAmount, depositAmount (30%) and balanceAmount', async () => {
      const res = await request(app)
        .post('/api/v1/appointments/preview-pricing')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceIds: ['507f1f77bcf86cd799439021'],
          petWeightKg: 4,
          voucherCode: 'WELCOME50',
        });

      expect(res.status).toBe(200);
      expect(res.body.depositType).toBe('PERCENTAGE');
      expect(res.body.depositValue).toBe(30);
      expect(res.body.depositAmount).toBeDefined();
      expect(res.body.depositAmount).toBe(Math.round(res.body.finalAmount * 0.30));
      expect(res.body.balanceAmount).toBe(res.body.finalAmount - res.body.depositAmount);
      expect(res.body.policyText).toContain('30%');
    });
  });

  describe('2. Cancellation & Refund Preview (AP05 / CF07)', () => {
    it('previews 100% deposit refund when cancelled >= 24h before start', async () => {
      const futureStart = new Date(Date.now() + 48 * 3600000); // 48h in future
      const mockApt = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439099'),
        code: 'BK-TEST-1001',
        status: 'CONFIRMED',
        scheduledStart: futureStart,
        pricing: {
          subtotal: 250000,
          finalAmount: 250000,
          depositAmount: 75000,
          paidAmount: 75000,
        },
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockApt);

      const res = await request(app)
        .get(`/api/v1/appointments/${mockApt._id}/cancel-preview`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.refundable).toBe(true);
      expect(res.body.refundAmount).toBe(75000);
      expect(res.body.penaltyAmount).toBe(0);
      expect(res.body.policyMessage).toContain('100% tiền cọc');
    });

    it('previews 0 refund (forfeited) when cancelled < 24h before start', async () => {
      const nearStart = new Date(Date.now() + 5 * 3600000); // 5h in future
      const mockApt = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439098'),
        code: 'BK-TEST-1002',
        status: 'CONFIRMED',
        scheduledStart: nearStart,
        pricing: {
          subtotal: 250000,
          finalAmount: 250000,
          depositAmount: 75000,
          paidAmount: 75000,
        },
      };

      jest.spyOn(Appointment, 'findById').mockResolvedValue(mockApt);

      const res = await request(app)
        .get(`/api/v1/appointments/${mockApt._id}/cancel-preview`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.refundable).toBe(false);
      expect(res.body.refundAmount).toBe(0);
      expect(res.body.penaltyAmount).toBe(75000);
      expect(res.body.policyMessage).toContain('không được hoàn lại');
    });
  });
});
