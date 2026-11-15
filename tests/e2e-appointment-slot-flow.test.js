const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app').default || require('../src/app');
const Appointment = require('../src/modules/booking/models/Appointment').default || require('../src/modules/booking/models/Appointment');
const SlotReservation = require('../src/modules/booking/models/SlotReservation').default || require('../src/modules/booking/models/SlotReservation');
const Payment = require('../src/modules/payment/models/Payment').default || require('../src/modules/payment/models/Payment');
const config = require('../src/shared/config').default || require('../src/shared/config');

async function runE2EAppointmentFlow() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB for E2E Appointment Slot Flow Test');

  const testDate = '2026-11-28';
  const branchId = '6ae15db11bb9b2b264c91121'; // Q1
  const serviceId = '6ae161491bb9b2b264c91198'; // 30m examination

  // 0. Clean prior test records for this branch on testDate
  await Appointment.deleteMany({
    branchId: new mongoose.Types.ObjectId(branchId),
    scheduledStart: {
      $gte: new Date(testDate + 'T00:00:00.000Z'),
      $lte: new Date(testDate + 'T23:59:59.999Z'),
    },
  });
  await SlotReservation.deleteMany({ branchId: new mongoose.Types.ObjectId(branchId) });
  await Payment.deleteMany({ code: null });

  console.log('\n=== STEP 1: Guest/Customer checks availability before booking ===');
  const resSlots1 = await request(app)
    .get('/api/v1/appointments/slots')
    .query({
      branchId,
      serviceIds: serviceId,
      date: testDate,
    })
    .expect(200);

  const slot0900_1 = resSlots1.body.slots.find((s) => s.start.includes('09:00:00'));
  console.log('Slot 09:00 initial:', {
    value: slot0900_1.value,
    totalCount: slot0900_1.totalCount,
    remaining: slot0900_1.remaining,
    occupiedCount: slot0900_1.occupiedCount,
    status: slot0900_1.status,
  });

  const initialRemaining = slot0900_1.remaining;
  console.log(`Initial capacity: ${initialRemaining} slots`);

  console.log('\n=== STEP 2: Guest books Appointment 1 at 09:00 ===');
  const resBooking1 = await request(app)
    .post('/api/v1/appointments')
    .set('Idempotency-Key', `idemp-test-1-${Date.now()}`)
    .send({
      branchId,
      serviceIds: [serviceId],
      slotStart: `${testDate}T09:00:00.000Z`,
      contact: {
        name: 'Nguyen Van Guest 1',
        phone: '0911000001',
        email: 'guest1@test.com',
      },
      pet: {
        name: 'Lucky',
        species: 'DOG',
        weightKg: 5,
      },
      paymentMethod: 'PAY_AT_STORE',
    });

  console.log('resBooking1 status:', resBooking1.status);
  if (resBooking1.status !== 201) {
    console.log('resBooking1 error body:', resBooking1.body);
    throw new Error(`Expected 201, got ${resBooking1.status}`);
  }

  console.log('Booking 1 created successfully:', {
    code: resBooking1.body.code,
    status: resBooking1.body.status,
    customerName: resBooking1.body.customer_name_snapshot,
    prepaymentId: resBooking1.body.prepaymentId,
  });

  console.log('\n=== STEP 3: Verify dynamic slot decrement after Booking 1 ===');
  const resSlots2 = await request(app)
    .get('/api/v1/appointments/slots')
    .query({
      branchId,
      serviceIds: serviceId,
      date: testDate,
    })
    .expect(200);

  const slot0900_2 = resSlots2.body.slots.find((s) => s.start.includes('09:00:00'));
  console.log('Slot 09:00 after Booking 1:', {
    value: slot0900_2.value,
    totalCount: slot0900_2.totalCount,
    remaining: slot0900_2.remaining,
    occupiedCount: slot0900_2.occupiedCount,
    status: slot0900_2.status,
  });

  if (slot0900_2.remaining !== initialRemaining - 1) {
    throw new Error(`Expected remaining to decrement to ${initialRemaining - 1}, but got ${slot0900_2.remaining}`);
  }
  console.log('SUCCESS: Slot remaining decremented by exactly 1!');

  console.log('\n=== STEP 4: Guest books Appointment 2 at 09:00 ===');
  const resBooking2 = await request(app)
    .post('/api/v1/appointments')
    .set('Idempotency-Key', `idemp-test-2-${Date.now()}`)
    .send({
      branchId,
      serviceIds: [serviceId],
      slotStart: `${testDate}T09:00:00.000Z`,
      contact: {
        name: 'Nguyen Van Guest 2',
        phone: '0911000002',
        email: 'guest2@test.com',
      },
      pet: {
        name: 'Milo',
        species: 'CAT',
        weightKg: 4,
      },
      paymentMethod: 'PAY_AT_STORE',
    });

  console.log('resBooking2 status:', resBooking2.status);
  if (resBooking2.status !== 201) {
    console.log('resBooking2 error body:', resBooking2.body);
    throw new Error(`Expected 201, got ${resBooking2.status}`);
  }

  console.log('Booking 2 created successfully:', {
    code: resBooking2.body.code,
    status: resBooking2.body.status,
    customerName: resBooking2.body.customer_name_snapshot,
  });

  console.log('\n=== STEP 5: Verify dynamic slot decrement after Booking 2 ===');
  const resSlots3 = await request(app)
    .get('/api/v1/appointments/slots')
    .query({
      branchId,
      serviceIds: serviceId,
      date: testDate,
    })
    .expect(200);

  const slot0900_3 = resSlots3.body.slots.find((s) => s.start.includes('09:00:00'));
  console.log('Slot 09:00 in slots list (status FULL is excluded for customers):', slot0900_3 ? {
    remaining: slot0900_3.remaining,
    status: slot0900_3.status,
  } : 'SLOT HAS REACHED FULL CAPACITY AND REMOVED FROM AVAILABLE SLOTS');

  console.log('\n=== STEP 6: Customer 3 attempts to book same 09:00 slot (Should be rejected with 409) ===');
  const resBooking3 = await request(app)
    .post('/api/v1/appointments')
    .set('Idempotency-Key', `idemp-test-3-${Date.now()}`)
    .send({
      branchId,
      serviceIds: [serviceId],
      slotStart: `${testDate}T09:00:00.000Z`,
      contact: {
        name: 'Nguyen Van Guest 3',
        phone: '0911000003',
      },
      pet: {
        name: 'Bong',
        species: 'DOG',
      },
      paymentMethod: 'PAY_AT_STORE',
    });

  console.log('Booking 3 HTTP response status:', resBooking3.status);
  console.log('Booking 3 Error body:', resBooking3.body);

  if (resBooking3.status === 409) {
    console.log('SUCCESS: Customer 3 correctly rejected with 409 Conflict (Capacity reached)!');
  } else {
    throw new Error(`Expected 409 Conflict, got ${resBooking3.status}`);
  }

  console.log('\n=== ALL E2E APPOINTMENT & SLOT DECREMENT TESTS PASSED! ===\n');
  process.exit(0);
}

runE2EAppointmentFlow().catch((e) => {
  console.error('E2E TEST FAILED:', e);
  process.exit(1);
});
