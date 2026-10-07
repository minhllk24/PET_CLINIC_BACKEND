import express from 'express';
import * as identityController from './identity.controller';

const router = express.Router();

router.post('/login', identityController.login);
router.post('/refresh', identityController.refresh);
router.post('/logout', identityController.logout);
router.post('/register', identityController.register);
router.post('/forgot-password', identityController.forgotPassword);
router.post('/reset-password', identityController.resetPassword);
router.post('/otp/resend', identityController.resendOtp);
router.get('/me', identityController.getMe);

export default router;
