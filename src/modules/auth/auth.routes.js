import express from 'express';
import authController from './auth.controller.js';
import { authenticate } from '../../shared/authMiddleware.js';
import { authLimiter, otpLimiter, forgotPasswordLimiter } from '../../shared/rateLimitMiddleware.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/google', authLimiter, authController.googleLogin);

// Protected Authentication Endpoints
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);

export default router;
