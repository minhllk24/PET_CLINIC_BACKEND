import express from 'express';
import * as notificationService from './notification.service';
import { authenticate } from '../../shared/authMiddleware';

const router = express.Router();

// GET /api/v1/notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await notificationService.listUserNotifications(req.actor.id, req.query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/notifications/read-all & POST /api/v1/notifications/read-all
const readAllHandler = async (req, res, next) => {
  try {
    const result = await notificationService.markAllNotificationsRead(req.actor.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
router.patch('/read-all', authenticate, readAllHandler);
router.post('/read-all', authenticate, readAllHandler);

// PATCH /api/v1/notifications/:id/read & POST /api/v1/notifications/:id/read
const readOneHandler = async (req, res, next) => {
  try {
    const result = await notificationService.markNotificationRead(req.actor.id, req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
router.patch('/:id/read', authenticate, readOneHandler);
router.post('/:id/read', authenticate, readOneHandler);

export default router;

