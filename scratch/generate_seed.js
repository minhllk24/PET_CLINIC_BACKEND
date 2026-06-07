const fs = require('fs');

const content = fs.readFileSync('C:/Users/Ly Le Minh/.gemini/antigravity-ide/brain/472a5c82-2bef-4833-804e-847172bbe3c7/.system_generated/steps/816/content.md', 'utf-8');

const jsonStart = content.indexOf('[{');
let jsonStr = content.substring(jsonStart);
const lastBrace = jsonStr.lastIndexOf('}');
jsonStr = jsonStr.substring(0, lastBrace + 1) + ']';

try {
  const products = JSON.parse(jsonStr);
  console.log(`Fetched \${products.length} products`);

  const categoryLimits = {
    'Thức ăn': 40,
    'Đồ dùng thiết yếu': 30,
    'Chăm sóc sức khỏe': 10,
    'Đồ chơi': 10,
    'Phụ kiện': 10
  };

  const categories = [
    { name: 'Thức ăn', image: 'https://cdn-icons-png.flaticon.com/512/3014/3014502.png', items: [], max: 40 },
    { name: 'Đồ dùng thiết yếu', image: 'https://cdn-icons-png.flaticon.com/512/815/815042.png', items: [], max: 30 },
    { name: 'Chăm sóc sức khỏe', image: 'https://cdn-icons-png.flaticon.com/512/2966/2966453.png', items: [], max: 10 },
    { name: 'Đồ chơi', image: 'https://cdn-icons-png.flaticon.com/512/2610/2610993.png', items: [], max: 10 },
    { name: 'Phụ kiện', image: 'https://cdn-icons-png.flaticon.com/512/3233/3233483.png', items: [], max: 10 }
  ];

  let currentCat = 0;
  for (const p of products) {
    if (!p.name || !p.prices) continue;
    const desc = p.description ? p.description.replace(/<[^>]*>?/gm, '').trim().substring(0, 500) + '...' : `Sản phẩm \${p.name} chất lượng cao, cung cấp đầy đủ nhu cầu cho thú cưng của bạn.`;
    const price = parseInt(p.prices.price) || (Math.floor(Math.random() * 20 + 5) * 10000);
    const image1 = p.images && p.images.length > 0 ? p.images[0].src : 'https://placehold.co/400x400';
    const image2 = p.images && p.images.length > 1 ? p.images[1].src : image1;

    // Find a category that isn't full
    let assigned = false;
    for (let i = 0; i < 5; i++) {
      let idx = (currentCat + i) % 5;
      if (categories[idx].items.length < categories[idx].max) {
        categories[idx].items.push({ name: p.name, description: desc, price: price, image1: image1, image2: image2 });
        currentCat = (idx + 1) % 5;
        assigned = true;
        break;
      }
    }
    if (!assigned) break; // All categories are full (reached 100)
  }

  let totalMapped = 0;
  categories.forEach(c => {
    console.log(c.name + ': ' + c.items.length + ' products');
    totalMapped += c.items.length;
  });
  console.log('Total mapped: ', totalMapped);

  // Read original seed.js
  let originalSeed = fs.readFileSync('d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/seed.js', 'utf-8');

  // Strip out old product section to replace it safely
  const section6Start = originalSeed.indexOf('// 6. Product Categories & Products');
  const section7Start = originalSeed.indexOf('// 7. Vouchers');

  if (section6Start === -1 || section7Start === -1) {
    console.log('Error: Could not find section markers in seed.js');
    process.exit(1);
  }

  const insertCode = `
  // 6. Product Categories & Products (100 products generated with weights)
  const seedData = ${JSON.stringify(categories.map(c => ({ name: c.name, image: c.image, items: c.items })), null, 2)};
  
  for (const catData of seedData) {
    let category = await prisma.productCategory.findFirst({ where: { category_name: catData.name } });
    if (!category) {
      category = await prisma.productCategory.create({
        data: {
          category_name: catData.name,
          image_url: catData.image,
          status: 'active'
        }
      });
    }

    for (const item of catData.items) {
      const existingProduct = await prisma.product.findFirst({ where: { product_name: item.name } });
      if (!existingProduct) {
        const basePrice = item.price;
        const originalPrice = basePrice + Math.floor(Math.random() * 5 + 1) * 20000;
        
        const product = await prisma.product.create({
          data: {
            product_category_id: category.product_category_id,
            product_name: item.name,
            description: item.description,
            price: basePrice,
            original_price: originalPrice,
            sold_quantity: Math.floor(Math.random() * 500),
            stock_quantity: Math.floor(Math.random() * 500 + 50),
            average_rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
            status: 'active'
          }
        });

        await prisma.productImage.createMany({
          data: [
            { product_id: product.product_id, image_url: item.image1, is_primary: true },
            { product_id: product.product_id, image_url: item.image2, is_primary: false }
          ]
        });

        await prisma.productVariant.createMany({
          data: [
            {
              product_id: product.product_id,
              variant_name: 'Mặc định',
              price: basePrice,
              original_price: originalPrice,
              stock_quantity: Math.floor(Math.random() * 100 + 20)
            },
            {
              product_id: product.product_id,
              variant_name: 'Đặc biệt',
              price: basePrice + 30000,
              original_price: originalPrice + 40000,
              stock_quantity: Math.floor(Math.random() * 50 + 10)
            }
          ]
        });
      }
    }
  }
`;

  const newSeed = originalSeed.substring(0, section6Start) + insertCode + "\\n  " + originalSeed.substring(section7Start);
  fs.writeFileSync('d:/A1. Lap Trinh Web/Group_Project_Pet_Clinic/PET_CLINIC_BACKEND/prisma/seed.js', newSeed);
  console.log('Successfully updated seed.js with 100 products!');

} catch (e) {
  console.error(e);
}
