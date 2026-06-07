import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Roles
  const roles = [
    { role_code: 'ADMIN', role_name: 'Administrator', description: 'System Admin' },
    { role_code: 'STAFF', role_name: 'Staff', description: 'Clinic Staff' },
    { role_code: 'DOCTOR', role_name: 'Doctor', description: 'Veterinarian' },
    { role_code: 'CUSTOMER', role_name: 'Customer', description: 'Pet Owner' }
  ];
  
  for (const r of roles) {
    await prisma.role.upsert({
      where: { role_code: r.role_code },
      update: {},
      create: r,
    });
  }

  // 2. Users
  const passwordHash = await bcrypt.hash('12345678', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@petclinic.com' },
    update: {},
    create: {
      email: 'admin@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Admin',
      role: { connect: { role_code: 'ADMIN' } },
      status: 'active'
    }
  });

  const doctor1 = await prisma.user.upsert({
    where: { email: 'doctor1@petclinic.com' },
    update: {},
    create: {
      email: 'doctor1@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Dr. Nguyen Van A',
      role: { connect: { role_code: 'DOCTOR' } },
      status: 'active'
    }
  });

  const customer1 = await prisma.user.upsert({
    where: { email: 'customer1@petclinic.com' },
    update: {},
    create: {
      email: 'customer1@petclinic.com',
      password_hash: passwordHash,
      full_name: 'Khách hàng 1',
      phone: '0123456789',
      role: { connect: { role_code: 'CUSTOMER' } },
      status: 'active'
    }
  });

  // 3. Species & Breeds
  const catSpecies = await prisma.petSpecies.upsert({
    where: { species_name: 'Mèo' },
    update: {},
    create: { species_name: 'Mèo' }
  });

  await prisma.petBreed.createMany({
    data: [
      { species_id: catSpecies.species_id, breed_name: 'Mèo Anh Lông Ngắn' },
      { species_id: catSpecies.species_id, breed_name: 'Mèo Ba Tư' }
    ],
    skipDuplicates: true
  });

  // 4. Service Categories
  let serviceCat1 = await prisma.serviceCategory.findFirst({ where: { category_name: 'Khám bệnh' } });
  if (!serviceCat1) {
    serviceCat1 = await prisma.serviceCategory.create({
      data: { category_name: 'Khám bệnh', description: 'Các dịch vụ khám chữa bệnh' }
    });
  }

  // 5. Clinic Services
  // We can just ignore clinicService duplicate or upsert if there's a unique field
  // Actually clinicService has no unique field besides ID, so we skip it to prevent duplication
  const existingService = await prisma.service.findFirst({ where: { service_name: 'Khám tổng quát' } });
  if (!existingService) {
    await prisma.service.create({
      data: {
        service_category_id: serviceCat1.service_category_id,
        service_name: 'Khám tổng quát',
        base_price: 150000,
        duration_minutes: 30,
        status: 'active'
      }
    });
  }

  
  
  // 6. Product Categories & Products (100 products generated with weights)
  const seedData = [
  {
    "name": "Thức ăn",
    "image": "https://cdn-icons-png.flaticon.com/512/3014/3014502.png",
    "items": [
      {
        "name": "Dầu cá cho mèo WILD CAUGHT Omega-3 Fish Oil For Cats",
        "description": "Dầu cá cho mèo WILD CAUGHT Omega-3 Fish Oil For Cats là sản phẩm bổ sung omega-3 dạng lỏng dành cho mèo, hỗ trợ chăm sóc da, lông và sức khỏe tổng thể. Sản phẩm được chiết xuất từ nguồn dầu cá tự nhiên của các loài cá biển như anchovies, herring, mackerel và sardines được đánh bắt từ vùng biển lạnh, sạch gần Iceland. Thiết kế vòi pump tiện lợi giúp định lượng dễ dàng khi sử dụng mỗi ngày. Phù hợp cho nhiều giống mèo, từ mèo con đến mèo trưởng thành.\nLợi ích chính\nSản phẩm cung cấp nguồn omega-3 ...",
        "price": 283000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-meo-wild-caught-omega-3-fish-oil-for-cats1.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-meo-wild-caught-omega-3-fish-oil-for-cats2.jpg"
      },
      {
        "name": "Thức ăn cho chó con vị cá hồi JIREHO Salmon Puppy",
        "description": "Thức ăn cho chó con vị cá hồi JIREHO Salmon Puppy là giải pháp dinh dưỡng toàn diện đến từ Hàn Quốc, được thiết kế riêng cho chó dưới 1 tuổi. Với thành phần chính là cá hồi giàu Omega-3 và sự kết hợp từ thịt gà, sản phẩm mang đến nguồn năng lượng lành mạnh, hỗ trợ phát triển toàn diện về trí não, thể lực và hệ tiêu hóa cho bé cún.\nLợi ích chính\n\nCông thức đa protein từ cá hồi và thịt gà giúp tăng cường calo và hỗ trợ tăng trưởng nhanh.\nProbiotics và nấm men giúp cân bằng hệ vi sinh đường ruột, h...",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-con-vi-ca-hoi-jireho-salomon-puppy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-con-vi-ca-hoi-jireho-salomon-puppy2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ, cá bào nhật &#038; ức gà",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ, cá bào nhật &amp; ức gà Tuna, Bonito &amp; Chicken Breast dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ, cá bào nhật &amp; ức gà bao gồm Katsuo, cá ngừ, dầu đậu nành, chiết xuất Katsuo-bushi, Oligosaccharide, polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat-uc-ga.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat-uc-ga.jpg"
      },
      {
        "name": "Bánh thưởng cho chó BOWWOW Carrot Cheesee Ball",
        "description": "Bánh thưởng cho chó BOWWOW Carrot Cheesee Ball làm từ 100% phô mai nguyên chất và cà rốt, giàu protein và canxi, vitamin A, là món ăn nhẹ bổ dưỡng cho các chú chó, nhất là các chú chó con đang phát triển hệ cơ xương và chó mẹ cần phục hồi thể trạng sau khi sau con. Snack có thể dùng được cho cả chó và mèo.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nLà món ăn nhẹ tuyệt vời cho cả chó và mèo\nThành phần: Phô mai, cà rốt, tinh bột bắp, vitamin, khoáng chất\nGiảm tỷ lệ cholesterol xấu trong ...",
        "price": 70000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-carrot-cheesee-ball.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-carrot-cheesee-ball.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó BOWWOW Mixed Sandwich",
        "description": "Snack bánh thưởng cho chó BOWWOW Mixed Sandwich là bánh thưởng đã được các huấn luyện viên sử dụng để huấn luyện chó hiệu quả. Đây cũng là món ăn nhẹ bổ dưỡng cho các chú chó, nhất là chó con và chó mẹ sau khi sinh con cần bổ sung dinh dưỡng bên cạnh các món ăn thường ngày.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Gà, cá hồi, rau củ, phô mai, can-xi, rong biển nâu, lúa mì, xơ đậu tương (bánh đậu tương), axit ...",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bow-wow-mixed-sandwich.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bow-wow-mixed-sandwich.jpg"
      },
      {
        "name": "Dụng cụ ăn uống cho chó mèo PAW tự động đa năng",
        "description": "Dụng cụ ăn uống cho chó mèo PAW tự động đa năng là sản phẩm dành cho tất cả giống chó và mèo.\nLợi ích chính\n\nDụng cụ ăn uống cho chó mèo PAW tự động đa năng sang trọng với thiết kế 2 chức năng vô cùng tiện lợi cho thú cưng của bạn dùng để bảo quản thức ăn không bị ỉu hỏng giúp thú cưng ăn ngon miệng hơn\nBình nước uống có thể điều chỉnh cao thấp hợp lý với mọi giống chó mèo\nĐặc biệt chức năng cấp nước uống tự động chảy nước ra khi thú cưng uống hết nhằm đảm bảo giữ vệ sinh sạch sẽ cho nước uống\nB...",
        "price": 430000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2014/12/dung-cu-an-uong-cho-cho-meo-paw-tu-dong-da-nang.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2014/12/Dung-cu-an-uong-cho-cho-meo-tu-dong-da-nang1.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Peanut Butter",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Peanut Butter hương vị bơ đậu phộng dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Peanut Butter For Dog bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chún...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-peanut-butter.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-peanut-butter.jpg"
      },
      {
        "name": "Thức ăn cho chó hạt mềm vị cá hồi ORIGI-7 Salmon",
        "description": "Thức ăn cho chó hạt mềm vị cá hồi ORIGI-7 Salmon được làm từ cá hồi tươi, kết hợp với các nguyên liệu hữu cơ cao cấp, đảm bảo an toàn và giàu dinh dưỡng. Với công thức đặc biệt từ BOWWOW Hàn Quốc, ORIGI-7 không chỉ mang lại một bữa ăn thơm ngon mà còn giúp thú cưng phát triển toàn diện. Sản phẩm thích hợp cho mọi giống chó và mọi lứa tuổi, từ chó con đến chó trưởng thành.\nĐặc điểm nổi bật\n\nThành phần 100% thịt thật, 70% nguyên liệu hữu cơ, đạt tiêu chuẩn nghiêm ngặt.\nCông thức 7 FREE: KHÔNG bột ...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-ca-hoi-origi7-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-ca-hoi-origi7-salmon.jpg"
      },
      {
        "name": "Thức ăn cho chó con hạt mềm ZENITH Puppy Chicken Potato",
        "description": "Thức ăn cho chó con hạt mềm ZENITH Puppy Chicken &amp; Potato được chế biến từ các nguyên liệu tươi sạch như thịt cừu, thịt nạc gà rút xương, gạo lứt, yến mạch và dầu cá hồi, cung cấp độ ẩm cao và lượng muối thấp. Sản phẩm không chỉ thơm ngon, dễ nhai và dễ tiêu hóa mà còn đặc biệt tốt cho sức khỏe và sự phát triển của chó con dưới 1 tuổi.\nĐặc điểm nổi bật\n\nKhông chứa ngũ cốc, không gây dị ứng.\nThành phần chính từ thịt cừu, bột gà, gạo lứt và yến mạch.\nGiúp giảm mùi phân và mùi cơ thể, hỗ trợ ti...",
        "price": 240000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-puppy-chicken-potato.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-puppy-chicken-potato.jpg"
      },
      {
        "name": "Thức ăn cho chó hữu cơ NATURAL CORE Duck Potato Organic",
        "description": "Thức ăn cho chó hữu cơ NATURAL CORE Duck &amp; Potato Organic thịt vịt được chế biến từ các loại thịt tươi và các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt vịt astaxanthin, rau bina, khoai lang, các loại ngũ cốc hữu cơ… Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, ECO2 có tác dụng nổi bật với hệ tiêu hóa, làm giảm mệt mỏi cho đôi mắt chú chó.\n\nDành cho các giống chó thuộc mọi lứa tuổi, cân nặng\nTạo sự ngon miệng, tối đa hóa khả năng hấp thụ\nThành phần: thịt vịt astaxanthin, rau bi...",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-duck-potato-organic.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-duck-potato-organic2.jpg"
      },
      {
        "name": "Bộ vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Dental Trial Kit",
        "description": "Bộ vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Dental Trial Kit dành cho tất cả các giống chó mèo.\nLợi ích chính\nBộ vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Dental Trial Kit bao gồm gel và nước vệ sinh cho răng sạch và miệng khỏe mạnh. Chai gel chăm sóc răng miệng giúp loại bỏ mảng bám và cao răng. Nhỏ 2 giọt vào mỗi bên miệng của chó hàng ngày theo chỉ dẫn để thấy răng sạch hơn sau 30 ngày hoặc ít hơn. Giúp mang lại hơi thở thơm mát rõ rệt trong vòng 14 ngày hoặc ít hơn khi sử ...",
        "price": 195000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/bo-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-dental-trial-kit.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/bo-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-dental-trial-kit.jpg"
      },
      {
        "name": "Nước súc miệng hỗ trợ tiêu hóa cho chó TROPICLEAN Dental Health Digestive",
        "description": "Nước súc miệng hỗ trợ tiêu hóa cho chó TROPICLEAN Dental Health Digestive dành cho tất cả các giống chó.\nLợi ích chính\nNước súc miệng hỗ trợ tiêu hóa cho chó TROPICLEAN Dental Health Digestive bao gồm: nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoate, Axit béo Omega 3 và 6, chiết xuất từ ​​lá trà xanh giúp chăm sóc răng miệng cho thú cưng của bạn hiệu quả. Đó là một trong những vấn đề cần quan tâm khi nuôi chó mèo. Trên thực tế, 80% chó cưng bắt đầu...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-tieu-hoa-cho-cho-tropiclean-dental-health-digestive.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-tieu-hoa-cho-cho-tropiclean-dental-health-digestive.jpg"
      },
      {
        "name": "Nước súc miệng dưỡng lông cho chó TROPICLEAN Dental Skin Health",
        "description": "Nước súc miệng dưỡng lông cho chó TROPICLEAN Dental Skin Health dành cho tất cả các giống chó.\nLợi ích chính\nNước súc miệng dưỡng lông cho chó TROPICLEAN Dental Skin Health bao gồm: nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoate, Axit béo Omega 3 và 6, chiết xuất từ ​​lá trà xanh giúp chăm sóc răng miệng cho thú cưng của bạn hiệu quả. Đó là một trong những vấn đề cần quan tâm khi nuôi chó. Trên thực tế, 80% chó cưng bắt đầu có các dấu hiệu của bện...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-duong-long-cho-cho-tropiclean-dental-skin-health.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-duong-long-cho-cho-tropiclean-dental-skin-health.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó con TROPICLEAN Clean Teeth Gel Puppy",
        "description": "Gel vệ sinh răng miệng cho chó con TROPICLEAN Clean Teeth Gel Puppy phù hợp với những chú cho con 12 tuần tuổi trở lên.\nLợi ích chính\nGel vệ sinh răng miệng cho chó con TROPICLEAN Clean Teeth Gel Puppy với thành phần nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, bạc hà cay, chất tẩy rửa tự nhiên, Kẽm clorua (0,01g/10ml), chiết xuất lá trà xanh, chất diệp lục.\nChăm sóc răng miệng không chỉ là làm cho răng miệng của thú cưng sáng bóng, chắc chắn hơn mà nó là một thành phần quan trọ...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-con-tropiclean-clean-teeth-gel-puppy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-con-tropiclean-clean-teeth-gel-puppy.jpg"
      },
      {
        "name": "Dung dịch vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Drops",
        "description": "Dung dịch vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Drops for Dogs dành cho tất cả các giống chó.\nLợi ích chính\nDung dịch vệ sinh răng miệng cho chó TROPICLEAN Fresh Breath Drops for Dogs với các thành phần bao gồm nước tinh khiết, Glycerin, Cetylpyridinum Clorua, Kali Sorbate, Axit Citric, chiết xuất lá trà xanh, chất diệp lục giữ cho răng miệng của thú cưng của bạn luôn khỏe mạnh và hơi thở thơm tho. Được phát triển với các thành phần tự nhiên, Fresh Breath Drops giúp biến hơi thở có ...",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-drops-for-dogs-0.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-cho-tropiclean-fresh-breath-drops-for-dogs-1.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà và thanh cua",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà và thanh cua Chicken Breast &amp; Crab Sticks dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà và thanh cua bao gồm: Thịt gà (Sashimi), Kamaboko hương cua, tinh bột, Polysaccharide làm đặc, Vitamin E, chiết xuất trà xanh Protein thô &lt; 14,0%, chất béo thô &gt; 0,7%, chất xơ thô &lt; 0,1% trở xuống, hàm lượng tro thô từ &lt; 2,0% trở xuống, hàm lượng nước &lt; 83,0%, năng lượng 55 kcal/lon. Hạn sử dụng 3 năm kể từ ngày ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-thanh-cua.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-thanh-cua2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; cá ngần trắng",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; cá ngần trắng Tuna &amp; Small Whitebait dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; cá ngần trắng A-01C bao gồm cá ngừ, Shirasu, tinh bột, Polysaccharide làm đặc, Vitamin E, chiết xuất trà xanh&#8230; Thành phần phân tích đảm bảo Protein thô &gt; 13,0% trở lên, chất béo thô &gt; 0,5% trở lên, chất xơ thô &gt; 0,1%, hàm lượng tro thô &lt; 1,0% trở xuống, hàm lượng nước &lt; 85,0% trở xuống, năng lượng ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-ngan-trang.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-ngan-trang2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; thịt gà",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; thịt gà Tuna &amp; Chiken dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; thịt gà được làm từ các thành phần nguyên liệu tươi ngon từ tự nhiên.Thành phần chính bao gồm: Thịt gà, cá ngừ, Shirasu, chiết xuất cá ngừ, đường (Oligosaccharides), dầu và mỡ thực vật, chất làm đặc (tinh bột đã qua chế biến), khoáng chất, gia vị, Axit Amin, Polysaccharides làm đặc, Vitamin E, màu đỏ Sắc tố Koji, chiết xuất trà xanh,...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; cá bào nhật",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; cá bào nhật Tuna &amp; Bonito Flakes dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; cá bào nhật được làm từ các thành phần nguyên liệu tươi ngon từ tự nhiên.Thành phần chính bao gồm: Thịt gà, cá ngừ, Kamaboko hương cua, chiết xuất cá ngừ, đường (Oligosaccharides), dầu và mỡ thực vật, chất làm đặc (tinh bột đã qua chế biến), khoáng chất, gia vị, Axit Amin, Polysaccharides làm đặc, Vitamin E, màu đỏ Sắc tố ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-ca-bao-nhat.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Bonito Chicken",
        "description": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Bonito Chicken Wet Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Bonito Chicken Wet Cat Food bao gồm cá ngừ, thịt gà, muối, Taurine, Carrageenan. Phân tích thành phần Protein thô trên 7%, chất béo thô &gt; 1,5%, xơ thô &gt; 0,3%, tro thô &lt; 0,5%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-thit-ga-iris-bonito-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị gà và tôm IRIS OHYAMA Chicken Shrimp Soup",
        "description": "Súp thưởng cho mèo vị gà và tôm IRIS OHYAMA Chicken Shrimp Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\nLợi ích chính\n\nSúp thưởng cho mèo vị gà và tôm IRIS OHYAMA Chicken Shrimp Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 – 2 gói/ngày.\nĐối với mèo trưởng thành: 3 – 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ga-va-tom-iris-chicken-shrimp-soup1.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ga-va-tom-iris-chicken-shrimp-soup1.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị cá hồi IRIS OHYAMA Salmon Soup",
        "description": "Súp thưởng cho mèo vị cá hồi IRIS OHYAMA Salmon Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\nLợi ích chính\n\nSúp thưởng cho mèo vị cá hồi IRIS OHYAMA Salmon Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 &#8211; 2 gói/ngày.\nĐối với mèo trưởng thành: 3 &#8211; 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-hoi-iris-salmon-soup8.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-hoi-iris-salmon-soup8.jpg"
      },
      {
        "name": "Pate cho chó vị bò và rau IRIS OHYAMA HRBV375 Beef Vegetable",
        "description": "Pate cho chó vị bò và rau IRIS OHYAMA HRBV375 Beef Vegetable dành cho tất cả các giống chó. Bảo quản sản phẩm nơi khô ráo và thoáng mát. Thời hạn sử dụng 24 tháng kể từ ngày sản xuất.\nThành phần dinh dưỡng\nPate cho chó vị bò và rau IRIS OHYAMA HRBV375 Beef Vegetable bao gồm: gà, bò, cà rốt thái sợi, đậu nành xanh… Cung cấp đầy đủ dưỡng chất cho thú cưng trong mỗi bữa ăn.\nCách sử dụng\n\n\n\nTrọng lượng\nLượng ăn\n\n\n5 kg\n1 gói / ngày\n\n\n5-10 kg\n2 gói / ngày\n\n\n10-20 kg\n4 gói / ngày\n\n\n20-40 kg\n&gt; 4 gói ...",
        "price": 85000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-bo-va-rau-iris-hrbv375-beef-vegetable3.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-bo-va-rau-iris-hrbv375-beef-vegetable4.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và cua IRIS OHYAMA Tuna Crab",
        "description": "Pate cho mèo vị cá ngừ và cua IRIS OHYAMA Tuna Crab Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và cua IRIS OHYAMA Tuna Crab Cat Food bao gồm cá ngừ, thịt cua, Protein thực vật, Xylooligosaccharides, taurine. Phân tích thành phần: hơn 9% Protein, chất béo trên 1%, chất xơ thô dưới 0,5%. Độ ẩm dưới 82%.\nHạn sử dụng: 2 năm kể từ ngày sản xuất....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-cua-iris-tuna-crab.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-cua-iris-tuna-crab-cat-food1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ IRIS OHYAMA Tuna",
        "description": "Pate cho mèo vị cá ngừ IRIS OHYAMA Tuna Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ IRIS OHYAMA Tuna Cat Food bao gồm cá ngừ, Protein thực vật, Xylooligosaccharides, taurine. Phân tích thành phần: hơn 9% Protein, chất béo trên 1%, chất xơ thô dưới 0,5%. Độ ẩm dưới 82%.\nHạn sử dụng: 2 năm kể từ ngày sản xuất....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-iris-tuna.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-iris-tuna-cat-food1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và cá chub IRIS OHYAMA Tuna Chub",
        "description": "Pate cho mèo vị cá ngừ và cá chub IRIS OHYAMA Tuna Chub Wet Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và cá chub IRIS OHYAMA Tuna Chub Wet Cat Food bao gồm cá ngừ, cá chub họ nhà cá chép, Protein đậu nành, muối, taurine, cà rốt, carrageenan. Thành phần Protein thô  &gt; 7%, chất béo thô &lt; 2,5%, chất xơ thô &lt; 0,6% tro thô. Độ ẩm &lt; 1%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-ca-chub-iris-tunas-chub.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN5M",
        "description": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN5M phù hợp với tất cả các giống chó cỡ trung bình và lớn. Sản phẩm có 5 chiếc xương thơm ngon trong 1 túi.\nLợi ích chính\nXương canxi da bò cho chó vị sữa IRIS OHYAMA GN5M được làm bằng da bò, không có sản phẩm phụ từ da, không thêm chất màu. Tạo cảm giác ngon miệng và mùi thơm sữa tươi. Thành phần sữa, giúp răng chắc khỏe đồng thời có mùi thơm của sữa, lưu giữ hơi thở thơm mát. Đặc biệt hiệu quả ngăn chặn các mảng bám trên răng. Hạn sử dụng 16 tháng...",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-cho-vi-sua-iris-gn5m.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-iris.jpg"
      },
      {
        "name": "Pate cho mèo vị thịt trộn CATIDEA Variety Of Meat",
        "description": "Pate cho mèo vị thịt trộn CATIDEA Variety Of Meat dành cho tất cả các giống mèo, thích hợp cho mèo ở mọi lứa tuổi. Đặc biệt thích hợp cho mèo mẹ bầu, mèo con, mèo có vóc dáng còi cọc, đường ruột kém&#8230;\nThành phần dinh dưỡng\nPate cho mèo vị thịt trộn CATIDEA Variety Of Meat được làm từ các loại thịt tự nhiên: thịt bò, thịt gà, bí ngô, cà rốt và nguyên liệu thực vật....",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-thit-tron-catidea-variety-meat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-thit-tron-catidea-variety-of-meat1.jpg"
      },
      {
        "name": "Đồ chơi mèo bằng cói PAW hình chuột size XL",
        "description": "Đồ chơi mèo bằng cói PAW hình chuột size XL là bộ sản phẩm dành cho tất cả giống mèo.\nLợi ích chính\nĐồ chơi mèo bằng cói PAW hình chuột size XL với chất liệu bằng cói tự nhiên rất an toàn và không gây độc hại. Không những chỉ có tính năng làm đồ chơi, sản phẩm còn giúp mèo của bạn trở nên hoạt bát hơn, năng động hơn. Đồng thời còn có tác dụng để kích thích và định hướng mèo cào mài móng của mình, tránh làm hỏng hóc các đồ vật trong nhà. Đặc biệt nó còn gây tiếng động có tác dụng kích thích sự tò...",
        "price": 150000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-meo-bang-coi-paw-hinh-chuot-size-xl.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-meo-bang-coi-paw-hinh-chuot-size-xl.jpg"
      },
      {
        "name": "Dây dắt cho chó kèm xích đai ngực HAND IN HAND",
        "description": "Dây dắt cho chó kèm xích đai ngực HAND IN HAND là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nDây dắt cho chó kèm xích đai ngực HAND IN HAND được làm bằng sợi Polypropylene\nXích cương ngực cho phép kiểm soát tự nhiên hơn và thoải mái hơn cho chú chó\nĐược thiết kế phong cách đơn giản, dễ dàng và an toàn khi sử dụng\nXích cương ngực có lớp mềm làm giảm sự rụng lông của chó. Với khóa nhựa có tác động cao\nDây dắt cho chó kèm xích đai ngực có nhiều mầu sắc cho bạn chọn lựa\nChiều dài dây dắt là ...",
        "price": 100000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-xich-dai-nguc-hand-in-hand.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-xich-dai-nguc-hand-in-hand-1.jpg"
      },
      {
        "name": "Xương gặm cho chó Poodle VEGEBRAND 360 For Poodles Bone",
        "description": "Xương gặm cho chó Poodle VEGEBRAND 360 For Poodles Bone vị thịt vịt phù hợp với giống chó Poodle trong mọi giai đoạn phát triển.\nLợi ích chính\n\nXương gặm cho chó Poodle VEGEBRAND 360 For Poodles Bone với thành phần dinh dưỡng từ thiên nhiên không độc hại.\nCó thể bổ sung dinh dưỡng.\nNhai lâu tăng hiệu quả matxa răng.\nLoại bỏ mảng bám và cao răng.\nThúc đẩy hoạt động đường ruột, hỗ trợ tiêu hóa.\nXương gặm loại bỏ vị khác lạ ở miệng.\nCó thể làm đồ ăn để huấn luyện.\nHấp dẫn thú cưng, làm tinh thần th...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-gam-cho-cho-poodle-vegebrand-360-for-poodles-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-gam-cho-cho-poodle-vegebrand-360-for-poodles-bone.jpg"
      },
      {
        "name": "Xương cho chó gặm thơm miệng VEGEBRAND 360 Fresh Breath Bone",
        "description": "Xương cho chó gặm thơm miệng VEGEBRAND 360 Fresh Breath Bone thích hợp với: chó kích thước nhỏ, kích thước trung bình và kích thước lớn. Sử dụng: cho ăn trực tiếp, hoặc có thể dùng làm đồ ăn khi huấn luyện hoặc khen thưởng.\nLợi ích chính\n\nThiết kế hình lập thể: hình lập thể có lợi cho việc làm sạch răng, còn có hiệu quả loại bỏ mảng bám cứng đầu, làm sạch bộ phận nướu.\nXương cho chó thơm miệng BONE Fresh Breath với nguyên liệu tự nhiên: đặc biệt có thêm bột sữa, gluten, cám lúc mạch, với nguồn d...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-thom-mieng-vegebrad-360-fresh-breath-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-thom-mieng-vegebrad-360-fresh-breath-bone.jpg"
      },
      {
        "name": "Xương cho chó gặm vị thịt bò VEGEBRAND 360 Delicious Beef Bone",
        "description": "Xương cho chó gặm vị thịt bò VEGEBRAND 360 Delicious Beef Bone thích hợp với các giống chó có kích thước nhỏ, kích thước trung bình và kích thước lớn. Có thể sử dụng cho chó ăn trực tiếp, hoặc có thể dùng làm đồ ăn khi huấn luyện.\nLợi ích chính\n\nXương cho chó gặm vị thịt bò VEGEBRAND 360 Delicious Beef Bone có lợi cho việc làm sạch răng, còn có hiệu quả loại bỏ mảng bám cứng đầu, có thể thâm nhập vào bộ phận nướu, loại bỏ cao răng, có thể tiếp xúc được cả phần mặt trong của răng, loại bỏ những v...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-thit-bo-vegebrand-360-delicious-beef-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-thit-bo-vegebrand-360-delicious-beef-bone.jpg"
      },
      {
        "name": "Xương cho chó gặm vị sữa VEGEBRAND 360 Calcium Milk Bone",
        "description": "Xương cho chó gặm vị sữa VEGEBRAND 360 Calcium Milk Bone thích hợp với: chó kích thước nhỏ, kích thước trung bình và kích thước lớn. Sản phẩm giống như bánh thưởng cho chó, có thể sử dụng: cho ăn trực tiếp, hoặc có thể dùng làm đồ ăn khi huấn luyện hoặc khen thưởng.\nLợi ích chính\n\nVEGEBRAND 360 Calcium Milk Bone với thiết kế hình lập thể: hình lập thể có lợi cho việc làm sạch răng, còn có hiệu quả loại bỏ mảng bám cứng đầu, làm sạch bộ phận nướu.\nNguyên liệu tự nhiên: đặc biệt có thêm bột sữa, G...",
        "price": 50000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-sua-vegebrand-360-calcium-milk-bone.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/xuong-cho-cho-gam-vi-sua-vegebrand-360-calcium-milk-bone.jpg"
      },
      {
        "name": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-42",
        "description": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-42 được dùng cho tất cả giống chó. Cả bịch nguyên có 42 miếng.\nMiếng lót cho chó đi vệ sinh là một sản phẩm chất lượng cao được thiết kế đặc biệt để giúp cho việc vệ sinh cho thú cưng của bạn trở nên dễ dàng và thuận tiện hơn. Với các tính năng tiên tiến như chất liệu chống thấm, độ bền cao và khả năng hấp thụ mùi hôi, Miếng lót IRIS không chỉ giúp giữ cho không gian sống của bạn luôn sạch sẽ và khô ráo mà còn giúp giảm thiểu mùi hôi ...",
        "price": 10000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps-42.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps-42.jpg"
      },
      {
        "name": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-88",
        "description": "Miếng lót cho chó đi vệ sinh IRIS OHYAMA Clean Pet Sheets CPS-88 được dùng cho tất cả các giống chó. Cả bịch nguyên có 88 miếng.\nMiếng lót IRIS là một sản phẩm chất lượng cao được thiết kế đặc biệt để giúp cho việc vệ sinh cho chó trở nên dễ dàng hơn. Sản phẩm được làm từ vật liệu chất lượng, không gây kích ứng da và thân thiện với môi trường. Miếng lót này có khả năng thấm hút tối đa, giúp cho chất lỏng và mùi hôi không bị lan ra ngoài. Đặc biệt, sản phẩm có thiết kế chống tràn, giúp ngăn chặn ...",
        "price": 5000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps88.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/mieng-lot-cho-cho-di-ve-sinh-iris-clean-pet-sheets-cps88.jpg"
      },
      {
        "name": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình ốc sên",
        "description": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình ốc sên là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nĐồ chơi cho chó mèo bằng bông chút chít ELITE hình ốc sên hình rùa được sản xuất từ cao su mềm không gây độc hại cho thú cưng.\nLà món đồ giúp thú cưng ở trong nhà mà không cảm thấy nhàm chán khi bị bỏ lại một mình. Món đồ chơi đặc biệt dễ thương này không chỉ giúp chú chó giải trí mà còn bảo vệ những thứ quan trọng cho bạn như giày dép, bàn ghế, tủ…\nMàu sắc như thật, âm thanh chút chít...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-oc-sen.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-oc-sen.jpg"
      },
      {
        "name": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình gấu",
        "description": "Đồ chơi cho chó mèo bằng bông chút chít ELITE hình gấu là sản phẩm dành cho tất cả giống chó.\n\nLợi ích chính\n\nĐồ chơi cho chó mèo bằng bông chút chít ELITE hình gấu được sản xuất từ cao su mềm không gây độc hại cho thú cưng.\nLà món đồ giúp thú cưng ở trong nhà mà không cảm thấy nhàm chán khi bị bỏ lại một mình. Món đồ chơi đặc biệt dễ thương này không chỉ giúp chú chó giải trí mà còn bảo vệ những thứ quan trọng cho bạn như giày dép, bàn ghế, tủ…\nMàu sắc như thật, âm thanh chút chít đáng yêu sẽ k...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-gau.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/do-choi-cho-cho-meo-bang-bong-chut-chit-elite-hinh-gau.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ nguyên chất CAT SEA FISH Pure Tuna Meat",
        "description": "Pate cho mèo vị cá ngừ nguyên chất CAT SEA FISH Pure Tuna Meat là thức ăn dinh dưỡng cho mèo phù hợp với tất cả các giống và độ tuổi.\nLợi ích chính\nCAT SEA FISH Pure Tuna Meat là một sản phẩm cho sức khỏe. Với dưỡng chất Axit béo trong cá ngừ là các axit béo không bão hòa. Chứa đầy đủ các axit amin đối với cơ thể. Với 8 loại axit amin cần thiết, vitamin, chất sắt, kali, canxi, iốt và các nguyên tố vi lượng khác.\nCá ngừ chứa nhiều DHA. Nó là chất dinh dưỡng thiết yếu cho bộ não cũng như cho sự ph...",
        "price": 30000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-ngu-nguyen-chat-cat-sea-fish-pure-tuna-meat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-ngu-nguyen-chat-cat-sea-fish-pure-tuna-meat1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ cá cơm CAT SEA FISH Tuna Anchovy",
        "description": "Pate cho mèo vị cá ngừ cá cơm CAT SEA FISH Tuna Anchovy có giá trị dinh dưỡng cao. Phù hợp với tất cả các giống mèo.\nLợi ích chính\nTheo phân tích, một trăm gram CAT SEA FISH Tuna Anchovy có chứa 18-20,1g protein. Chất béo 5,0 g chất khoáng 2,0-2,5 gam. Ngoài ra, có VA, VE. Protein có chứa 16 loại axit amin cơ thể cần. Glutamate và glycine có trong giúp tạo nên hương vị cá cơm tươi ngon. Mỡ cá cơm chứa hai loại axit docosahexaenoic (DHA) và axit eicosapentaenoic (EPA). Cả hai loại axit béo không ...",
        "price": 30000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-com-cat-sea-fish-tuna-anchovy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2015/12/pate-cho-meo-vi-ca-ngu-ca-com-cat-sea-fish-tuna-anchovy.jpg"
      }
    ]
  },
  {
    "name": "Đồ dùng thiết yếu",
    "image": "https://cdn-icons-png.flaticon.com/512/815/815042.png",
    "items": [
      {
        "name": "Dầu cá cho chó WILD CAUGHT Omega-3 Fish Oil For Dogs",
        "description": "Dầu cá cho chó WILD CAUGHT Omega-3 Fish Oil For Dogs là sản phẩm bổ sung omega-3 dạng lỏng dành cho chó, hỗ trợ chăm sóc da, lông và sức khỏe tổng thể. Sản phẩm được chiết xuất từ nguồn dầu cá tự nhiên của các loài cá biển như anchovies, herring, mackerel và sardines. Thiết kế vòi pump tiện lợi giúp định lượng dễ dàng khi sử dụng hằng ngày. Phù hợp cho nhiều giống chó với kích cỡ và độ tuổi khác nhau.\nLợi ích chính\nSản phẩm giúp nuôi dưỡng làn da khỏe mạnh, hỗ trợ bộ lông mềm mượt và bóng đẹp hơ...",
        "price": 283000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-cho-wild-caught-omega-3-fish-oil-for-dogs1.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2026/03/dau-ca-cho-cho-wild-caught-omega-3-fish-oil-for-dogs2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà và cá bào nhật",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà và cá bào nhật Chicken Breast &amp; Bonito dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà và cá bào nhật bao gồm thịt gà, cá ngừ, sò điệp, dầu đậu nành, chiết xuất Katsuo-Bushi, Oligosaccharide, Polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống,...",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-ca-bao-nhat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-va-ca-bao-nhat.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ &#038; sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ &amp; sò điệp Tuna &amp; Scallop Flavor dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ &amp; sò điệp bao gồm Katsuo, cá ngừ, chiết xuất sò điệp, chiết xuất cá ngừ. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-so-diep.jpg"
      },
      {
        "name": "Bánh thưởng cho chó BOWWOW Cheddar Cheese Ball",
        "description": "Bánh thưởng cho chó BOWWOW Cheddar Cheese Ball làm từ 100% phô mai nguyên chất, giàu protein và canxi, là món ăn nhẹ bổ dưỡng cho các chú chó, nhất là các chú chó con đang phát triển hệ cơ xương và chó mẹ cần phục hồi thể trạng sau khi sau con. Snack có thể dùng được cho cả chó và mèo.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nLà món ăn nhẹ tuyệt vời cho cả chó và mèo\nThành phần: Phô mai, tinh bột bắp, vitamin, khoáng chất\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo ph...",
        "price": 70000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-cheddar-cheese-ball.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/bowwow-cheddar-cheese-ball.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Soft Chicken",
        "description": "Que bánh thưởng cho chó BOWWOW Soft Chicken được làm từ thịt gà rút xương, chứa nhiều protein, vitamin và khoáng chất, giúp chó tăng cường cơ bắp và chắc khỏe xương khớp. Sản phẩm có lượng chất béo, muối và calo thấp, không gây béo phì, tim mạch, sỏi thận. Đây là snack thơm ngon với thành phần dinh dưỡng tốt cho sức khỏe thú cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nThịt gà rút xương mùi thơm hấp dẫn, kích thích chó ăn ngon miệng\nThành phần: Thịt gà rút xương, bột thịt, bột cá, ...",
        "price": 65000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-soft-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-soft-chicken.jpg"
      },
      {
        "name": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Carrot Oat",
        "description": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Carrot Oat đóng hộp dạng mềm được kết hợp bởi các nguyên liệu tươi ngon như ức gà, yến mạch và cà rốt giúp bổ sung đầy đủ dinh dưỡng cho thú cưng.\nLợi ích chính\nPate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Carrot Oat cung cấp các nguyên liệu thô, cân bằng Protein, ít chất béo và đầy đủ dinh dưỡng&#8230; giúp giải phóng vị giác của cún cưng. Sản phẩm giàu năng lượng với tỷ lệ khoa học giúp duy trì sức khỏe của xương. Kết hợp nhiều loại rau quả gi...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang-chicken-carrot-oat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang1.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Vanilla Mint",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Vanilla Mint dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Vanilla Mint bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên thực tế, 70% mèo và 80% ...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-vanilla-mint.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-vanilla-mint.jpg"
      },
      {
        "name": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Pumpkin Carrot",
        "description": "Pate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Pumpkin Carrot đóng hộp dạng mềm được kết hợp bởi các nguyên liệu tươi ngon như ức gà, bí đỏ và cà rốt giúp bổ sung đầy đủ dinh dưỡng cho thú cưng.\nLợi ích chính\nPate cho chó trộn vị IRIS OHYAMA Aiwang Chicken Pumpkin Carrot cung cấp các nguyên liệu thô, cân bằng Protein, ít chất béo và đầy đủ dinh dưỡng&#8230; giúp giải phóng vị giác của cún cưng. Sản phẩm giàu năng lượng với tỷ lệ khoa học giúp duy trì sức khỏe của xương. Kết hợp nhiều loại rau q...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang-chicken-pumpkin-carrot.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-cho-tron-vi-iris-aiwang1.jpg"
      },
      {
        "name": "Sữa tắm khô cho mèo TROPICLEAN Berry &#038; Coconut Waterless",
        "description": "Sữa tắm khô cho mèo TROPICLEAN Berry &amp; Coconut Waterless Cat Shampoo dành cho tất cả các giống mèo.\nLợi ích ích\nSữa tắm khô cho mèo TROPICLEAN Berry &amp; Coconut Waterless Cat Shampoo với thành phần nước tinh khiết chất tẩy rửa dịu nhẹ, Protein thực vật thủy phân, chất trung hòa mùi. Hỗn hợp hữu cơ bao gồm chiết xuất mận trắng, chiết xuất dưa chuột, bột yến mạch Avena Sativa làm sạch triệt để và dưỡng ẩm cho lông và da. Đồng thời giúp bộ lông của thú cưng mềm mại, sạch sẽ và có mùi thơm bền...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-meo-tropiclean-berry-coconut-waterless-cat-shampoo.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-meo-tropiclean-berry-coconut-waterless-cat-shampoo.jpg"
      },
      {
        "name": "Thức ăn cho chó hữu cơ NATURAL CORE Lamb Potato Organic",
        "description": "Thức ăn cho chó hữu cơ NATURAL CORE Lamb &amp; Potato Organic thịt cừu được chế biến từ các loại thịt tươi và các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt Cừu, rau bina, các loại ngũ cốc hữu cơ. Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, ECO1 có tác dụng nổi bật với hệ tiêu hóa, da và lông chú chó.\n\nDành cho các giống chó thuộc mọi lứa tuổi, cân nặng\nThành phần: thịt Cừu, rau bina, khoai lang hữu cơ, các loại ngũ cốc hữu cơ\nTạo sự ngon miệng, tối đa hóa khả năng hấp thụ\nĐặc biệ...",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-lamb-potato-organic.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-lamb-potato-organic1.jpg"
      },
      {
        "name": "Nước súc miệng cho mèo TROPICLEAN Dental Health Solution",
        "description": "Nước súc miệng cho mèo TROPICLEAN Dental Health Solution For Cat dành cho tất cả các giống mèo.\nLợi ích chính\nNước súc miệng cho mèo TROPICLEAN Dental Health Solution bao gồm nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoate, Axit béo Omega 3 và 6, chiết xuất từ ​​lá trà xanh giúp chăm sóc răng miệng cho thú cưng của bạn hiệu quả. Đó là một trong những vấn đề cần quan tâm khi nuôi chó mèo. Trên thực tế, 70% mèo cưng bắt đầu có các dấu hiệu của bệnh r...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-cho-meo-tropiclean-dental-health-solution.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-cho-meo-tropiclean-dental-health-solution.jpg"
      },
      {
        "name": "Nước súc miệng hỗ trợ xương khớp cho chó TROPICLEAN Dental Health Hip Joint",
        "description": "Nước súc miệng hỗ trợ xương khớp cho chó TROPICLEAN Dental Health Hip Joint phù hợp với tất cả các giống chó.\nLợi ích chính\nNước súc miệng hỗ trợ xương khớp cho chó TROPICLEAN Dental Health Hip Joint với các thành phần nước tinh khiết, Axit citric, Cetylpyridinium Chloride, Chlorophyllin, Glycerin, Natri Benzoat, Glucosamine, chiết xuất lá trà xanh giúp chăm sóc sức khỏe răng miệng cho thú cưng vô cùng hiệu quả. Trên thực tế, 80% chó và 70% mèo bắt đầu có dấu hiệu của bệnh răng miệng khi tuổi lê...",
        "price": 360000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-xuong-khop-cho-cho-tropiclean-dental-health-hip-joint.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-suc-mieng-ho-tro-xuong-khop-cho-cho-tropiclean-dental-health-hip-joint.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho mèo TROPICLEAN Clean Teeth Gel Oral Care",
        "description": "Gel vệ sinh răng miệng cho mèo TROPICLEAN Clean Teeth Gel Oral Carel for Cats dành cho tất cả các giống mèo.\nLợi ích chính\nGel vệ sinh răng miệng cho mèo TROPICLEAN Clean Teeth Gel Oral Care bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên thực tế, 70% mèo bắt...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-meo-tropiclean-clean-teeth-gel-oral-care.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-meo-tropiclean-clean-teeth-gel-oral-care.jpg"
      },
      {
        "name": "Dung dịch vệ sinh răng miệng cho mèo TROPICLEAN Fresh Breath Drops",
        "description": "Dung dịch vệ sinh răng miệng cho mèo TROPICLEAN Fresh Breath Drops for Cats dành cho tất cả các giống mèo.\nLợi ích chính\nDung dịch vệ sinh răng miệng cho mèo TROPICLEAN Fresh Breath Drops for Cats bao gồm nước tinh khiết, Glycerin, Cetylpyridinum Clorua, Kali Sorbate, Axit Citric, chiết xuất lá trà xanh, chất diệp lục giữ cho miệng mèo của bạn khỏe mạnh và hơi thở thơm tho. Được phát triển với các thành phần tự nhiên, Fresh Breath DROPS for Cats giúp chứng hôi miệng của mèo trở nên thơm tho hơn....",
        "price": 250000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-meo-tropiclean-fresh-breath-drops-for-cats.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/dung-dich-ve-sinh-rang-mieng-cho-meo-tropiclean-fresh-breath-drops-for-cats-1.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ và mực biển",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ và mực biển Bonito &amp; Squid dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ và mực biểnbao gồm: Katsuo, Katsuo-bushi, đường (Oligosaccharides), chất béo và dầu thực vật, khoáng chất, Polysaccharide làm đặc, gia vị (Axit Amin), Vitamin E, chiết xuất trà xanh. Thành phần phân tích Protein thô &gt; 12,5%, chất béo thô &gt; 0,3%, chất xơ thô &lt; 0,1% trở xuống, hàm lượng tro thô &lt; 1,8% trở xuống, hàm lượng nước &lt...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-va-muc-bien.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-va-muc-bien2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà &#038; sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà &amp; sò điệp Chicken Breast &amp; Scallop dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà &amp; sò điệp bao gồm Katsuo, sò điệp, chiết xuất từ ​​vỏ sò, tinh bột, Polysaccharide làm đặc, chất làm đặc (tinh bột đã qua xử lý), Vitamin E, chiết xuất trà xanh. Thành phần phân tích bảo đảm Protein thô &gt; 13,5%, chất béo thô &gt; 0,3% , chất xơ thô &lt; 0,1%, hàm lượng tro thô &lt; 1,3% trở xuống, hàm lượng nước &lt; 85,0% ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-so-diep2.jpg"
      },
      {
        "name": "Máy sấy lông chó mèo chuyên dụng CHUNZHOU 2800w A22-2300",
        "description": "Máy sấy lông chó mèo chuyên dụng CHUNZHOU 2800w A22-2300 với vỏ ABS, công suất 2800W giúp làm khô lông chó mèo nhanh chóng.\nLợi ích chính\nMáy sấy lông chó mèo chuyên dụng CHUNZHOU 2800w A22-2300 với 3 ống thổi gió giúp điều chỉnh lượng gió phù hợp, làm khô lông chó mèo nhanh chóng qua từng lớp lông. Đặc biệt là những thú cưng có bộ lông dày. Phích cắm tiêu chuẩn 3 lỗ an toàn hơn và thuận tiện hơn khi sử dụng. Tốc độ gió đạt 65m/s. Nhiệt độ điều chỉnh ở 3 tốc độ, dễ dàng điều chỉnh tốc độ gió và ...",
        "price": 170000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/may-say-long-cho-meo-chuyen-dung-chunzhou-2800w-a22-2300.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/may-say-long-cho-meo-chuyen-dung-chunzhou-2800w-a22-2300-1.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ, thịt gà &#038; sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ, thịt gà &amp; sò điệp Tuna &amp; Chicken &amp; Scallop dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ, thịt gà &amp; sò điệp được làm từ các thành phần nguyên liệu tươi ngon từ tự nhiên.Thành phần chính bao gồm thịt cá ngừ, thịt sò, thêm thịt gà và các hương vị thơm ngon. Thành phần phân tích đảm bảo Protein thô &gt; 6,5%, chất béo thô &gt; 0,2% trở lên, chất xơ thô &lt; 0,1%, hàm lượng tro thô &lt; 1,0% trở xuống, ...",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-thit-ga-so-diep.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Tuna Chicken",
        "description": "Pate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Tuna Chicken Wet Cat Food dành co tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và thịt gà IRIS OHYAMA Tuna Chicken Wet Cat Food bao gồm cá ngừ, thịt gà, Protein đậu nành, muối, taurine, cà rốt, carrageenan. Thành phần Protein thô  &gt; 7%, chất béo thô &lt; 2,5%, chất xơ thô &lt; 0,6% tro thô. Độ ẩm &lt; 1%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-thit-ga-iris-tuna-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị cá thu IRIS OHYAMA Bonito Soup",
        "description": "Súp thưởng cho mèo vị cá thu IRIS OHYAMA Bonito Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\n\nLợi ích chính\n\nSúp thưởng cho mèo vị cá thu IRIS OHYAMA Bonito Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 – 2 gói/ngày.\nĐối với mèo trưởng thành: 3 – 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-thu-iris-bonito-soup.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-thu-iris-bonito-soup.jpg"
      },
      {
        "name": "Súp thưởng cho mèo vị cá ngừ IRIS OHYAMA Tuna Soup",
        "description": "Súp thưởng cho mèo vị cá ngừ IRIS OHYAMA Tuna Soup dành cho tất cả các giống mèo trên 3 tháng tuổi.\nLợi ích chính\n\nSúp thưởng cho mèo vị cá ngừ IRIS OHYAMA Tuna Soup có thể rút ngắn khoảng cách giữa bạn và thú cưng.\nCác loại thảo mộc và ngũ cốc hỗn hợp tạo nên món ăn vừa ngon vừa bổ.\nTạo sự ngon miệng và dễ tiêu hóa.\nCân bằng dinh dưỡng, tươi ngon mỗi ngày.\n\nCách sử dụng\n\nĐối với mèo con: 1 – 2 gói/ngày.\nĐối với mèo trưởng thành: 3 – 4 gói/ngày....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-ngu-iris-tuna-soup5.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sup-thuong-cho-meo-vi-ca-ngu-iris-tuna-soup5.jpg"
      },
      {
        "name": "Pate cho chó vị thịt bò IRIS OHYAMA HRB375 Beef",
        "description": "Pate cho chó vị thịt bò IRIS OHYAMA HRB375 Beef dành cho tất cả các giống chó. Bảo quản sản phẩm nơi khô ráo và thoáng mát. Thời hạn sử dụng 24 tháng kể từ ngày sản xuất.\nThành phần dinh dưỡng\nPate cho chó vị thịt bò IRIS OHYAMA HRB375 Beef bao gồm: thịt gà và thịt bò. Cung cấp đầy đủ dưỡng chất cho thú cưng trong mỗi bữa ăn.\nCách sử dụng\n\n\n\nTrọng lượng\nLượng ăn\n\n\n5 kg\n1 gói / ngày\n\n\n5-10 kg\n2 gói / ngày\n\n\n10-20 kg\n4 gói / ngày\n\n\n20-40 kg\n&gt; 4 gói / ngày...",
        "price": 85000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-thit-bo-iris-hrb375-beef3.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-thit-bo-iris-hrb375-beef4.jpg"
      },
      {
        "name": "Pate cho chó vị gà và rau IRIS OHYAMA HRCV375 Chicken Vegetable",
        "description": "Pate cho chó vị gà và rau IRIS OHYAMA HRCV375 Chicken Vegetable dành cho tất cả các giống chó. Bảo quản sản phẩm nơi khô ráo và thoáng mát. Thời hạn sử dụng 24 tháng kể từ ngày sản xuất.\nThành phần dinh dưỡng\nPate cho chó vị gà và rau IRIS OHYAMA HRCV375 Chicken Vegetable bao gồm: thịt gà, thịt bò, miếng cà rốt, đậu nành xanh&#8230; Cung cấp đầy đủ dưỡng chất cho thú cưng trong mỗi bữa ăn.\nCách sử dụng\n\n\n\nTrọng lượng\nLượng ăn\n\n\n5 kg\n1 gói / ngày\n\n\n5-10 kg\n2 gói / ngày\n\n\n10-20 kg\n4 gói / ngày\n\n\n2...",
        "price": 85000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-ga-va-rau-iris-hrcv375-chicken-vegetable6.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-cho-vi-ga-va-rau-iris-hrcv375-chicken-vegetable2.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ và gà IRIS OHYAMA Tuna Chicken",
        "description": "Pate cho mèo vị cá ngừ và gà IRIS OHYAMA Tuna Chicken Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ và gà IRIS OHYAMA Tuna Chicken Cat Food bao gồm cá ngừ, thịt gà, Protein thực vật, Xylooligosaccharides, taurine. Phân tích thành phần: hơn 9% Protein, chất béo trên 1%, chất xơ thô dưới 0,5%. Độ ẩm dưới 82%.\nHạn sử dụng: 2 năm kể từ ngày sản xuất....",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-ga-iris-tuna-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-va-ga-iris-tuna-chicken-cat-food1.jpg"
      },
      {
        "name": "Pate cho mèo vị cá ngừ IRIS OHYAMA Bonito Tuna",
        "description": "Pate cho mèo vị cá ngừ IRIS OHYAMA Bonito Tuna Cat Food dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nPate cho mèo vị cá ngừ IRIS OHYAMA Bonito Tuna Cat Food bao gồm: cá ngừ, muối, Taurine, Carrageenan. Phân tích thành phần Protein thô trên 7%, chất béo thô &gt; 1,5%, xơ thô &gt; 0,3%, tro thô &lt; 0,5%, độ ẩm &lt; 84%....",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-ca-ngu-iris-bonito-tuna.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-vi-iris2.jpg"
      },
      {
        "name": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN3L",
        "description": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN3L phù hợp với tất cả các giống chó cỡ lớn với 3 miếng xương thơm ngon trong 1 túi.\nLợi ích chính\nXương canxi da bò cho chó vị sữa IRIS OHYAMA GN3L được làm bằng da bò, không có sản phẩm phụ từ da, không thêm chất màu. Tạo cảm giác ngon miệng và mùi thơm sữa tươi. Thành phần sữa, giúp răng chắc khỏe đồng thời có mùi thơm của sữa, lưu giữ hơi thở thơm mát. Đặc biệt hiệu quả ngăn chặn các mảng bám trên răng. Hạn sử dụng 16 tháng....",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-cho-vi-sua-iris-gn3l.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-iris.jpg"
      },
      {
        "name": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN8S",
        "description": "Xương canxi da bò cho chó vị sữa IRIS OHYAMA GN8S phù hợp với tất cả các giống chó cỡ nhỏ, trung bình và lớn với 8 miếng xương nhỏ thơm ngon trong 1 túi.\nLợi ích chính\nXương canxi da bò cho chó vị sữa IRIS OHYAMA GN8S được làm bằng da bò, không có sản phẩm phụ từ da, không thêm chất màu. Tạo cảm giác ngon miệng và mùi thơm sữa tươi. Thành phần sữa, giúp răng chắc khỏe đồng thời có mùi thơm của sữa, lưu giữ hơi thở thơm mát. Đặc biệt hiệu quả ngăn chặn các mảng bám trên răng. Hạn sử dụng 16 tháng...",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-cho-vi-sua-iris-gn8s.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xuong-canxi-da-bo-cho-iris.jpg"
      },
      {
        "name": "Pate cho mèo mẹ và mèo con CATIDEA Mother &#038; Baby Cat",
        "description": "Pate cho mèo mẹ và mèo con CATIDEA Mother &amp; Baby Cat dành cho tất cả các giống mèo, mèo mẹ đang mang thai, đang cho con bú và mèo con.\nThành phần dinh dưỡng\nSản phẩm được làm từ nguyên liệu hoàn toàn tự nhiên. Bao gồm nhiều loại trái cây và rau củ. Không cho thêm ngũ cốc và tinh bột. Thành phần dinh dưỡng chính bao gồm: nước, thịt gà, cá ngừ, cá hồi, thịt bò, cà rốt, miền nam: dưa, cá tươi, cá mòi, dầu nành, Gelatin, Vitamin và khoáng chất, nước sốt, Choline Chloride.\nHướng dẫn sử dụng\nPate ...",
        "price": 30000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-me-va-meo-con-catidea-mother-baby-cat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/pate-cho-meo-me-va-meo-con-catidea-mother-baby-cat2.jpg"
      },
      {
        "name": "Dây dắt cho chó kèm vòng đeo cổ HAND IN HAND Plain Color Double Layers",
        "description": "Dây dắt cho chó kèm vòng đeo cổ HAND IN HAND Plain Color Double Layers là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nDây dắt cho chó kèm vòng đeo cổ HAND IN HAND Plain Color Double Layers được làm bằng chất liệu 100% nylon\nVới thiết kế mang phong cách truyền thống và cổ điển từ xích đeo cổ đến dây dắt\nTay nắm dây dắt và xích đeo cổ chó có lớp cao su tổng hợp làm cho chú chó cảm thấy thoải mái, không bị khó chịu\nBên cạnh đó, có mút mềm tránh ma sát cho thú cưng. Còn làm giảm sự rụng lông ...",
        "price": 200000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-vong-deo-co-hand-in-hand-plain-color-double-layers.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2018/12/day-dat-cho-cho-kem-vong-deo-co-hand-in-hand-plain-color-double-layers-3.jpg"
      },
      {
        "name": "Vòng cổ cho chó gắn chuông kèm dây dắt HAND IN HAND",
        "description": "Vòng cổ cho chó gắn chuông kèm dây dắt HAND IN HAND là sản phẩm dành cho tất cả giống chó.\nLợi ích chính\n\nVòng cổ cho chó gắn chuông kèm dây dắt HAND IN HAND được làm bằng chất liệu 100% nylon.\nVới thiết kế đơn giản mang phong cách cổ điển.\nDây có khóa nhựa an toàn dễ mở và khóa.\nSản phẩm không gây khó chịu cho chú chó khi mang chúng.\nVới chiếc chuông nhỏ tạo ra âm thanh chắc chắc sẽ làm thú cưng thích thú.\nVòng cổ cho chó gắn chuông kèm dây dắt có nhiều màu sắc đa dạng để bạn chọn lựa.\nKích thư...",
        "price": 130000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2018/12/vong-co-cho-cho-gan-chuong-kem-day-dat-hand-in-hand-0.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2018/12/vong-co-cho-cho-gan-chuong-kem-day-dat-hand-in-hand-4.jpg"
      }
    ]
  },
  {
    "name": "Chăm sóc sức khỏe",
    "image": "https://cdn-icons-png.flaticon.com/512/2966/2966453.png",
    "items": [
      {
        "name": "Thức ăn cho mèo con vị cá ngừ JIREHO Tuna Kitten",
        "description": "Thức ăn cho mèo con vị cá ngừ JIREHO Tuna Kitten là lựa chọn tối ưu cho giai đoạn phát triển đầu đời. Sản phẩm cung cấp nguồn đa dạng protein từ cá ngừ và thịt gà, giúp hỗ trợ quá trình tăng trưởng và phát triển toàn diện.\nLợi ích chính\n\nLợi khuẩn đường ruột và nấm men được bổ sung giúp cải thiện hệ tiêu hoá, đặc biệt phù hợp với mèo con có hệ tiêu hoá nhạy cảm.\nNgoài ra, vitamin và khoáng chất thiết yếu giúp củng cố sức đề kháng, hỗ trợ phát triển thị lực, da và lông khỏe mạnh.\n\nThành phần dinh...",
        "price": 55000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-con-vi-ca-ngu-jireho-tuna-kitten.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-con-vi-ca-ngu-jireho-tuna-kitten2.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà &amp; hương sò điệp",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà &amp; hương sò điệp Chicken Breast &amp; Scallop Flavor dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà &amp; hương sò điệp bao gồm thịt gà, cá ngừ, sò điệp, dầu đậu nành, chiết xuất Katsuo-Bushi, Oligosaccharide, Polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt...",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-huong-so-diep.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-huong-so-diep.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá ngừ nguyên chất",
        "description": "Nước sốt pate cho mèo CIAO vị cá ngừ nguyên chất Tuna Recipe dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá ngừ nguyên chất bao gồm Katsuo, cá ngừ, lưỡi dẹt, chiết xuất Katsuo-Bushi Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-nguyen-chat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-ngu-nguyen-chat.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Chicken",
        "description": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Chickencó thành phần chính là thịt gà và phô mai, giàu protein và dưỡng chất. Đây là món ăn nhẹ bổ dưỡng cho cả chó và mèo, nhất là chó con và chó mẹ sau khi sinh con. Hương vị thơm ngon, hấp dẫn, chứa lượng chất béo và muối thấp.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Phô mai, gà, cá, lúa mì, xơ đậu tương (bánh đậu tương), axit amin liên kết và những nguyên liệu...",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-chicken.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Soft Salmon",
        "description": "Que bánh thưởng cho chó BOWWOW Soft Salmon được làm từ cá hồi tươi, chứa nhiều vitamin và khoáng chất, đặc biệt là omega-3, taurine, giúp tăng thị lực và tăng khả năng học hỏi của thú cưng. Sản phẩm có lượng chất béo, muối và calo thấp, không gây béo phì, tim mạch, sỏi thận. Đây là snack thơm ngon với thành phần dinh dưỡng tốt cho sức khỏe thú cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nHương vị cá hồi hấp dẫn, kích thích chó ăn ngon miệng\nThành phần: Cá hồi tươi, bột thịt, bột đậ...",
        "price": 65000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/banh-thuong-cho-cho-bow-wow-soft-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/banh-thuong-cho-cho-bow-wow-soft-salmon.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Oral Care",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Oral Care for Dog dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Oral Care bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên thực tế, 70% mèo và 80...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-oral-care.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-oral-care.jpg"
      },
      {
        "name": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Berry Fresh",
        "description": "Gel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Berry Fresh For Dog hương vị quả mọng dành cho tất cả các giống chó.\nLợi ích chính\nGel vệ sinh răng miệng cho chó TROPICLEAN Clean Teeth Gel Berry Fresh bao gồm: nước tinh khiết, cồn chiết xuất tự nhiên, Glycerin, Carbomer, Kẽm clorua (0,01g/10ml), chất tẩy rửa tự nhiên, chất diệp lục. Việc chăm sóc răng miệng không chỉ là làm cho nụ cười của thú cưng của bạn trở nên đẹp hơn mà đó là một thành phần quan trọng của sức khỏe của chúng. Trên ...",
        "price": 325000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-berry-fresh.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/gel-ve-sinh-rang-mieng-cho-cho-tropiclean-clean-teeth-gel-berry-fresh.jpg"
      },
      {
        "name": "Xịt khử mùi hôi miệng cho chó TROPICLEAN Peanut Fresh Oral Care Spray",
        "description": "Xịt khử mùi hôi miệng chó TROPICLEAN Peanut Fresh Oral Care Spray mùi vị bơ đậu phộng dành cho tất cả các giống chó.\nLợi ích chính\nXịt khử mùi hôi miệng chó hương bơ đậu phộng TROPICLEAN Peanut Fresh Oral Care Spray bao gồm: nước tinh khiết, Glycerin, cồn chiết xuất tự nhiên, hương vị, Axit citric, chiết xuất lá trà xanh, kẽm clorua (0,01g/10ml), chất diệp lục. Hôi miệng có thể là một trong những dấu hiệu đầu tiên của bệnh răng miệng. Trên thực tế, 80% chó và 70% mèo có dấu hiệu mắc bệnh răng mi...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-bo-dau-phong-tropiclean-peanut-fresh-oral-care-spray.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-bo-dau-phong-tropiclean-peanut-fresh-oral-care-spray-1.png"
      },
      {
        "name": "Pate cho mèo vị cá ngừ IRIS OHYAMA Love Meow Tuna",
        "description": "Pate cho mèo vị cá ngừ IRIS OHYAMA Love Meow Tuna đóng hộp là thực phẩm ướt bổ sung đầy đủ các chất dinh dưỡng cho mèo cần thiết.\nLợi ích chính\nPate cho mèo vị cá ngừ IRIS OHYAMA Love Meow Tuna với hương vị tươi ngon không chứa phẩm màu, không chất hấp dẫn. Có thể sử dụng kết hợp ăn riêng hoặc trộn với thức ăn hạt. Tỷ lệ khoa học, dinh dưỡng cân bằng. Sản phẩm được sản xuất bởi nguyên liệu an toàn, cân bằng đạm cao, ít béo và đầy đủ dinh dưỡng. Kết hợp với nhiều loại rau giúp thúc đẩy sự thấp th...",
        "price": 25000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-meo-vi-ca-ngu-iris-love-meow-tuna.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2021/12/pate-cho-meo-vi-ca-ngu-iris-love-meow-tuna2.jpg"
      },
      {
        "name": "Xịt khử mùi hôi miệng cho chó TROPICLEAN Berry Fresh Oral Care Spray",
        "description": "Xịt khử mùi hôi miệng chó hương quả mọng TROPICLEAN Berry Fresh Oral Care Spray dành cho tất cả các giống chó.\nLợi ích chính\nXịt khử mùi hôi miệng chó hương quả mọng TROPICLEAN Berry Fresh Oral Care Spray bao gồm nước tinh khiết, Glycerin, cồn chiết xuất tự nhiên, hương vị, Axit citric, chiết xuất lá trà xanh, kẽm clorua (0,01g/10ml), chất diệp lục. Hôi miệng có thể là một trong những dấu hiệu đầu tiên của bệnh răng miệng. Trên thực tế, 80% chó và 70% mèo có dấu hiệu mắc bệnh răng miệng ở độ tuổ...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-qua-mong-tropiclean-berry-fresh-oral-care-spray.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-huong-qua-mong-tropiclean-berry-fresh-oral-care-spray-1.jpg"
      }
    ]
  },
  {
    "name": "Đồ chơi",
    "image": "https://cdn-icons-png.flaticon.com/512/2610/2610993.png",
    "items": [
      {
        "name": "Thức ăn cho mèo mọi lứa tuổi vị thịt gà JIREHO Chicken",
        "description": "Thức ăn cho mèo mọi lứa tuổi vị thịt gà JIREHO Chicken là giải pháp dinh dưỡng toàn diện dành cho mèo ở mọi lứa tuổi, hỗ trợ phát triển khỏe mạnh từ trong ra ngoài. Với nguồn thịt gà tươi ngon kết hợp cùng dầu cá, khoáng chất, lợi khuẩn và chiết xuất thảo mộc, sản phẩm mang đến bữa ăn vừa thơm ngon, vừa tốt cho hệ tiêu hóa, da lông và sức đề kháng.\nLợi ích chính\n\nJIREHO Chicken hỗ trợ tiêu hóa tối ưu nhờ probiotics và nấm men.\nDầu cá giàu Omega giúp lông mượt, da khỏe, tim mạch tốt.\nChiết xuất t...",
        "price": 110000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-moi-lua-tuoi-vi-thit-ga-jireho-chicken.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-meo-moi-lua-tuoi-vi-thit-ga-jireho-chicken.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị ức gà &amp; cá mòi",
        "description": "Nước sốt pate cho mèo CIAO vị ức gà &amp; cá mòi Chicken Breast &amp; Sardines  dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị ức gà &amp; cá mòi bao gồm Katsuo, cá ngừ, cá mòi, dầu đậu nành, chiết xuất Katsuo-Bushi, Oligosaccharide, Polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, kh...",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-ca-moi.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-uc-ga-ca-moi.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị cá bào nhật",
        "description": "Nước sốt pate cho mèo CIAO vị cá bào nhật Bonito Formula dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị cá bào nhật bao gồm thịt gà (sasami), cá ngừ, tinh bột, chiết xuất cá ngừ, chiết xuất hải sản, Polysaccharide làm dày, Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 35000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-bao-nhat.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-ca-bao-nhat.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Salmon",
        "description": "Snack bánh thưởng cho chó BOWWOW Cheese Roll Salmon có thành phần chính là cá hồi và phô mai, giàu protein và dưỡng chất. Đây là món ăn nhẹ bổ dưỡng cho cả chó và mèo, nhất là chó con và chó mẹ sau khi sinh con. Hương vị thơm ngon, hấp dẫn, chứa lượng chất béo và muối thấp.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Phô mai, gà, cá, lúa mì, xơ đậu tương (bánh đậu tương), axit amin liên kết và những nguyên liệu ...",
        "price": 60000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-bowwow-cheese-roll-salmon.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Stick Jerky Beef",
        "description": "Que bánh thưởng cho chó BOWWOW Stick Jerky Beef được làm từ thịt bò tươi Úc và New Zealand, chứa nhiều vitamin và khoáng chất, giúp hỗ trợ việc huấn luyện chó và nâng cao khả năng học hỏi của chó. Sản phẩm có dạng mềm, thơm ngon, có hàm lượng chất béo, muối và calo thấp.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nThành phần: thịt bò tươi từ Úc và New Zealand, cá ngừ, bột mì, bột đậu nành, gia vị, vitamin, khoáng chất\nHương vị bò sấy thơm ngon\nChứa nhiều vitamin và khoáng chất\nĐược sản ...",
        "price": 40000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-stick-jerky-beef.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bow-wow-stick-jerky-beef.jpg"
      },
      {
        "name": "Cát vệ sinh hữu cơ cho mèo CATS BEST Original",
        "description": "Cát vệ sinh hữu cơ cho mèo CATS BEST Original vón cục, thấm hút chất lỏng gấp 7 lần thể tích cát, khóa chặt mùi hôi và vi khuẩn trong một thời gian dài nhờ hệ thống mao dẫn của sợi cây, giải pháp tiết kiệm và an toàn cho cả người, mèo và môi trường.\n\nĐược làm từ 100% cây hữu cơ thiên nhiên, có hương thơm tự nhiên của gỗ\nCực kỳ tiết kiệm, sau khi xúc bỏ phần cát chứa chất thải, phần cát còn lại có thể dùng tiếp trong 5-7 tuần\nVón cục, thấm hút lượng chất lỏng lớn gấp 7 lần thể tích của hạt\nKhử mù...",
        "price": 140000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-original.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-original.jpg"
      },
      {
        "name": "Thức ăn cho chó hạt mềm vị thịt cừu ORIGI-7 Lamb",
        "description": "Thức ăn cho chó hạt mềm vị thịt cừu ORIGI-7 Lamb được làm từ thịt cừu Úc tươi ngon, kết hợp với các nguyên liệu hữu cơ cao cấp, mang lại dinh dưỡng cân bằng và an toàn cho thú cưng. Với công thức độc quyền từ nhà máy BOWWOW Hàn Quốc, sản phẩm không chỉ thơm ngon mà còn hỗ trợ sự phát triển toàn diện cho mọi giống chó ở mọi độ tuổi, từ chó con đến chó trưởng thành.\nĐặc điểm nổi bật\n\nThành phần 100% thịt thật, 70% nguyên liệu hữu cơ, đảm bảo tiêu chuẩn nghiêm ngặt.\nCông thức 7 FREE: KHÔNG bột thịt...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-cuu-origi-7-lamb.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-cuu-origi-7-lamb.jpg"
      },
      {
        "name": "Thức ăn cho chó lớn hạt mềm ZENITH Adult Lamb Potato",
        "description": "Thức ăn cho chó lớn hạt mềm ZENITH Adult Lamb Potato được chế biến từ các thành phần giàu dinh dưỡng như thịt cừu tươi, thịt nạc gà rút xương, gạo lứt, yến mạch và dầu cá hồi. Sản phẩm cung cấp độ ẩm cao, ít muối, hạt mềm dễ nhai và dễ tiêu hóa, đặc biệt tốt cho sức khỏe và phát triển của chó trưởng thành trên 1 tuổi.\nĐặc điểm nổi bật\n\nKhông chứa ngũ cốc, không gây dị ứng.\nGiúp xương khớp chắc khỏe, phòng ngừa loãng xương.\nGiảm mùi phân và mùi cơ thể, duy trì vóc dáng cân đối và đốt cháy mỡ thừa...",
        "price": 240000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-adult-lamb-potato.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/zenith-adult-lamb-potato.jpg"
      },
      {
        "name": "Thức ăn cho mèo hữu cơ NATURAL CORE Multi Protein Organic",
        "description": "Thức ăn cho mèo hữu cơ NATURAL CORE Multi Protein Organic được chế biến từ thịt gà, thịt cá hồi, thịt vịt rút xương, hồng sâm… với 95% thành phần hữu cơ và 5% khoáng chất vô cơ tốt cho sức khỏe mèo, phù hợp với mọi lứa tuổi, mọi giống mèo. Được chứng nhận hữu cơ ECOCERT, sản phẩm có tác dụng làm đẹp da, đẹp lông, tối đa hóa khả năng hấp thụ, giảm thiểu mùi phân, trị búi lông.\n\nĐược chế biến từ thịt gà, thịt cá hồi, thịt vịt rút xương, hồng sâm…\n95% nguyên liệu hữu cơ và 5% là vitamin và khoáng c...",
        "price": 340000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-meo-huu-co-natural-core-multi-protein-organic.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-meo-huu-co-natural-core-multi-protein-organic1.jpg"
      },
      {
        "name": "Thức ăn cho chó con hữu cơ NATURAL CORE Lamb Puppy",
        "description": "Thức ăn cho chó con hữu cơ NATURAL CORE Lamb Puppy thịt cừu được chế biến từ các loại thịt tươi và các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt cừu Úc và thịt nạc gà hữu cơ, khoai lang hữu cơ và ngũ cốc. Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, ECO5a có tác dụng nổi bật trong việc hỗ trợ sự phát triển của chó con.\n\nDành cho chó con dưới 1 tuổi, chó mẹ đang mang thai và cho con bú\nThành phần: thịt cừu Úc và thịt nạc gà hữu cơ, khoai lang hữu cơ và ngũ cốc\nKhông chứa thành phần...",
        "price": 290000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-con-huu-co-natural-core-lamb-puppy.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-con-huu-co-natural-core-lamb-puppy1.jpg"
      }
    ]
  },
  {
    "name": "Phụ kiện",
    "image": "https://cdn-icons-png.flaticon.com/512/3233/3233483.png",
    "items": [
      {
        "name": "Thức ăn cho chó mọi lứa tuổi vị thịt vịt JIREHO Duck",
        "description": "Thức ăn cho chó mọi lứa tuổi vị thịt vịt JIREHO Duck là dòng sản phẩm cao cấp phù hợp cho chó ở mọi độ tuổi, từ cún con đến chó trưởng thành. Với công thức kết hợp giữa thịt vịt, rau củ hữu cơ và thảo mộc tự nhiên, sản phẩm giúp thú cưng phát triển khỏe mạnh toàn diện, tăng sức đề kháng và duy trì vóc dáng lý tưởng.\nLợi ích chính\n\nJIREHO Duck hỗ trợ tiêu hóa nhờ probiotics và nấm men giàu vitamin B tổng hợp.\nRau củ hữu cơ giúp tăng lượng chất xơ, cải thiện tình trạng táo bón.\nChiết xuất thảo mộc...",
        "price": 145000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-moi-lua-tuoi-vi-thit-vit-jireho-duck.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2025/04/thuc-an-cho-cho-moi-lua-tuoi-vi-thit-vit-jireho-duck.jpg"
      },
      {
        "name": "Nước sốt pate cho mèo CIAO vị thịt gà và cá ngừ",
        "description": "Nước sốt pate cho mèo CIAO vị thịt gà và cá ngừ Chicken &amp; Tuna dành cho tất cả các giống mèo.\nThành phần dinh dưỡng\nNước sốt pate cho mèo CIAO vị thịt gà và cá ngừ bao gồm Katsuo, cá ngừ, dầu đậu nành, chiết xuất Katsuo-bushi, Oligosaccharide, polysaccharide làm dày. Vitamin E, Taurine, chiết xuất trà xanh. Thành phần phân tích đảm bảo chất đạm &gt; 9,0%, chất béo &lt; 0,4% trở lên, chất xơ thô &lt;  0,1%, hàm lượng tro &lt; 2,0%, hàm lượng nước &lt; 89,0% trở xuống, khoảng 35 kcal/miếng....",
        "price": 37000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-thit-ga-va-ca-ngu.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/nuoc-sot-pate-cho-meo-ciao-vi-thit-ga-va-ca-ngu.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó hỗn hợp BOWWOW Jerky Mix",
        "description": "Que bánh thưởng cho chó hỗn hợp BOWWOW Jerky Mix có thành phần chính là thịt gà, cá hồi, phô mai và các loại rau củ quả: rau chân vịt, cà rốt, chuối, là món ăn nhẹ bổ dưỡng, giàu vitamin và khoáng chất, đặc biệt là những chú chó ít ăn rau hoặc bị thừa cân, béo phì. Snack có thể dùng được cho cả cún cưng và mèo cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Thịt gà, cá hồi, phô mai, rau chân vịt, cà rốt, chuối...",
        "price": 115000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-jerky-mix.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-jerky-mix.jpg"
      },
      {
        "name": "Snack bánh thưởng cho chó hỗn hợp BOWWOW Mix",
        "description": "Snack bánh thưởng cho chó hỗn hợp BOWWOW Mix với thành phần chính là thịt gà và cá hồi, là món ăn nhẹ bổ dưỡng, giàu protein và khoáng chất dành cho các chú chó, giúp bổ sung dinh dưỡng thiết yếu cho chó con đang phát triển và chó mẹ biếng ăn sau khi sinh con. Snack được cả cún cưng và mèo cưng ưa chuộng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nGiảm tỷ lệ cholesterol xấu trong huyết thanh, ngăn ngừa béo phì\nThành phần: Gà, cá hồi, rau, phô mai, can-xi, tảo biển (rong biển nâu), lúa ...",
        "price": 65000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-hon-hop-bowwowmix.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/snack-banh-thuong-cho-cho-hon-hop-bowwowmix.jpg"
      },
      {
        "name": "Que bánh thưởng cho chó BOWWOW Stick Jerky Lamd",
        "description": "Que bánh thưởng cho chó BOWWOW Stick Jerky Lamd được làm từ thịt cừu tươi Úc, chứa nhiều vitamin và khoáng chất, giúp tăng khả năng học hỏi của thú cưng. Sản phẩm có lượng chất béo, muối và calo thấp, không gây béo phì, tim mạch, sỏi thận. Đây là snack thơm ngon với thành phần dinh dưỡng tốt cho sức khỏe thú cưng.\n\nDành cho mọi giống chó thuộc mọi lứa tuổi, cân nặng\nHương vị cừu sấy thơm ngon\nThành phần: Thịt cừu tươi (Úc, New Zealand), cá ngừ, bột mì, bột đậu nành, gia vị, vitamin, khoáng chất\n...",
        "price": 40000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-stick-jerky-lamd.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/que-banh-thuong-cho-cho-bowwow-stick-jerky-lamd.jpg"
      },
      {
        "name": "Cát vệ sinh hữu cơ cho mèo CATS BEST Smart Peppets",
        "description": "Cát vệ sinh hữu cơ cho mèo CATS BEST Smart Peppets có dạng những viên nén &#8220;thông minh&#8221;, giúp hạn chế bám dính vào lông mèo gây vương vãi ra ngoài, đặc biệt phù hợp với mèo lông dài. Cát vón cục, thấm hút lượng chất lỏng gấp 7 lần thể tích cát.\n\nCó hình viên nén lớn, không dính lông mèo, ít vấy bẩn, lý tưởng cho mèo lông dài\nCực kỳ tiết kiệm, sau khi xúc bỏ phần cát chứa chất thải, phần cát còn lại có thể dùng tiếp trong 5-7 tuần\nVón cục, thấm hút lượng chất lỏng lớn hơn 700% lần thể ...",
        "price": 155000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-smart-peppets.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/cats-best-smart-peppets.jpg"
      },
      {
        "name": "Thức ăn cho chó hạt mềm vị thịt bò ORIGI-7 Beef",
        "description": "Thức ăn cho chó hạt mềm vị thịt bò ORIGI-7 Beef được làm từ thịt bò tươi ngon, kết hợp cùng các nguyên liệu hữu cơ cao cấp, đảm bảo an toàn và giàu dinh dưỡng. Với công thức đặc biệt từ nhà máy BOWWOW Hàn Quốc, ORIGI-7 không chỉ mang lại hương vị đậm đà mà còn giúp thú cưng phát triển toàn diện. Sản phẩm phù hợp cho mọi giống chó và mọi lứa tuổi, từ chó con đến chó trưởng thành.\nĐặc điểm nổi bật\n\nThành phần 100% thịt thật, 70% nguyên liệu hữu cơ, đảm bảo tiêu chuẩn nghiêm ngặt.\nCông thức 7 FREE:...",
        "price": 95000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-bo-origi-7-beef.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-hat-mem-vi-thit-bo-origi-7-beef.jpg"
      },
      {
        "name": "Sữa tắm khô cho chó TROPICLEAN Berry &#038; Coconut Waterless",
        "description": "Sữa tắm khô cho chó TROPICLEAN Berry &amp; Coconut Waterless Dog Shampoo dành cho tất cả các giống chó.\nLợi ích chính\nSữa tắm khô cho chó TROPICLEAN Waterless Dog Shampoo với thành phần nước tinh khiết chất tẩy rửa dịu nhẹ, Protein thực vật thủy phân, chất trung hòa mùi. Hỗn hợp hữu cơ bao gồm chiết xuất mận trắng, chiết xuất dưa chuột, bột yến mạch Avena Sativa làm sạch triệt để và dưỡng ẩm cho lông và da. Đồng thời giúp bộ lông của thú cưng mềm mại, sạch sẽ và có mùi thơm bền lâu. Các thành ph...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-cho-tropiclean-berry-coconut-waterless-dog-shampoo.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/sua-tam-kho-cho-cho-tropiclean-berry-coconut-waterless-dog-shampoo.jpg"
      },
      {
        "name": "Thức ăn cho chó hữu cơ NATURAL CORE Multi Protein Chicken Salmon",
        "description": "Thức ăn cho chó hữu cơ NATURAL CORE Multi Protein Chicken Salmon (Natural Core Bene M50) được chế biến từ các nguyên liệu được chứng nhận hữu cơ ECOCERT: thịt gà rút xương không chứa kháng sinh, thịt cá tươi, khoai tây, cà rốt, đậu, rau bina hữu cơ, hạt hắc mai biển… Với nhiều chất dinh dưỡng tốt cho sức khỏe thú cưng, Bene M50 phù hợp với các chú chó nuôi trong nhà, cần chế độ ăn uống ổn định và cân bằng.\n\nCải thiện chức năng tiêu hóa, ngăn ngừa tiêu chảy, giảm mùi phân\nChống oxy hóa, ngăn ngừa...",
        "price": 290000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-multi-protein-chicken-salmon.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/thuc-an-cho-cho-huu-co-natural-core-multi-protein-chicken-salmon2.jpg"
      },
      {
        "name": "Xịt khử mùi hôi miệng cho chó TROPICLEAN Vanilla Mint Oral Care Spray",
        "description": "Xịt khử mùi hôi miệng chó TROPICLEAN Vanilla Mint Oral Care Spray mùi vị vani bạc hà dành cho tất cả các giống chó.\nLợi ích chính\nXịt khử mùi hôi miệng chó hương vani bạc hà TROPICLEAN Vanilla Mint Oral Care Spray bao gồm: nước tinh khiết, Glycerin, cồn chiết xuất tự nhiên, hương vị, Axit citric, chiết xuất lá trà xanh, kẽm clorua (0,01g/10ml), chất diệp lục. Hôi miệng có thể là một trong những dấu hiệu đầu tiên của bệnh răng miệng. Trên thực tế, 80% chó và 70% mèo có dấu hiệu mắc bệnh răng miện...",
        "price": 295000,
        "image1": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-meo-huong-vani-bac-ha-tropiclean-vanilla-mint-oral-care-spray.jpg",
        "image2": "https://www.petmart.vn/wp-content/uploads/2020/12/xit-khu-mui-hoi-mieng-cho-meo-huong-vani-bac-ha-tropiclean-vanilla-mint-oral-care-spray-1.jpg"
      }
    ]
  }
];
  
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

  // 7. Vouchers
  await prisma.voucher.upsert({
    where: { voucher_code: 'WELCOME10' },
    update: {},
    create: {
      voucher_code: 'WELCOME10',
      voucher_name: 'Giảm giá chào mừng 10%',
      discount_type: 'percent',
      discount_value: 10,
      status: 'active',
      start_at: new Date(),
      end_at: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    }
  });

  console.log('Seed data successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
