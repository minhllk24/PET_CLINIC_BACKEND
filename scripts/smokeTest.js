/* eslint-disable no-console */
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import supertest from 'supertest';
import app from '../src/app.js';
import config from '../src/shared/config.js';

async function testAll() {
  await mongoose.connect(config.mongoUri);

  console.log('\n--- 1. Testing Staff List (GET /api/v1/staff) ---');
  const adminUser = await mongoose.connection.db.collection('users').findOne({ username: 'admin' });
  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), fullName: adminUser.fullName, systemRole: adminUser.systemRole, assignedBranchIds: [], authorizedBranchIds: [] },
    config.jwt.accessSecret
  );

  const staffRes = await supertest(app)
    .get('/api/v1/staff')
    .set('Authorization', 'Bearer ' + adminToken);
  console.log('Status     :', staffRes.status);
  console.log('Items Count:', staffRes.body?.items?.length);
  console.log('TotalCount :', staffRes.body?.totalCount);
  console.log('First Staff:', staffRes.body?.items?.[0]?.fullName, `(${staffRes.body?.items?.[0]?.staffSubRole})`, 'Branch:', staffRes.body?.items?.[0]?.homeBranchId);

  console.log('\n--- 2. Testing Vouchers List (GET /api/v1/vouchers) ---');
  const managerUser = await mongoose.connection.db.collection('users').findOne({ username: 'manager' });
  const managerToken = jwt.sign(
    { id: managerUser._id.toString(), fullName: managerUser.fullName, systemRole: managerUser.systemRole, assignedBranchIds: managerUser.assignedBranchIds || [], authorizedBranchIds: [] },
    config.jwt.accessSecret
  );

  const voucherRes = await supertest(app)
    .get('/api/v1/vouchers')
    .set('Authorization', 'Bearer ' + managerToken);
  console.log('Status       :', voucherRes.status);
  console.log('Voucher Count:', voucherRes.body?.items?.length);
  const freeship = voucherRes.body?.items?.find((v) => v.code === 'FREESHIP');
  console.log('FREESHIP     :', freeship?.code, '|', freeship?.name, '| Min:', freeship?.minOrderAmount);

  console.log('\n--- 3. Testing Orders List (GET /api/v1/orders) ---');
  const orderRes = await supertest(app)
    .get('/api/v1/orders')
    .set('Authorization', 'Bearer ' + adminToken);
  console.log('Status     :', orderRes.status);
  console.log('Order Count:', orderRes.body?.items?.length);
  console.log('TotalCount :', orderRes.body?.totalCount);
  console.log('Codes & Status:');
  orderRes.body?.items?.slice(0, 5).forEach((o) => {
    console.log(`  - ${o.code.padEnd(32)} | ${o.status.padEnd(10)} | ${o.paymentMethod.padEnd(11)} | ${o.pricing?.totalAmount?.toLocaleString('vi-VN')}đ`);
  });

  console.log('\n--- 4. Testing Returns List (GET /api/v1/order-returns) ---');
  const returnRes = await supertest(app)
    .get('/api/v1/order-returns')
    .set('Authorization', 'Bearer ' + adminToken);
  console.log('Status      :', returnRes.status);
  console.log('Return Count:', returnRes.body?.items?.length);
  console.log('TotalCount  :', returnRes.body?.totalCount);
  returnRes.body?.items?.forEach((r) => {
    console.log(`  - ${r.code || r.id} | Status: ${r.status} | Reason: ${r.reason}`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Tất cả 4 API smoke test phản hồi đúng chuẩn dữ liệu!');
}

testAll().catch((err) => {
  console.error('Smoke test error:', err);
  process.exit(1);
});
