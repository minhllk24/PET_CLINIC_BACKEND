import mongoose from 'mongoose';
import Appointment from '../src/modules/booking/models/Appointment';
import Shift from '../src/modules/staff/models/Shift';
import StaffProfile from '../src/modules/staff/models/StaffProfile';
import ServiceRecord from '../src/modules/execution/models/ServiceRecord';
import SlotReservation from '../src/modules/booking/models/SlotReservation';
import Payment from '../src/modules/payment/models/Payment';
import {
  resolveVetReviewer,
  mockCompletePayment,
} from '../src/modules/booking/booking.service';
import { processAppointmentHoldExpiries } from '../src/worker/cronjobs';

describe('Phase 1 & Phase 2: BR3 Vet Auto-Assignment, Capacity & Auto-Confirm', () => {
  const branchId = new mongoose.Types.ObjectId();
  const vet1Id = new mongoose.Types.ObjectId();
  const vet2Id = new mongoose.Types.ObjectId();
  const nurseId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. BR3 Vet Auto-Assignment Algorithm (resolveVetReviewer)', () => {
    it('Priority 1: returns directly assigned Vet in appointment segments', async () => {
      const segments = [
        { requiredStaffRole: 'NURSE', assignedStaffId: nurseId },
        { requiredStaffRole: 'VETERINARIAN', assignedStaffId: vet1Id },
      ];

      const result = await resolveVetReviewer({
        branchId,
        segments,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 30 * 60000),
      });

      expect(result.toString()).toBe(vet1Id.toString());
    });

    it('Priority 2: if only Nurse in segments, assigns active Vet in current shift at same branch', async () => {
      const segments = [{ requiredStaffRole: 'NURSE', assignedStaffId: nurseId }];
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 60000);

      const mockShift = {
        branchId,
        status: 'ACTIVE',
        startAt: new Date(now.getTime() - 60000),
        endAt: new Date(end.getTime() + 60000),
        staffId: {
          _id: vet1Id,
          status: 'ACTIVE',
          staffSubRole: 'VETERINARIAN',
        },
      };

      jest.spyOn(Shift, 'find').mockReturnValue({
        populate: jest.fn().mockResolvedValue([mockShift]),
      });

      const result = await resolveVetReviewer({
        branchId,
        segments,
        scheduledStart: now,
        scheduledEnd: end,
      });

      expect(result.toString()).toBe(vet1Id.toString());
    });

    it('Priority 3: if no Vet in current shift, selects active Vet in nearest upcoming shift', async () => {
      const segments = [{ requiredStaffRole: 'NURSE', assignedStaffId: nurseId }];
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 60000);

      const nextShiftTime = new Date(now.getTime() + 2 * 3600000);
      const mockNextShift = {
        branchId,
        status: 'ACTIVE',
        startAt: nextShiftTime,
        endAt: new Date(nextShiftTime.getTime() + 4 * 3600000),
        staffId: {
          _id: vet2Id,
          status: 'ACTIVE',
          staffSubRole: 'VETERINARIAN',
        },
      };

      // First query (current shift) returns empty; second query (upcoming shift) returns mockNextShift
      jest.spyOn(Shift, 'find')
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue([mockNextShift]),
          }),
        });

      const result = await resolveVetReviewer({
        branchId,
        segments,
        scheduledStart: now,
        scheduledEnd: end,
      });

      expect(result.toString()).toBe(vet2Id.toString());
    });

    it('Priority 4: if multiple Vets in shift, selects the one with least pending reviews', async () => {
      const segments = [{ requiredStaffRole: 'NURSE', assignedStaffId: nurseId }];
      const now = new Date();
      const end = new Date(now.getTime() + 30 * 60000);

      const mockShifts = [
        {
          branchId,
          status: 'ACTIVE',
          startAt: new Date(now.getTime() - 60000),
          endAt: new Date(end.getTime() + 60000),
          staffId: { _id: vet1Id, userId: new mongoose.Types.ObjectId(), status: 'ACTIVE', staffSubRole: 'VETERINARIAN' },
        },
        {
          branchId,
          status: 'ACTIVE',
          startAt: new Date(now.getTime() - 60000),
          endAt: new Date(end.getTime() + 60000),
          staffId: { _id: vet2Id, userId: new mongoose.Types.ObjectId(), status: 'ACTIVE', staffSubRole: 'VETERINARIAN' },
        },
      ];

      jest.spyOn(Shift, 'find').mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockShifts),
      });

      // vet1 has 5 pending reviews, vet2 has 1 pending review
      jest.spyOn(ServiceRecord, 'aggregate').mockResolvedValue([
        { _id: vet1Id, count: 5 },
        { _id: vet2Id, count: 1 },
      ]);

      const result = await resolveVetReviewer({
        branchId,
        segments,
        scheduledStart: now,
        scheduledEnd: end,
      });

      // Should choose vet2 because vet2 has fewer pending reviews (1 < 5)
      expect(result.toString()).toBe(vet2Id.toString());
    });

    it('Priority 5: returns null if no Vet shifts exist at branch', async () => {
      const segments = [{ requiredStaffRole: 'NURSE', assignedStaffId: nurseId }];

      jest.spyOn(Shift, 'find')
        .mockReturnValueOnce({
          populate: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          sort: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue([]),
          }),
        });

      const result = await resolveVetReviewer({
        branchId,
        segments,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 30 * 60000),
      });

      expect(result).toBeNull();
    });
  });

  describe('2. Auto-Confirm and 15-Minute Hold Logic', () => {
    it('mockCompletePayment auto-confirms appointment and releases hold timer', async () => {
      const aptId = new mongoose.Types.ObjectId();
      const mockPayment = {
        _id: new mongoose.Types.ObjectId(),
        targetType: 'APPOINTMENT',
        targetId: aptId,
        amount: 50000,
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockApt = {
        _id: aptId,
        status: 'PENDING_PAYMENT',
        pricing: { paidAmount: 0 },
        deposit: {},
        holdExpiresAt: new Date(Date.now() + 900000),
        save: jest.fn().mockResolvedValue(true),
      };

      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
      };

      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);
      jest.spyOn(Payment, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockPayment),
      });
      jest.spyOn(Appointment, 'findById').mockReturnValue({
        session: jest.fn().mockResolvedValue(mockApt),
      });
      jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

      await mockCompletePayment(mockPayment._id);

      expect(mockApt.status).toBe('CONFIRMED');
      expect(mockApt.holdExpiresAt).toBeNull();
      expect(mockApt.pricing.paidAmount).toBe(50000);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('processAppointmentHoldExpiries only queries PENDING_PAYMENT, never cancels CONFIRMED', async () => {
      const now = new Date();
      const expiredApt = {
        _id: new mongoose.Types.ObjectId(),
        status: 'PENDING_PAYMENT',
        holdExpiresAt: new Date(now.getTime() - 60000),
        pricing: { paidAmount: 0 },
        cancel: null,
        save: jest.fn().mockResolvedValue(true),
      };

      const findSpy = jest.spyOn(Appointment, 'find').mockResolvedValue([expiredApt]);
      jest.spyOn(SlotReservation, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      const processed = await processAppointmentHoldExpiries();

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING_PAYMENT',
        })
      );
      expect(processed).toContain(expiredApt._id.toString());
      expect(expiredApt.status).toBe('CANCELLED');
    });
  });
});
