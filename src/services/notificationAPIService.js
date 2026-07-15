import prisma from '../configs/prisma';

const getNotifications = async (userId, status, search) => {
  try {
    let whereCondition = { user_id: BigInt(userId) };

    if (status === 'unread') {
      whereCondition.is_read = false;
    } else if (status === 'read') {
      whereCondition.is_read = true;
    }

    if (search) {
      whereCondition.searchable_text = {
        contains: search
      };
    }

    const notifications = await prisma.notification.findMany({
      where: whereCondition,
      include: {
        pet: {
          select: {
            pet_id: true,
            pet_name: true,
            profile_image_url: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Cần serialize BigInt trước khi trả về
    const serialized = notifications.map(notif => ({
      ...notif,
      notification_id: notif.notification_id.toString(),
      user_id: notif.user_id.toString(),
      pet_id: notif.pet_id ? notif.pet_id.toString() : null,
      pet: notif.pet ? {
        ...notif.pet,
        pet_id: notif.pet.pet_id.toString()
      } : null
    }));

    return { EM: 'Lấy thông báo thành công', EC: 0, DT: serialized };
  } catch (error) {
    console.error('getNotifications error:', error);
    return { EM: 'Lỗi server', EC: -2, DT: '' };
  }
};

const markAsRead = async (notificationId, userId) => {
  try {
    const notification = await prisma.notification.findFirst({
      where: {
        notification_id: BigInt(notificationId),
        user_id: BigInt(userId)
      }
    });

    if (!notification) {
      return { EM: 'Không tìm thấy thông báo', EC: 1, DT: '' };
    }

    const updated = await prisma.notification.update({
      where: { notification_id: BigInt(notificationId) },
      data: { is_read: true }
    });

    return { EM: 'Đánh dấu đã đọc thành công', EC: 0, DT: { ...updated, notification_id: updated.notification_id.toString(), user_id: updated.user_id.toString(), pet_id: updated.pet_id ? updated.pet_id.toString() : null } };
  } catch (error) {
    console.error('markAsRead error:', error);
    return { EM: 'Lỗi server', EC: -2, DT: '' };
  }
};

const markAllAsRead = async (userId) => {
  try {
    const updatedCount = await prisma.notification.updateMany({
      where: {
        user_id: BigInt(userId),
        is_read: false
      },
      data: { is_read: true }
    });

    return { EM: 'Đánh dấu tất cả đã đọc thành công', EC: 0, DT: updatedCount.count };
  } catch (error) {
    console.error('markAllAsRead error:', error);
    return { EM: 'Lỗi server', EC: -2, DT: '' };
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
