import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedNotifications() {
  const userId = 2; // Bạn có thể sửa thành ID của tài khoản test của bạn đang đăng nhập

  try {
    // 1. Thông báo lịch hẹn
    await prisma.notification.create({
      data: {
        user_id: userId,
        notification_type: 'appointment',
        title: 'Nhắc lịch hẹn',
        content: 'Khám sức khỏe tổng quát cho Nâu lúc 09:00 ngày mai',
        message_parts: JSON.stringify([
          { text: 'Nhắc lịch hẹn:', tone: 'strong' },
          { text: ' Khám sức khỏe tổng quát cho ' },
          { text: 'Nâu', tone: 'brandStrong' },
          { text: ' lúc 09:00 ngày mai.' }
        ]),
        searchable_text: 'Nhắc lịch hẹn Khám sức khỏe tổng quát cho Nâu lúc 09:00 ngày mai',
        is_read: false
      }
    });

    // 2. Thông báo hệ thống
    await prisma.notification.create({
      data: {
        user_id: userId,
        notification_type: 'system',
        title: 'Hướng dẫn Cách chăm sóc thú cưng',
        content: 'Hướng dẫn: Cách chăm sóc thú cưng sau khi tiêm chủng.',
        message_parts: JSON.stringify([
          { text: 'Hướng dẫn: Cách chăm sóc thú cưng sau khi tiêm chủng.' }
        ]),
        searchable_text: 'Hướng dẫn Cách chăm sóc thú cưng sau khi tiêm chủng',
        is_read: true
      }
    });

    console.log('✅ Đã tạo thông báo test thành công cho user ID:', userId);
  } catch (error) {
    console.error('Lỗi tạo dữ liệu test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedNotifications();
