"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
/**
 * Get currently active flash sale, or the closest upcoming flash sale.
 */
var getActiveFlashSale = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
    var now, flashSale, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          now = new Date(); // 1. Find currently active flash sale
          _context.n = 1;
          return _prisma["default"].flashSale.findFirst({
            where: {
              status: 'active',
              start_time: {
                lte: now
              },
              end_time: {
                gte: now
              }
            },
            include: {
              items: {
                include: {
                  product: {
                    include: {
                      product_images: {
                        where: {
                          is_primary: true
                        }
                      },
                      category: true
                    }
                  }
                }
              }
            }
          });
        case 1:
          flashSale = _context.v;
          if (flashSale) {
            _context.n = 3;
            break;
          }
          _context.n = 2;
          return _prisma["default"].flashSale.findFirst({
            where: {
              status: 'active',
              start_time: {
                gt: now
              }
            },
            include: {
              items: {
                include: {
                  product: {
                    include: {
                      product_images: {
                        where: {
                          is_primary: true
                        }
                      },
                      category: true
                    }
                  }
                }
              }
            },
            orderBy: {
              start_time: 'asc'
            }
          });
        case 2:
          flashSale = _context.v;
        case 3:
          return _context.a(2, {
            EM: flashSale ? 'Get active flash sale successful' : 'No active or upcoming flash sale found',
            EC: 0,
            DT: flashSale
          });
        case 4:
          _context.p = 4;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 4]]);
  }));
  return function getActiveFlashSale() {
    return _ref.apply(this, arguments);
  };
}();

/**
 * Create a new Flash Sale with optional items.
 * discount_price is calculated automatically based on discount_percentage.
 */
var createFlashSale = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(data) {
    var items, productIds, products, productMap, itemsToCreate, _iterator, _step, item, prodId, product, originalPrice, discountPct, discountPrice, newFlashSale, _t2, _t3;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          if (!(!data.name || !data.start_time || !data.end_time)) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Missing required fields: name, start_time, or end_time',
            EC: 1,
            DT: ''
          });
        case 1:
          items = data.items || [];
          productIds = items.map(function (item) {
            return (0, _prismaHelpers.toBigIntId)(item.product_id);
          }).filter(Boolean); // Fetch original product prices
          _context2.n = 2;
          return _prisma["default"].product.findMany({
            where: {
              product_id: {
                "in": productIds
              }
            }
          });
        case 2:
          products = _context2.v;
          productMap = new Map(products.map(function (p) {
            return [p.product_id.toString(), p];
          }));
          itemsToCreate = [];
          _iterator = _createForOfIteratorHelper(items);
          _context2.p = 3;
          _iterator.s();
        case 4:
          if ((_step = _iterator.n()).done) {
            _context2.n = 8;
            break;
          }
          item = _step.value;
          prodId = (0, _prismaHelpers.toBigIntId)(item.product_id);
          if (prodId) {
            _context2.n = 5;
            break;
          }
          return _context2.a(3, 7);
        case 5:
          product = productMap.get(prodId.toString());
          if (product) {
            _context2.n = 6;
            break;
          }
          return _context2.a(3, 7);
        case 6:
          originalPrice = parseFloat(product.price);
          discountPct = parseInt(item.discount_percentage) || 0; // Calculate discount_price automatically
          discountPrice = originalPrice * (1 - discountPct / 100);
          itemsToCreate.push({
            product_id: prodId,
            discount_percentage: discountPct,
            discount_price: discountPrice,
            stock_quantity: parseInt(item.stock_quantity) || 0,
            sold_quantity: 0
          });
        case 7:
          _context2.n = 4;
          break;
        case 8:
          _context2.n = 10;
          break;
        case 9:
          _context2.p = 9;
          _t2 = _context2.v;
          _iterator.e(_t2);
        case 10:
          _context2.p = 10;
          _iterator.f();
          return _context2.f(10);
        case 11:
          _context2.n = 12;
          return _prisma["default"].flashSale.create({
            data: {
              name: data.name,
              start_time: new Date(data.start_time),
              end_time: new Date(data.end_time),
              status: data.status || 'active',
              items: {
                create: itemsToCreate
              }
            },
            include: {
              items: {
                include: {
                  product: {
                    include: {
                      product_images: {
                        where: {
                          is_primary: true
                        }
                      }
                    }
                  }
                }
              }
            }
          });
        case 12:
          newFlashSale = _context2.v;
          return _context2.a(2, {
            EM: 'Create flash sale successful',
            EC: 0,
            DT: newFlashSale
          });
        case 13:
          _context2.p = 13;
          _t3 = _context2.v;
          console.error(_t3);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[3, 9, 10, 11], [0, 13]]);
  }));
  return function createFlashSale(_x) {
    return _ref2.apply(this, arguments);
  };
}();

/**
 * Update an existing Flash Sale and its items.
 */
