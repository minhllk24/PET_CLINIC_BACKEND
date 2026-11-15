const mongoose = require('mongoose');
const { getAvailability } = require('../src/modules/booking/availability.service');
const { createAppointment } = require('../src/modules/booking/booking.service');
const Appointment = require('../src/modules/booking/models/Appointment').default || require('../src/modules/booking/models/Appointment');
const SlotReservation = require('../src/modules/booking/models/SlotReservation').default || require('../src/modules/booking/models/SlotReservation');
const config = require('../src/shared/config').default || require('../src/shared/config');

async function testSlotDecrement() {
  await mongoose.connect(config.mongoUri);
  const testDate = '2026-11-25';
  const branchId = '6ae15db11bb9b2b264c91121';
  const serviceId = '6ae161491bb9b2b264c91198'; // 30m

  // Clean test appointments on testDate
  await Appointment.deleteMany({
    branchId: new mongoose.Types.ObjectId(branchId),
    scheduledStart: {
      $gte: new Date(testDate + 'T00:00:00.000Z'),
      $lte: new Date(testDate + 'T23:59:59.999Z'),
    },
  });
  await SlotReservation.deleteMany({ branchId: new mongoose.Types.ObjectId(branchId) });

  // 1. Initial Availability
  const avail1 = await getAvailability({ branchId, serviceIds: [serviceId], date: testDate, includeFull: true });
  const slot0900_1 = avail1.slots.find((s) => s.start.includes('09:00:00'));
  console.log('--- TEST 1: Initial Slot 09:00 ---');
  console.log('TotalCount:', slot0900_1.totalCount, 'Remaining:', slot0900_1.remaining, 'Occupied:', slot0900_1.occupiedCount, 'Status:', slot0900_1.status);

  // 2. Customer A books 09:00
  console.log('--- Customer A booking 09:00 ---');
  const aptA = await createAppointment({
    branchId,
    serviceIds: [serviceId],
    slotStart: testDate + 'T09:00:00.000Z',
    contact: { name: 'Customer A', phone: '0901111111' },
    pet: { name: 'Milo', species: 'DOG' },
    paymentMethod: 'PAY_AT_STORE',
  }, null, null);
  console.log('Customer A booked successfully! Code:', aptA.code, 'Status:', aptA.status);

  // 3. Availability after Customer A
  const avail2 = await getAvailability({ branchId, serviceIds: [serviceId], date: testDate, includeFull: true });
  const slot0900_2 = avail2.slots.find((s) => s.start.includes('09:00:00'));
  console.log('--- TEST 2: Slot 09:00 after Customer A ---');
  console.log('TotalCount:', slot0900_2.totalCount, 'Remaining:', slot0900_2.remaining, 'Occupied:', slot0900_2.occupiedCount, 'Status:', slot0900_2.status);

  // 4. Customer B books 09:00
  console.log('--- Customer B booking 09:00 ---');
  try {
    const aptB = await createAppointment({
      branchId,
      serviceIds: [serviceId],
      slotStart: testDate + 'T09:00:00.000Z',
      contact: { name: 'Customer B', phone: '0902222222' },
      pet: { name: 'Kiki', species: 'CAT' },
      paymentMethod: 'PAY_AT_STORE',
    }, null, null);
    console.log('Customer B booked successfully! Code:', aptB.code, 'Status:', aptB.status);
  } catch (err) {
    console.log('Customer B error:', err);
  }

  // 5. Availability after Customer B
  const avail3 = await getAvailability({ branchId, serviceIds: [serviceId], date: testDate, includeFull: true });
  const slot0900_3 = avail3.slots.find((s) => s.start.includes('09:00:00'));
  console.log('--- TEST 3: Slot 09:00 after Customer B ---');
  console.log('TotalCount:', slot0900_3.totalCount, 'Remaining:', slot0900_3.remaining, 'Occupied:', slot0900_3.occupiedCount, 'Status:', slot0900_3.status);

  // 6. Customer C attempts to book when capacity full
  console.log('--- Customer C booking 09:00 (Check capacity limits) ---');
  try {
    const aptC = await createAppointment({
      branchId,
      serviceIds: [serviceId],
      slotStart: testDate + 'T09:00:00.000Z',
      contact: { name: 'Customer C', phone: '0903333333' },
      pet: { name: 'Lulu', species: 'DOG' },
      paymentMethod: 'PAY_AT_STORE',
    }, null, null);
    console.log('Customer C booked! Code:', aptC.code);
  } catch (err) {
    console.log('Customer C rejected as expected! Status:', err.status || err.statusCode, 'Code:', err.code, 'Message:', err.message);
  }

  process.exit(0);
}

testSlotDecrement().catch((e) => {
  console.error(e);
  process.exit(1);
});
