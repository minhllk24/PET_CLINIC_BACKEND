"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
var _passwordHelpers = require("../utils/passwordHelpers");
var _emailHelpers = require("../utils/emailHelpers");
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
    var userId, address_id, payment_method, voucher_code, note, addrId, address, cartItemsToCheckout, isDirectCheckout, _iterator, _step, item, product, cart, subtotalAmount, variantsData, i, _item, availableStock, price, variant, voucherId, discountAmount, voucher, vCode, now, userUsed, shippingFee, finalAmount, recipientName, recipientPhone, shippingAddress, orderCode, paymentCode, resultOrder, _t3, _t4;
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
          address_id = data.address_id, payment_method = data.payment_method, voucher_code = data.voucher_code, note = data.note;
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
          // Check if items are passed directly from frontend (localStorage)
          cartItemsToCheckout = [];
          isDirectCheckout = false;
          if (!(data.items && Array.isArray(data.items) && data.items.length > 0)) {
            _context4.n = 14;
            break;
          }
          isDirectCheckout = true;
          _iterator = _createForOfIteratorHelper(data.items);
          _context4.p = 5;
          _iterator.s();
        case 6:
          if ((_step = _iterator.n()).done) {
            _context4.n = 10;
            break;
          }
          item = _step.value;
          _context4.n = 7;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: (0, _prismaHelpers.toBigIntId)(item.product_id)
            }
          });
        case 7:
          product = _context4.v;
          if (product) {
            _context4.n = 8;
            break;
          }
          return _context4.a(2, {
            EM: "Product not found: ".concat(item.product_id),
            EC: -1,
            DT: ''
          });
        case 8:
          cartItemsToCheckout.push({
            cart_item_id: null,
            product_id: product.product_id,
            variant_id: item.variant_id ? (0, _prismaHelpers.toBigIntId)(item.variant_id) : null,
            quantity: parseInt(item.quantity) || 1,
            product: product
          });
        case 9:
          _context4.n = 6;
          break;
        case 10:
          _context4.n = 12;
          break;
        case 11:
          _context4.p = 11;
          _t3 = _context4.v;
          _iterator.e(_t3);
        case 12:
          _context4.p = 12;
          _iterator.f();
          return _context4.f(12);
        case 13:
          _context4.n = 17;
          break;
        case 14:
          _context4.n = 15;
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
        case 15:
          cart = _context4.v;
          if (!(!cart || cart.cart_items.length === 0)) {
            _context4.n = 16;
            break;
          }
          return _context4.a(2, {
            EM: 'Cart is empty or no item selected',
            EC: -1,
            DT: ''
          });
        case 16:
          cartItemsToCheckout = cart.cart_items;
        case 17:
          if (!(cartItemsToCheckout.length === 0)) {
            _context4.n = 18;
            break;
          }
          return _context4.a(2, {
            EM: 'No items to checkout',
            EC: -1,
            DT: ''
          });
        case 18:
          // Check stock and calculate total
          subtotalAmount = 0;
          variantsData = {}; // Cache variants
          i = 0;
        case 19:
          if (!(i < cartItemsToCheckout.length)) {
            _context4.n = 25;
            break;
          }
          _item = cartItemsToCheckout[i];
          availableStock = _item.product.stock_quantity;
          price = parseFloat(_item.product.price);
          if (!_item.variant_id) {
            _context4.n = 22;
            break;
          }
          _context4.n = 20;
          return _prisma["default"].productVariant.findUnique({
            where: {
              variant_id: _item.variant_id
            }
          });
        case 20:
          variant = _context4.v;
          if (variant) {
            _context4.n = 21;
            break;
          }
          return _context4.a(2, {
            EM: "Invalid variant for product: ".concat(_item.product.product_name),
            EC: -1,
            DT: ''
          });
        case 21:
          availableStock = variant.stock_quantity;
          price = parseFloat(variant.price);
          variantsData[i] = variant;
        case 22:
          if (!(availableStock < _item.quantity)) {
            _context4.n = 23;
            break;
          }
          return _context4.a(2, {
            EM: "Not enough stock for product: ".concat(_item.product.product_name),
            EC: 2,
            DT: ''
          });
        case 23:
          subtotalAmount += price * _item.quantity;
        case 24:
          i++;
          _context4.n = 19;
          break;
        case 25:
          // Process Voucher (if any)
          voucherId = null;
          discountAmount = 0;
          voucher = null;
          if (!voucher_code) {
            _context4.n = 34;
            break;
          }
          vCode = voucher_code.toUpperCase();
          _context4.n = 26;
          return _prisma["default"].voucher.findUnique({
            where: {
              voucher_code: vCode
            }
          });
        case 26:
          voucher = _context4.v;
          if (!(!voucher || voucher.status !== 'active')) {
            _context4.n = 27;
            break;
          }
          return _context4.a(2, {
            EM: 'Voucher not valid or inactive',
            EC: -1,
            DT: ''
          });
        case 27:
          now = new Date();
          if (!(voucher.start_at && now < voucher.start_at)) {
            _context4.n = 28;
            break;
          }
          return _context4.a(2, {
            EM: 'Voucher not yet active',
            EC: -1,
            DT: ''
          });
        case 28:
          if (!(voucher.end_at && now > voucher.end_at)) {
            _context4.n = 29;
            break;
          }
          return _context4.a(2, {
            EM: 'Voucher expired',
            EC: -1,
            DT: ''
          });
        case 29:
          if (!(voucher.min_order_amount && subtotalAmount < parseFloat(voucher.min_order_amount))) {
            _context4.n = 30;
            break;
          }
          return _context4.a(2, {
            EM: "Minimum order value is ".concat(parseFloat(voucher.min_order_amount)),
            EC: -1,
            DT: ''
          });
        case 30:
          if (!(voucher.remaining_usage !== null && voucher.remaining_usage <= 0)) {
            _context4.n = 31;
            break;
          }
          return _context4.a(2, {
            EM: 'Voucher usage limit reached',
            EC: -1,
            DT: ''
          });
        case 31:
          _context4.n = 32;
          return _prisma["default"].voucherUsage.findFirst({
            where: {
              user_id: userId,
              voucher_id: voucher.voucher_id
            }
          });
        case 32:
          userUsed = _context4.v;
          if (!userUsed) {
            _context4.n = 33;
            break;
          }
          return _context4.a(2, {
            EM: 'You have already used this voucher',
            EC: -1,
            DT: ''
          });
        case 33:
          voucherId = voucher.voucher_id;
          if (voucher.discount_type === 'percent') {
            discountAmount = subtotalAmount * (parseFloat(voucher.discount_value) / 100);
            if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
              discountAmount = parseFloat(voucher.max_discount_amount);
            }
          } else if (voucher.discount_type === 'fixed') {
            discountAmount = parseFloat(voucher.discount_value);
          }

          // Ensure discount doesn't exceed subtotal
          if (discountAmount > subtotalAmount) {
            discountAmount = subtotalAmount;
          }
        case 34:
          shippingFee = 0; // Hardcoded to 0 as per user response
          finalAmount = subtotalAmount + shippingFee - discountAmount; // Snapshot address fields
          recipientName = address.recipient_name;
          recipientPhone = address.recipient_phone;
          shippingAddress = "".concat(address.address_line).concat(address.ward ? ', ' + address.ward : '').concat(address.district ? ', ' + address.district : '').concat(address.province ? ', ' + address.province : '');
          orderCode = "ORD-".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 6).toUpperCase());
          paymentCode = "PAY-".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 6).toUpperCase()); // Execute transaction
          _context4.n = 35;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(tx) {
              var newOrder, _i, _item2, _price, itemNameSnapshot, newPayment, cartItemIds;
              return _regenerator().w(function (_context3) {
                while (1) switch (_context3.n) {
                  case 0:
                    _context3.n = 1;
                    return tx.order.create({
                      data: {
                        order_code: orderCode,
                        order_type: 'product',
                        user_id: userId,
                        address_id: addrId,
                        voucher_id: voucherId,
                        recipient_name: recipientName,
                        recipient_phone: recipientPhone,
                        shipping_address: shippingAddress,
                        subtotal_amount: subtotalAmount,
                        discount_amount: discountAmount,
                        points_discount_amount: 0,
                        shipping_fee: shippingFee,
                        total_amount: finalAmount,
                        order_status: 'pending',
                        payment_status: 'unpaid',
                        note: note || null
                      }
                    });
                  case 1:
                    newOrder = _context3.v;
                    _i = 0;
                  case 2:
                    if (!(_i < cartItemsToCheckout.length)) {
                      _context3.n = 8;
                      break;
                    }
                    _item2 = cartItemsToCheckout[_i];
                    _price = parseFloat(_item2.product.price);
                    itemNameSnapshot = _item2.product.product_name;
                    if (_item2.variant_id && variantsData[_i]) {
                      _price = parseFloat(variantsData[_i].price);
                      itemNameSnapshot = "".concat(_item2.product.product_name, " - ").concat(variantsData[_i].variant_name);
                    }
                    _context3.n = 3;
                    return tx.orderItem.create({
                      data: {
                        order_id: newOrder.order_id,
                        product_id: _item2.product_id,
                        variant_id: _item2.variant_id,
                        item_type: 'product',
                        item_name_snapshot: itemNameSnapshot,
                        quantity: _item2.quantity,
                        unit_price: _price,
                        total_price: _price * _item2.quantity
                      }
                    });
                  case 3:
                    if (!_item2.variant_id) {
                      _context3.n = 6;
                      break;
                    }
                    _context3.n = 4;
                    return tx.productVariant.update({
                      where: {
                        variant_id: _item2.variant_id
                      },
                      data: {
                        stock_quantity: {
                          decrement: _item2.quantity
                        }
                      }
                    });
                  case 4:
                    _context3.n = 5;
                    return tx.product.update({
                      where: {
                        product_id: _item2.product_id
                      },
                      data: {
                        sold_quantity: {
                          increment: _item2.quantity
                        }
                      }
                    });
                  case 5:
                    _context3.n = 7;
                    break;
                  case 6:
                    _context3.n = 7;
                    return tx.product.update({
                      where: {
                        product_id: _item2.product_id
                      },
                      data: {
                        stock_quantity: {
                          decrement: _item2.quantity
                        },
                        sold_quantity: {
                          increment: _item2.quantity
                        }
                      }
                    });
                  case 7:
                    _i++;
                    _context3.n = 2;
                    break;
                  case 8:
                    _context3.n = 9;
                    return tx.payment.create({
                      data: {
                        payment_code: paymentCode,
                        user_id: userId,
                        order_id: newOrder.order_id,
                        payment_target_type: 'order',
                        payment_method: payment_method,
                        // 'cod' or 'online'
                        subtotal_amount: subtotalAmount,
                        voucher_discount_amount: discountAmount,
                        points_used: 0,
                        points_discount_amount: 0,
                        final_amount: finalAmount,
                        status: 'pending'
                      }
                    });
                  case 9:
                    newPayment = _context3.v;
                    if (!voucherId) {
                      _context3.n = 11;
                      break;
                    }
                    _context3.n = 10;
                    return tx.voucherUsage.create({
                      data: {
                        voucher_id: voucherId,
                        user_id: userId,
                        payment_id: newPayment.payment_id,
                        discount_amount: discountAmount
                      }
                    });
                  case 10:
                    if (!(voucher.remaining_usage !== null)) {
                      _context3.n = 11;
                      break;
                    }
                    _context3.n = 11;
                    return tx.voucher.update({
                      where: {
                        voucher_id: voucherId
                      },
                      data: {
                        remaining_usage: {
                          decrement: 1
                        }
                      }
                    });
                  case 11:
                    if (isDirectCheckout) {
                      _context3.n = 12;
                      break;
                    }
                    cartItemIds = cartItemsToCheckout.map(function (i) {
                      return i.cart_item_id;
                    });
                    _context3.n = 12;
                    return tx.cartItem.deleteMany({
                      where: {
                        cart_item_id: {
                          "in": cartItemIds
                        }
                      }
                    });
                  case 12:
                    return _context3.a(2, newOrder);
                }
              }, _callee3);
            }));
            return function (_x7) {
              return _ref4.apply(this, arguments);
            };
          }());
        case 35:
          resultOrder = _context4.v;
          return _context4.a(2, {
            EM: 'Checkout successful',
            EC: 0,
            DT: resultOrder
          });
        case 36:
          _context4.p = 36;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[5, 11, 12, 13], [0, 36]]);
  }));
  return function checkoutCart(_x5, _x6) {
    return _ref3.apply(this, arguments);
  };
}();
var updateOrderStatus = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(id, status) {
    var orderId, validStatuses, order, updatedOrder, _t6;
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
              var _iterator2, _step2, item, _t5;
              return _regenerator().w(function (_context5) {
                while (1) switch (_context5.p = _context5.n) {
                  case 0:
                    // Return stock
                    _iterator2 = _createForOfIteratorHelper(order.order_items);
                    _context5.p = 1;
                    _iterator2.s();
                  case 2:
                    if ((_step2 = _iterator2.n()).done) {
                      _context5.n = 7;
                      break;
                    }
                    item = _step2.value;
                    if (!item.variant_id) {
                      _context5.n = 5;
                      break;
                    }
                    _context5.n = 3;
                    return tx.productVariant.update({
                      where: {
                        variant_id: item.variant_id
                      },
                      data: {
                        stock_quantity: {
                          increment: item.quantity
                        }
                      }
                    });
                  case 3:
                    _context5.n = 4;
                    return tx.product.update({
                      where: {
                        product_id: item.product_id
                      },
                      data: {
                        sold_quantity: {
                          decrement: item.quantity
                        }
                      }
                    });
                  case 4:
                    _context5.n = 6;
                    break;
                  case 5:
                    _context5.n = 6;
                    return tx.product.update({
                      where: {
                        product_id: item.product_id
                      },
                      data: {
                        stock_quantity: {
                          increment: item.quantity
                        },
                        sold_quantity: {
                          decrement: item.quantity
                        }
                      }
                    });
                  case 6:
                    _context5.n = 2;
                    break;
                  case 7:
                    _context5.n = 9;
                    break;
                  case 8:
                    _context5.p = 8;
                    _t5 = _context5.v;
                    _iterator2.e(_t5);
                  case 9:
                    _context5.p = 9;
                    _iterator2.f();
                    return _context5.f(9);
                  case 10:
                    _context5.n = 11;
                    return tx.order.update({
                      where: {
                        order_id: orderId
                      },
                      data: {
                        order_status: 'cancelled'
                      }
                    });
                  case 11:
                    return _context5.a(2);
                }
              }, _callee5, null, [[1, 8, 9, 10]]);
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
          _t6 = _context6.v;
          console.error(_t6);
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
var generateRandomPassword = function generateRandomPassword() {
  var upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var lower = 'abcdefghijklmnopqrstuvwxyz';
  var digits = '0123456789';
  var special = '!@#$%^&*()_+';
  var password = '';
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  var allChars = upper + lower + digits + special;
  for (var i = 0; i < 6; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  return password.split('').sort(function () {
    return 0.5 - Math.random();
  }).join('');
};
var guestCheckout = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(data) {
    var full_name, phone, email, address_line, ward, district, province, payment_method, voucher_code, note, items, cartItemsToCheckout, _iterator3, _step3, _item4, product, subtotalAmount, variantsData, i, item, availableStock, price, variant, voucherId, discountAmount, voucher, vCode, now, shippingFee, finalAmount, shippingAddress, orderCode, paymentCode, generatedPassword, hashedPassword, resultOrder, _t7, _t8;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.p = _context8.n) {
        case 0:
          _context8.p = 0;
          full_name = data.full_name, phone = data.phone, email = data.email, address_line = data.address_line, ward = data.ward, district = data.district, province = data.province, payment_method = data.payment_method, voucher_code = data.voucher_code, note = data.note, items = data.items;
          if (!(!full_name || !phone || !email || !address_line || !province || !payment_method || !items)) {
            _context8.n = 1;
            break;
          }
          return _context8.a(2, {
            EM: 'Thiếu thông tin bắt buộc',
            EC: 1,
            DT: ''
          });
        case 1:
          if (!(!Array.isArray(items) || items.length === 0)) {
            _context8.n = 2;
            break;
          }
          return _context8.a(2, {
            EM: 'Không có sản phẩm nào để đặt hàng',
            EC: 1,
            DT: ''
          });
        case 2:
          // Check items and stock
          cartItemsToCheckout = [];
          _iterator3 = _createForOfIteratorHelper(items);
          _context8.p = 3;
          _iterator3.s();
        case 4:
          if ((_step3 = _iterator3.n()).done) {
            _context8.n = 8;
            break;
          }
          _item4 = _step3.value;
          _context8.n = 5;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: (0, _prismaHelpers.toBigIntId)(_item4.product_id)
            }
          });
        case 5:
          product = _context8.v;
          if (product) {
            _context8.n = 6;
            break;
          }
          return _context8.a(2, {
            EM: "Kh\xF4ng t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m v\u1EDBi ID: ".concat(_item4.product_id),
            EC: -1,
            DT: ''
          });
        case 6:
          cartItemsToCheckout.push({
            cart_item_id: null,
            product_id: product.product_id,
            variant_id: _item4.variant_id ? (0, _prismaHelpers.toBigIntId)(_item4.variant_id) : null,
            quantity: parseInt(_item4.quantity) || 1,
            product: product
          });
        case 7:
          _context8.n = 4;
          break;
        case 8:
          _context8.n = 10;
          break;
        case 9:
          _context8.p = 9;
          _t7 = _context8.v;
          _iterator3.e(_t7);
        case 10:
          _context8.p = 10;
          _iterator3.f();
          return _context8.f(10);
        case 11:
          // Check stock and calculate subtotal
          subtotalAmount = 0;
          variantsData = {}; // Cache variants
          i = 0;
        case 12:
          if (!(i < cartItemsToCheckout.length)) {
            _context8.n = 18;
            break;
          }
          item = cartItemsToCheckout[i];
          availableStock = item.product.stock_quantity;
          price = parseFloat(item.product.price);
          if (!item.variant_id) {
            _context8.n = 15;
            break;
          }
          _context8.n = 13;
          return _prisma["default"].productVariant.findUnique({
            where: {
              variant_id: item.variant_id
            }
          });
        case 13:
          variant = _context8.v;
          if (variant) {
            _context8.n = 14;
            break;
          }
          return _context8.a(2, {
            EM: "M\u1EABu s\u1EA3n ph\u1EA9m kh\xF4ng h\u1EE3p l\u1EC7: ".concat(item.product.product_name),
            EC: -1,
            DT: ''
          });
        case 14:
          availableStock = variant.stock_quantity;
          price = parseFloat(variant.price);
          variantsData[i] = variant;
        case 15:
          if (!(availableStock < item.quantity)) {
            _context8.n = 16;
            break;
          }
          return _context8.a(2, {
            EM: "S\u1EA3n ph\u1EA9m ".concat(item.product.product_name, " kh\xF4ng \u0111\u1EE7 s\u1ED1 l\u01B0\u1EE3ng trong kho"),
            EC: 2,
            DT: ''
          });
        case 16:
          subtotalAmount += price * item.quantity;
        case 17:
          i++;
          _context8.n = 12;
          break;
        case 18:
          // Process Voucher (if any)
          voucherId = null;
          discountAmount = 0;
          voucher = null;
          if (!voucher_code) {
            _context8.n = 25;
            break;
          }
          vCode = voucher_code.toUpperCase();
          _context8.n = 19;
          return _prisma["default"].voucher.findUnique({
            where: {
              voucher_code: vCode
            }
          });
        case 19:
          voucher = _context8.v;
          if (!(!voucher || voucher.status !== 'active')) {
            _context8.n = 20;
            break;
          }
          return _context8.a(2, {
            EM: 'Voucher không hợp lệ hoặc không hoạt động',
            EC: -1,
            DT: ''
          });
        case 20:
          now = new Date();
          if (!(voucher.start_at && now < voucher.start_at)) {
            _context8.n = 21;
            break;
          }
          return _context8.a(2, {
            EM: 'Voucher chưa bắt đầu có hiệu lực',
            EC: -1,
            DT: ''
          });
        case 21:
          if (!(voucher.end_at && now > voucher.end_at)) {
            _context8.n = 22;
            break;
          }
          return _context8.a(2, {
            EM: 'Voucher đã hết hạn',
            EC: -1,
            DT: ''
          });
        case 22:
          if (!(voucher.min_order_amount && subtotalAmount < parseFloat(voucher.min_order_amount))) {
            _context8.n = 23;
            break;
          }
          return _context8.a(2, {
            EM: "Gi\xE1 tr\u1ECB \u0111\u01A1n h\xE0ng t\u1ED1i thi\u1EC3u ph\u1EA3i t\u1EEB ".concat(parseFloat(voucher.min_order_amount)),
            EC: -1,
            DT: ''
          });
        case 23:
          if (!(voucher.remaining_usage !== null && voucher.remaining_usage <= 0)) {
            _context8.n = 24;
            break;
          }
          return _context8.a(2, {
            EM: 'Voucher đã hết lượt sử dụng',
            EC: -1,
            DT: ''
          });
        case 24:
          voucherId = voucher.voucher_id;
          if (voucher.discount_type === 'percent') {
            discountAmount = subtotalAmount * (parseFloat(voucher.discount_value) / 100);
            if (voucher.max_discount_amount && discountAmount > parseFloat(voucher.max_discount_amount)) {
              discountAmount = parseFloat(voucher.max_discount_amount);
            }
          } else if (voucher.discount_type === 'fixed') {
            discountAmount = parseFloat(voucher.discount_value);
          }

          // Ensure discount doesn't exceed subtotal
          if (discountAmount > subtotalAmount) {
            discountAmount = subtotalAmount;
          }
        case 25:
          shippingFee = 0; // Hardcoded to 0
          finalAmount = subtotalAmount + shippingFee - discountAmount; // Snapshot address fields
          shippingAddress = "".concat(address_line).concat(ward ? ', ' + ward : '').concat(district ? ', ' + district : '').concat(province ? ', ' + province : '');
          orderCode = "ORD-".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 6).toUpperCase());
          paymentCode = "PAY-".concat(Date.now(), "-").concat(Math.random().toString(36).substring(2, 6).toUpperCase());
          generatedPassword = generateRandomPassword();
          hashedPassword = (0, _passwordHelpers.hashPassword)(generatedPassword); // Execute transaction
          _context8.n = 26;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(tx) {
              var existingUserEmail, existingUserPhone, customerRole, newGuestUser, guestAddress, newOrder, _i2, _item3, _price2, itemNameSnapshot, newPayment;
              return _regenerator().w(function (_context7) {
                while (1) switch (_context7.n) {
                  case 0:
                    if (!email) {
                      _context7.n = 5;
                      break;
                    }
                    _context7.n = 1;
                    return tx.user.findFirst({
                      where: {
                        email: email
                      }
                    });
                  case 1:
                    existingUserEmail = _context7.v;
                    if (!existingUserEmail) {
                      _context7.n = 5;
                      break;
                    }
                    if (!(existingUserEmail.status === 'inactive')) {
                      _context7.n = 4;
                      break;
                    }
                    _context7.n = 2;
                    return tx.otpCode.deleteMany({
                      where: {
                        user_id: existingUserEmail.user_id
                      }
                    });
                  case 2:
                    _context7.n = 3;
                    return tx.user["delete"]({
                      where: {
                        user_id: existingUserEmail.user_id
                      }
                    });
                  case 3:
                    _context7.n = 5;
                    break;
                  case 4:
                    throw new Error('Email đã tồn tại, vui lòng đăng nhập để mua hàng');
                  case 5:
                    if (!phone) {
                      _context7.n = 10;
                      break;
                    }
                    _context7.n = 6;
                    return tx.user.findFirst({
                      where: {
                        phone: phone
                      }
                    });
                  case 6:
                    existingUserPhone = _context7.v;
                    if (!existingUserPhone) {
                      _context7.n = 10;
                      break;
                    }
                    if (!(existingUserPhone.status === 'inactive')) {
                      _context7.n = 9;
                      break;
                    }
                    _context7.n = 7;
                    return tx.otpCode.deleteMany({
                      where: {
                        user_id: existingUserPhone.user_id
                      }
                    });
                  case 7:
                    _context7.n = 8;
                    return tx.user["delete"]({
                      where: {
                        user_id: existingUserPhone.user_id
                      }
                    });
                  case 8:
                    _context7.n = 10;
                    break;
                  case 9:
                    throw new Error('Số điện thoại đã tồn tại, vui lòng đăng nhập để mua hàng');
                  case 10:
                    _context7.n = 11;
                    return tx.role.findUnique({
                      where: {
                        role_code: 'CUSTOMER'
                      }
                    });
                  case 11:
                    customerRole = _context7.v;
                    if (customerRole) {
                      _context7.n = 13;
                      break;
                    }
                    _context7.n = 12;
                    return tx.role.create({
                      data: {
                        role_code: 'CUSTOMER',
                        role_name: 'Customer'
                      }
                    });
                  case 12:
                    customerRole = _context7.v;
                  case 13:
                    _context7.n = 14;
                    return tx.user.create({
                      data: {
                        role_id: customerRole.role_id,
                        full_name: full_name,
                        email: email,
                        phone: phone,
                        password_hash: hashedPassword,
                        status: 'active'
                      }
                    });
                  case 14:
                    newGuestUser = _context7.v;
                    _context7.n = 15;
                    return tx.userAddress.create({
                      data: {
                        user_id: newGuestUser.user_id,
                        recipient_name: full_name,
                        recipient_phone: phone,
                        address_line: address_line,
                        ward: ward || null,
                        district: district || null,
                        province: province,
                        is_default: true
                      }
                    });
                  case 15:
                    guestAddress = _context7.v;
                    _context7.n = 16;
                    return tx.order.create({
                      data: {
                        order_code: orderCode,
                        order_type: 'product',
                        user_id: newGuestUser.user_id,
                        address_id: guestAddress.address_id,
                        voucher_id: voucherId,
                        recipient_name: full_name,
                        recipient_phone: phone,
                        shipping_address: shippingAddress,
                        subtotal_amount: subtotalAmount,
                        discount_amount: discountAmount,
                        points_discount_amount: 0,
                        shipping_fee: shippingFee,
                        total_amount: finalAmount,
                        order_status: 'pending',
                        payment_status: 'unpaid',
                        note: note || null
                      }
                    });
                  case 16:
                    newOrder = _context7.v;
                    _i2 = 0;
                  case 17:
                    if (!(_i2 < cartItemsToCheckout.length)) {
                      _context7.n = 23;
                      break;
                    }
                    _item3 = cartItemsToCheckout[_i2];
                    _price2 = parseFloat(_item3.product.price);
                    itemNameSnapshot = _item3.product.product_name;
                    if (_item3.variant_id && variantsData[_i2]) {
                      _price2 = parseFloat(variantsData[_i2].price);
                      itemNameSnapshot = "".concat(_item3.product.product_name, " - ").concat(variantsData[_i2].variant_name);
                    }
                    _context7.n = 18;
                    return tx.orderItem.create({
                      data: {
                        order_id: newOrder.order_id,
                        product_id: _item3.product_id,
                        variant_id: _item3.variant_id,
                        item_type: 'product',
                        item_name_snapshot: itemNameSnapshot,
                        quantity: _item3.quantity,
                        unit_price: _price2,
                        total_price: _price2 * _item3.quantity
                      }
                    });
                  case 18:
                    if (!_item3.variant_id) {
                      _context7.n = 21;
                      break;
                    }
                    _context7.n = 19;
                    return tx.productVariant.update({
                      where: {
                        variant_id: _item3.variant_id
                      },
                      data: {
                        stock_quantity: {
                          decrement: _item3.quantity
                        }
                      }
                    });
                  case 19:
                    _context7.n = 20;
                    return tx.product.update({
                      where: {
                        product_id: _item3.product_id
                      },
                      data: {
                        sold_quantity: {
                          increment: _item3.quantity
                        }
                      }
                    });
                  case 20:
                    _context7.n = 22;
                    break;
                  case 21:
                    _context7.n = 22;
                    return tx.product.update({
                      where: {
                        product_id: _item3.product_id
                      },
                      data: {
                        stock_quantity: {
                          decrement: _item3.quantity
                        },
                        sold_quantity: {
                          increment: _item3.quantity
                        }
                      }
                    });
                  case 22:
                    _i2++;
                    _context7.n = 17;
                    break;
                  case 23:
                    _context7.n = 24;
                    return tx.payment.create({
                      data: {
                        payment_code: paymentCode,
                        user_id: newGuestUser.user_id,
                        order_id: newOrder.order_id,
                        payment_target_type: 'order',
                        payment_method: payment_method,
                        // 'cod' or 'online'
                        subtotal_amount: subtotalAmount,
                        voucher_discount_amount: discountAmount,
                        points_used: 0,
                        points_discount_amount: 0,
                        final_amount: finalAmount,
                        status: 'pending'
                      }
                    });
                  case 24:
                    newPayment = _context7.v;
                    if (!voucherId) {
                      _context7.n = 26;
                      break;
                    }
                    _context7.n = 25;
                    return tx.voucherUsage.create({
                      data: {
                        voucher_id: voucherId,
                        user_id: newGuestUser.user_id,
                        payment_id: newPayment.payment_id,
                        discount_amount: discountAmount
                      }
                    });
                  case 25:
                    if (!(voucher.remaining_usage !== null)) {
                      _context7.n = 26;
                      break;
                    }
                    _context7.n = 26;
                    return tx.voucher.update({
                      where: {
                        voucher_id: voucherId
                      },
                      data: {
                        remaining_usage: {
                          decrement: 1
                        }
                      }
                    });
                  case 26:
                    return _context7.a(2, newOrder);
                }
              }, _callee7);
            }));
            return function (_x10) {
              return _ref8.apply(this, arguments);
            };
          }());
        case 26:
          resultOrder = _context8.v;
          // Send email asynchronously (non-blocking)
          (0, _emailHelpers.sendGuestAccountEmail)(email, generatedPassword, orderCode).then(function (success) {
            if (!success) {
              console.warn("Failed to send account credentials email to ".concat(email));
            }
          })["catch"](function (emailErr) {
            console.warn('Error sending guest checkout account email:', emailErr);
          });
          resultOrder.guest_account = {
            username: email || phone,
            password: generatedPassword
          };
          return _context8.a(2, {
            EM: 'Đơn hàng đã được tạo thành công. Thông tin tài khoản đã được gửi đến email của bạn.',
            EC: 0,
            DT: resultOrder
          });
        case 27:
          _context8.p = 27;
          _t8 = _context8.v;
          console.error(_t8);
          if (!(_t8.message && (_t8.message.includes('Email đã tồn tại') || _t8.message.includes('Số điện thoại đã tồn tại')))) {
            _context8.n = 28;
            break;
          }
          return _context8.a(2, {
            EM: _t8.message,
            EC: 2,
            DT: ''
          });
        case 28:
          return _context8.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee8, null, [[3, 9, 10, 11], [0, 27]]);
  }));
  return function guestCheckout(_x1) {
    return _ref7.apply(this, arguments);
  };
}();
module.exports = {
  getOrders: getOrders,
  getOrderById: getOrderById,
  checkoutCart: checkoutCart,
  guestCheckout: guestCheckout,
  updateOrderStatus: updateOrderStatus
};