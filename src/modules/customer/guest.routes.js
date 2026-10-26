import express from 'express';
import * as guestService from './guest.service';

const router = express.Router();

/**
 * Middleware to extract and verify guest lookup token
 */
const requireGuestAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const lookupHeader = req.headers['x-guest-lookup-token'];

  let token = null;
  if (lookupHeader) {
    token = lookupHeader;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  try {
    const payload = guestService.verifyGuestToken(token);
    req.guest = payload;
    next();
  } catch (error) {
    next(error);
  }
};

// Request OTP for guest lookup
router.post('/lookup/request-otp', async (req, res, next) => {
  try {
    const result = await guestService.requestGuestOtp(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Verify OTP for guest lookup
router.post('/lookup/verify-otp', async (req, res, next) => {
  try {
    const result = await guestService.verifyGuestOtp(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// View guest transactions
router.get('/transactions', requireGuestAuth, async (req, res, next) => {
  try {
    const result = await guestService.getGuestTransactions(req.guest);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export const activationRouter = express.Router();

// Trigger activation invite
activationRouter.post('/invite', async (req, res, next) => {
  try {
    const result = await guestService.sendActivationInvite(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Complete activation
activationRouter.post('/complete', async (req, res, next) => {
  try {
    const result = await guestService.completeActivation(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
