import contentAPIService from '../src/services/contentAPIService';

async function test() {
  console.log('--- TESTING FIRST AID SERVICES ---');

  // 1. Test Get Categories
  console.log('\n1. Testing getFirstAidCategories()...');
  const catsRes = await contentAPIService.getFirstAidCategories();
  console.log('Result Status:', catsRes.EM, 'EC:', catsRes.EC);
  if (catsRes.EC === 0) {
    console.log('Categories found:', catsRes.DT.map(c => `${c.first_aid_category_id}: ${c.category_name}`).join(', '));
  }

  // 2. Test Get All Guides with pagination
  console.log('\n2. Testing getFirstAidGuides({ page: 1, limit: 2 })...');
  const listRes = await contentAPIService.getFirstAidGuides({ page: 1, limit: 2 });
  console.log('Result Status:', listRes.EM, 'EC:', listRes.EC);
  if (listRes.EC === 0) {
    console.log('Total Rows:', listRes.DT.totalRows, 'Total Pages:', listRes.DT.totalPages);
    console.log('Guides on Page 1:');
    listRes.DT.guides.forEach(g => {
      console.log(`- [${g.category.category_name}] ${g.title} (Slug: ${g.slug})`);
    });
  }

  // 3. Test Get Guides by Search
  console.log('\n3. Testing getFirstAidGuides({ search: "mèo" })...');
  const searchRes = await contentAPIService.getFirstAidGuides({ search: 'mèo' });
  console.log('Result Status:', searchRes.EM, 'EC:', searchRes.EC);
  if (searchRes.EC === 0) {
    console.log('Guides matching "mèo":');
    searchRes.DT.guides.forEach(g => {
      console.log(`- ${g.title}`);
    });
  }

  // 4. Test Get Guide by Slug
  console.log('\n4. Testing getFirstAidGuideBySlug("so-cuu-khi-cho-bi-hoc-di-vat")...');
  const detailRes = await contentAPIService.getFirstAidGuideBySlug('so-cuu-khi-cho-bi-hoc-di-vat');
  console.log('Result Status:', detailRes.EM, 'EC:', detailRes.EC);
  if (detailRes.EC === 0) {
    const g = detailRes.DT;
    console.log(`Title: ${g.title}`);
    console.log(`Category: ${g.category.category_name}`);
    console.log(`Steps count: ${g.steps.length}`);
    g.steps.forEach(s => {
      console.log(`  Step ${s.step_number}: ${s.step_content.substring(0, 50)}...`);
    });
    console.log(`Media count: ${g.media.length}`);
  }
}

test()
  .catch(console.error);
