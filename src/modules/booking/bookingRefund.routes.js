import express from 'express';
import * as refundService from './bookingRefund.service';
import { authenticate, optionalAuth, requireRole } from '../../shared/authMiddleware';

const router = express.Router();

// Request refund (Customer / Guest)
router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const result = await refundService.requestRefund(req.body, req.actor, req.headers['x-guest-lookup-token']);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// List refunds (Staff, Customer own)
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const result = await refundService.listRefunds(req.query, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get refund by ID
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const result = await refundService.getRefundById(req.params.id, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Receptionist receives refund (REQUESTED -> PROCESSING)
router.post('/:id/receive', authenticate, requireRole(['STAFF', 'MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await refundService.receiveRefund(req.params.id, req.body?.note, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Manager/Admin approves refund (PROCESSING -> APPROVED -> REFUNDED)
router.post('/:id/approve', authenticate, requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await refundService.approveRefund(req.params.id, req.body?.note, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Manager/Admin rejects refund (PROCESSING -> REJECTED)
router.post('/:id/reject', authenticate, requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await refundService.rejectRefund(req.params.id, req.body?.reason, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Manager/Admin override
router.post('/:id/override', authenticate, requireRole(['MANAGER', 'ADMIN']), async (req, res, next) => {
  try {
    const result = await refundService.overrideRefund(req.params.id, req.body, req.actor);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
