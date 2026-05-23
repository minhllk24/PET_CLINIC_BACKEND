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
var getReviewsByTarget = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(targetType, targetIdStr, query) {
    var targetId, page, limit, skip, whereCondition, _yield$prisma$$transa, _yield$prisma$$transa2, total, reviews, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          targetId = (0, _prismaHelpers.toBigIntId)(targetIdStr);
          if (targetId) {
            _context.n = 1;
            break;
          }
          return _context.a(2, {
            EM: 'Invalid target ID',
            EC: 1,
            DT: ''
          });
        case 1:
          page = parseInt(query.page) || 1;
          limit = parseInt(query.limit) || 10;
          skip = (page - 1) * limit;
          whereCondition = {
            target_type: targetType,
            target_id: targetId,
            status: 'posted'
          };
          _context.n = 2;
          return _prisma["default"].$transaction([_prisma["default"].review.count({
            where: whereCondition
          }), _prisma["default"].review.findMany({
            where: whereCondition,
            include: {
              user: {
                select: {
                  full_name: true,
                  avatar_url: true
                }
              },
              review_images: true
            },
            skip: skip,
            take: limit,
            orderBy: {
              created_at: 'desc'
            }
          })]);
        case 2:
          _yield$prisma$$transa = _context.v;
          _yield$prisma$$transa2 = _slicedToArray(_yield$prisma$$transa, 2);
          total = _yield$prisma$$transa2[0];
          reviews = _yield$prisma$$transa2[1];
          return _context.a(2, {
            EM: 'Get reviews successful',
            EC: 0,
            DT: {
              totalRows: total,
              totalPages: Math.ceil(total / limit),
              reviews: reviews
            }
          });
        case 3:
          _context.p = 3;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 3]]);
  }));
  return function getReviewsByTarget(_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
}();
var createReview = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(userIdStr, data) {
    var userId, target_type, target_id, rating, comment, images, targetIdBig, newReview, _t2;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          target_type = data.target_type, target_id = data.target_id, rating = data.rating, comment = data.comment, images = data.images;
          if (!(!target_type || !target_id || !rating)) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Missing required fields',
            EC: 1,
            DT: ''
          });
        case 1:
          targetIdBig = (0, _prismaHelpers.toBigIntId)(target_id);
          _context3.n = 2;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(tx) {
              var review, imgData, allReviews, avgRating;
              return _regenerator().w(function (_context2) {
                while (1) switch (_context2.n) {
                  case 0:
                    _context2.n = 1;
                    return tx.review.create({
                      data: {
                        user_id: userId,
                        target_type: target_type,
                        target_id: targetIdBig,
                        rating: parseInt(rating),
                        comment: comment || null,
                        status: 'posted'
                      }
                    });
                  case 1:
                    review = _context2.v;
                    if (!(images && Array.isArray(images))) {
                      _context2.n = 2;
                      break;
                    }
                    imgData = images.map(function (url) {
                      return {
                        review_id: review.review_id,
                        image_url: url
                      };
                    });
                    _context2.n = 2;
                    return tx.reviewImage.createMany({
                      data: imgData
                    });
                  case 2:
                    _context2.n = 3;
                    return tx.review.findMany({
                      where: {
                        target_type: target_type,
                        target_id: targetIdBig,
                        status: 'posted'
                      },
                      select: {
                        rating: true
                      }
                    });
                  case 3:
                    allReviews = _context2.v;
                    avgRating = allReviews.reduce(function (acc, curr) {
                      return acc + curr.rating;
                    }, 0) / allReviews.length;
                    if (!(target_type === 'product')) {
                      _context2.n = 5;
                      break;
                    }
                    _context2.n = 4;
                    return tx.product.update({
                      where: {
                        product_id: targetIdBig
                      },
                      data: {
                        average_rating: avgRating
                      }
                    });
                  case 4:
                    _context2.n = 6;
                    break;
                  case 5:
                    if (!(target_type === 'service')) {
                      _context2.n = 6;
                      break;
                    }
                    _context2.n = 6;
                    return tx.clinicService.update({
                      where: {
                        service_id: targetIdBig
                      },
                      data: {
                        average_rating: avgRating
                      }
                    });
                  case 6:
                    return _context2.a(2, review);
                }
              }, _callee2);
            }));
            return function (_x6) {
              return _ref3.apply(this, arguments);
            };
          }());
        case 2:
          newReview = _context3.v;
          return _context3.a(2, {
            EM: 'Create review successful',
            EC: 0,
            DT: newReview
          });
        case 3:
          _context3.p = 3;
          _t2 = _context3.v;
          console.error(_t2);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 3]]);
  }));
  return function createReview(_x4, _x5) {
    return _ref2.apply(this, arguments);
  };
}();
var updateReviewStatus = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(id, status) {
    var reviewId, review, result, _t3;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          reviewId = (0, _prismaHelpers.toBigIntId)(id);
          if (reviewId) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, {
            EM: 'Invalid ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context5.n = 2;
          return _prisma["default"].review.findUnique({
            where: {
              review_id: reviewId
            }
          });
        case 2:
          review = _context5.v;
          if (review) {
            _context5.n = 3;
            break;
          }
          return _context5.a(2, {
            EM: 'Review not found',
            EC: -1,
            DT: ''
          });
        case 3:
          _context5.n = 4;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(tx) {
              var updated, allReviews, avgRating;
              return _regenerator().w(function (_context4) {
                while (1) switch (_context4.n) {
                  case 0:
                    _context4.n = 1;
                    return tx.review.update({
                      where: {
                        review_id: reviewId
                      },
                      data: {
                        status: status
                      }
                    });
                  case 1:
                    updated = _context4.v;
                    _context4.n = 2;
                    return tx.review.findMany({
                      where: {
                        target_type: review.target_type,
                        target_id: review.target_id,
                        status: 'posted'
                      },
                      select: {
                        rating: true
                      }
                    });
                  case 2:
                    allReviews = _context4.v;
                    avgRating = allReviews.length > 0 ? allReviews.reduce(function (acc, curr) {
                      return acc + curr.rating;
                    }, 0) / allReviews.length : 0;
                    if (!(review.target_type === 'product')) {
                      _context4.n = 4;
                      break;
                    }
                    _context4.n = 3;
                    return tx.product.update({
                      where: {
                        product_id: review.target_id
                      },
                      data: {
                        average_rating: avgRating
                      }
                    });
                  case 3:
                    _context4.n = 5;
                    break;
                  case 4:
                    if (!(review.target_type === 'service')) {
                      _context4.n = 5;
                      break;
                    }
                    _context4.n = 5;
                    return tx.clinicService.update({
                      where: {
                        service_id: review.target_id
                      },
                      data: {
                        average_rating: avgRating
                      }
                    });
                  case 5:
                    return _context4.a(2, updated);
                }
              }, _callee4);
            }));
            return function (_x9) {
              return _ref5.apply(this, arguments);
            };
          }());
        case 4:
          result = _context5.v;
          return _context5.a(2, {
            EM: 'Update review status successful',
            EC: 0,
            DT: result
          });
        case 5:
          _context5.p = 5;
          _t3 = _context5.v;
          console.error(_t3);
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 5]]);
  }));
  return function updateReviewStatus(_x7, _x8) {
    return _ref4.apply(this, arguments);
  };
}();
module.exports = {
  getReviewsByTarget: getReviewsByTarget,
  createReview: createReview,
  updateReviewStatus: updateReviewStatus
};