import express from 'express';
import * as cartController from './cart.controller';
import { optionalAuth } from '../../shared/authMiddleware';

const router = express.Router();

router.use(optionalAuth);

router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.patch('/items/:itemId', cartController.updateItem);
router.delete('/items/:itemId', cartController.removeItem);

export default router;
