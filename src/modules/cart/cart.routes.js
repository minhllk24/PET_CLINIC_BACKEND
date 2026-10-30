import express from 'express';
import * as cartController from './cart.controller';
import { optionalAuth } from '../../shared/authMiddleware';

const router = express.Router();

router.use(optionalAuth);

// Canonical OpenAPI v7 Routes
router.get('/', cartController.getCart);
router.post('/items', cartController.addItem);
router.patch('/items/:itemId', cartController.updateItem);
router.delete('/items/:itemId', cartController.removeItem);

// Backward-compatibility Aliases for Frontend (POST /cart, PUT/PATCH/DELETE /cart/:itemId)
router.post('/', cartController.addItem);
router.put('/:itemId', cartController.updateItem);
router.patch('/:itemId', cartController.updateItem);
router.delete('/:itemId', cartController.removeItem);

export default router;
