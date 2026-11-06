import mongoose from 'mongoose';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
import Post from '../modules/content/models/Post.js';
import CommunityPost from '../modules/content/models/CommunityPost.js';
import RescuePet from '../modules/content/models/RescuePet.js';
import AdoptionRequest from '../modules/content/models/AdoptionRequest.js';
import User from '../models/User.js';
import Customer from '../modules/customer/models/Customer.js';
import Branch from '../modules/branch/models/Branch.js';

export const BLOG_POSTS_SEED = [
  {
    title: 'Lịch tiêm phòng vắc-xin định kỳ cho chó mèo bạn cần biết',
    postType: 'OFFICIAL_BLOG',
    category: 'Cẩm nang nuôi dưỡng',
    excerpt: 'Bảo vệ thú cưng toàn diện trước các bệnh truyền nhiễm nguy hiểm bằng phác đồ tiêm chủng chuẩn quốc tế theo khuyến nghị của chuyên gia y tế Dr. Pet.',
    content: `Tiêm phòng vắc-xin là biện pháp dự phòng y tế cơ bản và quan trọng nhất để xây dựng hàng rào kháng thể vững chắc cho thú cưng ngay từ những tháng tuổi đầu đời.\n\n### 1. Phác đồ tiêm chủng cơ bản cho Chó con:\n- **Mũi 1 (6-8 tuần tuổi):** Vắc-xin phòng 5 bệnh (Care, Parvo, Viêm gan truyền nhiễm, Ho cũi chó, Cúm).\n- **Mũi 2 (9-11 tuần tuổi):** Vắc-xin phòng 7 bệnh (Bổ sung thêm 2 chủng Leptospira).\n- **Mũi 3 (12-14 tuần tuổi):** Vắc-xin phòng 7 bệnh nhắc lại lần cuối và tạo miễn dịch bền vững.\n- **Tiêm phòng Dại:** Bắt buộc từ 12-16 tuần tuổi theo quy định y tế dự phòng.\n\n### 2. Phác đồ tiêm chủng cơ bản cho Mèo con:\n- **Mũi 1 (8 tuần tuổi):** Vắc-xin phòng 3 hoặc 4 bệnh (Giảm bạch cầu FPV, Viêm mũi khí quản FVR, Calicivirus).\n- **Mũi 2 & 3:** Cách nhau 3-4 tuần theo hướng dẫn của bác sĩ thú y.\n- **Tiêm vắc-xin Dại (Rabies):** Lúc 12 tuần tuổi trở lên.\n\nSau khi hoàn thành các mũi sơ khai, hãy nhớ lịch tiêm nhắc lại hàng năm định kỳ tại bất kỳ chi nhánh nào của Dr. Pet's House!`,
    thumbnailUrl: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1420,
    likesCount: 108,
    publishedAt: new Date('2026-09-15T08:00:00.000Z'),
  },
  {
    title: 'Dinh dưỡng cân bằng cho thú cưng theo từng độ tuổi phát triển',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng thú cưng',
    excerpt: 'Khám phá chế độ dinh dưỡng tối ưu từ sơ sinh, trưởng thành đến khi về già giúp các bé cưng phát triển khỏe mạnh, lông mượt mà và tiêu hóa tốt.',
    content: `Nhu cầu trao đổi chất và hàm lượng calo cần thiết của chó mèo thay đổi đáng kể qua từng giai đoạn phát triển thể chất.\n\n### 1. Giai đoạn sơ sinh & cai sữa (0 - 2 tháng):\n- Cần sữa mẹ hoàn toàn hoặc sữa sinh học chuyên dụng thay thế. Tuyệt đối không cho uống sữa bò tươi có đường.\n\n### 2. Giai đoạn phát triển cơ bắp (2 - 12 tháng):\n- Nhu cầu protein chất lượng cao (thịt gà, cá hồi, thịt bò nạc) và canxi/phốt-pho cân bằng để hỗ trợ hình thành khung xương.\n\n### 3. Giai đoạn trưởng thành (1 - 7 tuổi):\n- Kiểm soát năng lượng nạp vào dựa trên mức độ vận động hàng ngày để phòng ngừa béo phì và các bệnh lý về tim mạch, khớp.\n\n### 4. Giai đoạn lớn tuổi (trên 7 tuổi):\n- Chuyển sang thức ăn dễ tiêu hóa, giảm hàm lượng muối natri và bổ sung Glucosamine, Omega-3 giúp bảo vệ sụn khớp.`,
    thumbnailUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 980,
    likesCount: 76,
    publishedAt: new Date('2026-10-01T09:30:00.000Z'),
  },
  {
    title: 'Dấu hiệu nhận biết và phòng ngừa ve rận, bọ chét ở thú cưng',
    postType: 'OFFICIAL_BLOG',
    category: 'Y tế & Bệnh học',
    excerpt: 'Ve rận và bọ chét không chỉ gây ngứa ngáy khó chịu mà còn là vật trung gian truyền ký sinh trùng máu nguy hiểm tính mạng cho thú cưng.',
    content: `Ve và bọ chét là những ký sinh trùng ngoài da phổ biến nhất tại vùng khí hậu nhiệt đới gió mùa của Việt Nam.\n\n### Nhận biết dấu hiệu nhiễm ký sinh trùng:\n1. Thú cưng thường xuyên gãi, cắn vào gốc đuôi, nách hoặc lắc đầu mạnh.\n2. Xuất hiện những hạt bụi màu đen (phân bọ chét) trên da khi vạch lông.\n3. Rụng lông từng mảng, da đỏ ửng, viêm da mủ thứ phát.\n4. Biểu hiện mệt mỏi, niêm mạc nhợt nhạt do mất máu hoặc nhiễm ký sinh trùng đường máu.\n\n### Biện pháp xử lý triệt để:\n- Sử dụng thuốc nhỏ gáy hoặc viên nhai định kỳ hàng tháng/hàng quý.\n- Vệ sinh, hút bụi và xịt khử khuẩn môi trường sống, nệm ngủ của thú cưng.\n- Đưa bé đến Dr. Pet để được bác sĩ kiểm tra và làm xét nghiệm máu nếu thấy bé sốt cao hoặc bỏ ăn.`,
    thumbnailUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 650,
    likesCount: 52,
    publishedAt: new Date('2026-10-18T14:15:00.000Z'),
  },
  {
    title: 'Bí quyết chăm sóc lông và vệ sinh tai mắt cho mèo cưng tại nhà',
    postType: 'OFFICIAL_BLOG',
    category: 'Cẩm nang nuôi dưỡng',
    excerpt: 'Hướng dẫn các bước tỉa móng, vệ sinh tai và chải lông giảm búi lông hiệu quả tại nhà dành cho hội sen nuôi mèo.',
    content: `Mèo dành tới 30% thời gian thức để tự liếm láp lông, tuy nhiên việc tích tụ lông nuốt vào dạ dày có thể hình thành búi lông nguy hiểm...\n\n(Nội dung đang được ban chuyên môn biên tập bổ sung...)`,
    thumbnailUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    status: 'DRAFT',
    isFeatured: false,
    viewCount: 0,
    likesCount: 0,
  },
];

