"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _express = _interopRequireDefault(require("express"));
var _authController = _interopRequireDefault(require("../controllers/authController"));
var _userController = _interopRequireDefault(require("../controllers/userController"));
var _petController = _interopRequireDefault(require("../controllers/petController"));
var _productController = _interopRequireDefault(require("../controllers/productController"));
var _cartController = _interopRequireDefault(require("../controllers/cartController"));
var _orderController = _interopRequireDefault(require("../controllers/orderController"));
var _paymentController = _interopRequireDefault(require("../controllers/paymentController"));
var _clinicServiceController = _interopRequireDefault(require("../controllers/clinicServiceController"));
var _appointmentController = _interopRequireDefault(require("../controllers/appointmentController"));
var _medicalRecordController = _interopRequireDefault(require("../controllers/medicalRecordController"));
var _healthDiaryController = _interopRequireDefault(require("../controllers/healthDiaryController"));
var _branchController = _interopRequireDefault(require("../controllers/branchController"));
var _reviewController = _interopRequireDefault(require("../controllers/reviewController"));
var _loyaltyController = _interopRequireDefault(require("../controllers/loyaltyController"));
var _contentController = _interopRequireDefault(require("../controllers/contentController"));
var _rescueController = _interopRequireDefault(require("../controllers/rescueController"));
var _flashSaleController = _interopRequireDefault(require("../controllers/flashSaleController"));
var _authMiddleware = require("../middleware/authMiddleware");
var _uploadMiddleware = _interopRequireDefault(require("../middleware/uploadMiddleware"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
// Phase 4 controllers

var router = _express["default"].Router();
var initAPIRoutes = function initAPIRoutes(app) {
  // --- AUTH ROUTES ---
  router.post('/register', _authController["default"].handleRegister);
  router.post('/verify-register-otp', _authController["default"].handleVerifyRegisterOtp);
  router.post('/login', _authController["default"].handleLogin);
  router.post('/logout', _authController["default"].handleLogout);
  router.post('/refresh', _authController["default"].handleRefreshToken);

  // --- FORGOT PASSWORD FLOW ---
  router.post('/forgot-password', _authController["default"].handleForgotPassword);
  router.post('/verify-otp', _authController["default"].handleVerifyOtp);
  router.post('/reset-password', _authController["default"].handleResetPassword);
  router.post('/change-password', _authMiddleware.authMiddleware, _authController["default"].handleChangePassword);

  // --- USER ROUTES ---
  router.get('/users', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _userController["default"].handleGetAllUsers);
  router.get('/users/:id', _authMiddleware.authMiddleware, _userController["default"].handleGetDetailUser);
  router.put('/users/:id', _authMiddleware.authMiddleware, _userController["default"].handleUpdateUser);
  router["delete"]('/users/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _userController["default"].handleDeleteUser);
  router.get('/users/:id/addresses', _authMiddleware.authMiddleware, _userController["default"].handleGetUserAddresses);
  router.post('/users/:id/addresses', _authMiddleware.authMiddleware, _userController["default"].handleCreateAddress);
  router.put('/addresses/:addressId', _authMiddleware.authMiddleware, _userController["default"].handleUpdateAddress);
  router["delete"]('/addresses/:addressId', _authMiddleware.authMiddleware, _userController["default"].handleDeleteAddress);

  // --- PET ROUTES ---
  router.get('/pets/species', _petController["default"].handleGetSpecies);
  router.get('/pets/breeds', _petController["default"].handleGetBreeds);
  router.get('/my-pets', _authMiddleware.authMiddleware, _petController["default"].handleGetMyPets);
  router.get('/pets/:id', _authMiddleware.authMiddleware, _petController["default"].handleGetDetailPet);
  router.post('/pets', _authMiddleware.authMiddleware, _petController["default"].handleCreatePet);
  router.put('/pets/:id', _authMiddleware.authMiddleware, _petController["default"].handleUpdatePet);
  router["delete"]('/pets/:id', _authMiddleware.authMiddleware, _petController["default"].handleDeletePet);

  // --- PRODUCT & CATEGORY ROUTES ---
  router.get('/categories', _productController["default"].handleGetAllCategories);
  router.post('/categories', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _productController["default"].handleCreateCategory);
  router.put('/categories/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _productController["default"].handleUpdateCategory);
  router["delete"]('/categories/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _productController["default"].handleDeleteCategory);
  router.get('/products', _productController["default"].handleGetAllProducts);
  router.get('/products/:id', _productController["default"].handleGetDetailProduct);
  router.get('/products/:id/related', _productController["default"].handleGetRelatedProducts);
  router.get('/products/:id/review-stats', _productController["default"].handleGetReviewStats);
  router.post('/products', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _productController["default"].handleCreateProduct);
  router.put('/products/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _productController["default"].handleUpdateProduct);
  router["delete"]('/products/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _productController["default"].handleDeleteProduct);

  // --- FLASH SALE ROUTES ---
  router.get('/flash-sales/active', _flashSaleController["default"].handleGetActiveFlashSale);
  router.post('/flash-sales', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _flashSaleController["default"].handleCreateFlashSale);
  router.put('/flash-sales/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _flashSaleController["default"].handleUpdateFlashSale);
  router["delete"]('/flash-sales/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _flashSaleController["default"].handleDeleteFlashSale);

  // --- CART ROUTES ---
  router.get('/cart', _authMiddleware.authMiddleware, _cartController["default"].handleGetCart);
  router.post('/cart', _authMiddleware.authMiddleware, _cartController["default"].handleAddToCart);
  router.put('/cart/:item_id', _authMiddleware.authMiddleware, _cartController["default"].handleUpdateCartItem);
  router["delete"]('/cart/:item_id', _authMiddleware.authMiddleware, _cartController["default"].handleDeleteCartItem);

  // --- ORDER ROUTES ---
  router.get('/orders', _authMiddleware.authMiddleware, _orderController["default"].handleGetOrders);
  router.get('/orders/:id', _authMiddleware.authMiddleware, _orderController["default"].handleGetDetailOrder);
  router.post('/orders/checkout', _authMiddleware.authMiddleware, _orderController["default"].handleCheckout);
  router.post('/orders/guest-checkout', _orderController["default"].handleGuestCheckout);
  router.put('/orders/:id/status', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN', 'STAFF']), _orderController["default"].handleUpdateOrderStatus);

  // --- PAYMENT ROUTES ---
  router.get('/payments', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _paymentController["default"].handleGetPayments);
  router.put('/payments/:id/status', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN', 'STAFF']), _paymentController["default"].handleUpdatePaymentStatus);

  // --- CLINIC SERVICE & BRANCH ROUTES ---
  router.get('/branches', _branchController["default"].handleGetAllBranches);
  router.get('/services', _clinicServiceController["default"].handleGetAllServices);
  router.get('/services/categories', _clinicServiceController["default"].handleGetAllCategories);
  router.get('/services/:id', _clinicServiceController["default"].handleGetServiceById);
  router.post('/services', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _clinicServiceController["default"].handleCreateService);
  router.put('/services/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _clinicServiceController["default"].handleUpdateService);
  router["delete"]('/services/:id', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _clinicServiceController["default"].handleDeleteService);

  // --- APPOINTMENT ROUTES ---
  router.get('/appointments/my-history', _authMiddleware.authMiddleware, _appointmentController["default"].handleGetMyHistory);
  router.get('/appointments/slots', _appointmentController["default"].handleGetSlots);
  router.get('/appointments/:id', _authMiddleware.authMiddleware, _appointmentController["default"].handleGetDetailAppointment);
  router.post('/appointments', _authMiddleware.authMiddleware, _appointmentController["default"].handleCreateAppointment);
  router.patch('/appointments/:id/cancel', _authMiddleware.authMiddleware, _appointmentController["default"].handleCancelAppointment);
  router.patch('/appointments/:id/status', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN', 'STAFF', 'DOCTOR']), _appointmentController["default"].handleUpdateStatus);

  // --- MEDICAL RECORD ROUTES ---
  router.get('/medical-records/pet/:petId', _authMiddleware.authMiddleware, _medicalRecordController["default"].handleGetRecordsByPet);
  router.get('/medical-records/:id', _authMiddleware.authMiddleware, _medicalRecordController["default"].handleGetDetailRecord);
  router.post('/medical-records', _authMiddleware.authMiddleware, _uploadMiddleware["default"].array('attachments', 5), _medicalRecordController["default"].handleCreateRecord);
  router.put('/medical-records/:id', _authMiddleware.authMiddleware, _uploadMiddleware["default"].array('attachments', 5), _medicalRecordController["default"].handleUpdateRecord);
  router["delete"]('/medical-records/:id', _authMiddleware.authMiddleware, _medicalRecordController["default"].handleDeleteRecord);

  // --- HEALTH DIARY ROUTES ---
  router.get('/health-diaries/pet/:petId', _authMiddleware.authMiddleware, _healthDiaryController["default"].handleGetDiaries);
  router.post('/health-diaries', _authMiddleware.authMiddleware, _healthDiaryController["default"].handleCreateDiary);

  // --- REMINDER ROUTES ---
  router.get('/reminders/pet/:petId', _authMiddleware.authMiddleware, _healthDiaryController["default"].handleGetReminders);
  router.post('/reminders', _authMiddleware.authMiddleware, _healthDiaryController["default"].handleCreateReminder);
  router.patch('/reminders/:id/complete', _authMiddleware.authMiddleware, _healthDiaryController["default"].handleCompleteReminder);
  router["delete"]('/reminders/:id', _authMiddleware.authMiddleware, _healthDiaryController["default"].handleDeleteReminder);

  // ==================== PHASE 4 ROUTES ==================== //

  // --- REVIEWS ---
  router.get('/reviews', _reviewController["default"].handleGetAllReviews);
  router.get('/reviews/target/:targetType/:targetId', _reviewController["default"].handleGetReviews);
  router.get('/reviews/can-review/:targetType/:targetId', _authMiddleware.authMiddleware, _reviewController["default"].handleCheckCanReview);
  router.post('/reviews', _authMiddleware.authMiddleware, _reviewController["default"].handleCreateReview);
  router.patch('/reviews/:id/reject', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _reviewController["default"].handleRejectReview);
  router.patch('/reviews/:id/delete', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _reviewController["default"].handleDeleteReview);
  router.post('/reviews/:id/like', _authMiddleware.authMiddleware, _reviewController["default"].handleLikeReview);
  router.post('/reviews/:id/reply', _authMiddleware.authMiddleware, _reviewController["default"].handleReplyReview);

  // --- VOUCHERS & LOYALTY ---
  router.get('/vouchers', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _loyaltyController["default"].handleGetVouchers);
  router.post('/vouchers', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _loyaltyController["default"].handleCreateVoucher);
  router.post('/vouchers/apply', _authMiddleware.authMiddleware, _loyaltyController["default"].handleApplyVoucher);
  router.get('/loyalty/my-points', _authMiddleware.authMiddleware, _loyaltyController["default"].handleGetMyPoints);
  router.get('/loyalty/transactions', _authMiddleware.authMiddleware, _loyaltyController["default"].handleGetMyTransactions);

  // --- POSTS & FIRST AID ---
  router.get('/post-categories', _contentController["default"].handleGetPostCategories);
  router.get('/posts/featured', _contentController["default"].handleGetFeaturedPost);
  router.get('/posts/trending', _contentController["default"].handleGetTrendingPosts);
  router.get('/posts', _contentController["default"].handleGetPosts);
  router.get('/posts/:slug', _contentController["default"].handleGetPostBySlug);
  router.post('/posts', _authMiddleware.authMiddleware, _contentController["default"].handleCreatePost);
  router.get('/first-aid/categories', _contentController["default"].handleGetFirstAidCategories);
  router.get('/first-aid/guides', _contentController["default"].handleGetFirstAidGuides);
  router.get('/first-aid/guides/:slug', _contentController["default"].handleGetFirstAidGuideBySlug);
  router.post('/first-aid/guides', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _contentController["default"].handleCreateFirstAidGuide);
  router.get('/ai-chat/sessions', _authMiddleware.authMiddleware, _contentController["default"].handleGetAiChatSessions);
  router.post('/ai-chat/sessions', _authMiddleware.authMiddleware, _contentController["default"].handleCreateAiChatSession);

  // --- RESCUE & ADOPTION ---
  router.get('/rescue/stations', _rescueController["default"].handleGetStations);
  router.get('/rescue/posts', _rescueController["default"].handleGetRescuePosts);
  router.get('/adoptions/pets', _rescueController["default"].handleGetAdoptionPets);
  router.post('/adoptions/requests', _authMiddleware.authMiddleware, _rescueController["default"].handleCreateAdoptionRequest);
  router.get('/adoptions/my-requests', _authMiddleware.authMiddleware, _rescueController["default"].handleGetMyRequests);
  router.patch('/adoptions/requests/:id/status', _authMiddleware.authMiddleware, (0, _authMiddleware.requireRole)(['ADMIN']), _rescueController["default"].handleUpdateStatus);
  return app.use('/api/v1', router);
};
var _default = exports["default"] = initAPIRoutes;