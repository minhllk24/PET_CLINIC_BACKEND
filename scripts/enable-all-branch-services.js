const mongoose = require('mongoose');
require('dotenv').config();

async function enableAllBranchServices() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Branch = mongoose.model('Branch', new mongoose.Schema({}, { strict: false }));
  const Service = mongoose.model('Service', new mongoose.Schema({}, { strict: false }));
  const BranchServiceConfig = mongoose.model('BranchServiceConfig', new mongoose.Schema({}, { strict: false }));

  const branches = await Branch.find({});
  const services = await Service.find({});

  console.log(`Found ${branches.length} branches and ${services.length} services.`);

  let updatedCount = 0;
  for (const b of branches) {
    for (const s of services) {
      await BranchServiceConfig.findOneAndUpdate(
        { branchId: b._id, serviceId: s._id },
        {
          $set: {
            branchId: b._id,
            serviceId: s._id,
            enabled: true,
            capacity: 3,
            availability: [],
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      updatedCount++;
    }
  }

  console.log(`Successfully enabled and updated ${updatedCount} BranchServiceConfig records to capacity=3, enabled=true.`);

  const disabledCount = await BranchServiceConfig.countDocuments({ enabled: false });
  console.log(`Disabled configs remaining: ${disabledCount}`);

  await mongoose.disconnect();
}

enableAllBranchServices().catch((err) => {
  console.error('Error enabling branch services:', err);
  process.exit(1);
});
