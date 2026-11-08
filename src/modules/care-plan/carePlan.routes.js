import express from 'express';
import * as carePlanController from './carePlan.controller';
import { optionalAuth, requireRole } from '../../shared/authMiddleware';

const router = express.Router();

// Care plan endpoints for pets
router.get('/:petId/care-plan', optionalAuth, carePlanController.getCarePlan);
router.patch('/:petId/care-plan/tasks/:taskKey', optionalAuth, carePlanController.updateTaskState);
router.put('/:petId/care-plan/tasks/:taskKey', optionalAuth, carePlanController.updateTaskState);
router.post('/:petId/care-plan/reminders', optionalAuth, carePlanController.sendCarePlanReminder);

export default router;

