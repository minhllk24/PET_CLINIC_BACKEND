import branchAPIService from '../src/services/branchAPIService';

async function test() {
  console.log('--- TESTING BRANCHES API SERVICE ---');
  const res = await branchAPIService.getAllBranches();
  console.log('Result Status:', res.EM, 'EC:', res.EC);
  if (res.EC === 0) {
    console.log(`Successfully fetched ${res.DT.length} branches.`);
    console.log('Branches data:');
    res.DT.forEach(b => {
      console.log(`- ID: ${b.branch_id} | Name: ${b.branch_name}`);
      console.log(`  Address: ${b.address}`);
      console.log(`  Phone: ${b.phone}`);
      console.log(`  Hours: ${b.operating_hours}`);
      console.log(`  Lat: ${b.latitude} (${typeof b.latitude}) | Lng: ${b.longitude} (${typeof b.longitude})`);
    });
  }
}

test().catch(console.error);
