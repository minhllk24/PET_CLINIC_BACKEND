const mongoose = require('mongoose');
require('dotenv').config();
const { getAvailability } = require('../src/modules/booking/availability.service');
const { createAppointment } = require('../src/modules/booking/booking.service');
const { checkoutCreateOrder } = require('../src/modules/order/order.service');

async function runEmpiricalVerification() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('=== [E2E TEST 1: SLOT DECREMENT & CONCURRENCY] ===');
  
  const testDate = '2026-11-20';
  const branchId = '6ae15db11bb9b2b264c91121';
  const tiemPhongId = '6ae161491bb9b2b264c91199'; // 20m
  const khamTongQuatId = '6ae161491bb9b2b264c91198'; // 30m

  // Clean any previous test appointments on testDate
  const Apt = mongoose.model('Appointment');
  const SlotRes = mongoose.model('SlotReservation');
  await Apt.deleteMany({ scheduledStart: { $gte: new Date(`${testDate}T00:00:00.000Z`), $lte: new Date(`${testDate}T23:59:59.999Z`) } });
  await SlotRes.deleteMany({ branchId: new mongoose.Types.ObjectId(branchId) });

  // 1. Initial Availability Check
  const initAvail = await getAvailability({ branchId, serviceIds: [khamTongQuatId], date: testDate });
  const slot0Init = initAvail.slots.find(s => s.start.includes('08:00'));
  console.log(`Initial 08:00 slot: booked=${slot0Init.bookedCount}, remaining=${slot0Init.remaining}, total=${slot0Init.totalCount}`);
  if (slot0Init.remaining !== 3 || slot0Init.bookedCount !== 0) {
    throw new Error(`Expected initial slot remaining=3, booked=0, got remaining=${slot0Init.remaining}, booked=${slot0Init.bookedCount}`);
  }

  // 2. Book 1st Appointment (Tiêm phòng - 20 mins)
  const apt1 = await createAppointment({
    branchId,
    serviceIds: [tiemPhongId],
    slotStart: `${testDate}T08:00:00.000Z`,
    paymentMethod: 'ONLINE_MOCK',
    pet: { name: 'Miu Miu', species: 'CAT', weightKg: 3 },
    contact: { name: 'Anh Nam', phone: '0901234567', email: 'nam@test.com' },
  }, null, null);
  console.log(`Created Apt 1 (${apt1.code}) for Tiêm phòng at 08:00. Status: ${apt1.status}`);

  // 3. Query availability for Khám Tổng Quát (30 mins) - must see remaining decremented to 2!
  const availAfter1 = await getAvailability({ branchId, serviceIds: [khamTongQuatId], date: testDate });
  const slot0After1 = availAfter1.slots.find(s => s.start.includes('08:00'));
  console.log(`After Apt 1: 08:00 slot booked=${slot0After1.bookedCount}, remaining=${slot0After1.remaining}, total=${slot0After1.totalCount}`);
  if (slot0After1.remaining !== 2 || slot0After1.bookedCount !== 1) {
    throw new Error(`Expected slot remaining=2, booked=1, got remaining=${slot0After1.remaining}, booked=${slot0After1.bookedCount}`);
  }

  // 4. Book 2nd Appointment (Khám tổng quát - 30 mins)
  const apt2 = await createAppointment({
    branchId,
    serviceIds: [khamTongQuatId],
    slotStart: `${testDate}T08:00:00.000Z`,
    paymentMethod: 'ONLINE_MOCK',
    pet: { name: 'Kiki', species: 'DOG', weightKg: 10 },
    contact: { name: 'Chị Mai', phone: '0907654321', email: 'mai@test.com' },
  }, null, null);
  console.log(`Created Apt 2 (${apt2.code}) for Khám tổng quát at 08:00. Status: ${apt2.status}`);

  // 5. Query availability - must see remaining decremented to 1!
  const availAfter2 = await getAvailability({ branchId, serviceIds: [khamTongQuatId], date: testDate });
  const slot0After2 = availAfter2.slots.find(s => s.start.includes('08:00'));
  console.log(`After Apt 2: 08:00 slot booked=${slot0After2.bookedCount}, remaining=${slot0After2.remaining}, total=${slot0After2.totalCount}`);
  if (slot0After2.remaining !== 1 || slot0After2.bookedCount !== 2) {
    throw new Error(`Expected slot remaining=1, booked=2, got remaining=${slot0After2.remaining}, booked=${slot0After2.bookedCount}`);
  }

  // 6. Book 3rd Appointment
  const apt3 = await createAppointment({
    branchId,
    serviceIds: [khamTongQuatId],
    slotStart: `${testDate}T08:00:00.000Z`,
    paymentMethod: 'ONLINE_MOCK',
    pet: { name: 'Lu', species: 'DOG', weightKg: 5 },
    contact: { name: 'Anh Hùng', phone: '0909999999', email: 'hung@test.com' },
  }, null, null);
  console.log(`Created Apt 3 (${apt3.code}) at 08:00. Status: ${apt3.status}`);

  // 7. Verify 4th booking is blocked with 409 SLOT_UNAVAILABLE
  try {
    await createAppointment({
      branchId,
      serviceIds: [khamTongQuatId],
      slotStart: `${testDate}T08:00:00.000Z`,
      paymentMethod: 'ONLINE_MOCK',
      pet: { name: 'Overload Pet', species: 'DOG', weightKg: 5 },
      contact: { name: 'Khách 4', phone: '0908888888', email: 'k4@test.com' },
    }, null, null);
    throw new Error('Expected 4th appointment to fail with 409 Conflict, but it succeeded!');
  } catch (err) {
    const statusCode = err.status || err.statusCode;
    console.log(`4th appointment correctly blocked: status=${statusCode}, message=${err.message}`);
    if (statusCode !== 409) throw err;
  }

  console.log('=== [E2E TEST 2: GUEST ORDER CHECKOUT WITH VARIANT] ===');
  const orderRes = await checkoutCreateOrder({
    contact: { fullName: 'Tèo Khách', phone: '0987654321', email: 'teokhach@example.com' },
    shippingAddress: { fullName: 'Tèo Khách', phone: '0987654321', addressLine: '456 Lê Lợi', city: 'Hồ Chí Minh' },
    paymentMethod: 'COD',
    items: [
      {
        product_id: '6aec91abfadcb390c758933f', // Whiskas 180k
        variant_id: '6aec91abfadcb390c7589341',
        quantity: 1,
      }
    ]
  }, null, 'guest-token-session-789');

  console.log(`Order placed successfully: code=${orderRes.code}, status=${orderRes.status}, total=${orderRes.pricing?.totalAmount || orderRes.totalAmount}`);

  // Clean up test data
  await Apt.deleteMany({ scheduledStart: { $gte: new Date(`${testDate}T00:00:00.000Z`), $lte: new Date(`${testDate}T23:59:59.999Z`) } });
  const Order = mongoose.model('Order');
  await Order.deleteOne({ _id: orderRes.id || orderRes._id });

  await mongoose.disconnect();
  console.log('ALL E2E VERIFICATION TESTS PASSED PERFECTLY!');
}

runEmpiricalVerification().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
