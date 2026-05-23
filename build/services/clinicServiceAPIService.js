"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var getAllCategories = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
    var categories, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          _context.n = 1;
          return _prisma["default"].serviceCategory.findMany({
            where: {
              status: 'active'
            }
          });
        case 1:
          categories = _context.v;
          return _context.a(2, {
            EM: 'Get service categories successful',
            EC: 0,
            DT: categories
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
  return function getAllCategories() {
    return _ref.apply(this, arguments);
  };
}();
var getAllServices = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(query) {
    var page, limit, skip, filter, categoryId, whereCondition, _yield$prisma$$transa, _yield$prisma$$transa2, total, services, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          page = parseInt(query.page) || 1;
          limit = parseInt(query.limit) || 10;
          skip = (page - 1) * limit;
          filter = query.filter || '';
          categoryId = query.category_id ? (0, _prismaHelpers.toBigIntId)(query.category_id) : undefined;
          whereCondition = {
            status: 'active',
            service_name: filter ? {
              contains: filter
            } : undefined,
            category_id: categoryId ? categoryId : undefined
          };
          _context2.n = 1;
          return _prisma["default"].$transaction([_prisma["default"].clinicService.count({
            where: whereCondition
          }), _prisma["default"].clinicService.findMany({
            where: whereCondition,
            include: {
              category: true
            },
            skip: skip,
            take: limit,
            orderBy: {
              created_at: 'desc'
            }
          })]);
        case 1:
          _yield$prisma$$transa = _context2.v;
          _yield$prisma$$transa2 = _slicedToArray(_yield$prisma$$transa, 2);
          total = _yield$prisma$$transa2[0];
          services = _yield$prisma$$transa2[1];
          return _context2.a(2, {
            EM: 'Get services successful',
            EC: 0,
            DT: {
              totalRows: total,
              totalPages: Math.ceil(total / limit),
              services: services
            }
          });
        case 2:
          _context2.p = 2;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[0, 2]]);
  }));
  return function getAllServices(_x) {
    return _ref2.apply(this, arguments);
  };
}();
var getServiceById = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(id) {
    var serviceId, service, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          serviceId = (0, _prismaHelpers.toBigIntId)(id);
          if (serviceId) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Invalid service ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context3.n = 2;
          return _prisma["default"].clinicService.findUnique({
            where: {
              service_id: serviceId
            },
            include: {
              category: true
            }
          });
        case 2:
          service = _context3.v;
          if (service) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'Service not found',
            EC: -1,
            DT: ''
          });
        case 3:
          return _context3.a(2, {
            EM: 'Get service successful',
            EC: 0,
            DT: service
          });
        case 4:
          _context3.p = 4;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 4]]);
  }));
  return function getServiceById(_x2) {
    return _ref3.apply(this, arguments);
  };
}();
var createService = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(data) {
    var newService, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          if (!(!data.service_name || !data.category_id || !data.base_price)) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Missing required fields',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].clinicService.create({
            data: {
              service_name: data.service_name,
              category_id: (0, _prismaHelpers.toBigIntId)(data.category_id),
              description: data.description || null,
              base_price: parseFloat(data.base_price),
              duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes) : 30,
              status: data.status || 'active'
            }
          });
        case 2:
          newService = _context4.v;
          return _context4.a(2, {
            EM: 'Create service successful',
            EC: 0,
            DT: newService
          });
        case 3:
          _context4.p = 3;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 3]]);
  }));
  return function createService(_x3) {
    return _ref4.apply(this, arguments);
  };
}();
var updateService = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(id, data) {
    var serviceId, updateData, updatedService, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          serviceId = (0, _prismaHelpers.toBigIntId)(id);
          if (serviceId) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, {
            EM: 'Invalid service ID',
            EC: 1,
            DT: ''
          });
        case 1:
          updateData = {};
          if (data.service_name) updateData.service_name = data.service_name;
          if (data.category_id) updateData.category_id = (0, _prismaHelpers.toBigIntId)(data.category_id);
          if (data.description !== undefined) updateData.description = data.description;
          if (data.base_price) updateData.base_price = parseFloat(data.base_price);
          if (data.duration_minutes) updateData.duration_minutes = parseInt(data.duration_minutes);
          if (data.status) updateData.status = data.status;
          _context5.n = 2;
          return _prisma["default"].clinicService.update({
            where: {
              service_id: serviceId
            },
            data: updateData
          });
        case 2:
          updatedService = _context5.v;
          return _context5.a(2, {
            EM: 'Update service successful',
            EC: 0,
            DT: updatedService
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
  return function updateService(_x4, _x5) {
    return _ref5.apply(this, arguments);
  };
}();
var deleteService = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(id) {
    var serviceId, _t6;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          serviceId = (0, _prismaHelpers.toBigIntId)(id);
          if (serviceId) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, {
            EM: 'Invalid service ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context6.n = 2;
          return _prisma["default"].clinicService.update({
            where: {
              service_id: serviceId
            },
            data: {
              status: 'inactive'
            }
          });
        case 2:
          return _context6.a(2, {
            EM: 'Delete service successful',
            EC: 0,
            DT: ''
          });
        case 3:
          _context6.p = 3;
          _t6 = _context6.v;
          console.error(_t6);
          return _context6.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee6, null, [[0, 3]]);
  }));
  return function deleteService(_x6) {
    return _ref6.apply(this, arguments);
  };
}();
module.exports = {
  getAllCategories: getAllCategories,
  getAllServices: getAllServices,
  getServiceById: getServiceById,
  createService: createService,
  updateService: updateService,
  deleteService: deleteService
};