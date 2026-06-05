"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// --- PRODUCT CATEGORY ---

var getAllCategories = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
    var categories, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          _context.n = 1;
          return _prisma["default"].productCategory.findMany({
            where: {
              status: 'active'
            },
            include: {
              children: {
                include: {
                  _count: {
                    select: {
                      products: {
                        where: {
                          status: 'active'
                        }
                      }
                    }
                  }
                }
              },
              _count: {
                select: {
                  products: {
                    where: {
                      status: 'active'
                    }
                  }
                }
              }
            }
          });
        case 1:
          categories = _context.v;
          return _context.a(2, {
            EM: 'Get categories successful',
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
var createCategory = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(data) {
    var newCat, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          if (data.category_name) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Missing category_name',
            EC: 1,
            DT: ''
          });
        case 1:
          _context2.n = 2;
          return _prisma["default"].productCategory.create({
            data: {
              category_name: data.category_name,
              parent_id: data.parent_id ? (0, _prismaHelpers.toBigIntId)(data.parent_id) : null,
              image_url: data.image_url || null,
              status: data.status || 'active'
            }
          });
        case 2:
          newCat = _context2.v;
          return _context2.a(2, {
            EM: 'Create category successful',
            EC: 0,
            DT: newCat
          });
        case 3:
          _context2.p = 3;
          _t2 = _context2.v;
          console.error(_t2);
          return _context2.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee2, null, [[0, 3]]);
  }));
  return function createCategory(_x) {
    return _ref2.apply(this, arguments);
  };
}();
var updateCategory = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(id, data) {
    var catId, existingCat, updateData, updatedCat, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          catId = (0, _prismaHelpers.toBigIntId)(id);
          if (catId) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Invalid category ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context3.n = 2;
          return _prisma["default"].productCategory.findUnique({
            where: {
              product_category_id: catId
            }
          });
        case 2:
          existingCat = _context3.v;
          if (existingCat) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'Category not found',
            EC: -1,
            DT: ''
          });
        case 3:
          updateData = {};
          if (data.category_name) updateData.category_name = data.category_name;
          if (data.parent_id !== undefined) updateData.parent_id = data.parent_id ? (0, _prismaHelpers.toBigIntId)(data.parent_id) : null;
          if (data.image_url) updateData.image_url = data.image_url;
          if (data.status) updateData.status = data.status;
          _context3.n = 4;
          return _prisma["default"].productCategory.update({
            where: {
              product_category_id: catId
            },
            data: updateData
          });
        case 4:
          updatedCat = _context3.v;
          return _context3.a(2, {
            EM: 'Update category successful',
            EC: 0,
            DT: updatedCat
          });
        case 5:
          _context3.p = 5;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 5]]);
  }));
  return function updateCategory(_x2, _x3) {
    return _ref3.apply(this, arguments);
  };
}();
var deleteCategory = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(id) {
    var catId, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          catId = (0, _prismaHelpers.toBigIntId)(id);
          if (catId) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid category ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].productCategory.update({
            where: {
              product_category_id: catId
            },
            data: {
              status: 'inactive'
            }
          });
        case 2:
          return _context4.a(2, {
            EM: 'Delete category successful',
            EC: 0,
            DT: ''
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
  return function deleteCategory(_x4) {
    return _ref4.apply(this, arguments);
  };
}();

// --- PRODUCT ---

var getAllProducts = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(query) {
    var page, limit, skip, filter, categoryId, sort, minPrice, maxPrice, whereCondition, orderBy, _yield$prisma$$transa, _yield$prisma$$transa2, total, products, _t5, _t6;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          page = parseInt(query.page) || 1;
          limit = parseInt(query.limit) || 10;
          skip = (page - 1) * limit;
          filter = query.filter || '';
          categoryId = query.category_id ? (0, _prismaHelpers.toBigIntId)(query.category_id) : undefined;
          sort = query.sort || 'newest';
          minPrice = query.minPrice ? parseFloat(query.minPrice) : undefined;
          maxPrice = query.maxPrice ? parseFloat(query.maxPrice) : undefined;
          whereCondition = _objectSpread({
            status: 'active',
            product_name: filter ? {
              contains: filter
            } : undefined,
            product_category_id: categoryId ? categoryId : undefined
          }, minPrice !== undefined || maxPrice !== undefined ? {
            price: _objectSpread(_objectSpread({}, minPrice !== undefined ? {
              gte: minPrice
            } : {}), maxPrice !== undefined ? {
              lte: maxPrice
            } : {})
          } : {});
          _t5 = sort;
          _context5.n = _t5 === 'best_selling' ? 1 : _t5 === 'price_asc' ? 2 : _t5 === 'price_desc' ? 3 : _t5 === 'rating' ? 4 : 5;
          break;
        case 1:
          orderBy = {
            sold_quantity: 'desc'
          };
          return _context5.a(3, 6);
        case 2:
          orderBy = {
            price: 'asc'
          };
          return _context5.a(3, 6);
        case 3:
          orderBy = {
            price: 'desc'
          };
          return _context5.a(3, 6);
        case 4:
          orderBy = {
            average_rating: 'desc'
          };
          return _context5.a(3, 6);
        case 5:
          orderBy = {
            created_at: 'desc'
          };
        case 6:
          _context5.n = 7;
          return _prisma["default"].$transaction([_prisma["default"].product.count({
            where: whereCondition
          }), _prisma["default"].product.findMany({
            where: whereCondition,
            include: {
              category: true,
              product_images: {
                where: {
                  is_primary: true
                }
              }
            },
            skip: skip,
            take: limit,
            orderBy: orderBy
          })]);
        case 7:
          _yield$prisma$$transa = _context5.v;
          _yield$prisma$$transa2 = _slicedToArray(_yield$prisma$$transa, 2);
          total = _yield$prisma$$transa2[0];
          products = _yield$prisma$$transa2[1];
          return _context5.a(2, {
            EM: 'Get products successful',
            EC: 0,
            DT: {
              totalRows: total,
              totalPages: Math.ceil(total / limit),
              products: products
            }
          });
        case 8:
          _context5.p = 8;
          _t6 = _context5.v;
          console.error(_t6);
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 8]]);
  }));
  return function getAllProducts(_x5) {
    return _ref5.apply(this, arguments);
  };
}();
var getDetailProduct = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(id) {
    var productId, product, _t7;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          productId = (0, _prismaHelpers.toBigIntId)(id);
          if (productId) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, {
            EM: 'Invalid product ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context6.n = 2;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: productId
            },
            include: {
              category: true,
              product_images: true,
              variants: true
            }
          });
        case 2:
          product = _context6.v;
          if (product) {
            _context6.n = 3;
            break;
          }
          return _context6.a(2, {
            EM: 'Product not found',
            EC: -1,
            DT: ''
          });
        case 3:
          return _context6.a(2, {
            EM: 'Get product successful',
            EC: 0,
            DT: product
          });
        case 4:
          _context6.p = 4;
          _t7 = _context6.v;
          console.error(_t7);
          return _context6.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee6, null, [[0, 4]]);
  }));
  return function getDetailProduct(_x6) {
    return _ref6.apply(this, arguments);
  };
}();
var createProduct = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(data) {
    var catId, newProduct, imageRecords, variantRecords, createdProduct, _t8;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          _context7.p = 0;
          if (!(!data.product_name || !data.product_category_id)) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2, {
            EM: 'Missing product_name or category_id',
            EC: 1,
            DT: ''
          });
        case 1:
          catId = (0, _prismaHelpers.toBigIntId)(data.product_category_id);
          _context7.n = 2;
          return _prisma["default"].product.create({
            data: {
              product_name: data.product_name,
              product_category_id: catId,
              description: data.description || null,
              price: data.price ? parseFloat(data.price) : 0,
              original_price: data.original_price !== undefined && data.original_price !== null ? parseFloat(data.original_price) : null,
              stock_quantity: data.stock_quantity ? parseInt(data.stock_quantity) : 0,
              status: data.status || 'active'
            }
          });
        case 2:
          newProduct = _context7.v;
          if (!(data.images && Array.isArray(data.images) && data.images.length > 0)) {
            _context7.n = 3;
            break;
          }
          imageRecords = data.images.map(function (img, index) {
            return {
              product_id: newProduct.product_id,
              image_url: img,
              is_primary: index === 0
            };
          });
          _context7.n = 3;
          return _prisma["default"].productImage.createMany({
            data: imageRecords
          });
        case 3:
          if (!(data.variants && Array.isArray(data.variants) && data.variants.length > 0)) {
            _context7.n = 4;
            break;
          }
          variantRecords = data.variants.map(function (v) {
            return {
              product_id: newProduct.product_id,
              variant_name: v.variant_name,
              price: parseFloat(v.price),
              original_price: v.original_price !== undefined && v.original_price !== null ? parseFloat(v.original_price) : null,
              stock_quantity: v.stock_quantity ? parseInt(v.stock_quantity) : 0
            };
          });
          _context7.n = 4;
          return _prisma["default"].productVariant.createMany({
            data: variantRecords
          });
        case 4:
          _context7.n = 5;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: newProduct.product_id
            },
            include: {
              category: true,
              product_images: true,
              variants: true
            }
          });
        case 5:
          createdProduct = _context7.v;
          return _context7.a(2, {
            EM: 'Create product successful',
            EC: 0,
            DT: createdProduct
          });
        case 6:
          _context7.p = 6;
          _t8 = _context7.v;
          console.error(_t8);
          return _context7.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee7, null, [[0, 6]]);
  }));
  return function createProduct(_x7) {
    return _ref7.apply(this, arguments);
  };
}();
var updateProduct = /*#__PURE__*/function () {
  var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(id, data) {
    var productId, existingProduct, updateData, updatedProduct, imageRecords, variantRecords, completeUpdatedProduct, _t9;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.p = _context8.n) {
        case 0:
          _context8.p = 0;
          productId = (0, _prismaHelpers.toBigIntId)(id);
          if (productId) {
            _context8.n = 1;
            break;
          }
          return _context8.a(2, {
            EM: 'Invalid product ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context8.n = 2;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: productId
            }
          });
        case 2:
          existingProduct = _context8.v;
          if (existingProduct) {
            _context8.n = 3;
            break;
          }
          return _context8.a(2, {
            EM: 'Product not found',
            EC: -1,
            DT: ''
          });
        case 3:
          updateData = {};
          if (data.product_name) updateData.product_name = data.product_name;
          if (data.product_category_id) updateData.product_category_id = (0, _prismaHelpers.toBigIntId)(data.product_category_id);
          if (data.description !== undefined) updateData.description = data.description;
          if (data.price !== undefined) updateData.price = parseFloat(data.price);
          if (data.original_price !== undefined) updateData.original_price = data.original_price !== null ? parseFloat(data.original_price) : null;
          if (data.stock_quantity !== undefined) updateData.stock_quantity = parseInt(data.stock_quantity);
          if (data.status) updateData.status = data.status;
          _context8.n = 4;
          return _prisma["default"].product.update({
            where: {
              product_id: productId
            },
            data: updateData
          });
        case 4:
          updatedProduct = _context8.v;
          if (!(data.images && Array.isArray(data.images))) {
            _context8.n = 6;
            break;
          }
          _context8.n = 5;
          return _prisma["default"].productImage.deleteMany({
            where: {
              product_id: productId
            }
          });
        case 5:
          if (!(data.images.length > 0)) {
            _context8.n = 6;
            break;
          }
          imageRecords = data.images.map(function (img, index) {
            return {
              product_id: productId,
              image_url: img,
              is_primary: index === 0
            };
          });
          _context8.n = 6;
          return _prisma["default"].productImage.createMany({
            data: imageRecords
          });
        case 6:
          if (!(data.variants && Array.isArray(data.variants))) {
            _context8.n = 8;
            break;
          }
          _context8.n = 7;
          return _prisma["default"].productVariant.deleteMany({
            where: {
              product_id: productId
            }
          });
        case 7:
          if (!(data.variants.length > 0)) {
            _context8.n = 8;
            break;
          }
          variantRecords = data.variants.map(function (v) {
            return {
              product_id: productId,
              variant_name: v.variant_name,
              price: parseFloat(v.price),
              original_price: v.original_price !== undefined && v.original_price !== null ? parseFloat(v.original_price) : null,
              stock_quantity: v.stock_quantity ? parseInt(v.stock_quantity) : 0
            };
          });
          _context8.n = 8;
          return _prisma["default"].productVariant.createMany({
            data: variantRecords
          });
        case 8:
          _context8.n = 9;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: productId
            },
            include: {
              category: true,
              product_images: true,
              variants: true
            }
          });
        case 9:
          completeUpdatedProduct = _context8.v;
          return _context8.a(2, {
            EM: 'Update product successful',
            EC: 0,
            DT: completeUpdatedProduct
          });
        case 10:
          _context8.p = 10;
          _t9 = _context8.v;
          console.error(_t9);
          return _context8.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee8, null, [[0, 10]]);
  }));
  return function updateProduct(_x8, _x9) {
    return _ref8.apply(this, arguments);
  };
}();
var deleteProduct = /*#__PURE__*/function () {
  var _ref9 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(id) {
    var productId, _t0;
    return _regenerator().w(function (_context9) {
      while (1) switch (_context9.p = _context9.n) {
        case 0:
          _context9.p = 0;
          productId = (0, _prismaHelpers.toBigIntId)(id);
          if (productId) {
            _context9.n = 1;
            break;
          }
          return _context9.a(2, {
            EM: 'Invalid product ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context9.n = 2;
          return _prisma["default"].product.update({
            where: {
              product_id: productId
            },
            data: {
              status: 'inactive'
            }
          });
        case 2:
          return _context9.a(2, {
            EM: 'Delete product successful',
            EC: 0,
            DT: ''
          });
        case 3:
          _context9.p = 3;
          _t0 = _context9.v;
          console.error(_t0);
          return _context9.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee9, null, [[0, 3]]);
  }));
  return function deleteProduct(_x0) {
    return _ref9.apply(this, arguments);
  };
}();
var getRelatedProducts = /*#__PURE__*/function () {
  var _ref0 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0(id) {
    var productId, product, related, _t1;
    return _regenerator().w(function (_context0) {
      while (1) switch (_context0.p = _context0.n) {
        case 0:
          _context0.p = 0;
          productId = (0, _prismaHelpers.toBigIntId)(id);
          if (productId) {
            _context0.n = 1;
            break;
          }
          return _context0.a(2, {
            EM: 'Invalid product ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context0.n = 2;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: productId
            }
          });
        case 2:
          product = _context0.v;
          if (product) {
            _context0.n = 3;
            break;
          }
          return _context0.a(2, {
            EM: 'Product not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context0.n = 4;
          return _prisma["default"].product.findMany({
            where: {
              product_category_id: product.product_category_id,
              product_id: {
                not: productId
              },
              status: 'active'
            },
            include: {
              product_images: {
                where: {
                  is_primary: true
                }
              }
            },
            orderBy: {
              sold_quantity: 'desc'
            },
            take: 10
          });
        case 4:
          related = _context0.v;
          return _context0.a(2, {
            EM: 'Get related products successful',
            EC: 0,
            DT: related
          });
        case 5:
          _context0.p = 5;
          _t1 = _context0.v;
          console.error(_t1);
          return _context0.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee0, null, [[0, 5]]);
  }));
  return function getRelatedProducts(_x1) {
    return _ref0.apply(this, arguments);
  };
}();
var getReviewStats = /*#__PURE__*/function () {
  var _ref1 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1(id) {
    var productId, product, stats, counts, totalReviews, sumRating, averageRating, breakdown, star, count, percentage, _t10;
    return _regenerator().w(function (_context1) {
      while (1) switch (_context1.p = _context1.n) {
        case 0:
          _context1.p = 0;
          productId = (0, _prismaHelpers.toBigIntId)(id);
          if (productId) {
            _context1.n = 1;
            break;
          }
          return _context1.a(2, {
            EM: 'Invalid product ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context1.n = 2;
          return _prisma["default"].product.findUnique({
            where: {
              product_id: productId
            }
          });
        case 2:
          product = _context1.v;
          if (product) {
            _context1.n = 3;
            break;
          }
          return _context1.a(2, {
            EM: 'Product not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context1.n = 4;
          return _prisma["default"].review.groupBy({
            by: ['rating'],
            where: {
              target_type: 'product',
              target_id: productId,
              status: 'posted'
            },
            _count: {
              rating: true
            }
          });
        case 4:
          stats = _context1.v;
          counts = {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0
          };
          totalReviews = 0;
          sumRating = 0;
          stats.forEach(function (s) {
            var rating = s.rating;
            var count = s._count.rating;
            if (counts[rating] !== undefined) {
              counts[rating] = count;
              totalReviews += count;
              sumRating += rating * count;
            }
          });
          averageRating = totalReviews > 0 ? parseFloat((sumRating / totalReviews).toFixed(2)) : 0.00;
          breakdown = [];
          for (star = 5; star >= 1; star--) {
            count = counts[star];
            percentage = totalReviews > 0 ? parseFloat((count / totalReviews * 100).toFixed(2)) : 0.00;
            breakdown.push({
              star: star,
              count: count,
              percentage: percentage
            });
          }
          return _context1.a(2, {
            EM: 'Get review stats successful',
            EC: 0,
            DT: {
              totalReviews: totalReviews,
              averageRating: averageRating,
              breakdown: breakdown
            }
          });
        case 5:
          _context1.p = 5;
          _t10 = _context1.v;
          console.error(_t10);
          return _context1.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee1, null, [[0, 5]]);
  }));
  return function getReviewStats(_x10) {
    return _ref1.apply(this, arguments);
  };
}();
module.exports = {
  getAllCategories: getAllCategories,
  createCategory: createCategory,
  updateCategory: updateCategory,
  deleteCategory: deleteCategory,
  getAllProducts: getAllProducts,
  getDetailProduct: getDetailProduct,
  createProduct: createProduct,
  updateProduct: updateProduct,
  deleteProduct: deleteProduct,
  getRelatedProducts: getRelatedProducts,
  getReviewStats: getReviewStats
};