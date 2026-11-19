import mongoose from 'mongoose';
import Feedback from '../modules/review/models/Feedback';
import Review from '../modules/review/models/Review';
import Customer from '../modules/customer/models/Customer';
import User from '../models/User';
import Product from '../modules/catalog/models/Product';
import Service from '../modules/catalog/models/Service';
import Order from '../modules/order/models/Order';
import Appointment from '../modules/booking/models/Appointment';
import Branch from '../modules/branch/models/Branch';
import CommunityReport from '../modules/content/models/CommunityReport';
import CommunityPost from '../modules/content/models/CommunityPost';
import StaffProfile from '../modules/staff/models/StaffProfile';
import Shift from '../modules/staff/models/Shift';
import { recalculateTargetRating } from '../modules/review/review.service';
import { logger } from '../shared/logger';

export const purgeTesterData = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return;
    const db = mongoose.connection.db;

    // 1. Purge staff Nguyễn Văn Mười (created by Hưng without proper staffCode or with raw ObjectId)
    const muoiQuery = {
      $or: [
        { fullName: /Nguyễn Văn Mười/i },
        { name: /Nguyễn Văn Mười/i },
        { username: /muoi/i },
        { staffCode: /6aff04861e617f1acfe4a25f/i },
      ]
    };
    if (mongoose.Types.ObjectId.isValid('6aff04861e617f1acfe4a25f')) {
      muoiQuery.$or.push({ _id: new mongoose.Types.ObjectId('6aff04861e617f1acfe4a25f') });
    }

    const muoiUsers = await db.collection('users').find(muoiQuery).toArray();
    for (const u of muoiUsers) {
      await db.collection('users').deleteOne({ _id: u._id });
      await db.collection('staffprofiles').deleteMany({ userId: u._id });
      await db.collection('shifts').deleteMany({ staffId: u._id });
      logger.info(`[Purge] Purged staff user: ${u.fullName} (${u._id})`);
    }

    const muoiProfiles = await db.collection('staffprofiles').find({
      $or: [
        { staffCode: /6aff04861e617f1acfe4a25f/i },
        ...(mongoose.Types.ObjectId.isValid('6aff04861e617f1acfe4a25f') ? [{ _id: new mongoose.Types.ObjectId('6aff04861e617f1acfe4a25f') }] : [])
      ]
    }).toArray();

    for (const p of muoiProfiles) {
      await db.collection('staffprofiles').deleteOne({ _id: p._id });
      if (p.userId) await db.collection('users').deleteOne({ _id: p.userId });
      await db.collection('shifts').deleteMany({ staffId: p._id });
      logger.info(`[Purge] Purged staff profile: ${p._id}`);
    }

    // 2. Purge orders created today by tester (e.g. ORD-20261119-*, or test orders with contact name 'Khách hàng')
    const todayOrders = await db.collection('orders').find({
      $or: [
        { code: /^ORD-20261119/i },
        { 'contactSnapshot.fullName': /^Khách hàng$/i, createdAt: { $gte: new Date('2026-11-19T00:00:00.000Z') } },
      ]
    }).toArray();

    if (todayOrders.length > 0) {
      const orderIds = todayOrders.map(o => o._id);
      await db.collection('orders').deleteMany({ _id: { $in: orderIds } });
      await db.collection('payments').deleteMany({ orderId: { $in: orderIds } });
      logger.info(`[Purge] Purged ${todayOrders.length} test orders created today by tester.`);
    }

    // 3. Purge appointments created today by tester (e.g. APT-20261119-*, Khách Hàng 1-1 .. Khách Hàng 18-2)
    const todayApts = await db.collection('appointments').find({
      $or: [
        { code: /^APT-20261119/i },
        { 'customerSnapshot.fullName': /^Khách Hàng \d+-\d+$/i },
        { 'contactSnapshot.fullName': /^Khách Hàng \d+-\d+$/i }
      ]
    }).toArray();

    if (todayApts.length > 0) {
      const aptIds = todayApts.map(a => a._id);
      await db.collection('appointments').deleteMany({ _id: { $in: aptIds } });
      await db.collection('servicerecords').deleteMany({ appointmentId: { $in: aptIds } });
      await db.collection('payments').deleteMany({ appointmentId: { $in: aptIds } });
      logger.info(`[Purge] Purged ${todayApts.length} test appointments created today by tester.`);
    }
  } catch (err) {
    logger.warn('[Purge] Warning during tester data purge:', err.message);
  }
};

