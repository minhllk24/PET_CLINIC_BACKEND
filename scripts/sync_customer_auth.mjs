import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function updateCustomer() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pet_clinic_v2';
  await mongoose.connect(uri);
  const hash = await bcrypt.hash('K9#mQ$8xL!2vW*7z', 10);
  const updateRes = await mongoose.connection.collection('users').updateOne(
    { phone: '0905555555' },
    {
      $set: {
        passwordHash: hash,
        accountStatus: 'ACTIVE',
        lockedUntil: null,
        failedLoginCount: 0,
      },
    }
  );
  console.log('Update result:', updateRes);

  const user = await mongoose.connection.collection('users').findOne({ phone: '0905555555' });
  console.log('Verified user:', {
    username: user.username,
    phone: user.phone,
    accountStatus: user.accountStatus,
    addressesCount: user.addresses?.length,
  });

  await mongoose.disconnect();
}

updateCustomer().catch((e) => {
  console.error(e);
  process.exit(1);
});
