import petAPIService from '../src/services/petAPIService';
import prisma from '../src/configs/prisma';

async function test() {
  console.log('--- TESTING PET VALIDATIONS AND LOGIC ---');

  // 1. Get a test customer user
  const customer = await prisma.user.findFirst({
    where: { role: { role_code: 'CUSTOMER' } }
  });
  if (!customer) {
    console.error('No customer found in DB. Please seed the DB first.');
    return;
  }
  const userId = customer.user_id.toString();
  console.log(`Using Customer: ID ${userId}, Name: ${customer.full_name}`);

  // 2. Get species and breeds
  const speciesListRes = await petAPIService.getSpecies();
  const speciesList = speciesListRes.DT;
  if (!speciesList || speciesList.length < 2) {
    console.error('Not enough species in DB to test.');
    return;
  }

  // Find "Mèo" (Cat) and "Chó" (Dog) or just first two species
  const speciesCat = speciesList.find(s => s.species_name === 'Mèo') || speciesList[0];
  const speciesDog = speciesList.find(s => s.species_name === 'Chó') || speciesList[1];

  console.log(`Cat Species ID: ${speciesCat.species_id}, Dog Species ID: ${speciesDog.species_id}`);

  // Get breeds for Cat and Dog
  const catBreedsRes = await petAPIService.getBreedsBySpecies(speciesCat.species_id.toString());
  const dogBreedsRes = await petAPIService.getBreedsBySpecies(speciesDog.species_id.toString());

  const catBreed = catBreedsRes.DT[0];
  const dogBreed = dogBreedsRes.DT[0];

  if (!catBreed || !dogBreed) {
    console.error('Not enough breeds found in DB.');
    return;
  }

  console.log(`Cat Breed: ${catBreed.breed_name} (ID: ${catBreed.breed_id})`);
  console.log(`Dog Breed: ${dogBreed.breed_name} (ID: ${dogBreed.breed_id})`);

  // --- TEST CASE 1: Breed does not belong to Species ---
  console.log('\n--- TEST Case 1: Wrong Breed/Species Match ---');
  // species = Cat, breed = Dog breed
  const res1 = await petAPIService.createPet(userId, {
    pet_name: 'Test Wrong Match',
    species_id: speciesCat.species_id.toString(),
    breed_id: dogBreed.breed_id.toString()
  });
  console.log('Result (Expect Failure - Giống loài không phù hợp):');
  console.log('EC:', res1.EC, 'EM:', res1.EM);

  // --- TEST CASE 2: Negative Weight ---
  console.log('\n--- TEST Case 2: Negative Weight ---');
  const res2 = await petAPIService.createPet(userId, {
    pet_name: 'Test Negative Weight',
    species_id: speciesCat.species_id.toString(),
    breed_id: catBreed.breed_id.toString(),
    weight_kg: -2.5
  });
  console.log('Result (Expect Failure - Cân nặng phải là số dương):');
  console.log('EC:', res2.EC, 'EM:', res2.EM);

  // --- TEST CASE 3: Weight too large ---
  console.log('\n--- TEST Case 3: Weight too large ---');
  const res3 = await petAPIService.createPet(userId, {
    pet_name: 'Test Large Weight',
    species_id: speciesCat.species_id.toString(),
    breed_id: catBreed.breed_id.toString(),
    weight_kg: 350
  });
  console.log('Result (Expect Failure - Cân nặng không hợp lệ):');
  console.log('EC:', res3.EC, 'EM:', res3.EM);

  // --- TEST CASE 4: Future Birth Date ---
  console.log('\n--- TEST Case 4: Future Birth Date ---');
  const res4 = await petAPIService.createPet(userId, {
    pet_name: 'Test Future Birth Date',
    species_id: speciesCat.species_id.toString(),
    breed_id: catBreed.breed_id.toString(),
    birth_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // tomorrow
  });
  console.log('Result (Expect Failure - Ngày sinh không được lớn hơn ngày hiện tại):');
  console.log('EC:', res4.EC, 'EM:', res4.EM);

  // --- TEST CASE 5: Success Create Pet with Image ---
  console.log('\n--- TEST Case 5: Happy Path Create Pet with Image ---');
  const res5 = await petAPIService.createPet(userId, {
    pet_name: 'Lucky Test Pet',
    species_id: speciesCat.species_id.toString(),
    breed_id: catBreed.breed_id.toString(),
    gender: 'male',
    birth_date: '2024-05-15',
    age: '2 tuổi',
    weight_kg: 4.2,
    profile_image_url: 'https://example.com/lucky_avatar.jpg',
    health_status: 'healthy',
    medical_note: 'Initial note'
  });
  console.log('Result (Expect Success):');
  console.log('EC:', res5.EC, 'EM:', res5.EM);
  let createdPetId;
  if (res5.EC === 0) {
    createdPetId = res5.DT.pet_id;
    console.log('Created Pet ID:', createdPetId.toString());
    console.log('Created Pet Age in DB:', res5.DT.age);

    // Verify image in DB
    const imgInDb = await prisma.petImage.findMany({
      where: { pet_id: createdPetId }
    });
    console.log('Images for created pet in DB:', JSON.stringify(imgInDb, (k,v) => typeof v === 'bigint' ? v.toString() : v, 2));
  }

  // --- TEST CASE 5b: Success Create Pet with Age only (no birth_date) ---
  console.log('\n--- TEST Case 5b: Happy Path Create Pet with Age Only ---');
  const res5b = await petAPIService.createPet(userId, {
    pet_name: 'Kitty Age Only',
    species_id: speciesCat.species_id.toString(),
    breed_id: catBreed.breed_id.toString(),
    gender: 'female',
    age: '6 tháng',
    weight_kg: 1.5,
    health_status: 'healthy'
  });
  console.log('Result (Expect Success):');
  console.log('EC:', res5b.EC, 'EM:', res5b.EM);
  let createdPetId5b;
  if (res5b.EC === 0) {
    createdPetId5b = res5b.DT.pet_id;
    console.log('Created Pet 5b ID:', createdPetId5b.toString());
    console.log('Created Pet 5b Birth Date (expect null):', res5b.DT.birth_date);
    console.log('Created Pet 5b Age (expect "6 tháng"):', res5b.DT.age);
  }

  // --- TEST CASE 5c: Success Create Pet with Numeric Age (auto converted to string) ---
  console.log('\n--- TEST Case 5c: Happy Path Create Pet with Numeric Age ---');
  const res5c = await petAPIService.createPet(userId, {
    pet_name: 'Doggo Numeric Age',
    species_id: speciesDog.species_id.toString(),
    breed_id: dogBreed.breed_id.toString(),
    gender: 'male',
    age: 3, // numeric age
    weight_kg: 12.5,
    health_status: 'healthy'
  });
  console.log('Result (Expect Success):');
  console.log('EC:', res5c.EC, 'EM:', res5c.EM);
  let createdPetId5c;
  if (res5c.EC === 0) {
    createdPetId5c = res5c.DT.pet_id;
    console.log('Created Pet 5c ID:', createdPetId5c.toString());
    console.log('Created Pet 5c Age (expect "3" as string):', typeof res5c.DT.age, 'value:', res5c.DT.age);
  }

  if (!createdPetId) return;

  const mockAdminUser = {
    role_code: 'ADMIN',
    user_id: userId
  };

  // --- TEST CASE 6: Update Pet validation (Wrong Match) ---
  console.log('\n--- TEST Case 6: Update Pet wrong match ---');
  const res6 = await petAPIService.updatePet(createdPetId.toString(), {
    breed_id: dogBreed.breed_id.toString() // trying to set a dog breed on a cat pet
  }, mockAdminUser);
  console.log('Result (Expect Failure - Giống loài không phù hợp):');
  console.log('EC:', res6.EC, 'EM:', res6.EM);

  // --- TEST CASE 7: Update Pet with invalid weight ---
  console.log('\n--- TEST Case 7: Update Pet with invalid weight ---');
  const res7 = await petAPIService.updatePet(createdPetId.toString(), {
    weight_kg: -1.0
  }, mockAdminUser);
  console.log('Result (Expect Failure):');
  console.log('EC:', res7.EC, 'EM:', res7.EM);

  // --- TEST CASE 8: Update Pet with new image & age ---
  console.log('\n--- TEST Case 8: Update Pet with new image & age ---');
  const res8 = await petAPIService.updatePet(createdPetId.toString(), {
    profile_image_url: 'https://example.com/lucky_new_avatar.jpg',
    age: 4 // update with number
  }, mockAdminUser);
  console.log('Result (Expect Success):');
  console.log('EC:', res8.EC, 'EM:', res8.EM);
  if (res8.EC === 0) {
    console.log('Updated Pet Age in DB:', typeof res8.DT.age, 'value:', res8.DT.age); // expect "4"
    // Verify images in DB
    const images = await prisma.petImage.findMany({
      where: { pet_id: createdPetId },
      orderBy: { created_at: 'asc' }
    });
    console.log('Images list in DB after update:');
    images.forEach(img => {
      console.log(`- URL: ${img.image_url} | Primary: ${img.is_primary}`);
    });
  }

  // --- CLEAN UP: Delete the created pets and their images ---
  console.log('\n--- CLEAN UP ---');
  if (createdPetId) {
    await prisma.petImage.deleteMany({
      where: { pet_id: createdPetId }
    });
    await prisma.pet.delete({
      where: { pet_id: createdPetId }
    });
  }
  if (createdPetId5b) {
    await prisma.petImage.deleteMany({
      where: { pet_id: createdPetId5b }
    });
    await prisma.pet.delete({
      where: { pet_id: createdPetId5b }
    });
  }
  if (createdPetId5c) {
    await prisma.petImage.deleteMany({
      where: { pet_id: createdPetId5c }
    });
    await prisma.pet.delete({
      where: { pet_id: createdPetId5c }
    });
  }
  console.log('Cleanup completed successfully.');
}

test()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
