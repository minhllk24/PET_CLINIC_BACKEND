import express from 'express';
import authController from '../controllers/authController';
import userController from '../controllers/userController';
import petController from '../controllers/petController';
import productController from '../controllers/productController';
import cartController from '../controllers/cartController';
import orderController from '../controllers/orderController';
import paymentController from '../controllers/paymentController';
import clinicServiceController from '../controllers/clinicServiceController';
import appointmentController from '../controllers/appointmentController';
import medicalRecordController from '../controllers/medicalRecordController';
import healthDiaryController from '../controllers/healthDiaryController';
import branchController from '../controllers/branchController';

// Phase 4 controllers
import reviewController from '../controllers/reviewController';
import loyaltyController from '../controllers/loyaltyController';
import contentController from '../controllers/contentController';
import rescueController from '../controllers/rescueController';
import flashSaleController from '../controllers/flashSaleController';

import { authMiddleware as verifyToken, requireRole as checkPermission } from '../middleware/authMiddleware';
import upload from '../middleware/uploadMiddleware';

const router = express.Router();

const initAPIRoutes = (app) => {
  // --- AUTH ROUTES ---
  router.post('/register', authController.handleRegister);
  router.post('/verify-register-otp', authController.handleVerifyRegisterOtp);
  router.post('/login', authController.handleLogin);
  router.post('/logout', authController.handleLogout);
  router.post('/refresh', authController.handleRefreshToken);

  // --- FORGOT PASSWORD FLOW ---
  router.post('/forgot-password', authController.handleForgotPassword);
  router.post('/verify-otp', authController.handleVerifyOtp);
  router.post('/reset-password', authController.handleResetPassword);
  router.post('/change-password', verifyToken, authController.handleChangePassword);

  // --- USER ROUTES ---
  router.get('/users', verifyToken, checkPermission(['ADMIN']), userController.handleGetAllUsers);
  router.get('/users/:id', verifyToken, userController.handleGetDetailUser);
  router.put('/users/:id', verifyToken, userController.handleUpdateUser);
  router.delete('/users/:id', verifyToken, checkPermission(['ADMIN']), userController.handleDeleteUser);
  
  router.get('/users/:id/addresses', verifyToken, userController.handleGetUserAddresses);
  router.post('/users/:id/addresses', verifyToken, userController.handleCreateAddress);
  router.put('/addresses/:addressId', verifyToken, userController.handleUpdateAddress);
  router.delete('/addresses/:addressId', verifyToken, userController.handleDeleteAddress);

  // --- PET ROUTES ---
  router.get('/pets/species', petController.handleGetSpecies);
  router.get('/pets/breeds', petController.handleGetBreeds);
  router.get('/my-pets', verifyToken, petController.handleGetMyPets);
  router.get('/pets/:id', verifyToken, petController.handleGetDetailPet);
  router.post('/pets', verifyToken, petController.handleCreatePet);
  router.put('/pets/:id', verifyToken, petController.handleUpdatePet);
  router.delete('/pets/:id', verifyToken, petController.handleDeletePet);

  // --- PRODUCT & CATEGORY ROUTES ---
  router.get('/categories', productController.handleGetAllCategories);
  router.post('/categories', verifyToken, checkPermission(['ADMIN']), productController.handleCreateCategory);
  router.put('/categories/:id', verifyToken, checkPermission(['ADMIN']), productController.handleUpdateCategory);
  router.delete('/categories/:id', verifyToken, checkPermission(['ADMIN']), productController.handleDeleteCategory);

  router.get('/products', productController.handleGetAllProducts);
  router.get('/products/:id', productController.handleGetDetailProduct);
  router.get('/products/:id/related', productController.handleGetRelatedProducts);
  router.get('/products/:id/review-stats', productController.handleGetReviewStats);
  router.post('/products', verifyToken, checkPermission(['ADMIN']), productController.handleCreateProduct);
  router.put('/products/:id', verifyToken, checkPermission(['ADMIN']), productController.handleUpdateProduct);
  router.delete('/products/:id', verifyToken, checkPermission(['ADMIN']), productController.handleDeleteProduct);

  // --- FLASH SALE ROUTES ---
  router.get('/flash-sales/active', flashSaleController.handleGetActiveFlashSale);
  router.post('/flash-sales', verifyToken, checkPermission(['ADMIN']), flashSaleController.handleCreateFlashSale);
  router.put('/flash-sales/:id', verifyToken, checkPermission(['ADMIN']), flashSaleController.handleUpdateFlashSale);
  router.delete('/flash-sales/:id', verifyToken, checkPermission(['ADMIN']), flashSaleController.handleDeleteFlashSale);

  // --- CART ROUTES ---
  router.get('/cart', verifyToken, cartController.handleGetCart);
  router.post('/cart', verifyToken, cartController.handleAddToCart);
  router.put('/cart/:item_id', verifyToken, cartController.handleUpdateCartItem);
  router.delete('/cart/:item_id', verifyToken, cartController.handleDeleteCartItem);

  // --- ORDER ROUTES ---
  router.get('/orders', verifyToken, orderController.handleGetOrders);
  router.get('/orders/:id', verifyToken, orderController.handleGetDetailOrder);
  router.post('/orders/checkout', verifyToken, orderController.handleCheckout);
  router.post('/orders/guest-checkout', orderController.handleGuestCheckout);
  router.put('/orders/:id/status', verifyToken, checkPermission(['ADMIN', 'STAFF']), orderController.handleUpdateOrderStatus);

  // --- PAYMENT ROUTES ---
  router.get('/payments', verifyToken, checkPermission(['ADMIN']), paymentController.handleGetPayments);
  router.put('/payments/:id/status', verifyToken, checkPermission(['ADMIN', 'STAFF']), paymentController.handleUpdatePaymentStatus);

  // --- CLINIC SERVICE & BRANCH ROUTES ---
  router.get('/branches', branchController.handleGetAllBranches);
  
  router.get('/services', clinicServiceController.handleGetAllServices);
  router.get('/services/categories', clinicServiceController.handleGetAllCategories);
  router.get('/services/:id', clinicServiceController.handleGetServiceById);
  router.post('/services', verifyToken, checkPermission(['ADMIN']), clinicServiceController.handleCreateService);
  router.put('/services/:id', verifyToken, checkPermission(['ADMIN']), clinicServiceController.handleUpdateService);
  router.delete('/services/:id', verifyToken, checkPermission(['ADMIN']), clinicServiceController.handleDeleteService);

  // --- APPOINTMENT ROUTES ---
  router.get('/appointments/my-history', verifyToken, appointmentController.handleGetMyHistory);
  router.get('/appointments/slots', appointmentController.handleGetSlots);
  router.get('/appointments/:id/pricing', verifyToken, appointmentController.handleGetPricing);
  router.get('/appointments/:id', verifyToken, appointmentController.handleGetDetailAppointment);
  router.post('/appointments', verifyToken, appointmentController.handleCreateAppointment);
  router.post('/appointments/:id/checkout', verifyToken, appointmentController.handleCheckout);
  router.patch('/appointments/:id/cancel', verifyToken, appointmentController.handleCancelAppointment);
  router.patch('/appointments/:id/status', verifyToken, checkPermission(['ADMIN', 'STAFF', 'DOCTOR']), appointmentController.handleUpdateStatus);

  // --- MEDICAL RECORD ROUTES ---
  router.get('/medical-records/pet/:petId', verifyToken, medicalRecordController.handleGetRecordsByPet);
  router.get('/medical-records/:id', verifyToken, medicalRecordController.handleGetDetailRecord);
  router.post('/medical-records', verifyToken, upload.array('attachments', 5), medicalRecordController.handleCreateRecord);
  router.put('/medical-records/:id', verifyToken, upload.array('attachments', 5), medicalRecordController.handleUpdateRecord);
  router.delete('/medical-records/:id', verifyToken, medicalRecordController.handleDeleteRecord);

  // --- HEALTH DIARY ROUTES ---
  router.get('/health-diaries/pet/:petId', verifyToken, healthDiaryController.handleGetDiaries);
  router.post('/health-diaries', verifyToken, healthDiaryController.handleCreateDiary);

  // --- REMINDER ROUTES ---
  router.get('/reminders/pet/:petId', verifyToken, healthDiaryController.handleGetReminders);
  router.post('/reminders', verifyToken, healthDiaryController.handleCreateReminder);
  router.patch('/reminders/:id/complete', verifyToken, healthDiaryController.handleCompleteReminder);
  router.delete('/reminders/:id', verifyToken, healthDiaryController.handleDeleteReminder);

  // ==================== PHASE 4 ROUTES ==================== //

  // --- REVIEWS ---
  router.get('/reviews', reviewController.handleGetAllReviews);
  router.get('/reviews/target/:targetType/:targetId', reviewController.handleGetReviews);
  router.get('/reviews/can-review/:targetType/:targetId', verifyToken, reviewController.handleCheckCanReview);
  router.post('/reviews', verifyToken, reviewController.handleCreateReview);
  router.patch('/reviews/:id/reject', verifyToken, checkPermission(['ADMIN']), reviewController.handleRejectReview);
  router.patch('/reviews/:id/delete', verifyToken, checkPermission(['ADMIN']), reviewController.handleDeleteReview);
  router.post('/reviews/:id/like', verifyToken, reviewController.handleLikeReview);
  router.post('/reviews/:id/reply', verifyToken, reviewController.handleReplyReview);

  // --- VOUCHERS & LOYALTY ---
  router.get('/vouchers', verifyToken, checkPermission(['ADMIN']), loyaltyController.handleGetVouchers);
  router.post('/vouchers', verifyToken, checkPermission(['ADMIN']), loyaltyController.handleCreateVoucher);
  router.post('/vouchers/apply', verifyToken, loyaltyController.handleApplyVoucher);
  router.get('/loyalty/my-points', verifyToken, loyaltyController.handleGetMyPoints);
  router.get('/loyalty/transactions', verifyToken, loyaltyController.handleGetMyTransactions);

  // --- POSTS & FIRST AID ---
  router.get('/post-categories', contentController.handleGetPostCategories);
  router.get('/posts/featured', contentController.handleGetFeaturedPost);
  router.get('/posts/trending', contentController.handleGetTrendingPosts);
  router.get('/posts', contentController.handleGetPosts);
  router.get('/posts/:slug', contentController.handleGetPostBySlug);
  router.post('/posts', verifyToken, contentController.handleCreatePost);
  
  router.get('/first-aid/categories', contentController.handleGetFirstAidCategories);
  router.get('/first-aid/guides', contentController.handleGetFirstAidGuides);
  router.get('/first-aid/guides/:slug', contentController.handleGetFirstAidGuideBySlug);
  router.post('/first-aid/guides', verifyToken, checkPermission(['ADMIN']), contentController.handleCreateFirstAidGuide);
  router.get('/ai-chat/sessions', verifyToken, contentController.handleGetAiChatSessions);
  router.post('/ai-chat/sessions', verifyToken, contentController.handleCreateAiChatSession);

  // --- RESCUE & ADOPTION ---
  router.get('/rescue/stations', rescueController.handleGetStations);
  router.get('/rescue/posts', rescueController.handleGetRescuePosts);
  router.get('/adoptions/pets', rescueController.handleGetAdoptionPets);
  router.post('/adoptions/requests', verifyToken, rescueController.handleCreateAdoptionRequest);
  router.get('/adoptions/my-requests', verifyToken, rescueController.handleGetMyRequests);
  router.patch('/adoptions/requests/:id/status', verifyToken, checkPermission(['ADMIN']), rescueController.handleUpdateStatus);

  return app.use('/api/v1', router);
};

export default initAPIRoutes;
