"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _passwordHelpers = require("../utils/passwordHelpers");
var _jwtHelpers = require("../utils/jwtHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var registerNewUser = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(rawUserData) {
    var isExist, _isExist, customerRole, hashed_password, _t;
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
          hashed_password = (0, _passwordHelpers.hashPassword)(rawUserData.password); // Create user
          _context.n = 8;
          return _prisma["default"].user.create({
            data: {
              role_id: customerRole.role_id,
              full_name: rawUserData.full_name || 'Anonymous',
              email: rawUserData.email || null,
              phone: rawUserData.phone || null,
              password_hash: hashed_password
            }
          });
        case 8:
          return _context.a(2, {
            EM: 'Register successful',
            EC: 0,
            DT: ''
          });
        case 9:
          _context.p = 9;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 9]]);
  }));
  return function registerNewUser(_x) {
    return _ref.apply(this, arguments);
  };
}();
var loginUser = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(loginData) {
    var login_id, password, user, isCorrectPassword, payload, access_token, refresh_token, _t2;
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
          isCorrectPassword = (0, _passwordHelpers.comparePassword)(password, user.password_hash);
          if (isCorrectPassword) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'Email/Phone or Password incorrect',
            EC: 1,
            DT: ''
          });
        case 3:
          // Prepare payload
          payload = {
            user_id: user.user_id.toString(),
            role_code: user.role.role_code,
            email: user.email,
            full_name: user.full_name
          };
          access_token = (0, _jwtHelpers.generateAccessToken)(payload);
          refresh_token = (0, _jwtHelpers.generateRefreshToken)(payload);
          return _context2.a(2, {
            EM: 'Login successful',
            EC: 0,
            DT: {
              access_token: access_token,
              refresh_token: refresh_token,
              user: payload
            }
          });
        case 4:
          _context2.p = 4;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[0, 4]]);
  }));
  return function loginUser(_x2) {
    return _ref2.apply(this, arguments);
  };
}();
var refreshNewToken = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(refreshToken) {
    var newAccessToken, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          newAccessToken = (0, _jwtHelpers.refreshNewTokenService)(refreshToken);
          if (newAccessToken) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Refresh token is invalid or expired',
            EC: -999,
            DT: ''
          });
        case 1:
          return _context3.a(2, {
            EM: 'Refresh token successfully',
            EC: 0,
            DT: {
              access_token: newAccessToken
            }
          });
        case 2:
          _context3.p = 2;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 2]]);
  }));
  return function refreshNewToken(_x3) {
    return _ref3.apply(this, arguments);
  };
}();
module.exports = {
  registerNewUser: registerNewUser,
  loginUser: loginUser,
  refreshNewToken: refreshNewToken
};