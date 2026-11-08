import express from 'express';
import authController from './auth.controller.js';
import { authenticate } from '../../shared/authMiddleware.js';
import { authLimiter, otpLimiter, forgotPasswordLimiter } from '../../shared/rateLimitMiddleware.js';

const router = express.Router();

// Public Authentication Endpoints
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/refresh-token', authController.refreshToken); // FE alias
router.post('/forgot-password', forgotPasswordLimiter, authController.forgotPassword);
router.post('/verify-otp', otpLimiter, authController.verifyOtp);
router.post('/verify-register-otp', otpLimiter, authController.verifyOtp); // FE alias
router.post('/resend-otp', otpLimiter, authController.resendOtp);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/google', authLimiter, authController.googleLogin);

// Protected Authentication Endpoints
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);
router.patch('/me', authenticate, authController.updateMe);
router.put('/profile', authenticate, authController.updateMe);
router.patch('/profile', authenticate, authController.updateMe);

// Address Book (Customer Profile)
router.get('/me/addresses', authenticate, authController.listAddresses);
router.post('/me/addresses', authenticate, authController.addAddress);
router.patch('/me/addresses/:addressId', authenticate, authController.updateAddress);
router.put('/me/addresses/:addressId', authenticate, authController.updateAddress);
router.delete('/me/addresses/:addressId', authenticate, authController.deleteAddress);
router.post('/me/addresses/:addressId/default', authenticate, authController.setDefaultAddress);

export default router;
