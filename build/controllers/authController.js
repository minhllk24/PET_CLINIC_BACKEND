"use strict";

var _authAPIService = _interopRequireDefault(require("../services/authAPIService"));
var _responseHelpers = require("../utils/responseHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var handleRegister = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(req, res) {
    var data, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          if (!(!req.body.email && !req.body.phone)) {
            _context.n = 1;
            break;
          }
          return _context.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing email or phone', 1));
        case 1:
          if (req.body.password) {
            _context.n = 2;
            break;
          }
          return _context.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing password', 1));
        case 2:
          _context.n = 3;
          return _authAPIService["default"].registerNewUser(req.body);
        case 3:
          data = _context.v;
          return _context.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 4:
          _context.p = 4;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee, null, [[0, 4]]);
  }));
  return function handleRegister(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();
var handleVerifyRegisterOtp = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(req, res) {
    var _req$body, login_id, otp_code, data, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          _req$body = req.body, login_id = _req$body.login_id, otp_code = _req$body.otp_code;
          if (!(!login_id || !otp_code)) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing email/phone or OTP', 1));
        case 1:
          _context2.n = 2;
          return _authAPIService["default"].verifyRegisterOtp(login_id, otp_code);
        case 2:
          data = _context2.v;
          return _context2.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 3:
          _context2.p = 3;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee2, null, [[0, 3]]);
  }));
  return function handleVerifyRegisterOtp(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();
var handleLogin = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(req, res) {
    var data, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          if (!(!req.body.login_id || !req.body.password)) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing credentials', 1));
        case 1:
          // Inject ip_address and user_agent for session tracking
          req.body.ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
          req.body.user_agent = req.headers['user-agent'];
          _context3.n = 2;
          return _authAPIService["default"].loginUser(req.body);
        case 2:
          data = _context3.v;
          // Set refresh token in HttpOnly cookie if login successful
          if (data && data.DT && data.DT.refresh_token) {
            res.cookie('refresh_token', data.DT.refresh_token, {
              httpOnly: true,
              maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
          }
          return _context3.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 3:
          _context3.p = 3;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee3, null, [[0, 3]]);
  }));
  return function handleLogin(_x5, _x6) {
    return _ref3.apply(this, arguments);
  };
}();
var handleLogout = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(req, res) {
    var _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          res.clearCookie('refresh_token');
          return _context4.a(2, (0, _responseHelpers.sendResponse)(res, 200, 'Logout successful', 0));
        case 1:
          _context4.p = 1;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee4, null, [[0, 1]]);
  }));
  return function handleLogout(_x7, _x8) {
    return _ref4.apply(this, arguments);
  };
}();
var handleRefreshToken = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(req, res) {
    var refreshToken, data, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          refreshToken = req.cookies.refresh_token;
          if (refreshToken) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, (0, _responseHelpers.sendResponse)(res, 401, 'No refresh token found', -999));
        case 1:
          _context5.n = 2;
          return _authAPIService["default"].refreshNewToken(refreshToken);
        case 2:
          data = _context5.v;
          return _context5.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 3:
          _context5.p = 3;
          _t5 = _context5.v;
          console.error(_t5);
          return _context5.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee5, null, [[0, 3]]);
  }));
  return function handleRefreshToken(_x9, _x0) {
    return _ref5.apply(this, arguments);
  };
}();
var handleForgotPassword = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(req, res) {
    var data, _t6;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          if (req.body.email) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing email', 1));
        case 1:
          _context6.n = 2;
          return _authAPIService["default"].forgotPassword(req.body.email);
        case 2:
          data = _context6.v;
          return _context6.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 3:
          _context6.p = 3;
          _t6 = _context6.v;
          console.error(_t6);
          return _context6.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee6, null, [[0, 3]]);
  }));
  return function handleForgotPassword(_x1, _x10) {
    return _ref6.apply(this, arguments);
  };
}();
var handleVerifyOtp = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(req, res) {
    var _req$body2, email, otp_code, data, _t7;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          _context7.p = 0;
          _req$body2 = req.body, email = _req$body2.email, otp_code = _req$body2.otp_code;
          if (!(!email || !otp_code)) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing email or otp_code', 1));
        case 1:
          _context7.n = 2;
          return _authAPIService["default"].verifyOtp(email, otp_code);
        case 2:
          data = _context7.v;
          return _context7.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 3:
          _context7.p = 3;
          _t7 = _context7.v;
          console.error(_t7);
          return _context7.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee7, null, [[0, 3]]);
  }));
  return function handleVerifyOtp(_x11, _x12) {
    return _ref7.apply(this, arguments);
  };
}();
var handleResetPassword = /*#__PURE__*/function () {
  var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(req, res) {
    var _req$body3, reset_token, new_password, data, _t8;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.p = _context8.n) {
        case 0:
          _context8.p = 0;
          _req$body3 = req.body, reset_token = _req$body3.reset_token, new_password = _req$body3.new_password;
          if (!(!reset_token || !new_password)) {
            _context8.n = 1;
            break;
          }
          return _context8.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing reset_token or new_password', 1));
        case 1:
          if (!(new_password.length < 8)) {
            _context8.n = 2;
            break;
          }
          return _context8.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Password must be at least 8 characters long', 1));
        case 2:
          _context8.n = 3;
          return _authAPIService["default"].resetPassword(reset_token, new_password);
        case 3:
          data = _context8.v;
          return _context8.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 4:
          _context8.p = 4;
          _t8 = _context8.v;
          console.error(_t8);
          return _context8.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee8, null, [[0, 4]]);
  }));
  return function handleResetPassword(_x13, _x14) {
    return _ref8.apply(this, arguments);
  };
}();
var handleChangePassword = /*#__PURE__*/function () {
  var _ref9 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(req, res) {
    var _req$body4, old_password, new_password, userId, data, _t9;
    return _regenerator().w(function (_context9) {
      while (1) switch (_context9.p = _context9.n) {
        case 0:
          _context9.p = 0;
          _req$body4 = req.body, old_password = _req$body4.old_password, new_password = _req$body4.new_password;
          if (!(!old_password || !new_password)) {
            _context9.n = 1;
            break;
          }
          return _context9.a(2, (0, _responseHelpers.sendResponse)(res, 400, 'Missing password', 1));
        case 1:
          // req.user from verifyToken middleware
          userId = req.user.user_id;
          _context9.n = 2;
          return _authAPIService["default"].changePassword(userId, old_password, new_password);
        case 2:
          data = _context9.v;
          // If change password successful, clear refresh token cookie (logout from current device too)
          if (data.EC === 0) {
            res.clearCookie('refresh_token');
          }
          return _context9.a(2, (0, _responseHelpers.sendResponse)(res, 200, data.EM, data.EC, data.DT));
        case 3:
          _context9.p = 3;
          _t9 = _context9.v;
          console.error(_t9);
          return _context9.a(2, (0, _responseHelpers.sendResponse)(res, 500, 'Internal server error', -2));
      }
    }, _callee9, null, [[0, 3]]);
  }));
  return function handleChangePassword(_x15, _x16) {
    return _ref9.apply(this, arguments);
  };
}();
module.exports = {
  handleRegister: handleRegister,
  handleVerifyRegisterOtp: handleVerifyRegisterOtp,
  handleLogin: handleLogin,
  handleLogout: handleLogout,
  handleRefreshToken: handleRefreshToken,
  handleForgotPassword: handleForgotPassword,
  handleVerifyOtp: handleVerifyOtp,
  handleResetPassword: handleResetPassword,
  handleChangePassword: handleChangePassword
};