"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var getCartByUserId = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(userIdStr) {
    var userId, cart, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          if (userId) {
            _context.n = 1;
            break;
          }
          return _context.a(2, {
            EM: 'Invalid user ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context.n = 2;
          return _prisma["default"].cart.findUnique({
            where: {
              user_id: userId
            },
            include: {
              cart_items: {
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
        case 2:
          cart = _context.v;
          if (cart) {
            _context.n = 4;
            break;
          }
          _context.n = 3;
          return _prisma["default"].cart.create({
            data: {
              user_id: userId
            },
            include: {
              cart_items: true
            }
          });
        case 3:
          cart = _context.v;
        case 4:
          return _context.a(2, {
            EM: 'Get cart successful',
            EC: 0,
            DT: cart
          });
        case 5:
          _context.p = 5;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 5]]);
  }));
  return function getCartByUserId(_x) {
    return _ref.apply(this, arguments);
  };
}();
var addToCart = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(userIdStr, data) {
    var userId, productId, quantity, variantId, cart, product, availableStock, variant, existingItem, resultItem, newQuantity, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
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
          if (!(!data.product_id || !data.quantity)) {
            _context2.n = 2;
            break;
          }
          return _context2.a(2, {
            EM: 'Missing product_id or quantity',
            EC: 1,
            DT: ''
          });
        case 2:
          productId = (0, _prismaHelpers.toBigIntId)(data.product_id);
          quantity = parseInt(data.quantity);
          variantId = data.variant_id ? (0, _prismaHelpers.toBigIntId)(data.variant_id) : null; // Get or create cart
          _context2.n = 3;
          return _prisma["default"].cart.findUnique({
            where: {
              user_id: userId
            }
          });
        case 3:
          cart = _context2.v;
          if (cart) {
            _context2.n = 5;
            break;
          }
          _context2.n = 4;
          return _prisma["default"].cart.create({
            data: {
              user_id: userId
            }
          });
        case 4:
          cart = _context2.v;
        case 5:
          _context2.n = 6;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: productId
            }
          });
        case 6:
          product = _context2.v;
          if (!(!product || product.status !== 'active')) {
            _context2.n = 7;
            break;
          }
          return _context2.a(2, {
            EM: 'Product not available',
            EC: -1,
            DT: ''
          });
        case 7:
          availableStock = product.stock_quantity;
          if (!variantId) {
            _context2.n = 10;
            break;
          }
          _context2.n = 8;
          return _prisma["default"].productVariant.findUnique({
            where: {
              variant_id: variantId
            }
          });
        case 8:
          variant = _context2.v;
          if (!(!variant || variant.product_id !== productId)) {
            _context2.n = 9;
            break;
          }
          return _context2.a(2, {
            EM: 'Invalid product variant',
            EC: -1,
            DT: ''
          });
        case 9:
          availableStock = variant.stock_quantity;
        case 10:
          if (!(availableStock < quantity)) {
            _context2.n = 11;
            break;
          }
          return _context2.a(2, {
            EM: 'Not enough stock',
            EC: 2,
            DT: ''
          });
        case 11:
          _context2.n = 12;
          return _prisma["default"].cartItem.findFirst({
            where: {
              cart_id: cart.cart_id,
              product_id: productId,
              variant_id: variantId
            }
          });
        case 12:
          existingItem = _context2.v;
          if (!existingItem) {
            _context2.n = 15;
            break;
          }
          newQuantity = existingItem.quantity + quantity;
          if (!(availableStock < newQuantity)) {
            _context2.n = 13;
            break;
          }
          return _context2.a(2, {
            EM: 'Not enough stock to add more',
            EC: 2,
            DT: ''
          });
        case 13:
          _context2.n = 14;
          return _prisma["default"].cartItem.update({
            where: {
              cart_item_id: existingItem.cart_item_id
            },
            data: {
              quantity: newQuantity
            }
          });
        case 14:
          resultItem = _context2.v;
          _context2.n = 17;
          break;
        case 15:
          _context2.n = 16;
          return _prisma["default"].cartItem.create({
            data: {
              cart_id: cart.cart_id,
              product_id: productId,
              variant_id: variantId,
              quantity: quantity,
              is_selected: true
            }
          });
        case 16:
          resultItem = _context2.v;
        case 17:
          return _context2.a(2, {
            EM: 'Add to cart successful',
            EC: 0,
            DT: resultItem
          });
        case 18:
          _context2.p = 18;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[0, 18]]);
  }));
  return function addToCart(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
}();
var updateCartItem = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(userIdStr, itemId, data) {
    var userId, cartItemId, cart, item, updateData, q, availableStock, variant, updatedItem, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          cartItemId = (0, _prismaHelpers.toBigIntId)(itemId);
          if (!(!userId || !cartItemId)) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Invalid ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context3.n = 2;
          return _prisma["default"].cart.findUnique({
            where: {
              user_id: userId
            }
          });
        case 2:
          cart = _context3.v;
          if (cart) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'Cart not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context3.n = 4;
          return _prisma["default"].cartItem.findFirst({
            where: {
              cart_item_id: cartItemId,
              cart_id: cart.cart_id
            },
            include: {
              product: true
            }
          });
        case 4:
          item = _context3.v;
          if (item) {
            _context3.n = 5;
            break;
          }
          return _context3.a(2, {
            EM: 'Cart item not found',
            EC: -1,
            DT: ''
          });
        case 5:
          updateData = {};
          if (!(data.quantity !== undefined)) {
            _context3.n = 11;
            break;
          }
          q = parseInt(data.quantity);
          if (!(q <= 0)) {
            _context3.n = 7;
            break;
          }
          _context3.n = 6;
          return _prisma["default"].cartItem["delete"]({
            where: {
              cart_item_id: cartItemId
            }
          });
        case 6:
          return _context3.a(2, {
            EM: 'Item removed from cart',
            EC: 0,
            DT: ''
          });
        case 7:
          availableStock = item.product.stock_quantity;
          if (!item.variant_id) {
            _context3.n = 9;
            break;
          }
          _context3.n = 8;
          return _prisma["default"].productVariant.findUnique({
            where: {
              variant_id: item.variant_id
            }
          });
        case 8:
          variant = _context3.v;
          if (variant) {
            availableStock = variant.stock_quantity;
          }
        case 9:
          if (!(availableStock < q)) {
            _context3.n = 10;
            break;
          }
          return _context3.a(2, {
            EM: 'Not enough stock',
            EC: 2,
            DT: ''
          });
        case 10:
          updateData.quantity = q;
        case 11:
          if (data.is_selected !== undefined) {
            updateData.is_selected = data.is_selected;
          }
          _context3.n = 12;
          return _prisma["default"].cartItem.update({
            where: {
              cart_item_id: cartItemId
            },
            data: updateData
          });
        case 12:
          updatedItem = _context3.v;
          return _context3.a(2, {
            EM: 'Update cart item successful',
            EC: 0,
            DT: updatedItem
          });
        case 13:
          _context3.p = 13;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 13]]);
  }));
  return function updateCartItem(_x4, _x5, _x6) {
    return _ref3.apply(this, arguments);
  };
}();
var deleteCartItem = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(userIdStr, itemId) {
    var userId, cartItemId, cart, item, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          cartItemId = (0, _prismaHelpers.toBigIntId)(itemId);
          if (!(!userId || !cartItemId)) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].cart.findUnique({
            where: {
              user_id: userId
            }
          });
        case 2:
          cart = _context4.v;
          if (cart) {
            _context4.n = 3;
            break;
          }
          return _context4.a(2, {
            EM: 'Cart not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context4.n = 4;
          return _prisma["default"].cartItem.findFirst({
            where: {
              cart_item_id: cartItemId,
              cart_id: cart.cart_id
            }
          });
        case 4:
          item = _context4.v;
          if (item) {
            _context4.n = 5;
            break;
          }
          return _context4.a(2, {
            EM: 'Cart item not found',
            EC: -1,
            DT: ''
          });
        case 5:
          _context4.n = 6;
          return _prisma["default"].cartItem["delete"]({
            where: {
              cart_item_id: cartItemId
            }
          });
        case 6:
          return _context4.a(2, {
            EM: 'Delete cart item successful',
            EC: 0,
            DT: ''
          });
        case 7:
          _context4.p = 7;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 7]]);
  }));
  return function deleteCartItem(_x7, _x8) {
    return _ref4.apply(this, arguments);
  };
}();
module.exports = {
  getCartByUserId: getCartByUserId,
  addToCart: addToCart,
  updateCartItem: updateCartItem,
  deleteCartItem: deleteCartItem
};