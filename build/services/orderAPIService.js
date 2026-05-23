"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
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
var getOrders = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(user, query) {
    var page, limit, skip, whereCondition, _yield$prisma$$transa, _yield$prisma$$transa2, total, orders, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          page = parseInt(query.page) || 1;
          limit = parseInt(query.limit) || 10;
          skip = (page - 1) * limit;
          whereCondition = {};
          if (user.role_code !== 'ADMIN') {
            whereCondition.user_id = (0, _prismaHelpers.toBigIntId)(user.user_id);
          }
          if (query.status) {
            whereCondition.order_status = query.status;
          }
          _context.n = 1;
          return _prisma["default"].$transaction([_prisma["default"].order.count({
            where: whereCondition
          }), _prisma["default"].order.findMany({
            where: whereCondition,
            include: {
              payments: true,
              order_items: true
            },
            skip: skip,
            take: limit,
            orderBy: {
              created_at: 'desc'
            }
          })]);
        case 1:
          _yield$prisma$$transa = _context.v;
          _yield$prisma$$transa2 = _slicedToArray(_yield$prisma$$transa, 2);
          total = _yield$prisma$$transa2[0];
          orders = _yield$prisma$$transa2[1];
          return _context.a(2, {
            EM: 'Get orders successful',
            EC: 0,
            DT: {
              totalRows: total,
              totalPages: Math.ceil(total / limit),
              orders: orders
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
  return function getOrders(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();
var getOrderById = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(id, user) {
    var orderId, order, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          orderId = (0, _prismaHelpers.toBigIntId)(id);
          if (orderId) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Invalid order ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context2.n = 2;
          return _prisma["default"].order.findUnique({
            where: {
              order_id: orderId
            },
            include: {
              order_items: {
                include: {
                  product: {
                    select: {
                      product_name: true,
                      price: true
                    }
                  }
                }
              },
              payments: true,
              address: true
            }
          });
        case 2:
          order = _context2.v;
          if (order) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'Order not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(user.role_code !== 'ADMIN' && user.user_id !== order.user_id.toString())) {
            _context2.n = 4;
            break;
          }
          return _context2.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 4:
          return _context2.a(2, {
            EM: 'Get order successful',
            EC: 0,
            DT: order
          });
        case 5:
          _context2.p = 5;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[0, 5]]);
  }));
  return function getOrderById(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();
var checkoutCart = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(userIdStr, data) {
    var userId, address_id, payment_method, addrId, address, cart, totalAmount, _iterator, _step, item, shippingFee, finalAmount, resultOrder, _t4, _t5;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
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
          address_id = data.address_id, payment_method = data.payment_method;
          if (!(!address_id || !payment_method)) {
            _context4.n = 2;
            break;
          }
          return _context4.a(2, {
            EM: 'Missing address_id or payment_method',
            EC: 1,
            DT: ''
          });
        case 2:
          addrId = (0, _prismaHelpers.toBigIntId)(address_id); // Verify address
          _context4.n = 3;
          return _prisma["default"].userAddress.findUnique({
            where: {
              address_id: addrId
            }
          });
        case 3:
          address = _context4.v;
          if (!(!address || address.user_id !== userId)) {
            _context4.n = 4;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid address',
            EC: 1,
            DT: ''
          });
        case 4:
          _context4.n = 5;
          return _prisma["default"].cart.findUnique({
            where: {
              user_id: userId
            },
            include: {
              cart_items: {
                where: {
                  is_selected: true
                },
                include: {
                  product: true
                }
              }
            }
          });
        case 5:
          cart = _context4.v;
          if (!(!cart || cart.cart_items.length === 0)) {
            _context4.n = 6;
            break;
          }
          return _context4.a(2, {
            EM: 'Cart is empty or no item selected',
            EC: -1,
            DT: ''
          });
        case 6:
          // Check stock and calculate total
          totalAmount = 0;
          _iterator = _createForOfIteratorHelper(cart.cart_items);
          _context4.p = 7;
          _iterator.s();
        case 8:
          if ((_step = _iterator.n()).done) {
            _context4.n = 11;
            break;
          }
          item = _step.value;
          if (!(item.product.stock_quantity < item.quantity)) {
            _context4.n = 9;
            break;
          }
          return _context4.a(2, {
            EM: "Not enough stock for product: ".concat(item.product.product_name),
            EC: 2,
            DT: ''
          });
        case 9:
          totalAmount += parseFloat(item.product.price) * item.quantity;
        case 10:
          _context4.n = 8;
          break;
        case 11:
          _context4.n = 13;
          break;
        case 12:
          _context4.p = 12;
          _t4 = _context4.v;
          _iterator.e(_t4);
        case 13:
          _context4.p = 13;
          _iterator.f();
          return _context4.f(13);
        case 14:
          shippingFee = 30000; // Fixed shipping fee for simplicity
          finalAmount = totalAmount + shippingFee; // Execute transaction
          _context4.n = 15;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(tx) {
              var newOrder, _iterator2, _step2, item, cartItemIds, _t3;
              return _regenerator().w(function (_context3) {
                while (1) switch (_context3.p = _context3.n) {
                  case 0:
                    _context3.n = 1;
                    return tx.order.create({
                      data: {
                        user_id: userId,
                        address_id: addrId,
                        total_amount: totalAmount,
                        shipping_fee: shippingFee,
                        discount_amount: 0,
                        final_amount: finalAmount,
                        order_status: 'pending',
                        payment_status: 'unpaid'
                      }
                    });
                  case 1:
                    newOrder = _context3.v;
                    // 2. Create OrderItems & Update Product Stock
                    _iterator2 = _createForOfIteratorHelper(cart.cart_items);
                    _context3.p = 2;
                    _iterator2.s();
                  case 3:
                    if ((_step2 = _iterator2.n()).done) {
                      _context3.n = 6;
                      break;
                    }
                    item = _step2.value;
                    _context3.n = 4;
                    return tx.orderItem.create({
                      data: {
                        order_id: newOrder.order_id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        price: item.product.price
                      }
                    });
                  case 4:
                    _context3.n = 5;
                    return tx.product.update({
                      where: {
                        product_id: item.product_id
                      },
                      data: {
                        stock_quantity: {
                          decrement: item.quantity
                        }
                      }
                    });
                  case 5:
                    _context3.n = 3;
                    break;
                  case 6:
                    _context3.n = 8;
                    break;
                  case 7:
                    _context3.p = 7;
                    _t3 = _context3.v;
                    _iterator2.e(_t3);
                  case 8:
                    _context3.p = 8;
                    _iterator2.f();
                    return _context3.f(8);
                  case 9:
                    _context3.n = 10;
                    return tx.payment.create({
                      data: {
                        target_type: 'order',
                        target_id: newOrder.order_id,
                        user_id: userId,
                        amount: finalAmount,
                        payment_method: payment_method,
                        payment_status: 'pending'
                      }
                    });
                  case 10:
                    // 4. Delete processed CartItems
                    cartItemIds = cart.cart_items.map(function (i) {
                      return i.cart_item_id;
                    });
                    _context3.n = 11;
                    return tx.cartItem.deleteMany({
                      where: {
                        cart_item_id: {
                          "in": cartItemIds
                        }
                      }
                    });
                  case 11:
                    return _context3.a(2, newOrder);
                }
              }, _callee3, null, [[2, 7, 8, 9]]);
            }));
            return function (_x7) {
              return _ref4.apply(this, arguments);
            };
          }());
        case 15:
          resultOrder = _context4.v;
          return _context4.a(2, {
            EM: 'Checkout successful',
            EC: 0,
            DT: resultOrder
          });
        case 16:
          _context4.p = 16;
          _t5 = _context4.v;
          console.error(_t5);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[7, 12, 13, 14], [0, 16]]);
  }));
  return function checkoutCart(_x5, _x6) {
    return _ref3.apply(this, arguments);
  };
}();
var updateOrderStatus = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(id, status) {
    var orderId, validStatuses, order, updatedOrder, _t7;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          orderId = (0, _prismaHelpers.toBigIntId)(id);
          if (orderId) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, {
            EM: 'Invalid order ID',
            EC: 1,
            DT: ''
          });
        case 1:
          validStatuses = ['pending', 'confirmed', 'shipping', 'completed', 'cancelled'];
          if (validStatuses.includes(status)) {
            _context6.n = 2;
            break;
          }
          return _context6.a(2, {
            EM: 'Invalid status',
            EC: 1,
            DT: ''
          });
        case 2:
          _context6.n = 3;
          return _prisma["default"].order.findUnique({
            where: {
              order_id: orderId
            },
            include: {
              order_items: true
            }
          });
        case 3:
          order = _context6.v;
          if (order) {
            _context6.n = 4;
            break;
          }
          return _context6.a(2, {
            EM: 'Order not found',
            EC: -1,
            DT: ''
          });
        case 4:
          if (!(status === 'cancelled' && order.order_status !== 'cancelled')) {
            _context6.n = 6;
            break;
          }
          _context6.n = 5;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(tx) {
              var _iterator3, _step3, item, _t6;
              return _regenerator().w(function (_context5) {
                while (1) switch (_context5.p = _context5.n) {
                  case 0:
                    // Return stock
                    _iterator3 = _createForOfIteratorHelper(order.order_items);
                    _context5.p = 1;
                    _iterator3.s();
                  case 2:
                    if ((_step3 = _iterator3.n()).done) {
                      _context5.n = 4;
                      break;
                    }
                    item = _step3.value;
                    _context5.n = 3;
                    return tx.product.update({
                      where: {
                        product_id: item.product_id
                      },
                      data: {
                        stock_quantity: {
                          increment: item.quantity
                        }
                      }
                    });
                  case 3:
                    _context5.n = 2;
                    break;
                  case 4:
                    _context5.n = 6;
                    break;
                  case 5:
                    _context5.p = 5;
                    _t6 = _context5.v;
                    _iterator3.e(_t6);
                  case 6:
                    _context5.p = 6;
                    _iterator3.f();
                    return _context5.f(6);
                  case 7:
                    _context5.n = 8;
                    return tx.order.update({
                      where: {
                        order_id: orderId
                      },
                      data: {
                        order_status: 'cancelled'
                      }
                    });
                  case 8:
                    return _context5.a(2);
                }
              }, _callee5, null, [[1, 5, 6, 7]]);
            }));
            return function (_x0) {
              return _ref6.apply(this, arguments);
            };
          }());
        case 5:
          return _context6.a(2, {
            EM: 'Order cancelled and stock returned',
            EC: 0,
            DT: ''
          });
        case 6:
          _context6.n = 7;
          return _prisma["default"].order.update({
            where: {
              order_id: orderId
            },
            data: {
              order_status: status
            }
          });
        case 7:
          updatedOrder = _context6.v;
          return _context6.a(2, {
            EM: 'Update status successful',
            EC: 0,
            DT: updatedOrder
          });
        case 8:
          _context6.p = 8;
          _t7 = _context6.v;
          console.error(_t7);
          return _context6.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee6, null, [[0, 8]]);
  }));
  return function updateOrderStatus(_x8, _x9) {
    return _ref5.apply(this, arguments);
  };
}();
module.exports = {
  getOrders: getOrders,
  getOrderById: getOrderById,
  checkoutCart: checkoutCart,
  updateOrderStatus: updateOrderStatus
};