export const FIRST_AID_GUIDES_SEED = [
  {
    title: 'Cách sơ cứu chó mèo bị hóc dị vật khẩn cấp',
    postType: 'FIRST_AID',
    category: 'tai-nan',
    emergencyPhone: '0901234567',
    excerpt: 'Hướng dẫn nhanh các bước kiểm tra đường thở và thủ thuật Heimlich đẩy dị vật cứu mạng thú cưng khi bị nghẹt thở đột ngột.',
    content: `Khi thú cưng hóc xương, nuốt bóng đồ chơi hoặc dị vật nghẽn khí quản, thời gian vàng để cấp cứu chỉ tính bằng phút.\n\n### Các bước thao tác sơ cứu khẩn cấp:`,
    steps: [
      {
        stepNumber: 1,
        title: 'Giữ bình tĩnh và mở rộng khoang miệng',
        instruction: 'Dùng một tay vòng qua sống mũi ấn môi trên vào răng để há miệng, tay còn lại kéo nhẹ lưỡi sang một bên để quan sát dị vật.',
      },
      {
        stepNumber: 2,
        title: 'Gắp dị vật nếu nhìn thấy rõ ràng',
        instruction: 'Nếu dị vật ở ngay cuống họng và lỏng lẻo, dùng kẹp panh gắp cẩn thận. TUYỆT ĐỐI không chọc ngoáy sâu nếu dị vật kẹt cứng vì có thể đẩy sâu thêm.',
      },
      {
        stepNumber: 3,
        title: 'Thực hiện thủ thuật Heimlich thú y',
        instruction: 'Đối với chó mèo nhỏ: Bế ôm lưng tựa vào ngực bạn, đặt nắm tay dưới xương ức đẩy mạnh hướng lên trên 4-5 lần. Đối với chó lớn: Đặt chó nằm nghiêng, dùng cả 2 tay ấn mạnh vào vùng bụng dưới xương sườn.',
      },
      {
        stepNumber: 4,
        title: 'Liên hệ Hotline cấp cứu và di chuyển đến phòng khám',
        instruction: 'Ngay khi dị vật bật ra hoặc nếu chưa bật ra sau 2 phút, gọi ngay Hotline 1900-PET-HELP và đưa bé đến phòng khám Dr. Pet gần nhất để thở oxy.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1850,
    likesCount: 142,
    publishedAt: new Date('2026-08-20T10:00:00.000Z'),
  },
  {
    title: 'Xử lý khẩn cấp khi thú cưng bị ngộ độc thực phẩm lạ hoặc hóa chất',
    postType: 'FIRST_AID',
    category: 'tai-nan',
    emergencyPhone: '0901234567',
    excerpt: 'Nhận biết triệu chứng trúng độc thức ăn lạ (sô-cô-la, nho khô, hành tỏi), bả chuột, thuốc trừ sâu và các bước sơ cứu trước khi đến bác sĩ.',
    content: `Trúng độc là một trong những ca cấp cứu nguy kịch nhất tại phòng khám thú y Dr. Pet's House.\n\n### Nguyên tắc xử lý sơ cứu:`,
    steps: [
      {
        stepNumber: 1,
        title: 'Cách ly nguồn chất độc ngay lập tức',
        instruction: 'Đưa thú cưng ra khỏi khu vực có hóa chất, thu giữ mẫu bao bì hoặc chất nôn để bác sĩ thú y xác định độc tố.',
      },
      {
        stepNumber: 2,
        title: 'KHÔNG tự ý gây nôn nếu chưa hỏi ý kiến bác sĩ',
        instruction: 'Nếu nuốt phải axit, kiềm tẩy rửa hoặc xăng dầu, việc gây nôn sẽ làm bỏng rát thực quản lần 2. Chỉ gây nôn khi có chỉ định cụ thể của bác sĩ qua điện thoại.',
      },
      {
        stepNumber: 3,
        title: 'Cho uống than hoạt tính (Activated Charcoal) nếu có sẵn',
        instruction: 'Than hoạt tính thú y giúp hấp phụ bớt độc chất trong ruột trước khi chúng ngấm vào máu.',
      },
      {
        stepNumber: 4,
        title: 'Giữ ấm cơ thể và chuyển viện cấp cứu',
        instruction: 'Trùm khăn ấm, đặt thú cưng nằm nghiêng đầu để tránh hít sặc nếu nôn mửa, lập tức di chuyển đến chi nhánh Dr. Pet có phòng cấp cứu ICU.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1610,
    likesCount: 125,
    publishedAt: new Date('2026-09-02T11:00:00.000Z'),
  },
  {
    title: 'Hướng dẫn băng bó và cầm máu vết thương hở cho thú cưng',
    postType: 'FIRST_AID',
    category: 'chan-thuong',
    emergencyPhone: '0901234567',
    excerpt: 'Kỹ thuật sát trùng, ép gạc cầm máu tại chỗ và băng bó vô khuẩn khi thú cưng bị cắn xé hoặc rách da do tai nạn.',
    content: `Chấn thương ngoài da chảy máu cần được can thiệp kịp thời để tránh sốc mất máu và nhiễm trùng mô mềm.\n\n### Quy trình băng bó sơ cứu:`,
    steps: [
      {
        stepNumber: 1,
        title: 'Đeo rọ mõm hoặc quấn khăn an toàn',
        instruction: 'Khi đau đớn, thú cưng có thể cắn phản xạ theo bản năng. Hãy quấn khăn quanh mõm nhẹ nhàng trước khi chạm vào vết thương.',
      },
      {
        stepNumber: 2,
        title: 'Áp lực ép trực tiếp để cầm máu',
        instruction: 'Dùng gạc y tế vô trùng ấn chặt trực tiếp lên miệng vết thương liên tục trong 3-5 phút không nhấc ra kiểm tra.',
      },
      {
        stepNumber: 3,
        title: 'Băng bó cố định gạc',
        instruction: 'Dùng băng co giãn quấn quanh vị trí tổn thương vừa đủ chặt để giữ gạc, không quấn quá chặt làm tím tái phần chi bên dưới.',
      },
      {
        stepNumber: 4,
        title: 'Đưa thú cưng đến phòng khám để khâu vết thương',
        instruction: 'Nếu vết rách sâu dài hơn 1cm hoặc máu vẫn rỉ qua lớp băng, bác sĩ cần tiến hành gây tê và khâu thẩm mỹ vô trùng.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=800&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 780,
    likesCount: 64,
    publishedAt: new Date('2026-10-10T16:20:00.000Z'),
  },
];

export const COMMUNITY_POSTS_SEED = [
  {
    title: 'Hành trình hồi phục diệu kỳ của bé Miu sau ca phẫu thuật gãy xương tại Dr. Pet Q1',
    content: 'Em muốn gửi lời cảm ơn chân thành và sâu sắc nhất đến bác sĩ Tuấn và toàn bộ đội ngũ y tá Dr. Pet chi nhánh Quận 1! Bé Miu nhà em bị ngã từ ban công tầng 2 gãy rời xương đùi phải. Sau ca phẫu thuật kết hợp xương và 3 tuần chăm sóc nội trú tận tình, hôm nay bé đã tự đi lại, chạy nhảy thoăn thoắt được rồi ạ!',
    imageUrls: [
      'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=800&q=80',
    ],
    authorNameSnapshot: 'Nguyễn Thị Lan (Khách hàng thân thiết)',
    status: 'APPROVED',
    likesCount: 48,
    commentsCount: 14,
  },
  {
    title: 'Chia sẻ kinh nghiệm trị nấm da cho cún Poodle tại nhà thành công',
    content: 'Chào cả nhà, bé Poodle nhà mình từng bị nấm vảy gàu đỏ cả 4 chân và vùng bụng. Sau khi đi khám tại Dr. Pet và kiên trì tắm sữa tắm trị nấm Dermaleen 2 lần/tuần kết hợp sấy thật khô chân lông sau khi tắm, bé đã khỏi hẳn 100%. Các sen lưu ý đừng để chân cún ẩm ướt sau khi dạo mưa nhé!',
    imageUrls: [
      'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80',
    ],
    authorNameSnapshot: 'Trần Văn Hoàng',
    status: 'APPROVED',
    likesCount: 35,
    commentsCount: 9,
  },
  {
    title: 'Xin kinh nghiệm huấn luyện cún con đi vệ sinh đúng khay cát cho người mới',
    content: 'Mọi người ơi, em mới đón một bé Corgi 2.5 tháng tuổi về nhà. Bé rất hiếu động nhưng hay đi bậy ra thảm phòng khách. Em đã xịt nước hướng dẫn vệ sinh nhưng bé vẫn chưa quen. Ai có mẹo gì kiên trì chỉ em với ạ?',
    imageUrls: [
      'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=800&q=80',
    ],
    authorNameSnapshot: 'Lê Minh Khang',
    status: 'PENDING',
    likesCount: 6,
    commentsCount: 2,
  },
  {
    title: 'Cần bán gấp đàn chó con giá rẻ không rõ nguồn gốc tại TP.HCM',
    content: 'Cần thanh lý gấp đàn cún con lai không rõ nguồn gốc giá 500k/con, ai cần inbox qua số điện thoại lạ...',
    imageUrls: [],
    authorNameSnapshot: 'Tài khoản Vi Phạm (Spam)',
    status: 'REJECTED',
    rejectionReason: 'Vi phạm quy chế cộng đồng Dr. Pet: Diễn đàn chỉ chia sẻ kiến thức nuôi dưỡng thú cưng phi thương mại, nghiêm cấm đăng tin buôn bán hoặc kinh doanh thú nuôi.',
    likesCount: 0,
    commentsCount: 0,
  },
];

export const RESCUE_PETS_SEED = [
  {
    petCode: 'RESCUE-DOG-001',
    petName: 'Bé Đậu',
    species: 'DOG',
    breed: 'Chó cỏ lai vàng',
    gender: 'MALE',
    ageDescription: '8 tháng tuổi',
    healthStatus: 'Sức khỏe tốt, đã tiêm 2 mũi vắc-xin 7 bệnh và xổ giun định kỳ.',
    rescueStory: 'Bé bị bỏ rơi trong thùng xốp trước cửa chi nhánh Dr. Pet Bình Thạnh trong đêm mưa bão. Đội ngũ bác sĩ đã tiếp nhận, hồi sức và chăm sóc bé phục hồi hoàn toàn.',
    images: [
      'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'LOOKING_FOR_HOME',
  },
  {
    petCode: 'RESCUE-CAT-002',
    petName: 'Bé Mây',
    species: 'CAT',
    breed: 'Mèo tam thể mắt ngọc',
    gender: 'FEMALE',
    ageDescription: '5 tháng tuổi',
    healthStatus: 'Rất nhanh nhẹn, tinh nghịch, tai mắt sạch sẽ, đã tiêm phòng 3 bệnh mèo.',
    rescueStory: 'Bé đi lạc vào tầng hầm chung cư Quận 7 và được cư dân đưa đến nhờ Dr. Pet cưu mang tìm tổ ấm yêu thương.',
    images: [
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'LOOKING_FOR_HOME',
  },
  {
    petCode: 'RESCUE-DOG-003',
    petName: 'Bé Vàng',
    species: 'DOG',
    breed: 'Chó Vàng Phú Quốc lai',
    gender: 'MALE',
    ageDescription: '14 tháng tuổi',
    healthStatus: 'Thể lực rất sung mãn, đã tiêm phòng dại và gắn microchip định danh.',
    rescueStory: 'Bé từng bị kẹt chân vào hàng rào sắt, được Dr. Pet giải cứu và phẫu thuật lành lặn. Bé đã được một gia đình tại Quận 2 nhận nuôi ấm êm.',
    images: [
      'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80',
    ],
    status: 'ADOPTED',
    adoptedAt: new Date('2026-10-15T10:00:00.000Z'),
  },
];

export const seedContent = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoUri);
    }
    logger.info('Connected to MongoDB for Content & Rescue seeding');

    // 1. Resolve Admin / Staff User and Branch
    const adminUser = await User.findOne({ systemRole: 'ADMIN' });
    const defaultBranch = await Branch.findOne({ status: 'ACTIVE' });
    const defaultCustomer = await Customer.findOne({ status: 'ACTIVE' });

    const adminId = adminUser?._id || new mongoose.Types.ObjectId('6ad08e4417bf41f5954234b0');
    const branchId = defaultBranch?._id || new mongoose.Types.ObjectId('6ad08e4417bf41f5954234c3');
    const customerId = defaultCustomer?._id || new mongoose.Types.ObjectId('6ad08e4417bf41f5954234d1');

    console.log('\n📝 BẮT ĐẦU SEED DỮ LIỆU CONTENT & DASHBOARD UAT...');

    // 2. Seed Blog Posts & First Aid Guides
    const allPosts = [...BLOG_POSTS_SEED, ...FIRST_AID_GUIDES_SEED];
    let postCount = 0;
    for (const postData of allPosts) {
      const slug = postData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');

      await Post.updateOne(
        { slug },
        {
          $set: {
            ...postData,
            slug,
            authorId: adminId,
          },
        },
        { upsert: true }
      );
      postCount++;
    }
    console.log(`✅ Đã đồng bộ ${postCount} bài viết Blog và Cẩm nang sơ cứu y tế.`);

    // 3. Seed Community Posts
    let communityCount = 0;
    for (const cpData of COMMUNITY_POSTS_SEED) {
      const query = { title: cpData.title };
      const updateData = {
        ...cpData,
        authorCustomerId: customerId,
        moderatedBy: cpData.status !== 'PENDING' ? adminId : undefined,
        moderatedAt: cpData.status !== 'PENDING' ? new Date('2026-10-25T14:00:00.000Z') : undefined,
      };
      await CommunityPost.updateOne(query, { $set: updateData }, { upsert: true });
      communityCount++;
    }
    console.log(`✅ Đã đồng bộ ${communityCount} bài viết cộng đồng (Pending, Approved, Rejected).`);

    // 4. Seed Rescue Pets
    let rescueCount = 0;
    const petMap = {};
    for (const petData of RESCUE_PETS_SEED) {
      const petDoc = await RescuePet.findOneAndUpdate(
        { petCode: petData.petCode },
        {
          $set: {
            ...petData,
            branchId,
          },
        },
        { upsert: true, new: true }
      );
      petMap[petData.petCode] = petDoc._id;
      rescueCount++;
    }
    console.log(`✅ Đã đồng bộ ${rescueCount} hồ sơ thú cưng cơ nhỡ tìm tổ ấm.`);

    // 5. Seed Adoption Requests
    const ADOPTION_REQUESTS_SEED = [
      {
        requestCode: 'ADOPT-REQ-001',
        rescuePetId: petMap['RESCUE-DOG-001'],
        customerId,
        applicantInfo: {
          fullName: 'Hoàng Minh Tuấn',
          phone: '0901234567',
          email: 'tuan.hoang@gmail.com',
          address: '123 Nguyễn Thị Minh Khai, P. Bến Nghé, Quận 1, TP.HCM',
          housingType: 'Nhà riêng có sân vườn rào kín',
          hasPetExperience: true,
          message: 'Đã nuôi chó cỏ 4 năm, nhà có sân vườn rào kín cao 2m.',
        },
        status: 'PENDING',
      },
      {
        requestCode: 'ADOPT-REQ-002',
        rescuePetId: petMap['RESCUE-DOG-003'],
        customerId,
        applicantInfo: {
          fullName: 'Phạm Thị Thảo',
          phone: '0988776655',
          email: 'thao.pham@gmail.com',
          address: '45 Thảo Điền, TP. Thủ Đức, TP.HCM',
          housingType: 'Biệt thự sân vườn',
          hasPetExperience: true,
          message: 'Gia đình rất yêu động vật, có kinh nghiệm chăm sóc chó lớn tuổi.',
        },
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: new Date('2026-10-15T09:30:00.000Z'),
        reviewNote: 'Gia đình đủ điều kiện không gian và cam kết chăm sóc trọn đời.',
      },
      {
        requestCode: 'ADOPT-REQ-003',
        rescuePetId: petMap['RESCUE-CAT-002'],
        applicantInfo: {
          fullName: 'Đỗ Văn Hùng',
          phone: '0911223344',
          email: 'hung.do@gmail.com',
          address: '78 Điện Biên Phủ, P. 15, Q. Bình Thạnh, TP.HCM',
          housingType: 'Phòng trọ cho thuê',
          hasPetExperience: false,
          message: 'Muốn nhận nuôi mèo cho vui cửa vui nhà.',
        },
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date('2026-10-27T10:00:00.000Z'),
        reviewNote: 'Phòng trọ diện tích nhỏ không có lưới an toàn ban công, chưa đảm bảo cam kết an toàn cho mèo con.',
      },
    ];

    let requestCount = 0;
    for (const reqData of ADOPTION_REQUESTS_SEED) {
      if (reqData.rescuePetId) {
        await AdoptionRequest.updateOne(
          { requestCode: reqData.requestCode },
          { $set: reqData },
          { upsert: true }
        );
        requestCount++;
      }
    }
    console.log(`✅ Đã đồng bộ ${requestCount} đơn xin nhận nuôi thú cưng (Pending, Approved, Rejected).`);

    console.log('\n========================================================================');
    console.log('🎉 TỔNG KẾT CONTENT & DASHBOARD SEED UAT THÀNH CÔNG');
    console.log('========================================================================');
    console.log(`| Bài viết Blog / Sơ cứu (Posts)    : ${String(postCount).padEnd(4)} bài (4 Blog + 3 First Aid)`);
    console.log(`| Diễn đàn cộng đồng (Community)    : ${String(communityCount).padEnd(4)} bài (Đủ trạng thái duyệt)`);
    console.log(`| Thú cưng cứu hộ (RescuePets)      : ${String(rescueCount).padEnd(4)} bé (Chó cỏ, Mèo tam thể, Chó Vàng)`);
    console.log(`| Đơn xin nhận nuôi (Adoptions)     : ${String(requestCount).padEnd(4)} đơn (Pending, Approved, Rejected)`);
    console.log('========================================================================\n');

    return true;
  } catch (error) {
    logger.error('Failed to seed Content & Rescue data:', error);
    console.error('Failed to seed Content & Rescue data:', error.message);
    throw error;
  }
};

// If executed via CLI
const isDirectCli = process.argv[1] && (process.argv[1].endsWith('contentSeed.js') || process.argv[1].endsWith('contentSeed'));
if (isDirectCli) {
  seedContent()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async () => {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      process.exit(1);
    });
}
