"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _passwordHelpers = require("../utils/passwordHelpers");
var _jwtHelpers = require("../utils/jwtHelpers");
var _emailHelpers = require("../utils/emailHelpers");
var _otpHelpers = require("../utils/otpHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var registerNewUser = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(rawUserData) {
    var isExist, _isExist, customerRole, passwordRegex, hashed_password, newUser, otpCode, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          if (!rawUserData.email) {
            _context.n = 2;
            break;
          }
          _context.n = 1;
          return _prisma["default"].user.findFirst({
            where: {
              email: rawUserData.email
            }
          });
        case 1:
          isExist = _context.v;
          if (!isExist) {
            _context.n = 2;
            break;
          }
          return _context.a(2, {
            EM: 'Email is already exist',
            EC: 2,
            DT: ''
          });
        case 2:
          if (!rawUserData.phone) {
            _context.n = 4;
            break;
          }
          _context.n = 3;
          return _prisma["default"].user.findFirst({
            where: {
              phone: rawUserData.phone
            }
          });
        case 3:
          _isExist = _context.v;
          if (!_isExist) {
            _context.n = 4;
            break;
          }
          return _context.a(2, {
            EM: 'Phone is already exist',
            EC: 2,
            DT: ''
          });
        case 4:
          _context.n = 5;
          return _prisma["default"].role.findUnique({
            where: {
              role_code: 'CUSTOMER'
            }
          });
        case 5:
          customerRole = _context.v;
          if (customerRole) {
            _context.n = 7;
            break;
          }
          _context.n = 6;
          return _prisma["default"].role.create({
            data: {
              role_code: 'CUSTOMER',
              role_name: 'Customer'
            }
          });
        case 6:
          customerRole = _context.v;
        case 7:
          // Validate password complexity
          passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
          if (passwordRegex.test(rawUserData.password)) {
            _context.n = 8;
            break;
          }
          return _context.a(2, {
            EM: 'Mật khẩu phải từ 8 ký tự, gồm ít nhất một chữ hoa và một chữ số',
            EC: 3,
            DT: ''
          });
        case 8:
          hashed_password = (0, _passwordHelpers.hashPassword)(rawUserData.password); // Create user as inactive
          _context.n = 9;
          return _prisma["default"].user.create({
            data: {
              role_id: customerRole.role_id,
              full_name: rawUserData.full_name || 'Anonymous',
              email: rawUserData.email || null,
              phone: rawUserData.phone || null,
              password_hash: hashed_password,
              status: 'inactive'
            }
          });
        case 9:
          newUser = _context.v;
          // Generate OTP
          otpCode = (0, _otpHelpers.generateOtpCode)();
          _context.n = 10;
          return _prisma["default"].otpCode.create({
            data: {
              user_id: newUser.user_id,
              email: newUser.email,
              phone: newUser.phone,
              otp_code: otpCode,
              purpose: 'register',
              expires_at: new Date(Date.now() + 5 * 60 * 1000),
              // 5 minutes
              resend_available_at: new Date(Date.now() + 60 * 1000) // 60 seconds
            }
          });
        case 10:
          if (!newUser.email) {
            _context.n = 12;
            break;
          }
          _context.n = 11;
          return (0, _emailHelpers.sendOtpEmail)(newUser.email, otpCode);
        case 11:
          _context.n = 13;
          break;
        case 12:
          if (newUser.phone) {
            console.log("[MOCK SMS] G\u1EEDi m\xE3 OTP \u0111\u0103ng k\xFD \u0111\u1EBFn S\u0110T ".concat(newUser.phone, ": ").concat(otpCode));
          }
        case 13:
          return _context.a(2, {
            EM: 'Vui lòng kiểm tra email hoặc SĐT để lấy mã OTP xác thực',
            EC: 0,
            DT: ''
          });
        case 14:
          _context.p = 14;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 14]]);
  }));
  return function registerNewUser(_x) {
    return _ref.apply(this, arguments);
  };
}();
var loginUser = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(loginData) {
    var login_id, password, user, isCorrectPassword, updatedUser, payload, access_token, refresh_token, isRememberMe, sessionExpiryDays, expiresAt, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          login_id = loginData.login_id, password = loginData.password;
          _context2.n = 1;
          return _prisma["default"].user.findFirst({
            where: {
              OR: [{
                email: login_id
              }, {
                phone: login_id
              }]
            },
            include: {
              role: true
            }
          });
        case 1:
          user = _context2.v;
          if (user) {
            _context2.n = 2;
            break;
          }
          return _context2.a(2, {
            EM: 'Email/Phone or Password incorrect',
            EC: 1,
            DT: ''
          });
        case 2:
          if (!(user.status !== 'active')) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa',
            EC: 2,
            DT: ''
          });
        case 3:
          if (!(user.failed_login_count >= 5)) {
            _context2.n = 4;
            break;
          }
          return _context2.a(2, {
            EM: 'Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng sử dụng Quên mật khẩu.',
            EC: 3,
            DT: ''
          });
        case 4:
          isCorrectPassword = (0, _passwordHelpers.comparePassword)(password, user.password_hash);
          if (isCorrectPassword) {
            _context2.n = 7;
            break;
          }
          _context2.n = 5;
          return _prisma["default"].user.update({
            where: {
              user_id: user.user_id
            },
            data: {
              failed_login_count: user.failed_login_count + 1
            }
          });
        case 5:
          updatedUser = _context2.v;
          if (!(updatedUser.failed_login_count >= 5)) {
            _context2.n = 6;
            break;
          }
          return _context2.a(2, {
            EM: 'Tài khoản đã bị khóa do nhập sai mật khẩu quá 5 lần. Vui lòng sử dụng Quên mật khẩu.',
            EC: 3,
            DT: ''
          });
        case 6:
          return _context2.a(2, {
            EM: 'Email/Phone or Password incorrect',
            EC: 1,
            DT: ''
          });
        case 7:
          if (!(user.failed_login_count > 0)) {
            _context2.n = 8;
            break;
          }
          _context2.n = 8;
          return _prisma["default"].user.update({
            where: {
              user_id: user.user_id
            },
            data: {
              failed_login_count: 0
            }
          });
        case 8:
          // Prepare payload
          payload = {
            user_id: user.user_id.toString(),
            role_code: user.role.role_code,
            email: user.email,
            full_name: user.full_name
          };
          access_token = (0, _jwtHelpers.generateAccessToken)(payload);
          refresh_token = (0, _jwtHelpers.generateRefreshToken)(payload); // Save session to DB
          isRememberMe = loginData.remember_me === true;
          sessionExpiryDays = isRememberMe ? 30 : 1;
          expiresAt = new Date(Date.now() + sessionExpiryDays * 24 * 60 * 60 * 1000);
          _context2.n = 9;
          return _prisma["default"].userSession.create({
            data: {
              user_id: user.user_id,
              session_token: refresh_token,
              remember_me: isRememberMe,
              ip_address: loginData.ip_address || null,
              user_agent: loginData.user_agent || null,
              expires_at: expiresAt
            }
          });
        case 9:
          return _context2.a(2, {
            EM: 'Login successful',
            EC: 0,
            DT: {
              access_token: access_token,
              refresh_token: refresh_token,
              user: payload
            }
          });
        case 10:
          _context2.p = 10;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[0, 10]]);
  }));
  return function loginUser(_x2) {
    return _ref2.apply(this, arguments);
  };
}();
var refreshNewToken = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(refreshToken) {
    var session, newAccessToken, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          _context3.n = 1;
          return _prisma["default"].userSession.findUnique({
            where: {
              session_token: refreshToken
            }
          });
        case 1:
          session = _context3.v;
          if (session) {
            _context3.n = 2;
            break;
          }
          return _context3.a(2, {
            EM: 'Session not found',
            EC: -999,
            DT: ''
          });
        case 2:
          if (!session.revoked_at) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'Session has been revoked',
            EC: -999,
            DT: ''
          });
        case 3:
          if (!(new Date() > session.expires_at)) {
            _context3.n = 4;
            break;
          }
          return _context3.a(2, {
            EM: 'Session has expired',
            EC: -999,
            DT: ''
          });
        case 4:
          newAccessToken = (0, _jwtHelpers.refreshNewTokenService)(refreshToken);
          if (newAccessToken) {
            _context3.n = 5;
            break;
          }
          return _context3.a(2, {
            EM: 'Refresh token is invalid or expired',
            EC: -999,
            DT: ''
          });
        case 5:
          return _context3.a(2, {
            EM: 'Refresh token successfully',
            EC: 0,
            DT: {
              access_token: newAccessToken
            }
          });
        case 6:
          _context3.p = 6;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 6]]);
  }));
  return function refreshNewToken(_x3) {
    return _ref3.apply(this, arguments);
  };
}();
var forgotPassword = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(email) {
    var user, recentOtp, waitTime, otpCode, isSent, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          _context4.n = 1;
          return _prisma["default"].user.findFirst({
            where: {
              email: email
            }
          });
        case 1:
          user = _context4.v;
          if (user) {
            _context4.n = 2;
            break;
          }
          return _context4.a(2, {
            EC: 2,
            EM: 'Email này chưa được đăng ký. Vui lòng tạo tài khoản mới.',
            DT: ''
          });
        case 2:
          _context4.n = 3;
          return _prisma["default"].otpCode.findFirst({
            where: {
              email: email,
              purpose: 'forgot_password',
              resend_available_at: {
                gt: new Date()
              }
            }
          });
        case 3:
          recentOtp = _context4.v;
          if (!recentOtp) {
            _context4.n = 4;
            break;
          }
          waitTime = Math.ceil((recentOtp.resend_available_at - new Date()) / 1000);
          return _context4.a(2, {
            EC: 1,
            EM: "Vui l\xF2ng ch\u1EDD ".concat(waitTime, "s \u0111\u1EC3 g\u1EEDi l\u1EA1i m\xE3 OTP"),
            DT: ''
          });
        case 4:
          otpCode = (0, _otpHelpers.generateOtpCode)(); // Save OTP to db
          _context4.n = 5;
          return _prisma["default"].otpCode.create({
            data: {
              user_id: user.user_id,
              email: user.email,
              otp_code: otpCode,
              purpose: 'forgot_password',
              expires_at: new Date(Date.now() + 5 * 60 * 1000),
              // 5 minutes
              resend_available_at: new Date(Date.now() + 60 * 1000) // 60 seconds
            }
          });
        case 5:
          _context4.n = 6;
          return (0, _emailHelpers.sendOtpEmail)(email, otpCode);
        case 6:
          isSent = _context4.v;
          if (isSent) {
            _context4.n = 7;
            break;
          }
          return _context4.a(2, {
            EC: -1,
            EM: 'Không thể gửi email OTP, vui lòng thử lại sau',
            DT: ''
          });
        case 7:
          return _context4.a(2, {
            EC: 0,
            EM: 'Mã OTP đã được gửi đến email của bạn',
            DT: ''
          });
        case 8:
          _context4.p = 8;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 8]]);
  }));
  return function forgotPassword(_x4) {
    return _ref4.apply(this, arguments);
  };
}();
var verifyOtp = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(email, otpCode) {
    var validOtp, updatedOtp, reset_token, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          _context5.n = 1;
          return _prisma["default"].otpCode.findFirst({
            where: {
              email: email,
              purpose: 'forgot_password',
              used_at: null
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 1:
          validOtp = _context5.v;
          if (validOtp) {
            _context5.n = 2;
            break;
          }
          return _context5.a(2, {
            EC: 1,
            EM: 'Không tìm thấy yêu cầu khôi phục mật khẩu hoặc OTP đã bị hủy',
            DT: ''
          });
        case 2:
          if (!(new Date() > validOtp.expires_at)) {
            _context5.n = 3;
            break;
          }
          return _context5.a(2, {
            EC: 1,
            EM: 'Mã OTP đã hết hạn',
            DT: ''
          });
        case 3:
          if (!(validOtp.otp_code !== otpCode)) {
            _context5.n = 7;
            break;
          }
          _context5.n = 4;
          return _prisma["default"].otpCode.update({
            where: {
              otp_id: validOtp.otp_id
            },
            data: {
              attempt_count: validOtp.attempt_count + 1
            }
          });
        case 4:
          updatedOtp = _context5.v;
          if (!(updatedOtp.attempt_count >= 5)) {
            _context5.n = 6;
            break;
          }
          _context5.n = 5;
          return _prisma["default"].otpCode.update({
            where: {
              otp_id: validOtp.otp_id
            },
            data: {
              used_at: new Date()
            }
          });
        case 5:
          return _context5.a(2, {
            EC: 1,
            EM: 'Mã OTP đã bị khóa do nhập sai quá nhiều lần',
            DT: ''
          });
        case 6:
          return _context5.a(2, {
            EC: 1,
            EM: 'Mã OTP không chính xác',
            DT: ''
          });
        case 7:
          _context5.n = 8;
          return _prisma["default"].otpCode.update({
            where: {
              otp_id: validOtp.otp_id
            },
            data: {
              used_at: new Date()
            }
          });
        case 8:
          // Generate reset token
          reset_token = (0, _otpHelpers.generateResetToken)({
            user_id: validOtp.user_id.toString(),
            email: validOtp.email,
            purpose: 'reset_password'
          });
          return _context5.a(2, {
            EC: 0,
            EM: 'Xác thực OTP thành công',
            DT: {
              reset_token: reset_token
            }
          });
        case 9:
          _context5.p = 9;
          _t5 = _context5.v;
          console.error(_t5);
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 9]]);
  }));
  return function verifyOtp(_x5, _x6) {
    return _ref5.apply(this, arguments);
  };
}();
var resetPassword = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(resetToken, newPassword) {
    var decoded, hashed_password, _t6;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          decoded = (0, _otpHelpers.verifyResetToken)(resetToken);
          if (decoded) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, {
            EC: -999,
            EM: 'Token không hợp lệ hoặc đã hết hạn',
            DT: ''
          });
        case 1:
          hashed_password = (0, _passwordHelpers.hashPassword)(newPassword);
          _context6.n = 2;
          return _prisma["default"].user.update({
            where: {
              user_id: BigInt(decoded.user_id)
            },
            data: {
              password_hash: hashed_password,
              failed_login_count: 0
            }
          });
        case 2:
          _context6.n = 3;
          return _prisma["default"].userSession.updateMany({
            where: {
              user_id: BigInt(decoded.user_id),
              revoked_at: null
            },
            data: {
              revoked_at: new Date()
            }
          });
        case 3:
          return _context6.a(2, {
            EC: 0,
            EM: 'Mật khẩu đã được cập nhật thành công',
            DT: ''
          });
        case 4:
          _context6.p = 4;
          _t6 = _context6.v;
          console.error(_t6);
          return _context6.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee6, null, [[0, 4]]);
  }));
  return function resetPassword(_x7, _x8) {
    return _ref6.apply(this, arguments);
  };
}();
var changePassword = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(userId, oldPassword, newPassword) {
    var user, isCorrectPassword, passwordRegex, hashed_password, _t7;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          _context7.p = 0;
          _context7.n = 1;
          return _prisma["default"].user.findUnique({
            where: {
              user_id: BigInt(userId)
            }
          });
        case 1:
          user = _context7.v;
          if (user) {
            _context7.n = 2;
            break;
          }
          return _context7.a(2, {
            EM: 'User not found',
            EC: 1,
            DT: ''
          });
        case 2:
          isCorrectPassword = (0, _passwordHelpers.comparePassword)(oldPassword, user.password_hash);
          if (isCorrectPassword) {
            _context7.n = 3;
            break;
          }
          return _context7.a(2, {
            EM: 'Mật khẩu cũ không chính xác',
            EC: 1,
            DT: ''
          });
        case 3:
          passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
          if (passwordRegex.test(newPassword)) {
            _context7.n = 4;
            break;
          }
          return _context7.a(2, {
            EM: 'Mật khẩu mới phải từ 8 ký tự, gồm ít nhất một chữ hoa và một chữ số',
            EC: 3,
            DT: ''
          });
        case 4:
          hashed_password = (0, _passwordHelpers.hashPassword)(newPassword);
          _context7.n = 5;
          return _prisma["default"].user.update({
            where: {
              user_id: BigInt(userId)
            },
            data: {
              password_hash: hashed_password
            }
          });
        case 5:
          _context7.n = 6;
          return _prisma["default"].userSession.updateMany({
            where: {
              user_id: BigInt(userId),
              revoked_at: null
            },
            data: {
              revoked_at: new Date()
            }
          });
        case 6:
          return _context7.a(2, {
            EC: 0,
            EM: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
            DT: ''
          });
        case 7:
          _context7.p = 7;
          _t7 = _context7.v;
          console.error(_t7);
          return _context7.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee7, null, [[0, 7]]);
  }));
  return function changePassword(_x9, _x0, _x1) {
    return _ref7.apply(this, arguments);
  };
}();
var verifyRegisterOtp = /*#__PURE__*/function () {
  var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(login_id, otpCode) {
    var validOtp, updatedOtp, _t8;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.p = _context8.n) {
        case 0:
          _context8.p = 0;
          _context8.n = 1;
          return _prisma["default"].otpCode.findFirst({
            where: {
              OR: [{
                email: login_id
              }, {
                phone: login_id
              }],
              purpose: 'register',
              used_at: null
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 1:
          validOtp = _context8.v;
          if (validOtp) {
            _context8.n = 2;
            break;
          }
          return _context8.a(2, {
            EC: 1,
            EM: 'Không tìm thấy yêu cầu đăng ký hoặc OTP đã bị hủy',
            DT: ''
          });
        case 2:
          if (!(new Date() > validOtp.expires_at)) {
            _context8.n = 3;
            break;
          }
          return _context8.a(2, {
            EC: 1,
            EM: 'Mã OTP đã hết hạn',
            DT: ''
          });
        case 3:
          if (!(validOtp.otp_code !== otpCode)) {
            _context8.n = 7;
            break;
          }
          _context8.n = 4;
          return _prisma["default"].otpCode.update({
            where: {
              otp_id: validOtp.otp_id
            },
            data: {
              attempt_count: validOtp.attempt_count + 1
            }
          });
        case 4:
          updatedOtp = _context8.v;
          if (!(updatedOtp.attempt_count >= 5)) {
            _context8.n = 6;
            break;
          }
          _context8.n = 5;
          return _prisma["default"].otpCode.update({
            where: {
              otp_id: validOtp.otp_id
            },
            data: {
              used_at: new Date()
            }
          });
        case 5:
          return _context8.a(2, {
            EC: 1,
            EM: 'Mã OTP đã bị khóa do nhập sai quá nhiều lần',
            DT: ''
          });
        case 6:
          return _context8.a(2, {
            EC: 1,
            EM: 'Mã OTP không chính xác',
            DT: ''
          });
        case 7:
          _context8.n = 8;
          return _prisma["default"].otpCode.update({
            where: {
              otp_id: validOtp.otp_id
            },
            data: {
              used_at: new Date()
            }
          });
        case 8:
          _context8.n = 9;
          return _prisma["default"].user.update({
            where: {
              user_id: validOtp.user_id
            },
            data: {
              status: 'active'
            }
          });
        case 9:
          return _context8.a(2, {
            EC: 0,
            EM: 'Xác thực tài khoản thành công. Bạn có thể đăng nhập.',
            DT: ''
          });
        case 10:
          _context8.p = 10;
          _t8 = _context8.v;
          console.error(_t8);
          return _context8.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee8, null, [[0, 10]]);
  }));
  return function verifyRegisterOtp(_x10, _x11) {
    return _ref8.apply(this, arguments);
  };
}();
module.exports = {
  registerNewUser: registerNewUser,
  loginUser: loginUser,
  refreshNewToken: refreshNewToken,
  forgotPassword: forgotPassword,
  verifyOtp: verifyOtp,
  verifyRegisterOtp: verifyRegisterOtp,
  resetPassword: resetPassword,
  changePassword: changePassword
};