var updateFlashSale = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(id, data) {
    var flashSaleId, existing, updateData, productIds, products, productMap, itemsToCreate, _iterator2, _step2, item, prodId, product, originalPrice, discountPct, discountPrice, updated, _t4, _t5;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          flashSaleId = (0, _prismaHelpers.toBigIntId)(id);
          if (flashSaleId) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Invalid Flash Sale ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context3.n = 2;
          return _prisma["default"].flashSale.findUnique({
            where: {
              flash_sale_id: flashSaleId
            }
          });
        case 2:
          existing = _context3.v;
          if (existing) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'Flash Sale not found',
            EC: -1,
            DT: ''
          });
        case 3:
          updateData = {};
          if (data.name) updateData.name = data.name;
          if (data.start_time) updateData.start_time = new Date(data.start_time);
          if (data.end_time) updateData.end_time = new Date(data.end_time);
          if (data.status) updateData.status = data.status;
          if (!data.items) {
            _context3.n = 14;
            break;
          }
          productIds = data.items.map(function (item) {
            return (0, _prismaHelpers.toBigIntId)(item.product_id);
          }).filter(Boolean); // Fetch original product prices
          _context3.n = 4;
          return _prisma["default"].product.findMany({
            where: {
              product_id: {
                "in": productIds
              }
            }
          });
        case 4:
          products = _context3.v;
          productMap = new Map(products.map(function (p) {
            return [p.product_id.toString(), p];
          }));
          itemsToCreate = [];
          _iterator2 = _createForOfIteratorHelper(data.items);
          _context3.p = 5;
          _iterator2.s();
        case 6:
          if ((_step2 = _iterator2.n()).done) {
            _context3.n = 10;
            break;
          }
          item = _step2.value;
          prodId = (0, _prismaHelpers.toBigIntId)(item.product_id);
          if (prodId) {
            _context3.n = 7;
            break;
          }
          return _context3.a(3, 9);
        case 7:
          product = productMap.get(prodId.toString());
          if (product) {
            _context3.n = 8;
            break;
          }
          return _context3.a(3, 9);
        case 8:
          originalPrice = parseFloat(product.price);
          discountPct = parseInt(item.discount_percentage) || 0; // Calculate discount_price automatically
          discountPrice = originalPrice * (1 - discountPct / 100);
          itemsToCreate.push({
            product_id: prodId,
            discount_percentage: discountPct,
            discount_price: discountPrice,
            stock_quantity: parseInt(item.stock_quantity) || 0,
            sold_quantity: parseInt(item.sold_quantity) || 0
          });
        case 9:
          _context3.n = 6;
          break;
        case 10:
          _context3.n = 12;
          break;
        case 11:
          _context3.p = 11;
          _t4 = _context3.v;
          _iterator2.e(_t4);
        case 12:
          _context3.p = 12;
          _iterator2.f();
          return _context3.f(12);
        case 13:
          // Re-create relations: clear all current items and populate new ones
          updateData.items = {
            deleteMany: {},
            create: itemsToCreate
          };
        case 14:
          _context3.n = 15;
          return _prisma["default"].flashSale.update({
            where: {
              flash_sale_id: flashSaleId
            },
            data: updateData,
            include: {
              items: {
                include: {
                  product: {
                    include: {
                      product_images: {
                        where: {
                          is_primary: true
                        }
                      }
                    }
                  }
                }
              }
            }
          });
        case 15:
          updated = _context3.v;
          return _context3.a(2, {
            EM: 'Update flash sale successful',
            EC: 0,
            DT: updated
          });
        case 16:
          _context3.p = 16;
          _t5 = _context3.v;
          console.error(_t5);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[5, 11, 12, 13], [0, 16]]);
  }));
  return function updateFlashSale(_x2, _x3) {
    return _ref3.apply(this, arguments);
  };
}();

/**
 * Delete a Flash Sale.
 */
var deleteFlashSale = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(id) {
    var flashSaleId, existing, _t6;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          flashSaleId = (0, _prismaHelpers.toBigIntId)(id);
          if (flashSaleId) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid Flash Sale ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].flashSale.findUnique({
            where: {
              flash_sale_id: flashSaleId
            }
          });
        case 2:
          existing = _context4.v;
          if (existing) {
            _context4.n = 3;
            break;
          }
          return _context4.a(2, {
            EM: 'Flash Sale not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context4.n = 4;
          return _prisma["default"].flashSale["delete"]({
            where: {
              flash_sale_id: flashSaleId
            }
          });
        case 4:
          return _context4.a(2, {
            EM: 'Delete flash sale successful',
            EC: 0,
            DT: ''
          });
        case 5:
          _context4.p = 5;
          _t6 = _context4.v;
          console.error(_t6);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 5]]);
  }));
  return function deleteFlashSale(_x4) {
    return _ref4.apply(this, arguments);
  };
}();
module.exports = {
  getActiveFlashSale: getActiveFlashSale,
  createFlashSale: createFlashSale,
  updateFlashSale: updateFlashSale,
  deleteFlashSale: deleteFlashSale
};