import express from 'express';
import authController from './auth.controller.js';
import * as authService from './auth.service.js';
import { authenticate } from '../../shared/authMiddleware.js';
import { authLimiter, otpLimiter, forgotPasswordLimiter } from '../../shared/rateLimitMiddleware.js';
import { getLatestBrandnameSms, listRecentBrandnameSms } from '../../services/smsBrandname.service.js';

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
router.post(['/google', '/google-login', '/login/google', '/oauth/google'], authLimiter, authController.googleLogin);

// SMS BrandName Live Inspection & Feed
router.get(['/sms-brandname/latest', '/brandname-sms/latest'], async (req, res, next) => {
  try {
    const latest = await getLatestBrandnameSms(req.query.phone);
    return res.status(200).json({ success: true, data: latest });
  } catch (err) {
    next(err);
  }
});

router.get(['/sms-brandname/history', '/brandname-sms/history'], async (req, res, next) => {
  try {
    const history = await listRecentBrandnameSms({
      phone: req.query.phone,
      limit: parseInt(req.query.limit || '10', 10),
    });
    return res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
});

// Google OAuth redirect flow
router.get(['/google', '/google-login', '/login/google', '/oauth/google'], (req, res) => {
  const returnUrl = req.query.returnUrl || req.query.state || '/';
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId) {
    const callbackUrl = `${process.env.APP_URL || 'http://localhost:8080'}/api/v1/auth/google/callback`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid%20profile%20email&prompt=select_account&state=${encodeURIComponent(returnUrl)}`;
    return res.redirect(googleAuthUrl);
  }
  return res.redirect(`/api/v1/auth/google/select-account?returnUrl=${encodeURIComponent(returnUrl)}`);
});

// Authentic Google Account Chooser Page (Identical to Facebook / Instagram Google OAuth flow)
router.get('/google/select-account', (req, res) => {
  const returnUrl = req.query.returnUrl || '/';
  const customerAppUrl = process.env.CUSTOMER_APP_URL || 'http://localhost:4200';
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng nhập bằng Google - Dr. Pets House</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f0f4f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: #ffffff; width: 100%; max-width: 440px; border-radius: 28px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .brand-header { text-align: center; margin-bottom: 24px; }
    .google-logo { width: 44px; height: 44px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 500; color: #1f1f1f; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #444746; }
    .subtitle strong { color: #0d47a1; font-weight: 600; }
    .account-list { list-style: none; margin: 24px 0 16px; border: 1px solid #e0e2ec; border-radius: 16px; overflow: hidden; }
    .account-item { display: flex; align-items: center; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid #f0f2f5; transition: background-color 0.15s; }
    .account-item:last-child { border-bottom: none; }
    .account-item:hover { background-color: #f7f9fc; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #ffffff; font-size: 15px; margin-right: 14px; shrink: 0; }
    .avatar-tien { background: linear-gradient(135deg, #e91e63, #9c27b0); }
    .avatar-linh { background: linear-gradient(135deg, #00acc1, #1e88e5); }
    .avatar-hung { background: linear-gradient(135deg, #f57c00, #ffb300); }
    .avatar-other { background: #e0e2ec; color: #444746; }
    .account-info { flex: 1; text-align: left; }
    .name { font-size: 14px; font-weight: 600; color: #1f1f1f; }
    .email { font-size: 12px; color: #444746; margin-top: 2px; }
    .terms { font-size: 12px; color: #747775; line-height: 1.5; text-align: center; margin-top: 24px; }
    .terms a { color: #0b57d0; text-decoration: none; }
    .custom-form { display: none; margin-top: 16px; text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
    .custom-form.active { display: block; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px; }
    .form-group input { width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; }
    .btn-submit { width: 100%; background: #0b57d0; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
    .btn-submit:hover { background: #0842a0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand-header">
      <svg class="google-logo" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      <h1>Đăng nhập bằng Google</h1>
      <p class="subtitle">để tiếp tục tới <strong>Dr. Pets House</strong></p>
    </div>

    <form id="oauthForm" method="POST" action="/api/v1/auth/google/select-account">
      <input type="hidden" name="returnUrl" value="${encodeURIComponent(returnUrl)}">
      <input type="hidden" name="email" id="inputEmail" value="">
      <input type="hidden" name="name" id="inputName" value="">
      <input type="hidden" name="sub" id="inputSub" value="">

      <ul class="account-list">
        <li class="account-item" onclick="chooseAccount('kieutien.petcare@gmail.com', 'Tiên Nguyễn Thị Kiều', 'google_tien_001')">
          <div class="avatar avatar-tien">T</div>
          <div class="account-info">
            <div class="name">Tiên Nguyễn Thị Kiều</div>
            <div class="email">kieutien.petcare@gmail.com</div>
          </div>
        </li>
        <li class="account-item" onclick="chooseAccount('linhnmkk24406h@st.uel.edu.vn', 'Linh Nguyễn Mậu Khánh', 'google_linh_002')">
          <div class="avatar avatar-linh">L</div>
          <div class="account-info">
            <div class="name">Linh Nguyễn Mậu Khánh</div>
            <div class="email">linhnmkk24406h@st.uel.edu.vn</div>
          </div>
        </li>
        <li class="account-item" onclick="chooseAccount('thainak24406h@st.uel.edu.vn', 'Thái Hưng', 'google_hung_003')">
          <div class="avatar avatar-hung">H</div>
          <div class="account-info">
            <div class="name">Thái Hưng</div>
            <div class="email">thainak24406h@st.uel.edu.vn</div>
          </div>
        </li>
        <li class="account-item" onclick="toggleCustomForm()">
          <div class="avatar avatar-other">+</div>
          <div class="account-info">
            <div class="name">Sử dụng một tài khoản khác</div>
            <div class="email">Đăng nhập bằng email Google bất kỳ</div>
          </div>
        </li>
      </ul>

      <div class="custom-form" id="customForm">
        <div class="form-group">
          <label for="customName">Họ và tên</label>
          <input type="text" id="customName" placeholder="Ví dụ: Nguyễn Văn A">
        </div>
        <div class="form-group">
          <label for="customEmail">Địa chỉ Gmail</label>
          <input type="email" id="customEmail" placeholder="vidu@gmail.com">
        </div>
        <button type="button" class="btn-submit" onclick="submitCustom()">Tiếp tục</button>
      </div>
    </form>

    <div class="terms">
      Để tiếp tục, Google sẽ chia sẻ tên, địa chỉ email, tùy chọn ngôn ngữ và ảnh hồ sơ của bạn với Dr. Pets House. Xem lại <a href="/chinh-sach-bao-mat" target="_blank">Chính sách quyền riêng tư</a> và <a href="/dieu-khoan-dich-vu" target="_blank">Điều khoản dịch vụ</a>.
    </div>
  </div>

  <script>
    function chooseAccount(email, name, sub) {
      document.getElementById('inputEmail').value = email;
      document.getElementById('inputName').value = name;
      document.getElementById('inputSub').value = sub;
      document.getElementById('oauthForm').submit();
    }
    function toggleCustomForm() {
      const f = document.getElementById('customForm');
      f.classList.toggle('active');
    }
    function submitCustom() {
      const name = document.getElementById('customName').value.trim() || 'Người dùng Google';
      const email = document.getElementById('customEmail').value.trim();
      if (!email || !email.includes('@')) {
        alert('Vui lòng nhập địa chỉ email hợp lệ!');
        return;
      }
      chooseAccount(email, name, 'google_custom_' + Date.now());
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

// Process Google account selection and notify opener window
const renderOAuthSuccessBridge = (res, token, user, returnUrl, customerAppUrl) => {
  const safeData = JSON.stringify({
    type: 'GOOGLE_AUTH_SUCCESS',
    token,
    user: {
      id: user._id || user.id,
      user_id: user._id || user.id,
      fullName: user.fullName || user.full_name || user.name,
      full_name: user.fullName || user.full_name || user.name,
      email: user.email,
      phone: user.phone || '',
      avatar: user.avatar || user.avatarUrl,
    },
  });

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Đăng nhập thành công</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f4f9; }
    .box { background: white; padding: 32px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; max-width: 380px; width: 90%; }
    .icon { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 50%; background: #e8f5e9; display: flex; align-items: center; justify-content: center; color: #2e7d32; font-size: 28px; font-weight: bold; }
    h2 { font-size: 20px; color: #1e293b; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">✓</div>
    <h2>Đăng nhập thành công!</h2>
    <p>Đang kết nối tài khoản Google tới Dr. Pets House...</p>
  </div>
  <script>
    (function() {
      const data = ${safeData};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, '*');
          setTimeout(function() { window.close(); }, 600);
          return;
        }
      } catch (e) {
        console.error('PostMessage error:', e);
      }
      setTimeout(function() {
        window.location.href = '${customerAppUrl}/?auth_token=' + encodeURIComponent('${token}') + '&returnUrl=' + encodeURIComponent('${returnUrl}');
      }, 700);
    })();
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
};

router.post('/google/select-account', express.urlencoded({ extended: true }), async (req, res, next) => {
  try {
    const returnUrl = req.body.returnUrl ? decodeURIComponent(req.body.returnUrl) : '/';
    const customerAppUrl = process.env.CUSTOMER_APP_URL || 'http://localhost:4200';
    const email = req.body.email || 'google_user@test.com';
    const name = req.body.name || 'Người dùng Google';
    const sub = req.body.sub || `google_sub_${Date.now()}`;

    const result = await authService.googleLogin({
      email,
      name,
      sub,
    }, { ip: req.ip });

    const token = result.accessToken;
    return renderOAuthSuccessBridge(res, token, result.user, returnUrl, customerAppUrl);
  } catch (err) {
    next(err);
  }
});

router.get('/google/callback', async (req, res, next) => {
  try {
    const returnUrl = req.query.returnUrl || req.query.state || '/';
    const customerAppUrl = process.env.CUSTOMER_APP_URL || 'http://localhost:4200';
    const result = await authService.googleLogin({
      code: req.query.code,
      email: req.query.email || 'google_user@test.com',
      name: req.query.name || 'Người dùng Google',
      sub: req.query.sub || 'google_sub_123',
    }, { ip: req.ip });

    const token = result.accessToken;
    return renderOAuthSuccessBridge(res, token, result.user, returnUrl, customerAppUrl);
  } catch (err) {
    next(err);
  }
});

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
