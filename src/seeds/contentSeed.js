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
import { DEFAULT_RESCUE_PARTNERS } from '../modules/content/content.service.js';

const buildRichBlocks = ({ heading, intro, bullets, tip, imageUrl, imageCaption }) => [
  { type: 'HEADING', text: heading },
  { type: 'PARAGRAPH', text: intro, html: `<p>${intro}</p>` },
  ...(imageUrl
    ? [{ type: 'IMAGE', imageUrl, caption: imageCaption || heading, alt: heading }]
    : []),
  ...(Array.isArray(bullets) && bullets.length > 0
    ? [
        {
          type: 'LIST',
          text: bullets.join('\n'),
          html: `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`,
        },
      ]
    : []),
  ...(tip
    ? [
        {
          type: 'QUOTE',
          text: tip,
          html: `<blockquote>${tip}</blockquote>`,
        },
      ]
    : []),
];

export const BLOG_POSTS_SEED = [
  // =========================================================================
  // 1. CHỦ ĐỀ: SỨC KHỎE (6 PUBLISHED + 1 DRAFT)
  // =========================================================================
  {
    title: 'Lịch tiêm phòng vắc-xin định kỳ cho chó mèo bạn cần biết',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'FEATURED',
    hashtags: ['tiem-phong', 'vac-xin', 'suc-khoe', 'cho-con', 'meo-con'],
    excerpt: 'Bảo vệ thú cưng toàn diện trước các bệnh truyền nhiễm nguy hiểm bằng phác đồ tiêm chủng chuẩn quốc tế theo khuyến nghị của bác sĩ Dr. Pet\'s House.',
    content: `<h3>1. Vì sao thú cưng cần tiêm phòng đúng lịch?</h3>
<p>Tiêm phòng vắc-xin là biện pháp dự phòng y tế cơ bản và quan trọng nhất để xây dựng hàng rào kháng thể vững chắc cho chó mèo ngay từ những tháng tuổi đầu đời, giúp phòng tránh các bệnh có tỷ lệ tử vong cao như Parvo, Care, Giảm bạch cầu và bệnh Dại.</p>
<h3>2. Phác đồ tiêm chủng cho Chó con</h3>
<ul>
  <li><strong>Mũi 1 (6–8 tuần tuổi):</strong> Vắc-xin 5 bệnh (Care, Parvo, Viêm gan truyền nhiễm, Ho cũi chó, Phó cúm).</li>
  <li><strong>Mũi 2 (9–11 tuần tuổi):</strong> Vắc-xin 7 bệnh (bổ sung 2 chủng xoắn khuẩn Leptospira).</li>
  <li><strong>Mũi 3 (12–14 tuần tuổi):</strong> Tiêm nhắc lại 7 bệnh để ổn định miễn dịch.</li>
  <li><strong>Tiêm phòng Dại:</strong> Bắt buộc từ 12–16 tuần tuổi và nhắc lại hằng năm.</li>
</ul>
<h3>3. Phác đồ tiêm chủng cho Mèo con</h3>
<ul>
  <li><strong>Mũi 1 (8 tuần tuổi):</strong> Vắc-xin 4 bệnh (Giảm bạch cầu FPV, Viêm mũi khí quản FVR, Calicivirus, Chlamydia).</li>
  <li><strong>Mũi 2 & 3:</strong> Cách nhau 3–4 tuần theo tư vấn của bác sĩ thú y.</li>
</ul>
<blockquote>Lưu ý: Chỉ tiêm phòng khi thú cưng khỏe mạnh, ăn uống bình thường và đã được tẩy giun trước đó 5–7 ngày.</blockquote>`,
    contentBlocks: buildRichBlocks({
      heading: 'Phác đồ tiêm phòng vắc-xin chuẩn y khoa cho chó mèo',
      intro: 'Xây dựng hàng rào kháng thể vững chắc ngay từ tuần tuổi thứ 6 giúp thú cưng phòng ngừa các bệnh truyền nhiễm nguy hiểm.',
      imageUrl: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=900&q=80',
      imageCaption: 'Khám sàng lọc và tiêm phòng định kỳ tại phòng khám Dr. Pet\'s House',
      bullets: [
        'Chó con bắt đầu tiêm mũi 1 lúc 6–8 tuần tuổi (5 bệnh), nhắc lại mũi 2–3 bằng vắc-xin 7 bệnh.',
        'Mèo con bắt đầu tiêm mũi 1 lúc 8 tuần tuổi với vắc-xin 3–4 bệnh.',
        'Tiêm vắc-xin Dại từ 12 tuần tuổi và duy trì tiêm nhắc lại mỗi năm 1 lần.',
      ],
      tip: 'Kiêng tắm cho thú cưng 5–7 ngày sau tiêm phòng và theo dõi bé tại phòng khám tối thiểu 30 phút sau mũi tiêm.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1840,
    likesCount: 136,
    publishedAt: new Date('2026-11-12T08:00:00.000Z'),
  },
  {
    title: 'Dấu hiệu nhận biết và phòng ngừa ve rận, bọ chét ở thú cưng',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'STANDARD',
    hashtags: ['ve-ran', 'bo-chet', 'ky-sinh-trung', 'suc-khoe'],
    excerpt: 'Ve rận và bọ chét không chỉ gây ngứa ngáy, viêm da mà còn là vật trung gian truyền ký sinh trùng đường máu cực kỳ nguy hiểm cho chó mèo.',
    content: `<h3>1. Dấu hiệu thú cưng đang bị ve rận, bọ chét</h3>
<p>Tại vùng khí hậu nhiệt đới ẩm như Việt Nam, ve rận và bọ chét sinh sôi quanh năm, đặc biệt sau những đợt mưa hoặc khi thú cưng đi dạo công viên.</p>
<ul>
  <li>Gãi liên tục vùng cổ, gốc đuôi, nách hoặc lắc đầu mạnh.</li>
  <li>Vạch lông thấy các chấm đen li ti (phân bọ chét) tan thành màu đỏ nâu khi thấm nước.</li>
  <li>Da mẩn đỏ, rụng lông từng mảng, xuất hiện vảy gàu hoặc viêm da mủ.</li>
  <li>Niêm mạc mắt/nướu nhợt nhạt, sốt cao, bỏ ăn (nguy cơ ký sinh trùng máu).</li>
</ul>
<h3>2. Giải pháp phòng ngừa hiệu quả</h3>
<ul>
  <li>Sử dụng viên nhai hoặc thuốc nhỏ gáy định kỳ mỗi 1–3 tháng theo cân nặng.</li>
  <li>Giặt giũ nệm ngủ bằng nước nóng và hút bụi thảm, khe tường hàng tuần.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Cách phát hiện sớm ve rận và bảo vệ da cho thú cưng',
      intro: 'Kiểm tra kỹ vùng sau tai, kẽ ngón chân và gốc đuôi sau mỗi lần đưa thú cưng ra ngoài giúp ngăn ngừa ổ ký sinh trùng lây lan.',
      bullets: [
        'Không tự ý dùng tay bứt mạnh ve đang bám sâu vì phần đầu ve có thể sót lại gây áp-xe da.',
        'Kết hợp tẩy ký sinh trùng trên cơ thể bé và vệ sinh môi trường sống đồng thời.',
      ],
      tip: 'Nếu thấy bé lờ đờ, nước tiểu sẫm màu hoặc nướu nhợt, hãy đưa bé đi xét nghiệm máu tầm soát ký sinh trùng ngay.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1290,
    likesCount: 94,
    publishedAt: new Date('2026-11-10T09:15:00.000Z'),
  },
  {
    title: 'Chó mèo bị cảm lạnh: Dấu hiệu và cách chăm sóc',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'STANDARD',
    hashtags: ['cam-lanh', 'ho-hap', 'suc-khoe', 'cham-soc'],
    excerpt: 'Nhận biết sớm triệu chứng hắt hơi, chảy nước mũi khi giao mùa để kịp thời giữ ấm và chăm sóc đường hô hấp cho chó mèo đúng cách.',
    content: `<h3>1. Triệu chứng nhận biết cảm lạnh ở chó mèo</h3>
<p>Sự thay đổi nhiệt độ đột ngột giữa trưa nắng và đêm lạnh, hoặc nằm điều hòa quá sâu sau khi tắm rất dễ khiến thú cưng bị cảm lạnh và viêm đường hô hấp trên.</p>
<ul>
  <li>Hắt hơi liên tục, chảy nước mũi trong hoặc hơi đặc, mắt ướt đỏ.</li>
  <li>Ho khan nhẹ, giọng khàn, ngủ nhiều hơn bình thường và giảm ham chơi.</li>
  <li>Thân nhiệt tăng nhẹ, tai và đệm thịt bàn chân ấm nóng bất thường.</li>
</ul>
<h3>2. Cách chăm sóc tại nhà an toàn</h3>
<ul>
  <li>Giữ phòng kín gió lùa, lót chăn ấm và tạm ngưng tắm nước cho đến khi hết triệu chứng.</li>
  <li>Dùng khăn ấm thấm nước muối sinh lý lau sạch dịch mũi, ghèn mắt 2–3 lần/ngày.</li>
  <li>Hâm ấm thức ăn mềm hoặc súp thịt để kích thích khứu giác giúp bé chịu ăn hơn.</li>
</ul>
<blockquote>Cảnh báo: Không tự ý cho chó mèo uống thuốc cảm hạ sốt của người (như Paracetamol/Ibuprofen) vì cực kỳ độc cho gan thận thú cưng.</blockquote>`,
    contentBlocks: buildRichBlocks({
      heading: 'Chăm sóc đúng cách khi thú cưng bị cảm lạnh lúc giao mùa',
      intro: 'Đa số ca cảm lạnh nhẹ sẽ hồi phục sau 5–7 ngày nếu được giữ ấm, vệ sinh mũi mắt và bù nước đầy đủ.',
      bullets: [
        'Tắt điều hòa thổi trực tiếp vào chỗ ngủ của thú cưng.',
        'Đưa đi khám thú y ngay nếu dịch mũi chuyển vàng/xanh đặc hoặc bé thở gấp, bỏ ăn quá 24 giờ.',
      ],
      tip: 'Tuyệt đối không tự ý dùng thuốc cảm người cho chó mèo, đặc biệt mèo cực kỳ nhạy cảm với Paracetamol.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1520,
    likesCount: 112,
    publishedAt: new Date('2026-11-08T10:30:00.000Z'),
  },
  {
    title: 'Những bệnh nguy hiểm trên chó con cần lưu ý',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'STANDARD',
    hashtags: ['cho-con', 'parvo', 'care', 'suc-khoe'],
    excerpt: 'Tổng hợp 4 bệnh truyền nhiễm cấp tính nguy hiểm nhất ở chó con dưới 6 tháng tuổi và cách phát hiện triệu chứng cảnh báo sớm.',
    content: `<h3>1. Vì sao chó con dưới 6 tháng tuổi dễ mắc bệnh nặng?</h3>
<p>Giai đoạn mới cai sữa là lúc kháng thể mẹ truyền giảm dần trong khi hệ miễn dịch tự thân của chó con chưa hoàn thiện, khiến bé dễ tổn thương trước virus.</p>
<ul>
  <li><strong>Bệnh Parvo (Viêm ruột xuất huyết):</strong> Nôn mửa dữ dội, tiêu chảy phân lỏng mùi tanh khắm đặc trưng, mất nước cực nhanh.</li>
  <li><strong>Bệnh Care (Sài sốt):</strong> Sốt cao hai pha, chảy gỉ mắt mũi đặc xanh, sừng hóa gan bàn chân, co giật thần kinh.</li>
  <li><strong>Ho cũi chó:</strong> Ho khạc thành từng cơn như hóc xương, đặc biệt khi vận động mạnh.</li>
  <li><strong>Viêm gan truyền nhiễm:</strong> Sốt, đau vùng bụng, màng mắt có thể chuyển xanh đục.</li>
</ul>
<h3>2. Nguyên tắc phòng tránh</h3>
<p>Hạn chế cho chó con tiếp xúc với nền đất công cộng hoặc chó lạ khi chưa tiêm đủ phác đồ vắc-xin 7 bệnh.</p>`,
    contentBlocks: buildRichBlocks({
      heading: '4 bệnh truyền nhiễm cấp tính cần đề phòng ở chó con',
      intro: 'Phát hiện sớm trong 24 giờ đầu giúp nâng tỷ lệ cứu sống lên gấp nhiều lần đối với các ca nhiễm virus ở chó con.',
      bullets: [
        'Parvo & Care có tốc độ diễn tiến nhanh, tuyệt đối không tự truyền nước tại nhà thiếu vô trùng.',
        'Giữ ấm, cách ly ngay bé có triệu chứng nôn/tiêu chảy khỏi các thú cưng khác trong nhà.',
      ],
      tip: 'Khám sức khỏe tổng quát và làm test nhanh ngay khi đón chó con mới về nhà để an tâm chăm sóc.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1410,
    likesCount: 97,
    publishedAt: new Date('2026-11-05T14:00:00.000Z'),
  },
  {
    title: 'Hướng dẫn chăm sóc hậu phẫu sau triệt sản cho chó mèo',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'STANDARD',
    hashtags: ['triet-san', 'hau-phau', 'suc-khoe', 'vet-thuong'],
    excerpt: 'Quy trình theo dõi vết mổ, đeo loa chống liếm và chế độ nghỉ ngơi trong 7–10 ngày đầu sau triệt sản giúp thú cưng lành thương nhanh chóng.',
    content: `<h3>1. Theo dõi 24 giờ đầu sau phẫu thuật</h3>
<p>Khi mới hết thuốc mê, chó mèo có thể đi loạng choạng, nhạy cảm với ánh sáng và tiếng ồn. Hãy đặt bé nằm ở nơi yên tĩnh, ấm áp và sát mặt sàn.</p>
<h3>2. Chăm sóc vết mổ & Đeo loa chống liếm</h3>
<ul>
  <li>Bắt buộc đeo vòng loa Elizabeth liên tục trong 7–10 ngày cho đến khi cắt chỉ.</li>
  <li>Kiểm tra vết mổ mỗi ngày: vết mổ khô ráo, khép mép là bình thường.</li>
  <li>Sử dụng đúng kháng sinh, giảm đau theo toa bác sĩ thú y, không bỏ dở giữa chừng.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Chăm sóc hậu phẫu an toàn trong 10 ngày vàng',
      intro: 'Hầu hết các biến chứng nhiễm trùng vết mổ sau triệt sản đều xuất phát từ việc chủ nuôi tháo loa chống liếm quá sớm.',
      bullets: [
        'Hạn chế cho chó mèo nhảy cao, chạy cầu thang trong 5 ngày đầu.',
        'Sử dụng cát giấy hoặc cát đậu nành sạch cho mèo hậu phẫu để bụi cát không dính vết thương.',
      ],
      tip: 'Liên hệ bác sĩ tái khám nếu thấy vết mổ sưng đỏ lan rộng, rỉ dịch mủ đục hoặc bung chỉ.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 890,
    likesCount: 68,
    publishedAt: new Date('2026-10-28T09:00:00.000Z'),
  },
  {
    title: 'Lịch tẩy giun định kỳ cho chó mèo theo từng độ tuổi chuẩn thú y',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'STANDARD',
    hashtags: ['tay-giun', 'ky-sinh-trung', 'suc-khoe'],
    excerpt: 'Giun đũa, giun móc và sán dây âm thầm hút dưỡng chất gây suy dinh dưỡng, chướng bụng ở thú cưng. Xem ngay lịch tẩy giun chuẩn theo tháng tuổi.',
    content: `<h3>1. Chu kỳ tẩy giun khuyến nghị</h3>
<ul>
  <li><strong>Từ 2 đến 12 tuần tuổi:</strong> Tẩy giun mỗi 2 tuần/lần bằng dung dịch tẩy giun chuyên dụng cho chó mèo sơ sinh.</li>
  <li><strong>Từ 3 đến 6 tháng tuổi:</strong> Duy trì đều đặn mỗi tháng 1 lần.</li>
  <li><strong>Trên 6 tháng tuổi & trưởng thành:</strong> Định kỳ 3–4 tháng/lần (hoặc 2 tháng/lần nếu bé thường xuyên ăn đồ tươi sống hoặc đi công viên).</li>
</ul>
<h3>2. Tác hại nếu bỏ quên tẩy giun</h3>
<p>Nhiễm giun nặng khiến chó mèo gầy còm dù ăn nhiều, bụng phình to, lông xơ xác, thiếu máu và có thể gây tắc ruột cấp tính.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Lịch tẩy giun khoa học từ 2 tuần tuổi đến trưởng thành',
      intro: 'Tẩy giun định kỳ không chỉ bảo vệ hệ tiêu hóa của thú cưng mà còn bảo vệ an toàn sức khỏe cho trẻ nhỏ và gia đình bạn.',
      bullets: [
        'Cân chính xác trọng lượng thú cưng trước khi tính liều thuốc tẩy giun.',
        'Tẩy giun cho toàn bộ chó mèo sống chung nhà trong cùng một ngày để tránh lây chéo.',
      ],
      tip: 'Nên cho uống thuốc tẩy giun vào buổi sáng sau bữa ăn nhẹ 1–2 giờ để dễ hấp thu và theo dõi phản ứng.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 745,
    likesCount: 59,
    publishedAt: new Date('2026-10-20T10:45:00.000Z'),
  },
  {
    title: 'Phác đồ tầm soát bệnh thận mạn tính và tiểu đường cho thú cưng lớn tuổi',
    postType: 'OFFICIAL_BLOG',
    category: 'Sức khỏe',
    layoutType: 'STANDARD',
    hashtags: ['tam-soat', 'thu-cung-lon-tuoi', 'suc-khoe'],
    excerpt: 'Hướng dẫn lịch xét nghiệm máu và siêu âm định kỳ 6 tháng/lần cho chó mèo từ 7 tuổi trở lên.',
    content: `<p>Bài viết chuyên sâu về bộ xét nghiệm sinh hóa thận (SDMA, Creatinine, BUN) và chỉ số đường huyết ở chó mèo cao tuổi đang được đội ngũ bác sĩ hoàn thiện biên tập.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Tầm soát bệnh lý tuổi già ở chó mèo trên 7 tuổi',
      intro: 'Bệnh thận mạn tính thường chỉ biểu hiện triệu chứng rõ ràng khi chức năng thận đã suy giảm trên 70%.',
      bullets: ['Khám tổng quát định kỳ 6 tháng/lần', 'Theo dõi lượng nước uống và tần suất đi tiểu hàng ngày'],
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=900&q=80',
    status: 'DRAFT',
    isFeatured: false,
    viewCount: 0,
    likesCount: 0,
  },

  // =========================================================================
  // 2. CHỦ ĐỀ: DINH DƯỠNG (6 PUBLISHED + 1 DRAFT)
  // =========================================================================
  {
    title: 'Dinh dưỡng cân bằng cho thú cưng theo từng độ tuổi phát triển',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'FEATURED',
    hashtags: ['dinh-duong', 'do-tuoi', 'thuc-an-hat', 'cho-meo'],
    excerpt: 'Khám phá chế độ dinh dưỡng tối ưu từ sơ sinh, trưởng thành đến khi về già giúp các bé cưng phát triển khỏe mạnh, lông mượt mà và tiêu hóa tốt.',
    content: `<h3>1. Giai đoạn sơ sinh & cai sữa (0 – 2 tháng)</h3>
<p>Nhu cầu trao đổi chất của chó mèo con rất cao nhưng hệ men tiêu hóa còn non nớt. Cần sữa mẹ hoàn toàn hoặc sữa bột thay thế chuyên dụng (KMR / Bio-Milk). Tuyệt đối không cho uống sữa bò tươi có đường Lactose gây tiêu chảy.</p>
<h3>2. Giai đoạn tăng trưởng (2 – 12 tháng)</h3>
<p>Ưu tiên hàm lượng protein động vật chất lượng cao (gà, cá hồi, thịt bò nạc) kết hợp tỷ lệ Canxi/Phốt-pho cân đối (~1.2:1) giúp phát triển khung xương chắc khỏe.</p>
<h3>3. Giai đoạn trưởng thành (1 – 7 tuổi)</h3>
<p>Kiểm soát khẩu phần calo dựa trên cân nặng mục tiêu và mức độ vận động để phòng tránh béo phì, gan nhiễm mỡ và thoái hóa khớp sớm.</p>
<h3>4. Giai đoạn lớn tuổi (trên 7 tuổi)</h3>
<p>Giảm natri, chọn nguồn đạm dễ tiêu hóa và bổ sung Glucosamine, Chondroitin cùng Omega-3 hỗ trợ tim mạch và xương khớp.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Xây dựng thực đơn theo 4 giai đoạn vàng của thú cưng',
      intro: 'Mỗi độ tuổi cần tỷ lệ đạm, chất béo, khoáng chất và khẩu phần calo khác nhau để duy trì thể trạng lý tưởng.',
      imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=900&q=80',
      imageCaption: 'Khẩu phần dinh dưỡng cân bằng giúp lông mượt và tiêu hóa ổn định',
      bullets: [
        'Chia 3–4 bữa nhỏ/ngày cho thú cưng dưới 6 tháng tuổi và 2 bữa/ngày khi trưởng thành.',
        'Khi đổi loại thức ăn mới, hãy trộn chuyển tiếp từ từ trong 7 ngày theo tỷ lệ tăng dần.',
      ],
      tip: 'Luôn cung cấp nước sạch mát suốt cả ngày, đặc biệt khi thú cưng ăn chế độ hạt khô.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1620,
    likesCount: 118,
    publishedAt: new Date('2026-11-11T09:30:00.000Z'),
  },
  {
    title: '10 loại thực phẩm đại kỵ tuyệt đối không cho chó mèo ăn',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'STANDARD',
    hashtags: ['thuc-pham-cam', 'ngo-doc', 'dinh-duong', 'an-toan'],
    excerpt: 'Nhiều món ăn quen thuộc trên bàn ăn gia đình như sô-cô-la, hành tỏi, nho khô hay xương nấu chín có thể gây suy thận hoặc ngộ độc cấp cho thú cưng.',
    content: `<h3>Danh sách thực phẩm gây độc hàng đầu</h3>
<ul>
  <li><strong>Sô-cô-la & Cà phê:</strong> Chứa Theobromine và Caffeine gây rối loạn nhịp tim, co giật thần kinh.</li>
  <li><strong>Nho tươi & Nho khô:</strong> Có thể dẫn tới suy thận cấp nguy kịch ở chó dù chỉ ăn một lượng nhỏ.</li>
  <li><strong>Hành tây, tỏi, hẹ:</strong> Phá hủy hồng cầu dẫn đến thiếu máu tan máu (đặc biệt độc với mèo).</li>
  <li><strong>Xương gia cầm nấu chín:</strong> Dễ vỡ thành mảnh sắc nhọn làm thủng thực quản, dạ dày hoặc tắc ruột.</li>
  <li><strong>Chất tạo ngọt Xylitol:</strong> Gây tụt đường huyết đột ngột và suy gan cấp.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Bảo vệ thú cưng khỏi ngộ độc thực phẩm gia đình',
      intro: 'Không chia sẻ thức ăn nêm nhiều gia vị hoặc đồ ngọt của người cho chó mèo dưới bất kỳ hình thức nào.',
      bullets: [
        'Đậy kín thùng rác bếp và để hoa quả (nho, bơ, macca) xa tầm với của chó mèo.',
        'Ghi nhớ ngay hotline cấp cứu thú y khi phát hiện thú cưng ăn nhầm thực phẩm cấm.',
      ],
      tip: 'Thay vì cho ăn đồ thừa, hãy thưởng bánh thưởng (treats) dành riêng cho thú cưng để an toàn đường ruột.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1470,
    likesCount: 121,
    publishedAt: new Date('2026-11-07T08:45:00.000Z'),
  },
  {
    title: 'Cách đọc bảng thành phần thức ăn hạt cho chó mèo chuẩn chuyên gia',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'STANDARD',
    hashtags: ['thuc-an-hat', 'chon-hat', 'dinh-duong'],
    excerpt: 'Hiểu đúng thứ tự nguyên liệu, tỷ lệ đạm thô, tro và ngũ cốc trên bao bì hạt giúp bạn chọn được loại thức ăn xứng đáng với số tiền bỏ ra.',
    content: `<h3>1. Quy tắc 5 thành phần đầu tiên</h3>
<p>Theo chuẩn ghi nhãn thức ăn thú cưng, các nguyên liệu được liệt kê theo thứ tự khối lượng giảm dần trước khi chế biến. Loại hạt chất lượng tốt thường có thịt thật (Deboned Chicken, Salmon Meal...) đứng đầu bảng.</p>
<h3>2. Những chỉ số cần lưu ý trong Guaranteed Analysis</h3>
<ul>
  <li><strong>Crude Protein (Đạm thô):</strong> Tối thiểu 22–28% cho chó trưởng thành và 30–40% cho mèo.</li>
  <li><strong>Taurine (Bắt buộc với mèo):</strong> Axit amin thiết yếu cho võng mạc mắt và cơ tim của mèo.</li>
  <li><strong>Tránh chất bảo quản tổng hợp:</strong> Hạn chế BHA, BHT, Ethoxyquin.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Giải mã nhãn bao bì thức ăn hạt chó mèo',
      intro: 'Đừng chỉ nhìn hình ảnh minh họa mặt trước bao bì, bảng Ingredients ở mặt sau mới phản ánh chất lượng thực sự.',
      bullets: [
        'Phân biệt thịt nguyên chất (Chicken) và bột thịt phụ phẩm không rõ nguồn gốc.',
        'Ưu tiên sản phẩm sử dụng vitamin E (Mixed Tocopherols) để bảo quản tự nhiên.',
      ],
      tip: 'Quan sát chất lượng phân, độ bóng mượt của lông và mức năng lượng sau 3 tuần dùng hạt để đánh giá độ hợp.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 930,
    likesCount: 74,
    publishedAt: new Date('2026-11-02T11:20:00.000Z'),
  },
  {
    title: 'Chế độ ăn kiểm soát cân nặng cho chó mèo béo phì sống tại căn hộ',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'STANDARD',
    hashtags: ['giam-can', 'beo-phi', 'dinh-duong', 'can-nang'],
    excerpt: 'Thú cưng sống trong chung cư ít vận động dễ thừa cân dẫn đến bệnh tim mạch và khớp. Tham khảo thực đơn giảm cân khoa học mà không làm bé bị đói.',
    content: `<h3>1. Dấu hiệu đánh giá thú cưng thừa cân (BCS)</h3>
<p>Khi sờ nhẹ dọc hai bên lồng ngực mà không thể cảm nhận rõ xương sườn, hoặc khi nhìn từ trên xuống không thấy đường eo thắt nhẹ trước hông, bé đã bước vào ngưỡng thừa cân.</p>
<h3>2. Chiến lược giảm cân an toàn</h3>
<ul>
  <li>Đong khẩu phần chính xác bằng cân điện tử hoặc cốc định lượng thay vì đổ đầy bát tự do.</li>
  <li>Bổ sung chất xơ tự nhiên (bí đỏ hấp, cà rốt băm nhỏ) hoặc chuyển sang dòng hạt Light/Weight Control.</li>
  <li>Cắt giảm đồ ăn vặt giàu tinh bột; chuyển 10% khẩu phần hạt hàng ngày thành phần thưởng tập luyện.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Kiểm soát vóc dáng cho chó mèo căn hộ chung cư',
      intro: 'Giảm cân an toàn chỉ nên đạt tốc độ 1–2% trọng lượng cơ thể mỗi tuần để tránh gan nhiễm mỡ (đặc biệt ở mèo).',
      bullets: [
        'Tuyệt đối không ép mèo nhịn đói đột ngột vì dễ gây hội chứng gan nhiễm mỡ nguy hiểm.',
        'Kết hợp trò chơi cần câu mèo hoặc đi bộ 20 phút mỗi tối để tăng tiêu hao năng lượng.',
      ],
      tip: 'Thức ăn ướt (Pate) có hàm lượng nước cao (~75%) giúp tạo cảm giác no nhanh hơn với ít calo hơn hạt khô.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 810,
    likesCount: 65,
    publishedAt: new Date('2026-10-26T15:00:00.000Z'),
  },
  {
    title: 'Hướng dẫn bổ sung Canxi, Omega-3 và men tiêu hóa đúng cách cho thú cưng',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'STANDARD',
    hashtags: ['vitamin', 'omega-3', 'men-tieu-hoa', 'dinh-duong'],
    excerpt: 'Bổ sung thực phẩm chức năng sai liều có thể gây phản tác dụng. Tìm hiểu thời điểm vàng để dùng dầu cá, men vi sinh và canxi cho chó mèo.',
    content: `<h3>1. Omega-3 (EPA & DHA)</h3>
<p>Chiết xuất từ dầu cá hồi giúp giảm viêm da, giảm rụng lông theo mùa, tăng cường trí nhớ cho thú cưng nhỏ và bảo vệ khớp cho thú cưng lớn tuổi.</p>
<h3>2. Men tiêu hóa / Probiotics</h3>
<p>Rất hữu ích khi chó mèo đi phân lỏng nhẹ do đổi thức ăn, sau đợt uống kháng sinh hoặc căng thẳng do chuyển môi trường.</p>
<h3>3. Canxi — Dùng sao cho không thừa?</h3>
<p>Nếu thú cưng đang ăn hạt hoàn chỉnh chất lượng cao, việc tự ý bổ sung thêm viên canxi liều cao có thể gây vôi hóa mô mềm và sỏi tiết niệu.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Dùng đúng thực phẩm bổ sung để tối ưu sức khỏe',
      intro: 'Thực phẩm bổ sung phát huy tác dụng tốt nhất khi đáp ứng đúng nhu cầu thiếu hụt thực tế của từng cá thể.',
      bullets: [
        'Không pha men vi sinh trực tiếp vào đồ ăn hoặc nước đang còn nóng.',
        'Hỏi ý kiến bác sĩ trước khi bổ sung canxi cho giống chó lớn (Alaska, Golden) đang phát triển xương.',
      ],
      tip: 'Bảo quản dầu cá Omega-3 nơi thoáng mát tránh ánh nắng để không bị oxy hóa gây mất chất.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 690,
    likesCount: 54,
    publishedAt: new Date('2026-10-19T08:30:00.000Z'),
  },
  {
    title: 'Mẹo giúp mèo lười uống nước bổ sung đủ ẩm phòng ngừa bệnh tiết niệu',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'STANDARD',
    hashtags: ['meo-uong-nuoc', 'tiet-nieu', 'pate', 'dinh-duong'],
    excerpt: 'Mèo có tập tính tổ tiên từ vùng bán sa mạc nên ít cảm thấy khát. Áp dụng ngay 5 mẹo đơn giản giúp boss chịu uống nước mỗi ngày.',
    content: `<h3>1. Vì sao mèo hay bị sỏi bàng quang và tắc tiểu?</h3>
<p>Khi ăn hoàn toàn thức ăn hạt khô mà không uống đủ 50–60ml nước/kg thể trọng mỗi ngày, nước tiểu của mèo trở nên cô đặc, dễ hình thành tinh thể Struvite hoặc Oxalate.</p>
<h3>2. 5 mẹo kích thích mèo uống nước hiệu quả</h3>
<ul>
  <li><strong>Dùng máy lọc nước vòi chảy:</strong> Mèo thích nước chuyển động liên tục vì bản năng cho rằng nước chảy sạch hơn nước tù.</li>
  <li><strong>Tách xa bát nước và khay cát, bát ăn:</strong> Đặt nhiều bát gốm/thủy tinh rộng miệng ở các góc yên tĩnh trong nhà.</li>
  <li><strong>Trộn thêm nước ấm vào Pate:</strong> Bổ sung trực tiếp 1–2 muỗng canh nước ấm vào bữa ăn ướt mỗi tối.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: '5 bí quyết giúp mèo uống đủ nước mỗi ngày',
      intro: 'Phòng ngừa sỏi thận và viêm bàng quang cho mèo bắt đầu từ việc cung cấp đủ độ ẩm qua từng bữa ăn.',
      bullets: [
        'Ưu tiên bát gốm sứ hoặc inox thay vì bát nhựa dễ bám mùi khó chịu.',
        'Thay nước mới mỗi ngày và rửa sạch nhớt thành bát bằng nước ấm.',
      ],
      tip: 'Nếu thấy mèo ra vào khay cát liên tục nhưng không đi tiểu được hoặc kêu đau, hãy đưa bé đi cấp cứu thú y ngay lập tức.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1180,
    likesCount: 89,
    publishedAt: new Date('2026-10-12T13:15:00.000Z'),
  },
  {
    title: 'So sánh chế độ ăn Raw Food, Pate tươi nấu chín và hạt khô cao cấp',
    postType: 'OFFICIAL_BLOG',
    category: 'Dinh dưỡng',
    layoutType: 'STANDARD',
    hashtags: ['raw-food', 'pate-tuoi', 'dinh-duong'],
    excerpt: 'Phân tích ưu nhược điểm về giá trị dinh dưỡng, chi phí và an toàn vi sinh giữa 3 xu hướng cho ăn phổ biến nhất hiện nay.',
    content: `<p>Bài viết phân tích chuyên sâu giữa chế độ ăn tươi nấu chín, Raw BARF và hạt khô cân bằng dinh dưỡng đang trong quá trình thẩm định chuyên môn.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Lựa chọn phương pháp cho ăn phù hợp với điều kiện gia đình',
      intro: 'Mỗi phương pháp dinh dưỡng đều có ưu điểm riêng nếu được cân đối vi chất đúng cách.',
      bullets: ['Hạt khô tiện lợi và hỗ trợ cọ mảng bám răng', 'Pate tươi giàu ẩm giúp dễ tiêu hóa'],
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=900&q=80',
    status: 'DRAFT',
    isFeatured: false,
    viewCount: 0,
    likesCount: 0,
  },

  // =========================================================================
  // 3. CHỦ ĐỀ: TÂM LÝ (6 PUBLISHED)
  // =========================================================================
  {
    title: 'Giải mã ngôn ngữ cơ thể của mèo: Tiếng gừ, vẫy đuôi và đôi tai nói lên điều gì?',
    postType: 'OFFICIAL_BLOG',
    category: 'Tâm lý',
    layoutType: 'FEATURED',
    hashtags: ['tam-ly', 'ngon-ngu-co-the', 'meo-cung', 'hanh-vi'],
    excerpt: 'Khác với chó, mèo giao tiếp tinh tế qua độ vểnh của tai, chuyển động đuôi và ánh mắt. Hiểu đúng tín hiệu giúp bạn kết nối sâu sắc hơn với bé mèo.',
    content: `<h3>1. Đôi tai — Phong vũ biểu cảm xúc</h3>
<ul>
  <li><strong>Tai hướng thẳng về trước:</strong> Mèo đang tò mò, vui vẻ và sẵn sàng tương tác.</li>
  <li><strong>Tai cụp ngang sang hai bên ("tai máy bay"):</strong> Dấu hiệu căng thẳng, phòng thủ hoặc khó chịu.</li>
</ul>
<h3>2. Đừng hiểu nhầm tiếng gừ (Purring) và cái vẫy đuôi</h3>
<p>Mèo vẫy đuôi mạnh qua lại KHÔNG giống chó đang vui mừng — đó là tín hiệu cảnh báo bé đang mất kiên nhẫn. Ngược lại, chiếc đuôi dựng thẳng đứng và hơi cong móc câu ở ngọn là lời chào thân thiện nhất.</p>
<h3>3. Cái chớp mắt chậm (Slow Blink)</h3>
<p>Khi mèo nhìn bạn và nhắm mắt chậm rãi, đó tương đương với "nụ hôn tin tưởng". Hãy chớp mắt chậm đáp lại để bé cảm thấy cực kỳ an toàn.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Đọc vị cảm xúc của mèo qua tai, mắt và đuôi',
      intro: 'Tôn trọng không gian cá nhân và dừng vuốt ve đúng lúc khi mèo ra tín hiệu khó chịu sẽ giúp mèo quấn chủ hơn.',
      imageUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80',
      imageCaption: 'Hiểu đúng ngôn ngữ cơ thể giúp xây dựng lòng tin bền chặt với mèo',
      bullets: [
        'Đuôi dựng đứng hình dấu hỏi là lời chào vui vẻ khi bạn đi làm về.',
        'Đuôi quất mạnh xuống sàn là dấu hiệu mèo sắp cào hoặc cắn cảnh báo.',
      ],
      tip: 'Khi mèo nằm ngửa khoe bụng, hãy vuốt nhẹ vùng đầu và cằm trước thay vì xoa mạnh vào bụng vì đó là vùng dễ giật mình.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1580,
    likesCount: 127,
    publishedAt: new Date('2026-11-14T10:00:00.000Z'),
  },
  {
    title: 'Hội chứng lo âu khi xa chủ ở chó: Dấu hiệu và cách khắc phục',
    postType: 'OFFICIAL_BLOG',
    category: 'Tâm lý',
    layoutType: 'STANDARD',
    hashtags: ['tam-ly', 'lo-au-xa-chu', 'hanh-vi-cho'],
    excerpt: 'Chó sủa tru liên hồi, cào cửa hoặc cắn nát đồ ngay khi bạn vừa ra khỏi nhà? Đây có thể là biểu hiện của hội chứng lo âu chia ly cần được điều chỉnh.',
    content: `<h3>1. Phân biệt quậy phá do buồn chán và lo âu chia ly</h3>
<p>Chó mắc chứng lo âu khi xa chủ thường hoảng loạn ngay trong 15–30 phút đầu sau khi bạn rời đi: đi tiểu bậy dù đã biết chỗ, chảy dãi nhiều, cào xước khung cửa hoặc tru sủa không ngừng.</p>
<h3>2. Phương pháp tập luyện từng bước</h3>
<ul>
  <li>Giữ thái độ bình thản khi chuẩn bị ra khỏi nhà và lúc mới về — tránh màn chia tay quá bi lụy.</li>
  <li>Tập tách rời ngắn từ 2 phút → 5 phút → 15 phút và thưởng khi bé giữ được bình tĩnh.</li>
  <li>Để lại đồ chơi nhồi pate đông lạnh (Kong) giúp bé phân tán sự chú ý một cách tích cực.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Giúp cún bình tĩnh khi phải ở nhà một mình',
      intro: 'Kiên trì luyện tập theo nguyên tắc tăng dần thời gian vắng mặt giúp chó xây dựng sự tự tin và độc lập.',
      bullets: [
        'Không quát mắng hay trừng phạt khi về nhà thấy đồ đạc bị cắn phá vì chó không liên kết được hình phạt muộn.',
        'Đi dạo giải phóng năng lượng 20 phút trước giờ đi làm giúp bé ngủ ngon khi bạn vắng nhà.',
      ],
      tip: 'Một chiếc áo cũ mang mùi hương quen thuộc của bạn đặt trong ổ nằm giúp làm dịu hệ thần kinh của cún.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1090,
    likesCount: 82,
    publishedAt: new Date('2026-11-09T09:00:00.000Z'),
  },
  {
    title: 'Cách giúp thú cưng làm quen nhà mới và giảm stress sau khi chuyển chỗ ở',
    postType: 'OFFICIAL_BLOG',
    category: 'Tâm lý',
    layoutType: 'STANDARD',
    hashtags: ['tam-ly', 'chuyen-nha', 'giam-stress'],
    excerpt: 'Không gian lạ, mùi lạ và tiếng ồn khi dọn nhà rất dễ khiến chó mèo trốn vào gầm tủ hoặc bỏ ăn. Áp dụng ngay quy tắc 3-3-3 giúp bé thích nghi êm ái.',
    content: `<h3>Quy tắc vàng 3-3-3 khi đón thú cưng về nhà mới</h3>
<ul>
  <li><strong>3 ngày đầu tiên:</strong> Giữ bé ở trong một phòng nhỏ yên tĩnh đầy đủ khay cát, nước uống và ổ cũ chưa giặt để giữ mùi quen.</li>
  <li><strong>3 tuần tiếp theo:</strong> Bé bắt đầu tìm hiểu các phòng còn lại và hình thành thói quen giờ giấc ăn ngủ mới.</li>
  <li><strong>3 tháng sau:</strong> Hình thành sự gắn bó tin tưởng và cảm giác "đây là nhà của mình".</li>
</ul>
<p>Có thể sử dụng máy khuếch tán Pheromone (Feliway cho mèo / Adaptil cho chó) trong tuần đầu chuyển nhà.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Áp dụng quy tắc 3-3-3 giúp thú cưng hết sợ hãi ở nhà mới',
      intro: 'Đừng ép thú cưng ra khỏi chỗ trốn hay bế đi khoe ngay trong ngày đầu chuyển nhà.',
      bullets: [
        'Giữ nguyên lịch cho ăn và loại thức ăn cũ trong 2 tuần đầu.',
        'Đóng kín cửa sổ, ban công hoặc lắp lưới an toàn trước khi thả mèo khám phá nhà mới.',
      ],
      tip: 'Ngồi yên đọc sách hoặc nói chuyện nhỏ nhẹ gần chỗ bé đang trốn để bé tự chủ động tiến lại ngửi tay bạn.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 860,
    likesCount: 71,
    publishedAt: new Date('2026-11-03T16:10:00.000Z'),
  },
  {
    title: 'Tại sao mèo đi vệ sinh ngoài khay cát? Nguyên nhân tâm lý và cách xử lý',
    postType: 'OFFICIAL_BLOG',
    category: 'Tâm lý',
    layoutType: 'STANDARD',
    hashtags: ['tam-ly', 'khay-cat', 'hanh-vi-meo'],
    excerpt: 'Mèo vốn cực kỳ sạch sẽ. Khi bỗng nhiên đi bậy lên giường hoặc thảm, bé đang gửi tín hiệu cầu cứu về stress hoặc bệnh lý tiết niệu.',
    content: `<h3>1. Kiểm tra y tế trước khi kết luận do tâm lý</h3>
<p>Viêm bàng quang hoặc sỏi niệu đạo gây đau rát khi đi tiểu khiến mèo sợ chính khay cát cũ và chuyển sang tiểu trên chăn gối mềm.</p>
<h3>2. 4 nguyên nhân tâm lý & môi trường phổ biến</h3>
<ul>
  <li>Khay cát quá dơ, quá nhỏ hoặc đặt gần máy giặt ồn ào / gần ngay bát ăn.</li>
  <li>Áp dụng công thức số khay cát: <strong>Số khay = Số mèo + 1</strong> nếu nuôi nhiều mèo.</li>
  <li>Căng thẳng do có người lạ, thú cưng mới hoặc mèo hoang lảng vảng ngoài cửa sổ.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Tìm đúng nguyên nhân khiến mèo bỏ khay cát',
      intro: 'Khử sạch mùi nước tiểu cũ bằng dung dịch enzyme chuyên dụng thay vì nước lau sàn thông thường chứa amoniac.',
      bullets: [
        'Dọn phân và cục cát vón ít nhất 1–2 lần/ngày.',
        'Đặt khay cát ở vị trí riêng tư, thoáng khí nhưng không bị khuất lối thoát.',
      ],
      tip: 'Tuyệt đối không ấn mũi mèo vào chỗ tiểu bậy vì hành động này làm tăng mức độ hoảng loạn và trầm trọng hơn.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 970,
    likesCount: 80,
    publishedAt: new Date('2026-10-24T11:00:00.000Z'),
  },
  {
    title: 'Phương pháp huấn luyện tích cực giúp cún con bỏ thói quen cắn phá đồ đạc',
    postType: 'OFFICIAL_BLOG',
    category: 'Tâm lý',
    layoutType: 'STANDARD',
    hashtags: ['tam-ly', 'huan-luyen', 'cun-con', 'can-pha'],
    excerpt: 'Giai đoạn thay răng từ 3–7 tháng tuổi khiến chó con ngứa nướu và thích gặm mọi thứ. Dạy bé chuyển hướng hành vi nhẹ nhàng không bạo lực.',
    content: `<h3>1. Hiểu đúng nhu cầu gặm nhấm tự nhiên của cún con</h3>
<p>Gặm đồ vừa giúp chó con giảm ngứa lợi lúc mọc răng vĩnh viễn, vừa là cách giải tỏa năng lượng tinh thần.</p>
<h3>2. Kỹ thuật "Chuyển hướng & Khen thưởng" (Positive Reinforcement)</h3>
<ul>
  <li>Khi thấy bé gặm giày hoặc chân bàn, phát âm thanh ngắn ngắt quãng ("À à") rồi đưa ngay đồ chơi gặm cao su an toàn thay thế.</li>
  <li>Ngay giây phút bé chuyển sang gặm đồ chơi, khen ngợi ("Giỏi lắm") và thưởng nhẹ.</li>
  <li>Khi chơi đùa không dùng ngón tay làm mồi để tránh tạo thói quen cắn tay người.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Huấn luyện tích cực không đòn roi cho chó con',
      intro: 'Khen thưởng hành vi đúng mang lại hiệu quả bền vững gấp nhiều lần việc la mắng sau khi sự việc đã xảy ra.',
      bullets: [
        'Cung cấp đa dạng kết cấu đồ chơi gặm (cao su, dây thừng cotton, gặm làm mát).',
        'Mỗi buổi tập chỉ nên kéo dài 5–10 phút để giữ sự hứng thú cao nhất.',
      ],
      tip: 'Cất gọn dây điện và giày dép vào tủ kín trong thời gian cún đang học nội quy nhà.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 785,
    likesCount: 62,
    publishedAt: new Date('2026-10-16T09:20:00.000Z'),
  },
  {
    title: 'Bí quyết làm quen giữa thú cưng mới và thú cưng cũ êm đẹp, không xung đột',
    postType: 'OFFICIAL_BLOG',
    category: 'Tâm lý',
    layoutType: 'STANDARD',
    hashtags: ['tam-ly', 'nhieu-thu-cung', 'hoa-nhap'],
    excerpt: 'Đưa thú cưng mới về nhà không đúng cách dễ khiến thú cưng cũ ghen tị hoặc đánh nhau tranh lãnh thổ. Thực hiện quy trình 4 bước làm quen qua mùi hương.',
    content: `<h3>Quy trình 4 bước giới thiệu thú cưng mới an toàn</h3>
<ul>
  <li><strong>Bước 1 — Cách ly & Khám sàng lọc (5–7 ngày):</strong> Đảm bảo bé mới không mang bệnh truyền nhiễm hoặc ve rận lây cho bé cũ.</li>
  <li><strong>Bước 2 — Trao đổi mùi hương:</strong> Đổi khăn lót hoặc dùng khăn lau nhẹ má bé này rồi đặt gần chỗ bé kia.</li>
  <li><strong>Bước 3 — Ăn ngon cách cửa đóng:</strong> Đặt bát thức ăn ở hai bên cánh cửa đóng để tạo liên kết tích cực: "Có mùi bạn mới = Có đồ ăn ngon".</li>
  <li><strong>Bước 4 — Gặp mặt có giám sát ngắn hạn:</strong> Giữ dây dắt hoặc đồ chơi phân tâm, kết thúc buổi gặp trước khi có dấu hiệu gầm gừ.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: '4 bước giới thiệu thành viên bốn chân mới vào gia đình',
      intro: 'Quá trình hòa nhập thường mất 2–4 tuần tùy tính cách từng bé; đừng nóng vội thả chung ngay ngày đầu tiên.',
      bullets: [
        'Luôn ưu tiên chào hỏi và cho thú cưng cũ ăn trước để bé không cảm thấy bị ra rìa.',
        'Chuẩn bị riêng bát ăn, khay cát và chỗ nằm cho mỗi bé để giảm cạnh tranh tài nguyên.',
      ],
      tip: 'Nếu hai bé gừ nhẹ, dùng bìa cứng chắn tầm nhìn nhẹ nhàng để tách ra, không thò tay không can thiệp khi chúng đang hoảng.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 640,
    likesCount: 51,
    publishedAt: new Date('2026-10-08T14:40:00.000Z'),
  },

  // =========================================================================
  // 4. CHỦ ĐỀ: VỆ SINH & LÀM ĐẸP (6 PUBLISHED)
  // =========================================================================
  {
    title: 'Quy trình tắm sấy chuẩn Spa tại nhà giúp cún Poodle, Phốc Sóc giữ lông bông xù',
    postType: 'OFFICIAL_BLOG',
    category: 'Vệ sinh & Làm đẹp',
    layoutType: 'FEATURED',
    hashtags: ['ve-sinh-lam-dep', 'tam-say', 'grooming', 'poodle'],
    excerpt: 'Hướng dẫn từng bước gỡ rối, chọn sữa tắm độ pH chuẩn da thú cưng và kỹ thuật vừa chải vừa sấy giúp bộ lông tơi bồng bềnh như vừa bước ra từ Spa.',
    content: `<h3>1. Tuyệt đối không tắm bằng sữa tắm của người</h3>
<p>Độ pH da người (~5.5) có tính axit hơn nhiều so với độ pH trung tính của da chó (6.5–7.5). Dùng sữa tắm người gây khô tróc vảy, mất lớp dầu tự nhiên và kích ứng viêm da.</p>
<h3>2. Quy trình 5 bước tắm sấy chuẩn Grooming</h3>
<ul>
  <li><strong>Bước 1 — Chải gỡ rối trước khi làm ướt:</strong> Lông rối gặp nước sẽ bết chặt thành cục nỉ không thể chải nổi.</li>
  <li><strong>Bước 2 — Nước ấm vừa phải (37–38°C):</strong> Xả ướt từ cổ xuống thân, tránh xịt nước thẳng vào lỗ tai và mũi.</li>
  <li><strong>Bước 3 — Tắm 2 lượt & Ủ xả dưỡng ẩm:</strong> Lượt 1 làm sạch bụi bẩn dầu nhờn; lượt 2 kết hợp dầu xả giữ nếp lông.</li>
  <li><strong>Bước 4 — Sấy khô hoàn toàn tận chân lông:</strong> Dùng lược bàn chải Slicker vừa chải xuôi vừa sấy ấm để nâng phồng từng sợi lông.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: '5 bước tắm sấy chuẩn Groomer chuyên nghiệp tại nhà',
      intro: 'Độ ẩm sót lại ở kẽ chân và nếp tai sau khi tắm là nguyên nhân số 1 dẫn đến nấm da và viêm tai.',
      imageUrl: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80',
      imageCaption: 'Chăm sóc tắm sấy và tạo kiểu lông chuyên nghiệp tại Dr. Pet\'s House',
      bullets: [
        'Tần suất tắm lý tưởng là 7–14 ngày/lần tùy mức độ vận động và chất lông.',
        'Đặt tấm lót chống trượt trong bồn tắm để cún đứng vững, giảm căng thẳng khi tắm.',
      ],
      tip: 'Với các giống lông xoăn dày như Poodle, Bichon, hãy đặt lịch Grooming chuyên nghiệp mỗi 4–6 tuần để cắt tỉa tạo form gọn gàng.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1591769225440-811ad7d6eab3?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1710,
    likesCount: 132,
    publishedAt: new Date('2026-11-13T15:00:00.000Z'),
  },
  {
    title: 'Bí quyết vệ sinh tai, mắt và cắt mài móng an toàn cho chó mèo tại nhà',
    postType: 'OFFICIAL_BLOG',
    category: 'Vệ sinh & Làm đẹp',
    layoutType: 'STANDARD',
    hashtags: ['ve-sinh-lam-dep', 'cat-mong', 've-sinh-tai'],
    excerpt: 'Sợ cắt phạm vào tủy móng gây chảy máu hay làm đau tai bé? Nắm vững giải phẫu móng và cách nhỏ dung dịch rửa tai đúng kỹ thuật.',
    content: `<h3>1. Cách nhận biết phần tủy máu khi cắt móng</h3>
<p>Với móng trắng trong, bạn dễ dàng thấy phần lõi hồng chứa mạch máu bên trong — chỉ cắt phần đầu móng trắng nhô ra cách tủy hồng khoảng 2mm và dùng máy mài dũa tròn cạnh.</p>
<h3>2. Vệ sinh tai sạch ráy không dùng tăm bông thọc sâu</h3>
<ul>
  <li>Nhỏ dung dịch vệ sinh tai thú y vào ống tai, bóp nhẹ phần sụn gốc tai khoảng 20 giây để hòa tan ráy tai.</li>
  <li>Thả cho bé tự lắc đầu đẩy chất bẩn ra ngoài, sau đó dùng bông gòn sạch lau nhẹ phần vành tai ngoài.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Kỹ thuật chăm sóc tai, mắt và cắt móng an toàn',
      intro: 'Móng mọc quá dài dễ bị cong chọc ngược vào đệm thịt bàn chân hoặc làm thay đổi dáng đi xương khớp của chó.',
      bullets: [
        'Luôn chuẩn bị sẵn bột cầm máu thú y khi tự cắt móng tại nhà.',
        'Nếu móng màu đen đục không thấy tủy, hãy cắt từng lát mỏng 1mm và dừng khi thấy chấm tối tròn ở mặt cắt.',
      ],
      tip: 'Lau khóe mắt hằng ngày bằng nước muối sinh lý và bông gòn mềm để hạn chế vết ố nước mắt trên các giống lông trắng.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1583512603805-3cc6b41f3edb?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1340,
    likesCount: 99,
    publishedAt: new Date('2026-11-06T10:20:00.000Z'),
  },
  {
    title: 'Tips Giữ Ấm Cho Thú Cưng Trong Mùa Đông',
    postType: 'OFFICIAL_BLOG',
    category: 'Vệ sinh & Làm đẹp',
    layoutType: 'STANDARD',
    hashtags: ['ve-sinh-lam-dep', 'giu-am', 'mua-dong', 'cham-soc'],
    excerpt: 'Hướng dẫn chọn áo giữ nhiệt thoáng khí, lót ổ ấm và điều chỉnh lịch tắm gội khi trời chuyển lạnh hoặc thú cưng thường xuyên ở phòng máy lạnh.',
    content: `<h3>1. Chăm sóc bộ lông và giữ ấm cơ thể mùa lạnh</h3>
<p>Vào mùa đông hoặc những ngày mưa lạnh kéo dài, thú cưng lông ngắn, cún nhỏ dưới 5kg và thú cưng lớn tuổi rất dễ hạ thân nhiệt nếu ngủ trực tiếp trên nền gạch đá hoa.</p>
<ul>
  <li>Kê nệm ngủ cao cách mặt sàn ít nhất 5–10cm và tránh vị trí cửa ra vào có gió lùa.</li>
  <li>Mặc áo cotton co giãn giữ ấm nhưng cần cởi áo chải lông hàng ngày để tránh bết rối lông nách, cổ.</li>
  <li>Giảm tần suất tắm nước, thay vào đó sử dụng khăn lau ấm hoặc phấn/bọt tắm khô chuyên dụng giữa các kỳ tắm.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Giữ ấm toàn diện nhưng vẫn đảm bảo bộ lông khô thoáng',
      intro: 'Mặc áo liên tục nhiều ngày không chải lông là nguyên nhân khiến Poodle, Pomeranian bị rối nỉ sát da vào mùa lạnh.',
      bullets: [
        'Cởi áo tối thiểu 1 lần/ngày để chải tơi lông và kiểm tra da không bị ẩm bí.',
        'Sấy khô bàn chân và bụng ngay sau khi đi dạo ngoài trời sương lạnh.',
      ],
      tip: 'Sưởi ấm bằng đệm nỉ hoặc túi chườm ấm an toàn, tuyệt đối không để bếp sưởi sát ổ vì dễ gây bỏng nhiệt.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1650,
    likesCount: 115,
    publishedAt: new Date('2026-11-04T08:00:00.000Z'),
  },
  {
    title: 'Chăm sóc răng miệng và phòng ngừa mảng bám cao răng cho chó mèo',
    postType: 'OFFICIAL_BLOG',
    category: 'Vệ sinh & Làm đẹp',
    layoutType: 'STANDARD',
    hashtags: ['ve-sinh-lam-dep', 'rang-mieng', 'hoi-mieng'],
    excerpt: 'Trên 80% chó mèo trên 3 tuổi gặp vấn đề nha chu gây hôi miệng, tụt nướu và rụng răng sớm. Học ngay cách đánh răng và bảo vệ nướu cho bé.',
    content: `<h3>1. Tác hại của cao răng tích tụ lâu ngày</h3>
<p>Vi khuẩn từ mảng bám cao răng không chỉ gây viêm nướu chảy máu khiến thú cưng bỏ ăn mà còn có thể theo mạch máu đi tới van tim và thận.</p>
<h3>2. 3 biện pháp giữ hơi thở thơm tho</h3>
<ul>
  <li>Đánh răng định kỳ 3–4 lần/tuần bằng bàn chải mềm và kem đánh răng chuyên dụng thú cưng (an toàn khi nuốt).</li>
  <li>Kết hợp dung dịch pha nước uống hạn chế mảng bám và xương gặm nha khoa.</li>
  <li>Đưa đi lấy cao răng siêu âm tại phòng khám khi thấy mảng vàng nâu dày sát viền nướu.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Bảo vệ hàm răng trắng khỏe và hơi thở thơm tho',
      intro: 'Tập cho thú cưng làm quen với hương vị kem đánh răng vị gà/bò ngay từ nhỏ sẽ giúp việc vệ sinh răng miệng trở nên nhẹ nhàng.',
      bullets: [
        'Tuyệt đối KHÔNG dùng kem đánh răng có Fluoride của người cho chó mèo.',
        'Kiểm tra viền nướu mỗi tuần xem có dấu hiệu đỏ rực hoặc rỉ máu không.',
      ],
      tip: 'Sau 3 ngày tập đánh răng bằng ngón tay bọc gạc, hãy chuyển dần sang bàn chải lông tơ mềm.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 820,
    likesCount: 66,
    publishedAt: new Date('2026-10-25T10:15:00.000Z'),
  },
  {
    title: 'Cách chải lông, gỡ rối và hạn chế búi lông (Hairball) cho mèo lông dài',
    postType: 'OFFICIAL_BLOG',
    category: 'Vệ sinh & Làm đẹp',
    layoutType: 'STANDARD',
    hashtags: ['ve-sinh-lam-dep', 'meo-long-dai', 'bui-long'],
    excerpt: 'Mèo Anh lông dài, Ba Tư hay Ragdoll dễ nuốt lượng lớn lông rụng gây nôn mửa hoặc tắc ruột. Khám phá bộ lược chải và cách chăm lông hiệu quả.',
    content: `<h3>1. Tại sao mèo cần được chải lông mỗi ngày?</h3>
<p>Chiếc lưỡi có gai ngược của mèo hoạt động như một chiếc lược tự nhiên, nuốt phần lớn lông chết vào dạ dày khi bé tự liếm láp. Nếu tích tụ nhiều sẽ vón thành búi lông gây nôn khan hoặc tắc ruột.</p>
<h3>2. Bộ dụng cụ chải lông chuẩn</h3>
<ul>
  <li><strong>Lược răng thưa inox:</strong> Kiểm tra các búi lông rối ẩn sâu sát da ở vùng cổ, bụng và sau tai.</li>
  <li><strong>Lược Slicker / Lược cao su:</strong> Gom lớp lông tơ rụng mỗi ngày.</li>
  <li>Kết hợp gel tiêu búi lông (Hairball Gel) hoặc cỏ mèo 2 lần/tuần.</li>
</ul>`,
    contentBlocks: buildRichBlocks({
      heading: 'Chăm sóc bộ lông óng ả cho các bé mèo lông dài',
      intro: 'Chải lông 5 phút mỗi tối không chỉ loại bỏ 80% lông rụng trong nhà mà còn giúp mèo thư giãn như được massage.',
      bullets: [
        'Chải nhẹ nhàng theo chiều mọc tự nhiên của lông, không giật mạnh vào cục rối.',
        'Nếu lông rối kết chặt sát da, hãy đưa đến Groomer dùng tông đơ an toàn xử lý thay vì tự dùng kéo dễ cắt phạm vào da mỏng của mèo.',
      ],
      tip: 'Cỏ lúa mì tươi (cỏ mèo) cung cấp chất xơ giúp kích thích nhu động ruột đẩy lông thừa ra ngoài theo phân.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 910,
    likesCount: 77,
    publishedAt: new Date('2026-10-15T14:30:00.000Z'),
  },
  {
    title: 'Hướng dẫn vệ sinh đệm thịt bàn chân và vắt tuyến hôi định kỳ đúng kỹ thuật',
    postType: 'OFFICIAL_BLOG',
    category: 'Vệ sinh & Làm đẹp',
    layoutType: 'STANDARD',
    hashtags: ['ve-sinh-lam-dep', 'ban-chan', 'tuyen-hoi'],
    excerpt: 'Giữ bàn chân không hôi mùi ẩm mốc, dưỡng mềm đệm thịt chống nứt nẻ và nhận biết thời điểm cần vắt tuyến hôi hậu môn cho cún.',
    content: `<h3>1. Chăm sóc bàn chân sạch khỏe cho chó mèo sống trong nhà</h3>
<p>Lông mọc dài trùm qua kẽ đệm thịt khiến thú cưng dễ bị trơn trượt trên sàn gỗ/gạch bóng, đồng thời giữ ẩm bẩn gây viêm kẽ ngón chân.</p>
<ul>
  <li>Cạo tỉa gọn lông phần kẽ đệm chân mỗi 3 tuần và lau sạch chân sau mỗi lần đi dạo.</li>
  <li>Thoa sáp dưỡng đệm thịt (Paw Balm) chứa sáp ong và dầu dừa nếu bàn chân khô nứt.</li>
</ul>
<h3>2. Khi nào cần vắt tuyến hôi?</h3>
<p>Nếu thấy chó hay kéo lê mông trên thảm ("chạy xe"), liếm vùng hậu môn liên tục hoặc có mùi tanh đặc trưng sau khi đi vệ sinh, hãy đưa bé tới dịch vụ Grooming để kỹ thuật viên kiểm tra tuyến hôi định kỳ.</p>`,
    contentBlocks: buildRichBlocks({
      heading: 'Chăm sóc từ bàn chân đến vệ sinh tuyến hôi định kỳ',
      intro: 'Cắt gọn lông kẽ bàn chân giúp chó bám sàn chắc hơn, bảo vệ khớp gối và ngăn ngừa nấm kẽ chân.',
      bullets: [
        'Không tự vắt tuyến hôi quá mạnh tay nếu tuyến đang sưng viêm đau vì dễ làm vỡ túi tuyến.',
        'Chế độ ăn đủ chất xơ giúp phân thành khuôn tự nhiên, hỗ trợ ép tiết tuyến hôi sinh lý mỗi lần đi tiêu.',
      ],
      tip: 'Dùng dung dịch rửa chân tạo bọt không cần xả lại bằng nước để vệ sinh nhanh mỗi tối sau khi dắt cún đi dạo.',
    }),
    thumbnailUrl: 'https://images.unsplash.com/photo-1507146426996-ef05306b995a?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 685,
    likesCount: 53,
    publishedAt: new Date('2026-10-05T11:00:00.000Z'),
  },
];

export const FIRST_AID_GUIDES_SEED = [
  // 1. Nhóm: Tai nạn & Khẩn cấp (accident)
  {
    title: 'Sơ cứu khi chó mèo bị sốc nhiệt (Say nắng) khẩn cấp',
    postType: 'FIRST_AID',
    category: 'accident',
    urgencyLevel: 'URGENT',
    heroTitle: 'CẤP CỨU SỐC NHIỆT THÚ CƯNG',
    stepBadges: ['Kiểm tra thân nhiệt', 'Làm mát từ từ', 'Không dội nước đá'],
    emergencyPhone: '1900-6868',
    excerpt: 'Nhận biết triệu chứng thở dốc, nướu đỏ sẫm, lảo đảo khi trời nắng nóng và quy trình hạ nhiệt an toàn tránh trụy tim.',
    content: `<p>Sốc nhiệt xảy ra khi thân nhiệt chó mèo vượt ngưỡng 40.5°C và có thể gây tổn thương đa cơ quan chỉ trong 15–20 phút.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Đưa thú cưng ngay vào khu vực râm mát',
        instruction: 'Nhanh chóng di chuyển bé ra khỏi nắng gắt hoặc xe kín vào nơi thoáng khí có quạt gió.',
      },
      {
        stepNumber: 2,
        title: 'Làm mát từ từ bằng khăn ướt mát (KHÔNG dùng nước đá)',
        instruction: 'Dùng khăn thấm nước mát lau vùng bụng, nách, bẹn và đệm bàn chân. Tuyệt đối không ngâm nước đá lạnh vì gây co mạch phản xạ cản trở thoát nhiệt.',
      },
      {
        stepNumber: 3,
        title: 'Cho nhấp từng ngụm nước mát nhỏ & gọi cấp cứu',
        instruction: 'Nếu bé còn tỉnh, cho uống lượng nhỏ nước mát. Gọi Hotline 1900-6868 và đưa đến Dr. Pet\'s House gần nhất để truyền dịch hạ nhiệt.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1920,
    likesCount: 158,
    publishedAt: new Date('2026-11-01T10:00:00.000Z'),
  },
  {
    title: 'Xử trí sơ cứu khi thú cưng bị co giật, động kinh đột ngột',
    postType: 'FIRST_AID',
    category: 'accident',
    urgencyLevel: 'URGENT',
    heroTitle: 'XỬ TRÍ CƠN CO GIẬT CẤP TÍNH',
    stepBadges: ['Dọn vật sắc nhọn', 'Không thò tay vào miệng', 'Ghi hình thời gian cơn'],
    emergencyPhone: '1900-6868',
    excerpt: 'Giữ an toàn tính mạng cho chó mèo trong cơn co giật và tránh sai lầm bị cắn hoặc gây ngạt đường thở.',
    content: `<p>Trong cơn co giật, thú cưng mất ý thức tạm thời và không kiểm soát được phản xạ hàm.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Dọn sạch đồ đạc xung quanh & tắt nguồn sáng mạnh',
        instruction: 'Kê gối hoặc chăn mềm dưới đầu và xung quanh người để bé không va đập vào cạnh bàn, tường.',
      },
      {
        stepNumber: 2,
        title: 'TUYỆT ĐỐI không đưa tay hoặc vật cứng vào miệng bé',
        instruction: 'Chó mèo không tự nuốt lưỡi khi co giật; việc cố banh miệng dễ gây gãy răng hoặc cắn đứt tay bạn.',
      },
      {
        stepNumber: 3,
        title: 'Bấm giờ cơn giật & đưa đi cấp cứu ngay nếu kéo dài > 3 phút',
        instruction: 'Quay lại video ngắn nếu an toàn để bác sĩ thú y chẩn đoán chính xác nguyên nhân.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1120,
    likesCount: 88,
    publishedAt: new Date('2026-10-18T10:00:00.000Z'),
  },

  // 2. Nhóm: Ngộ độc thực phẩm & Hóa chất (poisoning)
  {
    title: 'Xử lý khẩn cấp khi thú cưng bị ngộ độc thực phẩm lạ hoặc hóa chất',
    postType: 'FIRST_AID',
    category: 'poisoning',
    urgencyLevel: 'URGENT',
    heroTitle: 'CẤP CỨU NGỘ ĐỘC THỰC PHẨM & HÓA CHẤT',
    stepBadges: ['Giữ mẫu độc tố', 'Không tự gây nôn', 'Chuyển ICU ngay'],
    emergencyPhone: '1900-6868',
    excerpt: 'Nhận biết triệu chứng trúng độc thức ăn (sô-cô-la, nho khô), bả chuột, thuốc trừ sâu và các bước sơ cứu trước khi đến bác sĩ.',
    content: `<p>Trúng độc là một trong những ca cấp cứu tối khẩn cấp tại phòng khám thú y Dr. Pet's House.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Cách ly nguồn chất độc và giữ lại mẫu vật',
        instruction: 'Đưa thú cưng ra khỏi khu vực có hóa chất, giữ lại vỏ bao bì hoặc chụp ảnh mẫu chất lạ để bác sĩ xác định đúng độc tố.',
      },
      {
        stepNumber: 2,
        title: 'KHÔNG tự ý gây nôn nếu chưa hỏi ý kiến bác sĩ',
        instruction: 'Nếu nuốt phải chất tẩy rửa kiềm/axit hoặc xăng dầu, gây nôn sẽ làm bỏng thực quản lần 2. Chỉ gây nôn khi có chỉ định bác sĩ.',
      },
      {
        stepNumber: 3,
        title: 'Giữ ấm và chuyển viện cấp cứu ICU',
        instruction: 'Đặt thú cưng nằm nghiêng đầu để tránh hít sặc nếu nôn mửa, di chuyển ngay tới phòng khám thú y gần nhất.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1680,
    likesCount: 129,
    publishedAt: new Date('2026-10-29T11:00:00.000Z'),
  },
  {
    title: 'Sơ cứu nhanh khi mèo chó liếm phải tinh dầu, thuốc xịt côn trùng hoặc sáp thơm',
    postType: 'FIRST_AID',
    category: 'poisoning',
    urgencyLevel: 'URGENT',
    heroTitle: 'NGỘ ĐỘC HÓA CHẤT QUA DA & NIÊM MẠC',
    stepBadges: ['Rửa sạch da lông', 'Tránh liếm thêm', 'Đưa đi xét nghiệm'],
    emergencyPhone: '1900-6868',
    excerpt: 'Tinh dầu sả chanh, tràm trà hay thuốc diệt côn trùng bám trên lông có thể ngấm qua da và gan mèo khi bé tự liếm lông.',
    content: `<p>Mèo thiếu men gan Glucuronosyltransferase nên cực kỳ nhạy cảm với tinh dầu thiên nhiên và hợp chất Permethrin.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Rửa sạch ngay vùng lông dính hóa chất bằng nước ấm và sữa tắm dịu nhẹ',
        instruction: 'Không dùng dung môi lạ để tẩy; rửa trôi nhanh bằng nước ấm trong 5–10 phút.',
      },
      {
        stepNumber: 2,
        title: 'Đeo loa chống liếm tức thì',
        instruction: 'Ngăn không cho thú cưng tiếp tục liếm phần lông đang còn dư lượng hóa chất.',
      },
      {
        stepNumber: 3,
        title: 'Theo dõi chảy dãi, run cơ và đưa tới bác sĩ',
        instruction: 'Gọi 1900-6868 nếu bé xuất hiện dấu hiệu chảy nước dãi kéo dài, loạng choạng hoặc nôn ói.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 840,
    likesCount: 67,
    publishedAt: new Date('2026-10-14T15:00:00.000Z'),
  },

  // 3. Nhóm: Khó thở & Dị vật đường thở (breathing)
  {
    title: 'Cách sơ cứu chó mèo bị hóc dị vật đường thở khẩn cấp (Heimlich thú y)',
    postType: 'FIRST_AID',
    category: 'breathing',
    urgencyLevel: 'URGENT',
    heroTitle: 'CẤP CỨU HÓC DỊ VẬT & NGẠT THỞ',
    stepBadges: ['Kiểm tra khoang miệng', 'Thủ thuật Heimlich', 'Thở oxy gấp'],
    emergencyPhone: '1900-6868',
    excerpt: 'Hướng dẫn từng giây kiểm tra cổ họng và thực hiện thủ thuật Heimlich đẩy xương, bóng đồ chơi cứu mạng thú cưng nghẹt thở.',
    content: `<p>Khi dị vật nghẽn khí quản, thời gian vàng để cứu sống thú cưng chỉ tính bằng phút.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Giữ bình tĩnh và mở rộng khoang miệng kiểm tra',
        instruction: 'Kéo nhẹ lưỡi sang một bên quan sát cuống họng. Nếu dị vật lỏng lẻo và nhìn thấy rõ, dùng kẹp gắp cẩn thận.',
      },
      {
        stepNumber: 2,
        title: 'Thực hiện thủ thuật Heimlich thú y',
        instruction: 'Với chó mèo nhỏ: Bế lưng tựa vào ngực bạn, đặt nắm tay dưới xương ức đẩy dứt khoát hướng lên trên 4–5 lần. Với chó lớn: Đặt nằm nghiêng, dùng 2 tay ép mạnh vùng bụng dưới xương sườn.',
      },
      {
        stepNumber: 3,
        title: 'Di chuyển cấp cứu thở oxy',
        instruction: 'Ngay cả khi dị vật đã bật ra, cần đưa bé đến bác sĩ kiểm tra tổn thương thanh quản và phổi.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: true,
    viewCount: 1940,
    likesCount: 151,
    publishedAt: new Date('2026-11-04T09:00:00.000Z'),
  },
  {
    title: 'Xử trí ban đầu khi mèo thở hổn hển bằng miệng hoặc chó tím tái lưỡi',
    postType: 'FIRST_AID',
    category: 'breathing',
    urgencyLevel: 'URGENT',
    heroTitle: 'CẢNH BÁO SUY HÔ HẤP CẤP',
    stepBadges: ['Giữ tư thế tự nhiên', 'Hạn chế bế ép ngực', 'Đưa đi chụp X-quang'],
    emergencyPhone: '1900-6868',
    excerpt: 'Khác với chó, mèo KHÔNG bao giờ há miệng thở hổn hển trừ khi quá căng thẳng cực độ hoặc suy tim, tràn dịch màng phổi.',
    content: `<p>Khó thở là tình trạng đe dọa tính mạng ngay lập tức đòi hỏi can thiệp lồng oxy thú y.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Để thú cưng giữ tư thế dễ thở nhất (thường là nằm sấp rướn cổ)',
        instruction: 'Không ép bé nằm ngửa hoặc ôm ghì chặt quanh lồng ngực.',
      },
      {
        stepNumber: 2,
        title: 'Mở thoáng không khí & giảm tối đa stress',
        instruction: 'Tránh gây tiếng ồn lớn hay tụ tập đông người quanh thú cưng đang thiếu oxy.',
      },
      {
        stepNumber: 3,
        title: 'Chuyển nhanh tới phòng khám có bình Oxy y tế',
        instruction: 'Gọi trước hotline 1900-6868 để bác sĩ chuẩn bị sẵn buồng oxy ngay khi bạn vừa tới cổng.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 1050,
    likesCount: 84,
    publishedAt: new Date('2026-10-22T14:00:00.000Z'),
  },

  // 4. Nhóm: Chấn thương & Chăm sóc vết thương (injury)
  {
    title: 'Hướng dẫn băng bó và cầm máu vết thương hở cho thú cưng',
    postType: 'FIRST_AID',
    category: 'injury',
    urgencyLevel: 'URGENT',
    heroTitle: 'CẦM MÁU & BĂNG BÓ VẾT THƯƠNG HỞ',
    stepBadges: ['Bảo vệ an toàn', 'Ép gạc 3-5 phút', 'Băng cố định vừa đủ'],
    emergencyPhone: '1900-6868',
    excerpt: 'Kỹ thuật ép gạc vô khuẩn cầm máu tại chỗ và băng bó tạm thời an toàn khi thú cưng bị cắn xé hoặc giẫm phải mảnh kính.',
    content: `<p>Chấn thương ngoài da chảy nhiều máu cần được cầm máu đúng kỹ thuật để ngăn sốc mất máu trước khi đến bác sĩ.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Đeo rọ mõm hoặc quấn khăn an toàn',
        instruction: 'Khi đau đớn đột ngột, thú cưng có thể cắn phản xạ. Hãy bảo đảm an toàn trước khi thao tác.',
      },
      {
        stepNumber: 2,
        title: 'Ép trực tiếp bằng gạc vô trùng trong 3–5 phút',
        instruction: 'Dùng gạc y tế ấn chặt liên tục lên miệng vết thương; không nhấc gạc ra xem liên tục khiến cục máu đông bị phá vỡ.',
      },
      {
        stepNumber: 3,
        title: 'Băng cố định và đưa đi khâu vết thương',
        instruction: 'Quấn băng vừa tay giữ gạc (không siết chặt quá gây tím tái đầu chi) rồi chuyển tới bác sĩ.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 920,
    likesCount: 73,
    publishedAt: new Date('2026-10-19T16:20:00.000Z'),
  },
  {
    title: 'Cách cố định tạm thời khi nghi ngờ chó mèo bị gãy xương sau tai nạn',
    postType: 'FIRST_AID',
    category: 'injury',
    urgencyLevel: 'NORMAL',
    heroTitle: 'DI CHUYỂN AN TOÀN KHI NGHI GÃY XƯƠNG',
    stepBadges: ['Hạn chế xê dịch', 'Dùng tấm ván phẳng', 'Không tự nắn xương'],
    emergencyPhone: '1900-6868',
    excerpt: 'Sai lầm khi bế xốc lên tay có thể khiến đầu xương gãy chọc rách mạch máu và dây thần kinh. Xem ngay cách đặt cáng phẳng an toàn.',
    content: `<p>Nếu chó mèo không chạm chân xuống đất, chi biến dạng hoặc sưng phù nhanh sau té ngã, tuyệt đối không tự kéo nắn.</p>`,
    steps: [
      {
        stepNumber: 1,
        title: 'Giữ bé nằm yên tại chỗ, hạn chế cử động mạnh',
        instruction: 'Nói chuyện trấn an và che mắt nhẹ bằng khăn mỏng để giảm hoảng sợ.',
      },
      {
        stepNumber: 2,
        title: 'Dùng tấm bìa cứng phẳng hoặc đáy lồng vận chuyển làm cáng',
        instruction: 'Trượt nhẹ hai tay nâng đỡ đều đầu, lưng và hông đặt bé nằm phẳng lên tấm đỡ cứng thay vì bế gập bụng.',
      },
      {
        stepNumber: 3,
        title: 'Chụp X-quang chẩn đoán sớm tại phòng khám',
        instruction: 'Bác sĩ sẽ giảm đau và đánh giá chỉ định bó nẹp hoặc kết hợp xương phẫu thuật.',
      },
    ],
    thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80',
    status: 'PUBLISHED',
    isFeatured: false,
    viewCount: 760,
    likesCount: 61,
    publishedAt: new Date('2026-10-09T11:30:00.000Z'),
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
    type: 'KINH_NGHIEM',
    typeLabel: 'Kinh nghiệm',
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
    type: 'MEO_VAT',
    typeLabel: 'Mẹo vặt',
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
    type: 'HOI_DAP',
    typeLabel: 'Hỏi đáp',
    authorNameSnapshot: 'Lê Minh Khang',
    status: 'PENDING',
    likesCount: 6,
    commentsCount: 2,
  },
  {
    title: 'Cần bán gấp đàn chó con giá rẻ không rõ nguồn gốc tại TP.HCM',
    content: 'Cần thanh lý gấp đàn cún con lai không rõ nguồn gốc giá 500k/con, ai cần inbox qua số điện thoại lạ...',
    imageUrls: [],
    type: 'KHOANH_KHAC',
    typeLabel: 'Khoảnh khắc',
    authorNameSnapshot: 'Tài khoản Vi Phạm (Spam)',
    status: 'REJECTED',
    rejectionReason: 'Vi phạm quy chế cộng đồng Dr. Pet: Diễn đàn chỉ chia sẻ kiến thức nuôi dưỡng thú cưng phi thương mại, nghiêm cấm đăng tin buôn bán hoặc kinh doanh thú nuôi.',
    likesCount: 0,
    commentsCount: 0,
  },
];

const partnerSGT = DEFAULT_RESCUE_PARTNERS.find((p) => p.id === 'saigon-time') || DEFAULT_RESCUE_PARTNERS[0];
const partnerVawa = DEFAULT_RESCUE_PARTNERS.find((p) => p.id === 'vawa') || DEFAULT_RESCUE_PARTNERS[0];
const partnerLfp = DEFAULT_RESCUE_PARTNERS.find((p) => p.id === 'laws-for-paws') || DEFAULT_RESCUE_PARTNERS[0];

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
    supportNeeds: 'Cần tìm gia đình yêu thương, hỗ trợ hạt khô và chi phí khám sức khỏe định kỳ.',
    ownershipType: 'PARTNER_MAINTAINED',
    supportPartnerId: partnerSGT.id,
    supportPartnerName: partnerSGT.name,
    supportPartnerPhone: partnerSGT.phone,
    supportPartnerUrl: partnerSGT.websiteUrl,
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
    supportNeeds: 'Cần cát vệ sinh đậu nành, pate dinh dưỡng và nhà nhận nuôi có lưới an toàn ban công.',
    ownershipType: 'PARTNER_MAINTAINED',
    supportPartnerId: partnerVawa.id,
    supportPartnerName: partnerVawa.name,
    supportPartnerPhone: partnerVawa.phone,
    supportPartnerUrl: partnerVawa.websiteUrl,
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
    supportNeeds: 'Bé đã tìm được tổ ấm mới hạnh phúc.',
    ownershipType: 'PARTNER_MAINTAINED',
    supportPartnerId: partnerLfp.id,
    supportPartnerName: partnerLfp.name,
    supportPartnerPhone: partnerLfp.phone,
    supportPartnerUrl: partnerLfp.websiteUrl,
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

    // Clean up legacy/obsolete blog categories so Post.distinct/categories never pollutes the 4 canonical topics
    await Post.deleteMany({
      postType: 'OFFICIAL_BLOG',
      category: { $in: ['Cẩm nang nuôi dưỡng', 'Dinh dưỡng thú cưng', 'Y tế & Bệnh học', 'Chăm sóc'] },
    });

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
    console.log(`✅ Đã đồng bộ ${postCount} bài viết Blog (${BLOG_POSTS_SEED.length} bài: 24 PUBLISHED across 4 chủ đề + 2 DRAFT) và Cẩm nang sơ cứu y tế (${FIRST_AID_GUIDES_SEED.length} bài).`);

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
    console.log(`✅ Đã đồng bộ ${rescueCount} hồ sơ thú cưng cơ nhỡ tìm tổ ấm (kèm link đối tác cứu trợ).`);

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
        customerId,
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
    console.log(`| Bài viết Blog / Sơ cứu (Posts)    : ${String(postCount).padEnd(4)} bài (${BLOG_POSTS_SEED.length} Blog + ${FIRST_AID_GUIDES_SEED.length} First Aid)`);
    console.log(`| Diễn đàn cộng đồng (Community)    : ${String(communityCount).padEnd(4)} bài (Đủ trạng thái duyệt)`);
    console.log(`| Thú cưng cứu hộ (RescuePets)      : ${String(rescueCount).padEnd(4)} bé (Đủ partner CTA)`);
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
