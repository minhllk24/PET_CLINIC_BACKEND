"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var getAllUsers = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(limit, page) {
    var skip, _yield$prisma$$transa, _yield$prisma$$transa2, total, users, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          skip = (page - 1) * limit;
          _context.n = 1;
          return _prisma["default"].$transaction([_prisma["default"].user.count(), _prisma["default"].user.findMany({
            skip: skip,
            take: limit,
            select: {
              user_id: true,
              full_name: true,
              email: true,
              phone: true,
              avatar_url: true,
              status: true,
              role: true,
              created_at: true
            },
            orderBy: {
              created_at: 'desc'
            }
          })]);
        case 1:
          _yield$prisma$$transa = _context.v;
          _yield$prisma$$transa2 = _slicedToArray(_yield$prisma$$transa, 2);
          total = _yield$prisma$$transa2[0];
          users = _yield$prisma$$transa2[1];
          return _context.a(2, {
            EM: 'Get users successful',
            EC: 0,
            DT: {
              totalRows: total,
              totalPages: Math.ceil(total / limit),
              users: users
            }
          });
        case 2:
          _context.p = 2;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 2]]);
  }));
  return function getAllUsers(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();
var getUserById = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(id) {
    var userId, user, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(id);
          if (userId) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Invalid user ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context2.n = 2;
          return _prisma["default"].user.findUnique({
            where: {
              user_id: userId
            },
            select: {
              user_id: true,
              full_name: true,
              email: true,
              phone: true,
              avatar_url: true,
              status: true,
              role: true,
              created_at: true
            }
          });
        case 2:
          user = _context2.v;
          if (user) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'User not found',
            EC: -1,
            DT: ''
          });
        case 3:
          return _context2.a(2, {
            EM: 'Get user successful',
            EC: 0,
            DT: user
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
  return function getUserById(_x3) {
    return _ref2.apply(this, arguments);
  };
}();
var updateUser = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(id, data) {
    var userId, existingUser, checkEmail, checkPhone, updatedUser, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(id);
          if (userId) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Invalid user ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context3.n = 2;
          return _prisma["default"].user.findUnique({
            where: {
              user_id: userId
            }
          });
        case 2:
          existingUser = _context3.v;
          if (existingUser) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'User not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(data.email && data.email !== existingUser.email)) {
            _context3.n = 5;
            break;
          }
          _context3.n = 4;
          return _prisma["default"].user.findFirst({
            where: {
              email: data.email
            }
          });
        case 4:
          checkEmail = _context3.v;
          if (!checkEmail) {
            _context3.n = 5;
            break;
          }
          return _context3.a(2, {
            EM: 'Email already exists',
            EC: 2,
            DT: ''
          });
        case 5:
          if (!(data.phone && data.phone !== existingUser.phone)) {
            _context3.n = 7;
            break;
          }
          _context3.n = 6;
          return _prisma["default"].user.findFirst({
            where: {
              phone: data.phone
            }
          });
        case 6:
          checkPhone = _context3.v;
          if (!checkPhone) {
            _context3.n = 7;
            break;
          }
          return _context3.a(2, {
            EM: 'Phone already exists',
            EC: 2,
            DT: ''
          });
        case 7:
          _context3.n = 8;
          return _prisma["default"].user.update({
            where: {
              user_id: userId
            },
            data: {
              full_name: data.full_name || existingUser.full_name,
              email: data.email || existingUser.email,
              phone: data.phone || existingUser.phone,
              avatar_url: data.avatar_url || existingUser.avatar_url,
              status: data.status || existingUser.status
            },
            select: {
              user_id: true,
              full_name: true,
              email: true,
              phone: true,
              avatar_url: true,
              status: true
            }
          });
        case 8:
          updatedUser = _context3.v;
          return _context3.a(2, {
            EM: 'Update user successful',
            EC: 0,
            DT: updatedUser
          });
        case 9:
          _context3.p = 9;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 9]]);
  }));
  return function updateUser(_x4, _x5) {
    return _ref3.apply(this, arguments);
  };
}();
var deleteUser = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(id) {
    var userId, user, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(id);
          if (userId) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid user ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].user.findUnique({
            where: {
              user_id: userId
            }
          });
        case 2:
          user = _context4.v;
          if (user) {
            _context4.n = 3;
            break;
          }
          return _context4.a(2, {
            EM: 'User not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context4.n = 4;
          return _prisma["default"].user.update({
            where: {
              user_id: userId
            },
            data: {
              status: 'deleted'
            }
          });
        case 4:
          return _context4.a(2, {
            EM: 'Delete user successful',
            EC: 0,
            DT: ''
          });
        case 5:
          _context4.p = 5;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 5]]);
  }));
  return function deleteUser(_x6) {
    return _ref4.apply(this, arguments);
  };
}();
var getUserAddresses = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(id) {
    var userId, addresses, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(id);
          if (userId) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, {
            EM: 'Invalid user ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context5.n = 2;
          return _prisma["default"].userAddress.findMany({
            where: {
              user_id: userId
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 2:
          addresses = _context5.v;
          return _context5.a(2, {
            EM: 'Get user addresses successful',
            EC: 0,
            DT: addresses
          });
        case 3:
          _context5.p = 3;
          _t5 = _context5.v;
          console.error(_t5);
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 3]]);
  }));
  return function getUserAddresses(_x7) {
    return _ref5.apply(this, arguments);
  };
}();
var createAddress = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(id, data) {
    var userId, recipient_name, recipient_phone, address_line, ward, district, province, is_default, newAddress, _t6;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(id);
          if (userId) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, {
            EM: 'Invalid user ID',
            EC: 1,
            DT: ''
          });
        case 1:
          recipient_name = data.recipient_name, recipient_phone = data.recipient_phone, address_line = data.address_line, ward = data.ward, district = data.district, province = data.province, is_default = data.is_default;
          if (!(!recipient_name || !recipient_phone || !address_line)) {
            _context6.n = 2;
            break;
          }
          return _context6.a(2, {
            EM: 'Missing required fields',
            EC: 1,
            DT: ''
          });
        case 2:
          if (!is_default) {
            _context6.n = 3;
            break;
          }
          _context6.n = 3;
          return _prisma["default"].userAddress.updateMany({
            where: {
              user_id: userId
            },
            data: {
              is_default: false
            }
          });
        case 3:
          _context6.n = 4;
          return _prisma["default"].userAddress.create({
            data: {
              user_id: userId,
              recipient_name: recipient_name,
              recipient_phone: recipient_phone,
              address_line: address_line,
              ward: ward,
              district: district,
              province: province,
              is_default: is_default || false
            }
          });
        case 4:
          newAddress = _context6.v;
          return _context6.a(2, {
            EM: 'Create address successful',
            EC: 0,
            DT: newAddress
          });
        case 5:
          _context6.p = 5;
          _t6 = _context6.v;
          console.error(_t6);
          return _context6.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee6, null, [[0, 5]]);
  }));
  return function createAddress(_x8, _x9) {
    return _ref6.apply(this, arguments);
  };
}();
var updateAddress = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(addressId, data) {
    var addrId, existingAddr, updatedAddr, _t7;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          _context7.p = 0;
          addrId = (0, _prismaHelpers.toBigIntId)(addressId);
          if (addrId) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2, {
            EM: 'Invalid address ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context7.n = 2;
          return _prisma["default"].userAddress.findUnique({
            where: {
              address_id: addrId
            }
          });
        case 2:
          existingAddr = _context7.v;
          if (existingAddr) {
            _context7.n = 3;
            break;
          }
          return _context7.a(2, {
            EM: 'Address not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!data.is_default) {
            _context7.n = 4;
            break;
          }
          _context7.n = 4;
          return _prisma["default"].userAddress.updateMany({
            where: {
              user_id: existingAddr.user_id
            },
            data: {
              is_default: false
            }
          });
        case 4:
          _context7.n = 5;
          return _prisma["default"].userAddress.update({
            where: {
              address_id: addrId
            },
            data: {
              recipient_name: data.recipient_name || existingAddr.recipient_name,
              recipient_phone: data.recipient_phone || existingAddr.recipient_phone,
              address_line: data.address_line || existingAddr.address_line,
              ward: data.ward || existingAddr.ward,
              district: data.district || existingAddr.district,
              province: data.province || existingAddr.province,
              is_default: data.is_default !== undefined ? data.is_default : existingAddr.is_default
            }
          });
        case 5:
          updatedAddr = _context7.v;
          return _context7.a(2, {
            EM: 'Update address successful',
            EC: 0,
            DT: updatedAddr
          });
        case 6:
          _context7.p = 6;
          _t7 = _context7.v;
          console.error(_t7);
          return _context7.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee7, null, [[0, 6]]);
  }));
  return function updateAddress(_x0, _x1) {
    return _ref7.apply(this, arguments);
  };
}();
var deleteAddress = /*#__PURE__*/function () {
  var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(addressId) {
    var addrId, existingAddr, _t8;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.p = _context8.n) {
        case 0:
          _context8.p = 0;
          addrId = (0, _prismaHelpers.toBigIntId)(addressId);
          if (addrId) {
            _context8.n = 1;
            break;
          }
          return _context8.a(2, {
            EM: 'Invalid address ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context8.n = 2;
          return _prisma["default"].userAddress.findUnique({
            where: {
              address_id: addrId
            }
          });
        case 2:
          existingAddr = _context8.v;
          if (existingAddr) {
            _context8.n = 3;
            break;
          }
          return _context8.a(2, {
            EM: 'Address not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context8.n = 4;
          return _prisma["default"].userAddress["delete"]({
            where: {
              address_id: addrId
            }
          });
        case 4:
          return _context8.a(2, {
            EM: 'Delete address successful',
            EC: 0,
            DT: ''
          });
        case 5:
          _context8.p = 5;
          _t8 = _context8.v;
          console.error(_t8);
          return _context8.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee8, null, [[0, 5]]);
  }));
  return function deleteAddress(_x10) {
    return _ref8.apply(this, arguments);
  };
}();
module.exports = {
  getAllUsers: getAllUsers,
  getUserById: getUserById,
  updateUser: updateUser,
  deleteUser: deleteUser,
  getUserAddresses: getUserAddresses,
  createAddress: createAddress,
  updateAddress: updateAddress,
  deleteAddress: deleteAddress
};