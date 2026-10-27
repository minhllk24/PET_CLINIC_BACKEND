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

// Request OTP for guest lookup (supports both /lookup/otp and /lookup/request-otp)
router.post(['/lookup/otp', '/lookup/request-otp'], async (req, res, next) => {
  try {
    const result = await guestService.requestGuestOtp(req.body);
    const isStandardOpenApi = req.path.endsWith('/lookup/otp');
    if (isStandardOpenApi) {
      res.status(202).json({
        challengeId: result.challengeId,
        expiresIn: result.expiresIn,
        ...(result.debugOtp ? { debugOtp: result.debugOtp, otp: result.otp } : {}),
      });
    } else {
      res.status(200).json(result);
    }
  } catch (error) {
    next(error);
  }
});

// Verify OTP for guest lookup (supports both /lookup/verify and /lookup/verify-otp)
router.post(['/lookup/verify', '/lookup/verify-otp'], async (req, res, next) => {
  try {
    const result = await guestService.verifyGuestOtp(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// View guest transactions
router.get('/transactions', requireGuestAuth, async (req, res, next) => {
  try {
    const result = await guestService.getGuestTransactions(req.guest);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export const activationRouter = express.Router();

// Trigger activation invite (supports both /invitations and /invite)
activationRouter.post(['/invitations', '/invite'], async (req, res, next) => {
  try {
    const result = await guestService.sendActivationInvite(req.body);
    const isStandardOpenApi = req.path.endsWith('/invitations');
    if (isStandardOpenApi) {
      res.status(202).json(result);
    } else {
      res.status(200).json(result);
    }
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
