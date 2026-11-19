const mongoose = require('../node_modules/mongoose');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/pet_clinic_dev');
  const db = mongoose.connection.db;

  const branches = [
    {
      id: new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91121'),
      name: 'Chi nhánh Quận 1',
      vets: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91129'), new mongoose.Types.ObjectId('6aec91a5fadcb390c7589267')],
      groomers: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c9112f'), new mongoose.Types.ObjectId('6aec91a7fadcb390c75892d0')],
      nurses: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c9112b')],
      receptionists: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c9112d')],
    },
    {
      id: new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91122'),
      name: 'Chi nhánh Quận 3',
      vets: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91131'), new mongoose.Types.ObjectId('6aec91a6fadcb390c758927c')],
      groomers: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91137'), new mongoose.Types.ObjectId('6aec91a8fadcb390c75892e5')],
      nurses: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91133')],
      receptionists: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91135')],
    },
    {
      id: new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91123'),
      name: 'Chi nhánh Bình Thạnh',
      vets: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c91139'), new mongoose.Types.ObjectId('6aec91a6fadcb390c7589291')],
      groomers: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c9113f'), new mongoose.Types.ObjectId('6aec91a8fadcb390c75892fa')],
      nurses: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c9113b'), new mongoose.Types.ObjectId('6aec91a9fadcb390c758930f')],
      receptionists: [new mongoose.Types.ObjectId('6ae15db11bb9b2b264c9113d')],
    },
  ];

  // Generate dates from 2026-11-19 through 2027-01-31 (74 days)
  const startDate = new Date('2026-11-19T00:00:00.000Z');
  const endDate = new Date('2027-01-31T00:00:00.000Z');

  const newShifts = [];
  const now = new Date();

  for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);

    for (const b of branches) {
      // Vet 1: Full morning to early afternoon (08:00 - 14:00)
      if (b.vets[0]) {
        newShifts.push({
          staffId: b.vets[0],
          branchId: b.id,
          startAt: new Date(`${dateStr}T08:00:00.000Z`),
          endAt: new Date(`${dateStr}T14:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      // Vet 2: Midday to closing (12:00 - 18:00)
      if (b.vets[1]) {
        newShifts.push({
          staffId: b.vets[1],
          branchId: b.id,
          startAt: new Date(`${dateStr}T12:00:00.000Z`),
          endAt: new Date(`${dateStr}T18:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Groomer 1: Full morning to early afternoon (08:00 - 14:00)
      if (b.groomers[0]) {
        newShifts.push({
          staffId: b.groomers[0],
          branchId: b.id,
          startAt: new Date(`${dateStr}T08:00:00.000Z`),
          endAt: new Date(`${dateStr}T14:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      // Groomer 2: Midday to closing (12:00 - 18:00)
      if (b.groomers[1]) {
        newShifts.push({
          staffId: b.groomers[1],
          branchId: b.id,
          startAt: new Date(`${dateStr}T12:00:00.000Z`),
          endAt: new Date(`${dateStr}T18:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Nurse 1: Full shift (08:00 - 18:00)
      if (b.nurses[0]) {
        newShifts.push({
          staffId: b.nurses[0],
          branchId: b.id,
          startAt: new Date(`${dateStr}T08:00:00.000Z`),
          endAt: new Date(`${dateStr}T18:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
      // Nurse 2 (if present, e.g. Bình Thạnh)
      if (b.nurses[1]) {
        newShifts.push({
          staffId: b.nurses[1],
          branchId: b.id,
          startAt: new Date(`${dateStr}T08:00:00.000Z`),
          endAt: new Date(`${dateStr}T18:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Receptionist: Full shift (08:00 - 18:00)
      if (b.receptionists[0]) {
        newShifts.push({
          staffId: b.receptionists[0],
          branchId: b.id,
          startAt: new Date(`${dateStr}T08:00:00.000Z`),
          endAt: new Date(`${dateStr}T18:00:00.000Z`),
          status: 'ACTIVE',
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  console.log(`Generated ${newShifts.length} shifts to insert across 3 branches from 2026-11-19 to 2027-01-31.`);

  // Remove any previously cancelled or stale test shifts in this range
  const delRes = await db.collection('shifts').deleteMany({
    startAt: { $gte: startDate }
  });
  console.log(`Cleaned up ${delRes.deletedCount} old/cancelled shifts from 2026-11-19 onwards.`);

  // Bulk insert new shifts
  const insertRes = await db.collection('shifts').insertMany(newShifts);
  console.log(`Successfully inserted ${insertRes.insertedCount} active shifts!`);

  await mongoose.disconnect();
}

main().catch(console.error);
