"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sendOtpEmail = void 0;
var _nodemailer = _interopRequireDefault(require("nodemailer"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
require('dotenv').config();
var createTransporter = function createTransporter() {
  return _nodemailer["default"].createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_APP,
      pass: process.env.EMAIL_APP_PASSWORD
    }
  });
};
var sendOtpEmail = exports.sendOtpEmail = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(toEmail, otpCode) {
    var transporter, mailOptions, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          transporter = createTransporter();
          mailOptions = {
            from: "\"Pet Clinic\" <".concat(process.env.EMAIL_APP, ">"),
            to: toEmail,
            subject: 'Mã xác nhận khôi phục mật khẩu',
            html: "\n      <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;\">\n        <h2 style=\"color: #333; text-align: center;\">Kh\xF4i Ph\u1EE5c M\u1EADt Kh\u1EA9u</h2>\n        <p>Ch\xE0o b\u1EA1n,</p>\n        <p>B\u1EA1n \u0111\xE3 y\xEAu c\u1EA7u kh\xF4i ph\u1EE5c m\u1EADt kh\u1EA9u cho t\xE0i kho\u1EA3n t\u1EA1i Pet Clinic. Vui l\xF2ng s\u1EED d\u1EE5ng m\xE3 OTP d\u01B0\u1EDBi \u0111\xE2y \u0111\u1EC3 x\xE1c nh\u1EADn:</p>\n        <div style=\"background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0; border: 1px dashed #ccc;\">\n          <h1 style=\"color: #ff9800; letter-spacing: 5px; margin: 0;\">".concat(otpCode, "</h1>\n        </div>\n        <p>M\xE3 n\xE0y s\u1EBD h\u1EBFt h\u1EA1n sau <strong>5 ph\xFAt</strong>. Vui l\xF2ng kh\xF4ng chia s\u1EBB m\xE3 n\xE0y cho b\u1EA5t k\u1EF3 ai.</p>\n        <p>N\u1EBFu b\u1EA1n kh\xF4ng th\u1EF1c hi\u1EC7n y\xEAu c\u1EA7u n\xE0y, vui l\xF2ng b\u1ECF qua email n\xE0y.</p>\n        <br>\n        <p>Tr\xE2n tr\u1ECDng,</p>\n        <p><strong>\u0110\u1ED9i ng\u0169 Pet Clinic</strong></p>\n      </div>\n    ")
          };
          _context.p = 1;
          _context.n = 2;
          return transporter.sendMail(mailOptions);
        case 2:
          return _context.a(2, true);
        case 3:
          _context.p = 3;
          _t = _context.v;
          console.error('Error sending OTP email:', _t);
          return _context.a(2, false);
      }
    }, _callee, null, [[1, 3]]);
  }));
  return function sendOtpEmail(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();