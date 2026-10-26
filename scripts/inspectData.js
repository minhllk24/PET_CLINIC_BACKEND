/* eslint-disable no-console */
// READ-ONLY diagnostic. Never writes to the database and never prints the connection string.
// Usage: npm run inspect:data
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const maskHost = (uri) => {
  const m = /@([^/?]+)/.exec(uri) || /\/\/([^/?]+)/.exec(uri);
  return m ? m[1] : 'unknown';
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set (check .env).');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;

  console.log('=== TARGET ===');
  console.log('host    :', maskHost(uri));
  console.log('database:', db.databaseName);

  console.log('\n=== COLLECTION COUNTS ===');
  const cols = (await db.listCollections().toArray()).map((c) => c.name).sort();
  for (const name of cols) {
    console.log(name.padEnd(28), await db.collection(name).countDocuments());
  }

  const has = (n) => cols.includes(n);

  if (has('branches')) {
    console.log('\n=== BRANCHES (code / _id / status) ===');
    const rows = await db.collection('branches').find({}, { projection: { code: 1, name: 1, status: 1 } }).toArray();
    rows.forEach((b) => console.log(b.code, String(b._id), b.status, '-', b.name));
  }

  if (has('users')) {
    console.log('\n=== USERS BY ROLE ===');
    const rows = await db.collection('users').aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]).toArray();
    rows.forEach((r) => console.log(String(r._id).padEnd(16), r.n));
  }

  const settingCol = cols.find((c) => /setting/i.test(c));
  if (settingCol) {
    console.log(`\n=== ${settingCol} ===`);
    const rows = await db.collection(settingCol).find({}).toArray();
    rows.forEach((s) => console.log(JSON.stringify(s)));
    const commerce = rows.find((s) => s.key === 'commerce' || s._id === 'commerce');
    console.log('commerce setting present:', Boolean(commerce));
  } else {
    console.log('\nNo settings collection found -> commerce.fulfillmentBranchPriority is NOT configured.');
  }

  if (has('vouchers')) {
    console.log('\n=== VOUCHERS (code / scope / usedCount / quota) ===');
    const rows = await db.collection('vouchers').find({}, { projection: { code: 1, scope: 1, usedCount: 1, quota: 1 } }).toArray();
    rows.forEach((v) => console.log(v.code, v.scope, v.usedCount, v.quota));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('inspect failed:', err.message);
  process.exit(1);
});
