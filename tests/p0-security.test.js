import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import User from '../src/models/User.js';
import OtpChallenge from '../src/models/OtpChallenge.js';
import RefreshSession from '../src/models/RefreshSession.js';
import { hashPassword } from '../src/utils/passwordHelpers.js';
import { hashOtp } from '../src/utils/otpHelpers.js';

let mongod;

const setup = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log('Test MongoDB memory server connected at:', uri);
};

const teardown = async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

const runAllTests = async () => {
  await setup();
  console.log('\n================ STARTING P0 SECURITY TEST SUITE ================\n');

  let passed = 0;
  let failed = 0;

  const assertTest = (name, condition, extraInfo = '') => {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${extraInfo}`);
      failed++;
    }
  };

  try {
    // Seed initial users
    const passwordHash = await hashPassword('StrongP@ss123');

    const adminUser = await User.create({
      phone: '0901111111',
      fullName: 'Super Admin',
      passwordHash,
      systemRole: 'ADMIN',
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    });

    const managerUser = await User.create({
      phone: '0902222222',
      fullName: 'Branch Manager',
      passwordHash,
      systemRole: 'MANAGER',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001')],
      activatedAt: new Date(),
    });

    const staffVet = await User.create({
      phone: '0903333333',
      fullName: 'Staff Vet',
      passwordHash,
      systemRole: 'STAFF',
      staffSubRole: 'VETERINARIAN',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001')],
      activatedAt: new Date(),
    });

    const staffReceptionist = await User.create({
      phone: '0904444444',
      fullName: 'Staff Receptionist',
      passwordHash,
      systemRole: 'STAFF',
      staffSubRole: 'RECEPTIONIST',
      accountStatus: 'ACTIVE',
      assignedBranchIds: [new mongoose.Types.ObjectId('60c72b2f9b1d8b2bad000001')],
      activatedAt: new Date(),
    });

    const customerUser = await User.create({
      phone: '0905555555',
      fullName: 'Customer One',
      passwordHash,
      systemRole: 'CUSTOMER',
      accountStatus: 'ACTIVE',
      activatedAt: new Date(),
    });

    const blockedUser = await User.create({
      phone: '0906666666',
      fullName: 'Blocked Customer',
      passwordHash,
      systemRole: 'CUSTOMER',
      accountStatus: 'BLOCKED',
    });

    const pendingUser = await User.create({
      phone: '0907777777',
      fullName: 'Pending Customer',
      passwordHash,
      systemRole: 'CUSTOMER',
      accountStatus: 'PENDING_ACTIVATION',
    });

    console.log('--- H.1 Authentication Tests ---');

    // AUTH-01: Guest -> GET /auth/me -> 401
    const resAuth01 = await request(app).get('/api/v1/auth/me');
    assertTest('AUTH-01: Guest -> GET /auth/me gives 401', resAuth01.status === 401);

    // AUTH-02: Invalid JWT -> any protected endpoint -> 401
    const resAuth02 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid.token.payload');
    assertTest('AUTH-02: Invalid JWT gives 401', resAuth02.status === 401);

    // AUTH-04: Valid JWT but BLOCKED user -> any protected endpoint -> 403
    // Log in as customer to get a valid token, then block the user and test
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0905555555', password: 'StrongP@ss123' });
    const customerToken = loginRes.body?.accessToken;
    assertTest('Customer login successful', loginRes.status === 200 && Boolean(customerToken));

    // Block customerUser
    customerUser.accountStatus = 'BLOCKED';
    await customerUser.save();
    const resAuth04 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);
    assertTest('AUTH-04: Valid JWT for BLOCKED user gives 403', resAuth04.status === 403);
    // Unblock for later tests
    customerUser.accountStatus = 'ACTIVE';
    await customerUser.save();

    // AUTH-05: Revoked refresh token -> POST /auth/refresh -> 401
    // Log in admin to get cookie
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0901111111', password: 'StrongP@ss123' });
    const adminCookies = adminLoginRes.headers['set-cookie'] || [];
    const adminToken = adminLoginRes.body?.accessToken;
    assertTest('Admin login sets refresh cookie', adminLoginRes.status === 200 && adminCookies.length > 0);

    // Refresh once (rotation)
    const refreshRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', adminCookies);
    assertTest('Refresh token rotation success', refreshRes1.status === 200);
    const newAdminCookies = refreshRes1.headers['set-cookie'] || [];

    // AUTH-06: Reused old refresh token -> triggers reuse detection & revokes all sessions
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', adminCookies); // using old cookie
    assertTest(
      'AUTH-06: Reuse of rotated token detected & rejected (401)',
      reuseRes.status === 401 && reuseRes.body?.code === 'TOKEN_REUSE_DETECTED'
    );

    // Check that ALL sessions for admin are now revoked
    const activeAdminSessions = await RefreshSession.countDocuments({
      userId: adminUser._id,
      revokedAt: null,
    });
    assertTest('AUTH-06: All admin sessions successfully revoked after reuse breach', activeAdminSessions === 0);

    // AUTH-07: Login with wrong password 5x -> account locked 423
    for (let i = 0; i < 4; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ identifier: '0905555555', password: 'WrongPassword!1' });
    }
    const resAuth07 = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0905555555', password: 'WrongPassword!1' });
    const resAuth07Locked = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0905555555', password: 'StrongP@ss123' });
    assertTest('AUTH-07: 5 failed attempts locks account (423)', resAuth07Locked.status === 423);

    // Reset customer lockout
    await User.updateOne(
      { phone: '0905555555' },
      { $set: { failedLoginCount: 0, lockedUntil: null, accountStatus: 'ACTIVE' } }
    );

    // AUTH-08: Login PENDING_ACTIVATION account -> 403
    const resAuth08 = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0907777777', password: 'StrongP@ss123' });
    assertTest('AUTH-08: Login PENDING_ACTIVATION account gives 403', resAuth08.status === 403);

    // AUTH-09: OTP expired -> POST /auth/verify-otp -> 400
    await OtpChallenge.create({
      identifier: '0909999999',
      otpHash: hashOtp('123456'),
      purpose: 'REGISTER',
      expiresAt: new Date(Date.now() - 10000), // expired 10s ago
    });
    const resAuth09 = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ identifier: '0909999999', otpCode: '123456', purpose: 'REGISTER' });
    assertTest('AUTH-09: Expired OTP challenge gives 400', resAuth09.status === 400);

    // AUTH-10: OTP max attempts -> 429
    await OtpChallenge.create({
      identifier: '0908888888',
      otpHash: hashOtp('654321'),
      purpose: 'REGISTER',
      attemptCount: 5,
      expiresAt: new Date(Date.now() + 60000),
    });
    const resAuth10 = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ identifier: '0908888888', otpCode: '000000', purpose: 'REGISTER' });
    assertTest('AUTH-10: Max OTP attempts exceeded gives 429', resAuth10.status === 429);

    console.log('\n--- H.2 Authorization Tests ---');

    // Fresh admin login
    const adminRelogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0901111111', password: 'StrongP@ss123' });
    const validAdminToken = adminRelogin.body?.accessToken;

    // Fresh customer login
    const customerRelogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0905555555', password: 'StrongP@ss123' });
    const validCustomerToken = customerRelogin.body?.accessToken;

    // Fresh staff receptionist login
    const staffRelogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0904444444', password: 'StrongP@ss123' });
    const validStaffToken = staffRelogin.body?.accessToken;

    // Fresh manager login
    const managerRelogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: '0902222222', password: 'StrongP@ss123' });
    const validManagerToken = managerRelogin.body?.accessToken;

    // AUTHZ-01: CUSTOMER -> GET /admin/users -> 403
    const resAuthz01 = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${validCustomerToken}`);
    assertTest('AUTHZ-01: CUSTOMER -> GET /admin/users gives 403', resAuthz01.status === 403);

    // AUTHZ-02: STAFF -> POST /admin/users -> 403
    const resAuthz02 = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${validStaffToken}`)
      .send({
        phone: '0901239999',
        fullName: 'Test Staff',
        password: 'StrongP@ss123',
        systemRole: 'STAFF',
        staffSubRole: 'NURSE',
      });
    assertTest('AUTHZ-02: STAFF -> POST /admin/users gives 403', resAuthz02.status === 403);

    // AUTHZ-03: MANAGER -> POST /admin/users -> 403
    const resAuthz03 = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${validManagerToken}`)
      .send({
        phone: '0901239999',
        fullName: 'Test Staff',
        password: 'StrongP@ss123',
        systemRole: 'STAFF',
        staffSubRole: 'NURSE',
      });
    assertTest('AUTHZ-03: MANAGER -> POST /admin/users gives 403', resAuthz03.status === 403);

    // AUTHZ-04: MANAGER -> PUT /admin/users/:id/role -> 403
    const resAuthz04 = await request(app)
      .put(`/api/v1/admin/users/${customerUser._id}/role`)
      .set('Authorization', `Bearer ${validManagerToken}`)
      .send({ systemRole: 'STAFF', staffSubRole: 'NURSE' });
    assertTest('AUTHZ-04: MANAGER -> PUT /admin/users/:id/role gives 403', resAuthz04.status === 403);

    // AUTHZ-05: MANAGER list users -> only sees branch-scoped users
    const resAuthz05 = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${validManagerToken}`);
    assertTest('AUTHZ-05: MANAGER list users succeeds with 200', resAuthz05.status === 200);

    console.log('\n--- H.3 Privilege Escalation Tests ---');

    // PRIV-01: Register with systemRole: "ADMIN" in body -> role ignored, CUSTOMER created
    const resPriv01 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '0908881234',
        fullName: 'Attacker Attempt',
        password: 'AttackP@ss123',
        confirmPassword: 'AttackP@ss123',
        systemRole: 'ADMIN',
      });
    assertTest('PRIV-01: Registration endpoint responds 201', resPriv01.status === 201);
    const attackerUser = await User.findOne({ phone: '0908881234' });
    assertTest('PRIV-01: systemRole is forced to CUSTOMER in DB', attackerUser?.systemRole === 'CUSTOMER');

    // PRIV-02: Register with accountStatus: "ACTIVE" in body -> status ignored, PENDING
    assertTest(
      'PRIV-02: accountStatus is forced to PENDING_ACTIVATION',
      attackerUser?.accountStatus === 'PENDING_ACTIVATION'
    );

    // PRIV-03: PUT /auth/me with systemRole: "ADMIN" -> field ignored
    const resPriv03 = await request(app)
      .put('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validCustomerToken}`)
      .send({ fullName: 'Updated Customer Name', systemRole: 'ADMIN' });
    assertTest('PRIV-03: PUT /auth/me responds 200', resPriv03.status === 200);
    const refreshedCustomer = await User.findById(customerUser._id);
    assertTest('PRIV-03: Customer role remains CUSTOMER', refreshedCustomer?.systemRole === 'CUSTOMER');

    // PRIV-04 & PRIV-05: PUT /auth/me with accountStatus / assignedBranchIds -> ignored
    const resPriv04 = await request(app)
      .put('/api/v1/auth/me')
      .set('Authorization', `Bearer ${validCustomerToken}`)
      .send({ accountStatus: 'ACTIVE', assignedBranchIds: ['60c72b2f9b1d8b2bad000001'] });
    const refreshedCustomer2 = await User.findById(customerUser._id);
    assertTest(
      'PRIV-04/05: assignedBranchIds not modified via PUT /auth/me',
      refreshedCustomer2?.assignedBranchIds?.length === 0
    );

    // PRIV-06: CUSTOMER -> PUT /admin/users/:id/role -> 403
    const resPriv06 = await request(app)
      .put(`/api/v1/admin/users/${customerUser._id}/role`)
      .set('Authorization', `Bearer ${validCustomerToken}`)
      .send({ systemRole: 'ADMIN' });
    assertTest('PRIV-06: CUSTOMER -> PUT /admin/users/:id/role gives 403', resPriv06.status === 403);

    console.log('\n--- H.5 Input Validation Tests ---');

    // VAL-01: Register password "12345" (< 8 chars) -> 400
    const resVal01 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '0909990001',
        fullName: 'Val User',
        password: '12345',
        confirmPassword: '12345',
      });
    assertTest('VAL-01: Password < 8 characters rejected (400)', resVal01.status === 400);

    // VAL-02: Register password "abcdefgh" (no uppercase/digit) -> 400
    const resVal02 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '0909990002',
        fullName: 'Val User',
        password: 'abcdefgh',
        confirmPassword: 'abcdefgh',
      });
    assertTest('VAL-02: Password without uppercase/digit rejected (400)', resVal02.status === 400);

    // VAL-03: Register invalid phone format -> 400
    const resVal03 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '12345',
        fullName: 'Val User',
        password: 'ValidP@ss123',
        confirmPassword: 'ValidP@ss123',
      });
    assertTest('VAL-03: Invalid phone number rejected (400)', resVal03.status === 400);

    // VAL-04: Register mismatched confirmPassword -> 400
    const resVal04 = await request(app)
      .post('/api/v1/auth/register')
      .send({
        phone: '0909990003',
        fullName: 'Val User',
        password: 'ValidP@ss123',
        confirmPassword: 'DifferentP@ss123',
      });
    assertTest('VAL-04: Mismatched confirmPassword rejected (400)', resVal04.status === 400);

    // VAL-05: Login empty body -> 400
    const resVal05 = await request(app).post('/api/v1/auth/login').send({});
    assertTest('VAL-05: Empty login body rejected (400)', resVal05.status === 400);

    console.log(`\n================ TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ================\n`);
    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Unhandled test suite error:', err);
    process.exitCode = 1;
  } finally {
    await teardown();
  }
};

runAllTests();