export const seedModerationData = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return;

    // 0. RUN PURGE OF TESTER DATA & NGUYEN VAN MUOI FIRST
    await purgeTesterData();

    // 1. SEED FEEDBACKS (Customer inquiries, complaints, suggestions, compliments)
    const feedbackCount = await Feedback.countDocuments();
    if (feedbackCount < 10) {
      logger.info(`[ModerationSeed] Seeding realistic feedbacks (current count: ${feedbackCount})...`);

      const adminUser = await User.findOne({ systemRole: 'ADMIN' });
      const adminId = adminUser ? adminUser._id : null;

      const customerCuong = await Customer.findOne({ contactEmail: 'customer.levanc@gmail.com' });
      const cuongId = customerCuong ? customerCuong._id : null;

      const customerTien = await Customer.findOne({ contactEmail: 'kieutien.petcare@gmail.com' });
      const tienId = customerTien ? customerTien._id : null;

      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      const realisticFeedbacks = [
        {
          name: 'Nguyễn Thị Mai',
          email: 'mai.nguyen@gmail.com',
          phone: '0908123456',
          gender: 'female',
          sourceCode: 'CONTACT_FORM',
          subject: 'Khen ngợi bác sĩ và điều dưỡng chi nhánh Quận 1',
          message: 'Hôm qua tôi có đưa bé mèo Miu qua cấp cứu do hóc xương cá. Bác sĩ An và các bạn điều dưỡng xử lý rất nhanh, ân cần giải thích cho gia đình. Bé Miu nay đã khỏe lại, ăn uống bình thường. Cảm ơn phòng khám rất nhiều!',
          category: 'GENERAL',
          customerId: null,
          status: 'PROCESSED',
          processedBy: adminId,
          processingNotes: 'Đã gọi điện cảm ơn khách hàng và tuyên dương kíp trực BS. Nguyễn Văn An tại chi nhánh Quận 1.',
          responseMessage: 'Dr. Pets House chân thành cảm ơn chị Mai. Chúc bé Miu luôn khỏe mạnh và năng động!',
          processedAt: new Date(now - 1 * DAY_MS),
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi phản hồi qua form liên hệ', at: new Date(now - 2 * DAY_MS) },
            { status: 'READ', notes: 'Quản lý CSKH đã đọc', actorId: adminId, at: new Date(now - 1.8 * DAY_MS) },
            { status: 'PROCESSING', notes: 'Xác minh ca cấp cứu với chi nhánh Q1', actorId: adminId, at: new Date(now - 1.5 * DAY_MS) },
            { status: 'PROCESSED', notes: 'Đã gọi điện cảm ơn khách hàng', actorId: adminId, at: new Date(now - 1 * DAY_MS) },
          ],
          createdAt: new Date(now - 2 * DAY_MS),
        },
        {
          name: 'Trần Minh Đức',
          email: 'duc.tran@gmail.com',
          phone: '0912345678',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Tư vấn gói tiêm phòng dại và 7 bệnh cho chó Poodle con',
          message: 'Chào phòng khám, mình mới đón 1 bé Poodle được 2 tháng tuổi. Cho mình hỏi lịch tiêm phòng mũi 1 và mũi 2 cách nhau bao lâu, chi phí gói tiêm phòng và bên mình có dịch vụ đưa đón tại nhà không ạ?',
          category: 'INQUIRY',
          customerId: null,
          status: 'READ',
          processedBy: adminId,
          processingNotes: 'Bác sĩ tư vấn tiêm chủng đã nhận thông tin qua portal, chuẩn bị tài liệu phác đồ gửi khách.',
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi yêu cầu tư vấn', at: new Date(now - 1.2 * DAY_MS) },
            { status: 'READ', notes: 'Bác sĩ tiếp nhận hồ sơ tư vấn', actorId: adminId, at: new Date(now - 0.9 * DAY_MS) },
          ],
          createdAt: new Date(now - 1.2 * DAY_MS),
        },
        {
          name: 'Lê Văn Cường',
          email: 'customer.levanc@gmail.com',
          phone: '0905555555',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Góp ý về khu vực đỗ xe chi nhánh Bình Thạnh',
          message: 'Dịch vụ khám chữa bệnh rất tốt, bác sĩ nhiệt tình. Tuy nhiên khu vực gửi xe ô tô tại chi nhánh Bình Thạnh vào khung giờ cao điểm 17h-19h hơi chật chội, mong phòng khám có thêm nhân viên hướng dẫn bãi đậu xe gần đó để khách an tâm hơn.',
          category: 'SUGGESTION',
          customerId: cuongId,
          status: 'PROCESSING',
          processedBy: adminId,
          processingNotes: 'Đang liên hệ ban quản lý bãi đỗ xe cạnh tòa nhà để xin thêm 3 vị trí đỗ ô tô giờ cao điểm cho khách hàng.',
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi đóng góp ý kiến', at: new Date(now - 3 * DAY_MS) },
            { status: 'READ', notes: 'Quản lý vận hành đã xem', actorId: adminId, at: new Date(now - 2.8 * DAY_MS) },
            { status: 'PROCESSING', notes: 'Đang phối hợp với quản lý bãi xe', actorId: adminId, at: new Date(now - 2 * DAY_MS) },
          ],
          createdAt: new Date(now - 3 * DAY_MS),
        },
        {
          name: 'Phạm Hoàng Long',
          email: 'guest.long@gmail.com',
          phone: '0978889900',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Giao hàng chậm trễ đơn thức ăn hạt Royal Canin',
          message: 'Tôi đặt đơn hàng hạt Royal Canin Mini Adult từ sáng nhưng đến tối muộn shipper mới liên hệ giao. Bé cún bị đói bữa chiều. Mong bộ phận giao hàng tối ưu lại thời gian đóng gói và vận chuyển.',
          category: 'COMPLAINT',
          customerId: null,
          status: 'NEED_CONTACT',
          processedBy: adminId,
          processingNotes: 'Đã liên hệ đơn vị vận chuyển xác minh sự cố giao trễ; CSKH cần gọi điện xin lỗi và gửi tặng voucher 50.000đ cho đơn tiếp theo.',
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách khiếu nại thời gian giao hàng', at: new Date(now - 4 * DAY_MS) },
            { status: 'READ', notes: 'Trưởng bộ phận kho vận tiếp nhận', actorId: adminId, at: new Date(now - 3.8 * DAY_MS) },
            { status: 'NEED_CONTACT', notes: 'Yêu cầu CSKH gọi lại trao đổi và đền bù voucher', actorId: adminId, at: new Date(now - 2.5 * DAY_MS) },
          ],
          createdAt: new Date(now - 4 * DAY_MS),
        },
        {
          name: 'Hoàng Minh Châu',
          email: 'chau.hoang@yahoo.com',
          phone: '0933221100',
          gender: 'female',
          sourceCode: 'CONTACT_FORM',
          subject: 'Hỏi về lịch mổ triệt sản mèo cái bằng phương pháp nội soi',
          message: 'Mình muốn đặt lịch triệt sản cho bé mèo Anh lông ngắn 8 tháng tuổi. Cho mình hỏi bên mình có gói triệt sản nội soi ít đau không, cần kiêng ăn uống trước mổ bao lâu và có phải lưu chuồng qua đêm không?',
          category: 'INQUIRY',
          customerId: null,
          status: 'NEW',
          processedBy: null,
          processingNotes: null,
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi yêu cầu mới', at: new Date(now - 0.2 * DAY_MS) },
          ],
          createdAt: new Date(now - 0.2 * DAY_MS),
        },
        {
          name: 'Vũ Quốc Anh',
          email: 'anh.vu@outlook.com',
          phone: '0989001122',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Đánh giá dịch vụ Grooming & Spa cắt tỉa lông tạo kiểu',
          message: 'Bé cún Samoyed nhà mình lông dày và bị rối nhiều, đưa qua chi nhánh Quận 7 các bạn spa cắt tỉa rất tỉ mỉ, tắm thơm tho sạch sẽ và bé không hề hoảng sợ. Sẽ tiếp tục ủng hộ phòng khám!',
          category: 'GENERAL',
          customerId: null,
          status: 'PROCESSED',
          processedBy: adminId,
          processingNotes: 'Đã lưu ghi chú sở thích spa và dầu tắm phù hợp của thú cưng vào hồ sơ khách hàng.',
          responseMessage: 'Cảm ơn anh Quốc Anh. Chi nhánh Quận 7 rất vui khi mang lại trải nghiệm êm ái cho bé Samoyed!',
          processedAt: new Date(now - 4 * DAY_MS),
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi đánh giá', at: new Date(now - 5 * DAY_MS) },
            { status: 'READ', notes: 'Quản lý Grooming đã xem', actorId: adminId, at: new Date(now - 4.5 * DAY_MS) },
            { status: 'PROCESSED', notes: 'Đã phản hồi cảm ơn khách', actorId: adminId, at: new Date(now - 4 * DAY_MS) },
          ],
          createdAt: new Date(now - 5 * DAY_MS),
        },
        {
          name: 'Đặng Tuấn Hải',
          email: 'hai.dang@gmail.com',
          phone: '0909887766',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Đề xuất bổ sung thêm thức ăn hạt hữu cơ cho chim cảnh và thỏ',
          message: 'Tôi thấy Dr. Pets House có bán nhiều thức ăn cho chó mèo rất tốt, nhưng các dòng thức ăn chuyên dụng cho thỏ kiểng và chim cảnh như Alfalfa Hay hay RIO Daily Feed thường xuyên hết hàng. Rất mong shop nhập thêm số lượng ổn định.',
          category: 'SUGGESTION',
          customerId: null,
          status: 'READ',
          processedBy: adminId,
          processingNotes: 'Đã chuyển tiếp đề xuất nhập thêm 200 gói thức ăn cho thú nhỏ sang bộ phận Thu mua & Kho vận.',
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách đóng góp ý kiến sản phẩm', at: new Date(now - 6 * DAY_MS) },
            { status: 'READ', notes: 'Bộ phận quản lý hàng hóa đã tiếp nhận', actorId: adminId, at: new Date(now - 5.5 * DAY_MS) },
          ],
          createdAt: new Date(now - 6 * DAY_MS),
        },
        {
          name: 'Bùi Kim Ngân',
          email: 'ngan.bui@gmail.com',
          phone: '0944556677',
          gender: 'female',
          sourceCode: 'CONTACT_FORM',
          subject: 'Thời gian chờ khám ngày Chủ Nhật hơi lâu',
          message: 'Mình có đặt lịch trước lúc 10h sáng Chủ Nhật nhưng do phòng khám đông ca cấp cứu nên phải chờ đến gần 10h30 mới tới lượt. Dù hiểu là cấp cứu ưu tiên nhưng hy vọng lễ tân thông báo trước để khách không sốt ruột.',
          category: 'COMPLAINT',
          customerId: null,
          status: 'PROCESSED',
          processedBy: adminId,
          processingNotes: 'Quản lý chi nhánh đã làm việc với đội ngũ Lễ tân; cập nhật quy trình chủ động thông báo thời gian chờ thực tế khi phát sinh ca cấp cứu.',
          responseMessage: 'Dr. Pets House thành thật xin lỗi chị Ngân vì sự chậm trễ ngoài ý muốn do ca cấp cứu khẩn cấp. Phòng khám đã cải tiến quy trình thông báo thời gian chờ.',
          processedAt: new Date(now - 6 * DAY_MS),
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi phản ánh', at: new Date(now - 7 * DAY_MS) },
            { status: 'READ', notes: 'Quản lý tiếp nhận', actorId: adminId, at: new Date(now - 6.8 * DAY_MS) },
            { status: 'PROCESSING', notes: 'Rà soát ca trực cùng lễ tân', actorId: adminId, at: new Date(now - 6.5 * DAY_MS) },
            { status: 'PROCESSED', notes: 'Hoàn tất cập nhật quy trình', actorId: adminId, at: new Date(now - 6 * DAY_MS) },
          ],
          createdAt: new Date(now - 7 * DAY_MS),
        },
        {
          name: 'Đỗ Thùy Linh',
          email: 'linh.dothuy@gmail.com',
          phone: '0918776655',
          gender: 'female',
          sourceCode: 'CONTACT_FORM',
          subject: 'Trải nghiệm đặt lịch hẹn khám online trên website rất tiện lợi',
          message: 'Giao diện website mới đặt lịch rất mượt, chọn được giờ trống và dịch vụ rõ ràng, có thông báo nhắc lịch qua tin nhắn. Rất ưng ý với sự chuyển đổi số này của Dr. Pets House.',
          category: 'GENERAL',
          customerId: null,
          status: 'PROCESSED',
          processedBy: adminId,
          processingNotes: 'Ghi nhận phản hồi tích cực của khách hàng về trải nghiệm đặt hẹn trực tuyến v2.0.',
          responseMessage: 'Dr. Pets House cảm ơn chị Linh đã đồng hành và đánh giá cao trải nghiệm đặt lịch hẹn mới.',
          processedAt: new Date(now - 8 * DAY_MS),
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi phản hồi khen ngợi', at: new Date(now - 9 * DAY_MS) },
            { status: 'PROCESSED', notes: 'Đã lưu nhận xét vào báo cáo CSKH', actorId: adminId, at: new Date(now - 8 * DAY_MS) },
          ],
          createdAt: new Date(now - 9 * DAY_MS),
        },
        {
          name: 'Võ Minh Nhật',
          email: 'nhat.vo@gmail.com',
          phone: '0966334455',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Hỏi về thủ tục làm hồ sơ xuất cảnh cho thú cưng sang Nhật Bản',
          message: 'Chào bác sĩ, tháng sau gia đình tôi dự định định cư tại Nhật Bản và muốn mang theo 1 bé chó Corgi. Bên mình có hỗ trợ dịch vụ tiêm vaccine phòng dại, cấy microchip chuẩn ISO và xét nghiệm kháng thể dại FAVN gửi mẫu sang Nhật không?',
          category: 'INQUIRY',
          customerId: null,
          status: 'NEED_CONTACT',
          processedBy: adminId,
          processingNotes: 'Đã chuyển cho Bác sĩ Trưởng phòng Xét nghiệm & Kiểm dịch quốc tế để trực tiếp gọi tư vấn hồ sơ.',
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách gửi câu hỏi chuyên môn xuất cảnh', at: new Date(now - 7.5 * DAY_MS) },
            { status: 'NEED_CONTACT', notes: 'Cần bác sĩ có chứng chỉ kiểm dịch quốc tế gọi điện', actorId: adminId, at: new Date(now - 7 * DAY_MS) },
          ],
          createdAt: new Date(now - 7.5 * DAY_MS),
        },
        {
          name: 'Lý Thanh Bình',
          email: 'binh.ly@hotmail.com',
          phone: '0938112233',
          gender: 'female',
          sourceCode: 'CONTACT_FORM',
          subject: 'Đăng ký làm tình nguyện viên hỗ trợ chăm sóc thú cưng cứu trợ',
          message: 'Mình thấy trạm cứu trợ của Dr. Pets House đang tiếp nhận nhiều bé chó mèo bị bỏ rơi. Mình có kinh nghiệm chăm sóc thú cưng và muốn đăng ký tham gia tình nguyện viên hỗ trợ tắm rửa, cho ăn vào cuối tuần.',
          category: 'OTHER',
          customerId: null,
          status: 'NEW',
          processedBy: null,
          processingNotes: null,
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Đăng ký tình nguyện viên cứu trợ mới', at: new Date(now - 0.5 * DAY_MS) },
          ],
          createdAt: new Date(now - 0.5 * DAY_MS),
        },
        {
          name: 'Nguyễn Hoàng Nam',
          email: 'nam.nguyenhoang@gmail.com',
          phone: '0903445566',
          gender: 'male',
          sourceCode: 'CONTACT_FORM',
          subject: 'Sản phẩm sữa tắm bị rỉ nước khi nhận hàng',
          message: 'Đơn hàng sữa tắm SOS của tôi khi shipper giao tới bị nứt nhẹ nắp chai làm chảy ra bao bì. Tôi đã liên hệ nhưng chưa thấy phản hồi đổi hàng.',
          category: 'COMPLAINT',
          customerId: null,
          status: 'PROCESSING',
          processedBy: adminId,
          processingNotes: 'Đã xác nhận sự cố bưu cục vận chuyển làm nứt nắp chai; nhân viên CSKH đang chuẩn bị gửi sản phẩm mới nguyên seal đổi tận nhà cho khách.',
          responseMessage: null,
          processedAt: null,
          statusHistory: [
            { status: 'NEW', notes: 'Khách khiếu nại hàng bị hỏng do vận chuyển', at: new Date(now - 1.5 * DAY_MS) },
            { status: 'READ', notes: 'Bộ phận bảo hành tiếp nhận hình ảnh bưu phẩm', actorId: adminId, at: new Date(now - 1.3 * DAY_MS) },
            { status: 'PROCESSING', notes: 'Đang lên đơn đổi trả miễn phí', actorId: adminId, at: new Date(now - 1 * DAY_MS) },
          ],
          createdAt: new Date(now - 1.5 * DAY_MS),
        },
      ];

      for (const item of realisticFeedbacks) {
        const fb = new Feedback(item);
        await fb.save();
      }
      logger.info(`[ModerationSeed] Successfully seeded ${realisticFeedbacks.length} realistic feedbacks.`);
    }

    // 2. SEED REVIEWS (Product & Service Reviews)
    const reviewCount = await Review.countDocuments();
    if (reviewCount < 10) {
      logger.info(`[ModerationSeed] Seeding realistic reviews (current count: ${reviewCount})...`);

      const adminUser = await User.findOne({ systemRole: 'ADMIN' });
      const adminId = adminUser ? adminUser._id : null;

      // Find real customers
      const customers = await Customer.find({}).limit(6);
      if (!customers || customers.length === 0) {
        logger.warn('[ModerationSeed] No customers found to link reviews.');
        return;
      }

      const cust1 = customers[0]; // Lê Văn Cường
      const cust2 = customers[1] || cust1;
      const cust3 = customers[2] || cust1;
      const cust4 = customers[3] || cust1;
      const cust5 = customers[4] || cust1;

      // Find real products
      const pRoyalCanin = await Product.findOne({ $or: [{ name: /Royal Canin/i }, { slug: /royal-canin/i }] }) || (await Product.findOne());
      const pWhiskas = await Product.findOne({ $or: [{ name: /Whiskas/i }, { slug: /whiskas/i }] }) || pRoyalCanin;
      const pCature = await Product.findOne({ $or: [{ name: /Cature/i }, { slug: /cature/i }] }) || pRoyalCanin;
      const pBravecto = await Product.findOne({ $or: [{ name: /Bravecto/i }, { slug: /bravecto/i }] }) || pRoyalCanin;
      const pSOS = await Product.findOne({ $or: [{ name: /SOS/i }, { slug: /sos/i }] }) || pRoyalCanin;
      const pKong = await Product.findOne({ $or: [{ name: /KONG/i }, { slug: /kong/i }] }) || pRoyalCanin;

      // Find real services
      const sExam = await Service.findOne({ $or: [{ name: /Khám sức khỏe/i }, { code: 'MED01' }] }) || (await Service.findOne());
      const sBath = await Service.findOne({ $or: [{ name: /Tắm & Sấy/i }, { code: 'GRM01' }] }) || sExam;
      const sVaccine = await Service.findOne({ $or: [{ name: /Tiêm phòng/i }, { code: 'MED02' }] }) || sExam;
      const sUltrasound = await Service.findOne({ $or: [{ name: /Siêu âm/i }, { code: 'MED04' }] }) || sExam;
      const sBloodTest = await Service.findOne({ $or: [{ name: /Xét nghiệm máu/i }, { code: 'MED03' }] }) || sExam;
      const sMassage = await Service.findOne({ $or: [{ name: /Massage/i }, { code: 'GRM02' }] }) || sExam;

      // Find real branches
      const branchQ1 = await Branch.findOne({ $or: [{ code: 'BR-000001' }, { name: /Quận 1/i }] });
      const branchQ7 = await Branch.findOne({ $or: [{ code: 'BR-000002' }, { name: /Quận 7/i }, { name: /Quận 3/i }] });
      const branchBT = await Branch.findOne({ $or: [{ code: 'BR-000003' }, { name: /Bình Thạnh/i }] });

      // Find real orders and appointments for reference
      const orders = await Order.find({}).limit(10);
      const apts = await Appointment.find({}).limit(10);

      const o1 = orders[0];
      const o2 = orders[1] || o1;
      const o3 = orders[2] || o1;
      const o4 = orders[3] || o1;
      const o5 = orders[4] || o1;
      const o6 = orders[5] || o1;

      const a1 = apts[0];
      const a2 = apts[1] || a1;
      const a3 = apts[2] || a1;
      const a4 = apts[3] || a1;
      const a5 = apts[4] || a1;
      const a6 = apts[5] || a1;

      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      const realisticReviews = [
        {
          customerId: cust1._id,
          ownerUserId: cust1.userId,
          sourceType: 'ORDER',
          sourceId: o1 ? o1._id : null,
          branchId: branchQ1 ? branchQ1._id : null,
          targetType: 'PRODUCT',
          targetId: pRoyalCanin._id,
          rating: 5,
          comment: 'Hạt Royal Canin chính hãng, bao bì đóng gói cẩn thận có tem chống hàng giả. Bé Poodle nhà mình ăn rất hợp miệng, tiêu hóa tốt, phân khuôn đẹp. Sẽ ủng hộ lâu dài!',
          anonymous: false,
          displayName: 'Lê Văn Cường',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: {
            text: 'Dạ Dr. Pets House cảm ơn anh Cường đã luôn tin tưởng và ủng hộ sản phẩm chính hãng bên em ạ!',
            repliedBy: adminId,
            repliedAt: new Date(now - 3 * DAY_MS),
          },
          createdAt: new Date(now - 4 * DAY_MS),
        },
        {
          customerId: cust2._id,
          ownerUserId: cust2.userId,
          sourceType: 'ORDER',
          sourceId: o2 ? o2._id : null,
          branchId: branchQ7 ? branchQ7._id : null,
          targetType: 'PRODUCT',
          targetId: pWhiskas._id,
          rating: 5,
          comment: 'Pate thơm mùi cá thật, nhiều thạch và thịt cá xé nhuyễn. Hai bé mèo nhà mình tranh nhau ăn sạch đĩa trong vòng 2 phút. Giá cả rất hợp lý.',
          anonymous: false,
          displayName: 'Tiên Nguyễn Thị Kiều',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 3.5 * DAY_MS),
        },
        {
          customerId: cust1._id,
          ownerUserId: cust1.userId,
          sourceType: 'APPOINTMENT',
          sourceId: a1 ? a1._id : null,
          branchId: branchQ1 ? branchQ1._id : null,
          targetType: 'SERVICE',
          targetId: sExam._id,
          rating: 5,
          comment: 'Bác sĩ An khám rất có tâm, soi tai, kiểm tra răng miệng và nghe tim phổi cực kỳ kỹ lưỡng. Tư vấn chế độ dinh dưỡng giảm cân cho bé rất chi tiết. Phòng khám sạch sẽ, không có mùi hôi.',
          anonymous: false,
          displayName: 'Lê Văn Cường',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: {
            text: 'Dr. Pets House chân thành cảm ơn đánh giá của anh Cường. Chúc bé cún luôn khỏe mạnh và năng động ạ!',
            repliedBy: adminId,
            repliedAt: new Date(now - 2 * DAY_MS),
          },
          createdAt: new Date(now - 3 * DAY_MS),
        },
        {
          customerId: cust5._id,
          ownerUserId: cust5.userId,
          sourceType: 'APPOINTMENT',
          sourceId: a2 ? a2._id : null,
          branchId: branchBT ? branchBT._id : null,
          targetType: 'SERVICE',
          targetId: sBath._id,
          rating: 4,
          comment: 'Bé cún tắm xong lông bông mềm, sấy khô kỹ tận chân lông và thơm phức hương thảo dược. Điểm trừ nhẹ là phòng chờ hơi đông vào chiều thứ Bảy.',
          anonymous: false,
          displayName: 'Thái Nam Nguyễn',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 2.5 * DAY_MS),
        },
        {
          customerId: cust3._id,
          ownerUserId: cust3.userId,
          sourceType: 'ORDER',
          sourceId: o3 ? o3._id : null,
          branchId: branchQ1 ? branchQ1._id : null,
          targetType: 'PRODUCT',
          targetId: pBravecto._id,
          rating: 5,
          comment: 'Thuốc Bravecto hiệu quả thần kỳ! Cho bé nhai như snack vì có mùi thịt bò, sau 24h ve rận rơi sạch rụng hết. Tác dụng kéo dài tận 3 tháng rất đáng đồng tiền.',
          anonymous: false,
          displayName: 'Trần Minh Đức',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 2 * DAY_MS),
        },
        {
          customerId: cust1._id,
          ownerUserId: cust1.userId,
          sourceType: 'APPOINTMENT',
          sourceId: a3 ? a3._id : null,
          branchId: branchQ1 ? branchQ1._id : null,
          targetType: 'SERVICE',
          targetId: sUltrasound._id,
          rating: 5,
          comment: 'Máy siêu âm hiện đại, hình ảnh rõ nét. Bác sĩ chỉ cho mình thấy từng túi thai của bé mèo, đếm tim thai và dự đoán ngày sinh chính xác. Rất an tâm khi khám tại đây.',
          anonymous: false,
          displayName: 'Lê Văn Cường',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 1.8 * DAY_MS),
        },
        {
          customerId: cust2._id,
          ownerUserId: cust2.userId,
          sourceType: 'ORDER',
          sourceId: o4 ? o4._id : null,
          branchId: branchQ7 ? branchQ7._id : null,
          targetType: 'PRODUCT',
          targetId: pCature._id,
          rating: 4,
          comment: 'Cát vón cục nhanh, mùi trà xanh thơm dịu khử mùi cực tốt. Đặc biệt xả thẳng vào bồn cầu tan nhanh không lo nghẹt cống. Giá hơi cao một chút nhưng chất lượng tương xứng.',
          anonymous: false,
          displayName: 'Tiên Nguyễn Thị Kiều',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 1.5 * DAY_MS),
        },
        {
          customerId: cust5._id,
          ownerUserId: cust5.userId,
          sourceType: 'APPOINTMENT',
          sourceId: a4 ? a4._id : null,
          branchId: branchBT ? branchBT._id : null,
          targetType: 'SERVICE',
          targetId: sVaccine._id,
          rating: 5,
          comment: 'Vaccine bảo quản lạnh chuẩn GSP, trước khi tiêm bác sĩ cho kiểm tra hạn sử dụng và dán nhãn vào sổ khám rõ ràng. Bé cún tiêm không hề kêu la gì cả.',
          anonymous: false,
          displayName: 'Thái Nam Nguyễn',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 1.2 * DAY_MS),
        },
        {
          customerId: cust3._id,
          ownerUserId: cust3.userId,
          sourceType: 'ORDER',
          sourceId: o5 ? o5._id : null,
          branchId: branchQ1 ? branchQ1._id : null,
          targetType: 'PRODUCT',
          targetId: pSOS._id,
          rating: 4,
          comment: 'Sữa tắm SOS dùng rất thích, tạo bọt mịn, tắm xong lông bóng mượt và lưu hương được gần cả tuần. Chai to 530ml dùng được rất lâu.',
          anonymous: false,
          displayName: 'Hoàng Minh Châu',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 1 * DAY_MS),
        },
        {
          customerId: cust1._id,
          ownerUserId: cust1.userId,
          sourceType: 'APPOINTMENT',
          sourceId: a5 ? a5._id : null,
          branchId: branchQ1 ? branchQ1._id : null,
          targetType: 'SERVICE',
          targetId: sBloodTest._id,
          rating: 5,
          comment: 'Lấy máu nhanh, điều dưỡng dỗ dành bé rất khéo nên bé không sợ. Kết quả test nhanh Parvo và Care có sau 15 phút, bác sĩ giải thích cặn kẽ các chỉ số sinh hóa máu.',
          anonymous: false,
          displayName: 'Lê Văn Cường',
          hidden: false,
          hiddenReason: null,
          status: 'ACTIVE',
          staffReply: null,
          createdAt: new Date(now - 0.8 * DAY_MS),
        },
        {
          customerId: cust4._id,
          ownerUserId: cust4.userId,
          sourceType: 'ORDER',
          sourceId: o6 ? o6._id : null,
          branchId: branchQ7 ? branchQ7._id : null,
          targetType: 'PRODUCT',
          targetId: pKong._id,
          rating: 1,
          comment: 'Shop lừa đảo buôn bán đồ giả, gọi lên số hotline 0909xxxxxx để mua hàng chính hãng rẻ hơn một nửa nhé mọi người ghé shop abc.xyz mua rẻ hơn nhiều!!',
          anonymous: true,
          displayName: 'Khách hàng',
          hidden: true,
          hiddenReason: 'Bình luận chứa thông tin spam quảng cáo và số điện thoại bên ngoài.',
          hiddenBy: adminId,
          hiddenAt: new Date(now - 0.4 * DAY_MS),
          status: 'HIDDEN',
          staffReply: null,
          moderationHistory: [
            {
              action: 'HIDE',
              reason: 'Bình luận chứa thông tin spam quảng cáo và số điện thoại bên ngoài.',
              actorId: adminId,
              at: new Date(now - 0.4 * DAY_MS),
            },
          ],
          createdAt: new Date(now - 0.5 * DAY_MS),
        },
        {
          customerId: cust4._id,
          ownerUserId: cust4.userId,
          sourceType: 'APPOINTMENT',
          sourceId: a6 ? a6._id : null,
          branchId: branchBT ? branchBT._id : null,
          targetType: 'SERVICE',
          targetId: sMassage._id,
          rating: 2,
          comment: 'Nhân viên phục vụ thái độ thô lỗ và văng tục chửi bậy trước mặt khách hàng.',
          anonymous: false,
          displayName: 'Vũ Quốc Anh',
          hidden: true,
          hiddenReason: 'Nội dung ngôn từ không phù hợp, đã tiếp nhận điều tra nội bộ nhân sự.',
          hiddenBy: adminId,
          hiddenAt: new Date(now - 0.2 * DAY_MS),
          status: 'HIDDEN',
          staffReply: null,
          moderationHistory: [
            {
              action: 'HIDE',
              reason: 'Nội dung ngôn từ không phù hợp, đã tiếp nhận điều tra nội bộ nhân sự.',
              actorId: adminId,
              at: new Date(now - 0.2 * DAY_MS),
            },
          ],
          createdAt: new Date(now - 0.3 * DAY_MS),
        },
      ];

      for (const rev of realisticReviews) {
        // Skip duplicate if exists
        const exists = await Review.findOne({
          customerId: rev.customerId,
          targetType: rev.targetType,
          targetId: rev.targetId,
        });
        if (!exists) {
          const doc = new Review(rev);
          await doc.save();
        }
      }

      // Re-calculate target ratings
      const targets = [
        { type: 'PRODUCT', id: pRoyalCanin._id },
        { type: 'PRODUCT', id: pWhiskas._id },
        { type: 'PRODUCT', id: pCature._id },
        { type: 'PRODUCT', id: pBravecto._id },
        { type: 'PRODUCT', id: pSOS._id },
        { type: 'PRODUCT', id: pKong._id },
        { type: 'SERVICE', id: sExam._id },
        { type: 'SERVICE', id: sBath._id },
        { type: 'SERVICE', id: sVaccine._id },
        { type: 'SERVICE', id: sUltrasound._id },
        { type: 'SERVICE', id: sBloodTest._id },
        { type: 'SERVICE', id: sMassage._id },
      ];
      for (const t of targets) {
        await recalculateTargetRating(t.type, t.id);
      }

      logger.info(`[ModerationSeed] Successfully seeded realistic reviews and recalculated ratings.`);
    }

    // 3. SEED COMMUNITY REPORTS (Enterprise Moderation Violation Reports)
    const reportCount = await CommunityReport.countDocuments();
    if (reportCount < 10) {
      logger.info(`[ModerationSeed] Seeding realistic community violation reports (current count: ${reportCount})...`);

      const adminUser = await User.findOne({ systemRole: 'ADMIN' });
      const adminId = adminUser ? adminUser._id : null;

      const customerCuong = await Customer.findOne({ contactEmail: 'customer.levanc@gmail.com' });
      const cuongId = customerCuong ? customerCuong._id : null;

      const customerTien = await Customer.findOne({ contactEmail: 'kieutien.petcare@gmail.com' });
      const tienId = customerTien ? customerTien._id : null;

      const customerNam = await Customer.findOne({ contactEmail: 'thainamnguyen444@gmail.com' });
      const namId = customerNam ? customerNam._id : (customerCuong ? customerCuong._id : null);

      // Fetch or ensure community posts to link
      let posts = await CommunityPost.find({}).sort({ createdAt: -1 }).limit(10);
      if (posts.length < 5) {
        // Create realistic posts if needed
        const samplePosts = [
          {
            title: 'Hành trình hồi phục diệu kỳ của bé Miu sau ca phẫu thuật gãy xương tại Dr. Pet Q1',
            content: 'Bé Miu nhà mình bị ngã lầu gãy chân, may mắn được bác sĩ An tại Dr. Pet phẫu thuật cố định xương kịp thời...',
            authorNameSnapshot: 'Nguyễn Thị Lan (Khách hàng thân thiết)',
            status: 'APPROVED',
            category: 'STORY',
          },
          {
            title: 'Chia sẻ kinh nghiệm trị nấm da cho cún Poodle tại nhà thành công',
            content: 'Nấm da ở chó Poodle rất dai dẳng, mình chia sẻ các bước tắm thảo mộc sát khuẩn kết hợp xịt dưỡng ẩm...',
            authorNameSnapshot: 'Trần Văn Hoàng',
            status: 'APPROVED',
            category: 'EXPERIENCE',
          },
          {
            title: 'Xin kinh nghiệm huấn luyện cún con đi vệ sinh đúng khay cát cho người mới',
            content: 'Cún nhà mình 2 tháng tuổi rất hay đi lung tung trong nhà, các anh chị có mẹo nào huấn luyện nhanh chỉ em với...',
            authorNameSnapshot: 'Lê Minh Khang',
            status: 'APPROVED',
            category: 'QNA',
          },
          {
            title: 'Cần bán gấp đàn chó con giá rẻ không rõ nguồn gốc tại TP.HCM',
            content: 'Cần thanh lý gấp đàn cún con 1 tháng tuổi không tiêm chủng, liên hệ Zalo 0988xxxx để ship COD toàn quốc...',
            authorNameSnapshot: 'Tài khoản Vi Phạm (Spam)',
            status: 'REJECTED',
            category: 'QNA',
          },
          {
            title: 'Cảnh báo: Cách dùng thuốc hạ sốt Paracetamol cho mèo khi bị ốm',
            content: 'Khi mèo sốt cao các bạn cứ ra tiệm thuốc tây mua Panadol hạ sốt nghiền nửa viên cho uống là đỡ ngay...',
            authorNameSnapshot: 'Người nuôi thiếu kiến thức y khoa',
            status: 'REJECTED',
            category: 'EXPERIENCE',
          },
        ];
        for (const sp of samplePosts) {
          const np = new CommunityPost(sp);
          await np.save();
        }
        posts = await CommunityPost.find({}).sort({ createdAt: -1 }).limit(10);
      }

      const post0 = posts[0];
      const post1 = posts[1] || post0;
      const post2 = posts[2] || post0;
      const post3 = posts[3] || post0;
      const post4 = posts[4] || post0;
      const post5 = posts[5] || post1;
      const post6 = posts[6] || post2;
      const post7 = posts[7] || post3;
      const post8 = posts[8] || post4;

      const cust0 = cuongId;
      const cust1 = (await Customer.findOne({ contactEmail: 'senior_tester@gmail.com' }))?._id || cuongId;
      const cust2 = tienId;
      const cust3 = (await Customer.findOne({ contactEmail: 'user_1794992855@gmail.com' }))?._id || cuongId;
      const cust4 = namId;
      const cust5 = (await Customer.findOne({ contactEmail: 'blocked.user@gmail.com' }))?._id || cuongId;

      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;

      const realisticReports = [
        {
          reportCode: 'RPT-202611-0001',
          postId: post3._id,
          reporterCustomerId: cust0,
          reason: 'SPAM',
          description: 'Tài khoản này liên tục đăng bài spam bán đàn chó con nhập lậu không tiêm phòng, để lại số điện thoại Zalo mờ ám trên diễn đàn.',
          postSnapshot: {
            title: post3.title || 'Cần bán gấp đàn chó con giá rẻ không rõ nguồn gốc tại TP.HCM',
            content: post3.content || 'Cần thanh lý gấp đàn cún con 1 tháng tuổi không tiêm chủng...',
            imageUrls: [],
            authorName: post3.authorNameSnapshot || 'Tài khoản Vi Phạm (Spam)',
            createdAt: new Date(now - 4 * DAY_MS),
          },
          status: 'RESOLVED',
          decision: 'HIDE_POST',
          moderationNote: 'Đã xác minh bài đăng vi phạm chính sách cấm buôn bán thú cưng trái phép và spam thương mại. Đã ẩn bài viết và cảnh cáo tài khoản.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 2 * DAY_MS),
          createdAt: new Date(now - 4 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0002',
          postId: post8._id,
          reporterCustomerId: cust2,
          reason: 'MISINFORMATION',
          description: 'Bài viết hướng dẫn người nuôi cho mèo uống Panadol/Paracetamol khi bị sốt. Paracetamol cực kỳ độc với mèo, gây suy gan cấp và tử vong chỉ sau vài giờ! Cần gỡ ngay để tránh làm chết thú cưng của người nuôi.',
          postSnapshot: {
            title: post8.title || 'Cảnh báo: Cách dùng thuốc hạ sốt Paracetamol cho mèo khi bị ốm',
            content: post8.content || 'Khi mèo sốt cao các bạn cứ ra tiệm thuốc tây mua Panadol hạ sốt...',
            imageUrls: [],
            authorName: post8.authorNameSnapshot || 'Người nuôi thiếu kiến thức y khoa',
            createdAt: new Date(now - 3 * DAY_MS),
          },
          status: 'RESOLVED',
          decision: 'HIDE_POST',
          moderationNote: 'Chính xác. Paracetamol là chất kịch độc gây tán huyết và hoại tử gan ở loài mèo. Đã ẩn bài viết lập tức để bảo vệ an toàn cho thú cưng.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 1 * DAY_MS),
          createdAt: new Date(now - 3 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0003',
          postId: post1._id,
          reporterCustomerId: cust4,
          reason: 'HARASSMENT',
          description: 'Thành viên bình luận dùng lời lẽ thô tục, xúc phạm danh dự của người đăng bài và công kích cá nhân trong phần thảo luận.',
          postSnapshot: {
            title: post1.title,
            content: post1.content,
            imageUrls: [],
            authorName: post1.authorNameSnapshot,
            createdAt: new Date(now - 5 * DAY_MS),
          },
          status: 'UNDER_REVIEW',
          decision: null,
          moderationNote: 'Kiểm duyệt viên đang tiến hành rà soát lịch sử bình luận và xác thực hành vi công kích.',
          moderatorId: adminId,
          reviewedAt: null,
          createdAt: new Date(now - 2 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0004',
          postId: post2._id,
          reporterCustomerId: cust0,
          reason: 'INAPPROPRIATE',
          description: 'Bài đăng đính kèm hình ảnh vết thương hở máu me không che mờ, gây sợ hãi và ám ảnh cho các thành viên khác khi xem bài.',
          postSnapshot: {
            title: post2.title,
            content: post2.content,
            imageUrls: [],
            authorName: post2.authorNameSnapshot,
            createdAt: new Date(now - 3 * DAY_MS),
          },
          status: 'RESOLVED',
          decision: 'HIDE_POST',
          moderationNote: 'Đã tạm ẩn hình ảnh chưa gắn nhãn cảnh báo nội dung nhạy cảm, yêu cầu chủ bài đăng làm mờ trước khi hiển thị lại.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 1 * DAY_MS),
          createdAt: new Date(now - 2 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0005',
          postId: post7._id,
          reporterCustomerId: cust2,
          reason: 'SPAM',
          description: 'Tài khoản quảng cáo buôn bán thuốc thú y trôi nổi chưa được Bộ Nông nghiệp cấp phép, xúi giục tự tiêm kháng sinh tại nhà gây kháng thuốc.',
          postSnapshot: {
            title: post7.title,
            content: post7.content,
            imageUrls: [],
            authorName: post7.authorNameSnapshot,
            createdAt: new Date(now - 4 * DAY_MS),
          },
          status: 'RESOLVED',
          decision: 'HIDE_POST',
          moderationNote: 'Vi phạm quy định nghiêm cấm quảng cáo dược phẩm thú y kê đơn trên diễn đàn cộng đồng.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 1 * DAY_MS),
          createdAt: new Date(now - 3 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0006',
          postId: post5._id,
          reporterCustomerId: cust0,
          reason: 'MISINFORMATION',
          description: 'Người báo cáo nghi ngờ bài viết hướng dẫn bôi lá trầu không pha loãng lên da cún có thể gây kích ứng da.',
          postSnapshot: {
            title: post5.title,
            content: post5.content,
            imageUrls: [],
            authorName: post5.authorNameSnapshot,
            createdAt: new Date(now - 6 * DAY_MS),
          },
          status: 'NO_VIOLATION',
          decision: 'NO_VIOLATION',
          moderationNote: 'Bác sĩ thú y chuyên khoa da liễu đã thẩm định: Bài viết khuyến cáo dùng nước lá trầu không pha loãng sát trùng nhẹ, có ghi rõ cần đi khám thú y nếu có mủ. Không có dấu hiệu vi phạm.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 1 * DAY_MS),
          createdAt: new Date(now - 4 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0007',
          postId: post6._id,
          reporterCustomerId: cust4,
          reason: 'OTHER',
          description: 'Có tài khoản bình luận chèn link web cá độ cờ bạc trá hình dưới bài hỏi đáp chăm sóc cún.',
          postSnapshot: {
            title: post6.title,
            content: post6.content,
            imageUrls: [],
            authorName: post6.authorNameSnapshot,
            createdAt: new Date(now - 5 * DAY_MS),
          },
          status: 'PENDING',
          decision: null,
          moderationNote: null,
          moderatorId: null,
          reviewedAt: null,
          createdAt: new Date(now - 1 * DAY_MS),
        },
        {
          reportCode: 'RPT-202611-0008',
          postId: post0._id,
          reporterCustomerId: cust1,
          reason: 'SPAM',
          description: 'Tài khoản spam dịch vụ cắt tỉa lông chui tại nhà giá rẻ lặp đi lặp lại nhiều lần trong cùng bài viết.',
          postSnapshot: {
            title: post0.title,
            content: post0.content,
            imageUrls: [],
            authorName: post0.authorNameSnapshot,
            createdAt: new Date(now - 8 * DAY_MS),
          },
          status: 'PENDING',
          decision: null,
          moderationNote: null,
          moderatorId: null,
          reviewedAt: null,
          createdAt: new Date(now - 18 * 60 * 60 * 1000),
        },
        {
          reportCode: 'RPT-202611-0009',
          postId: post4._id,
          reporterCustomerId: cust2,
          reason: 'MISINFORMATION',
          description: 'Sử dụng hình ảnh ca phẫu thuật gãy xương của bé Miu tại Dr. Pet để kêu gọi chuyển tiền quyên góp vào tài khoản cá nhân mờ ám.',
          postSnapshot: {
            title: post4.title,
            content: post4.content,
            imageUrls: [],
            authorName: post4.authorNameSnapshot,
            createdAt: new Date(now - 8 * DAY_MS),
          },
          status: 'RESOLVED',
          decision: 'HIDE_POST',
          moderationNote: 'Xác nhận hành vi mạo danh hồ sơ lâm sàng của bệnh viện để trục lợi từ thiện. Đã ẩn bài viết và khóa tài khoản vi phạm.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 12 * 60 * 60 * 1000),
          createdAt: new Date(now - 20 * 60 * 60 * 1000),
        },
        {
          reportCode: 'RPT-202611-0010',
          postId: post6._id,
          reporterCustomerId: cust3,
          reason: 'HARASSMENT',
          description: 'Thành viên tranh cãi gay gắt và tung số điện thoại cá nhân cùng địa chỉ nhà của người khác lên diễn đàn đe dọa.',
          postSnapshot: {
            title: post6.title,
            content: post6.content,
            imageUrls: [],
            authorName: post6.authorNameSnapshot,
            createdAt: new Date(now - 6 * DAY_MS),
          },
          status: 'UNDER_REVIEW',
          decision: null,
          moderationNote: 'Nội dung làm lộ thông tin cá nhân riêng tư (doxxing). Đã liên hệ cảnh báo và yêu cầu gỡ số điện thoại.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 6 * 60 * 60 * 1000),
          createdAt: new Date(now - 15 * 60 * 60 * 1000),
        },
        {
          reportCode: 'RPT-202611-0011',
          postId: post0._id,
          reporterCustomerId: cust3,
          reason: 'OTHER',
          description: 'Báo cáo nhầm: Khách hàng ấn nhầm nút báo cáo khi đang đọc câu chuyện hồi phục của bé Miu.',
          postSnapshot: {
            title: post0.title,
            content: post0.content,
            imageUrls: [],
            authorName: post0.authorNameSnapshot,
            createdAt: new Date(now - 8 * DAY_MS),
          },
          status: 'NO_VIOLATION',
          decision: 'NO_VIOLATION',
          moderationNote: 'Chủ tài khoản gửi tin nhắn đính chính đã bấm nhầm nút báo cáo. Bài viết tích cực, tiếp tục hiển thị.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 4 * 60 * 60 * 1000),
          createdAt: new Date(now - 8 * 60 * 60 * 1000),
        },
        {
          reportCode: 'RPT-202611-0012',
          postId: post1._id,
          reporterCustomerId: cust1,
          reason: 'MISINFORMATION',
          description: 'Chia sẻ công thức tự chế thuốc bôi nấm từ lưu huỳnh thô không định lượng, có nguy cơ gây ngộ độc cho thú cưng khi liếm phải.',
          postSnapshot: {
            title: post1.title,
            content: post1.content,
            imageUrls: [],
            authorName: post1.authorNameSnapshot,
            createdAt: new Date(now - 7 * DAY_MS),
          },
          status: 'UNDER_REVIEW',
          decision: null,
          moderationNote: 'Đã gửi công thức cho Bác sĩ dược lý thú y kiểm định tính an toàn trước khi đưa ra quyết định cuối cùng.',
          moderatorId: adminId,
          reviewedAt: new Date(now - 2 * 60 * 60 * 1000),
          createdAt: new Date(now - 5 * 60 * 60 * 1000),
        },
      ];

      for (const rpt of realisticReports) {
        const exists = await CommunityReport.findOne({ reportCode: rpt.reportCode });
        if (!exists) {
          const doc = new CommunityReport(rpt);
          await doc.save();
        }
      }

      logger.info(`[ModerationSeed] Successfully seeded 12 realistic community violation reports.`);
    }
  } catch (err) {
    logger.error('[ModerationSeed] Error seeding moderation data:', err);
  }
};
