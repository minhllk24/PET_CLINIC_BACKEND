import mongoose from 'mongoose';
import OutboxMessage from './models/OutboxMessage';
import Notification from './models/Notification';
import AppError from '../../utils/AppError';
import { ErrorCodes } from '../../shared/errorCodes';

export const sendEmail = async (to, subject, body, session = null) => {
  const msg = new OutboxMessage({
    type: 'EMAIL',
    payload: { to, subject, body }
  });
  if (session) {
    await msg.save({ session });
  } else {
    await msg.save();
  }
  return msg;
};

export const sendSms = async (to, message, session = null) => {
  const msg = new OutboxMessage({
    type: 'SMS',
    payload: { to, message }
  });
  if (session) {
    await msg.save({ session });
  } else {
    await msg.save();
  }
  return msg;
};

export const createNotification = async ({ recipientId, type = 'SYSTEM', title, body, metadata = {} }) => {
  const notif = new Notification({
    recipientId,
    type,
    title,
    body,
    metadata,
    read: false,
  });
  await notif.save();
  return notif;
};

export const listUserNotifications = async (userId, query = {}) => {
  const filter = { recipientId: userId };

  if (query.unreadOnly === true || query.unreadOnly === 'true' || query.status === 'unread' || query.isRead === false || query.isRead === 'false') {
    filter.read = false;
  }

  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);

  let sortCriteria = { _id: -1 };
  if (query.cursor) {
    try {
      const decodedId = Buffer.from(query.cursor, 'base64').toString('ascii');
      if (mongoose.isValidObjectId(decodedId)) {
        filter._id = { $lt: new mongoose.Types.ObjectId(decodedId) };
      }
    } catch {
      // Ignore cursor decode error
    }
  }

  const docs = await Notification.find(filter)
    .sort(sortCriteria)
    .limit(limit + 1)
    .lean();

  let nextCursor = null;
  let items = docs;
  if (docs.length > limit) {
    items = docs.slice(0, limit);
    const lastItem = items[items.length - 1];
    nextCursor = Buffer.from(lastItem._id.toString()).toString('base64');
  }

  // Format to match both OpenAPI schema and Frontend requirements
  const formattedItems = items.map((d) => ({
    id: d._id.toString(),
    notification_id: d._id.toString(),
    type: d.type || 'SYSTEM',
    title: d.title,
    body: d.body,
    content: d.body,
    read: Boolean(d.read),
    isRead: Boolean(d.read),
    is_read: Boolean(d.read),
    createdAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
    created_at: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
    metadata: d.metadata || {},
  }));

  return {
    items: formattedItems,
    nextCursor,
    total: formattedItems.length,
  };
};

export const markNotificationRead = async (userId, notificationId) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Notification not found');
  }

  const notif = await Notification.findOneAndUpdate(
    { _id: notificationId, recipientId: userId },
    { $set: { read: true } },
    { new: true }
  );

  if (!notif) {
    throw new AppError(404, 'NotFound', ErrorCodes.NOT_FOUND, 'Notification not found');
  }

  return {
    success: true,
    id: notif._id.toString(),
    read: true,
  };
};

export const markAllNotificationsRead = async (userId) => {
  await Notification.updateMany(
    { recipientId: userId, read: false },
    { $set: { read: true } }
  );

  return {
    success: true,
    message: 'All notifications marked as read',
  };
};
