"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// --- RESCUE STATIONS & POSTS ---
var getStations = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
    var stations, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          _context.n = 1;
          return _prisma["default"].rescueStation.findMany({
            where: {
              status: 'active'
            }
          });
        case 1:
          stations = _context.v;
          return _context.a(2, {
            EM: 'Get stations successful',
            EC: 0,
            DT: stations
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
  return function getStations() {
    return _ref.apply(this, arguments);
  };
}();
var getRescuePosts = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
    var posts, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          _context2.n = 1;
          return _prisma["default"].rescuePost.findMany({
            where: {
              status: 'published'
            },
            include: {
              station: true
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 1:
          posts = _context2.v;
          return _context2.a(2, {
            EM: 'Get rescue posts successful',
            EC: 0,
            DT: posts
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
  return function getRescuePosts() {
    return _ref2.apply(this, arguments);
  };
}();

// --- ADOPTION ---
var getAdoptionPets = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3() {
    var pets, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          _context3.n = 1;
          return _prisma["default"].adoptionPet.findMany({
            where: {
              status: 'available'
            },
            include: {
              station: true,
              adoption_pet_images: true
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 1:
          pets = _context3.v;
          return _context3.a(2, {
            EM: 'Get adoption pets successful',
            EC: 0,
            DT: pets
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
  return function getAdoptionPets() {
    return _ref3.apply(this, arguments);
  };
}();
var createAdoptionRequest = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(userIdStr, data) {
    var userId, adoptionPetId, pet, pendingRequests, existingReq, newReq, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          adoptionPetId = (0, _prismaHelpers.toBigIntId)(data.adoption_pet_id);
          if (adoptionPetId) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Missing adoption_pet_id',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].adoptionPet.findUnique({
            where: {
              adoption_pet_id: adoptionPetId
            }
          });
        case 2:
          pet = _context4.v;
          if (!(!pet || pet.status !== 'available')) {
            _context4.n = 3;
            break;
          }
          return _context4.a(2, {
            EM: 'Pet is not available for adoption',
            EC: -1,
            DT: ''
          });
        case 3:
          _context4.n = 4;
          return _prisma["default"].adoptionRequest.count({
            where: {
              user_id: userId,
              status: 'pending'
            }
          });
        case 4:
          pendingRequests = _context4.v;
          if (!(pendingRequests >= 3)) {
            _context4.n = 5;
            break;
          }
          return _context4.a(2, {
            EM: 'You can only have maximum 3 pending requests',
            EC: -1,
            DT: ''
          });
        case 5:
          _context4.n = 6;
          return _prisma["default"].adoptionRequest.findFirst({
            where: {
              user_id: userId,
              adoption_pet_id: adoptionPetId,
              status: 'pending'
            }
          });
        case 6:
          existingReq = _context4.v;
          if (!existingReq) {
            _context4.n = 7;
            break;
          }
          return _context4.a(2, {
            EM: 'You already sent a request for this pet',
            EC: -1,
            DT: ''
          });
        case 7:
          _context4.n = 8;
          return _prisma["default"].adoptionRequest.create({
            data: {
              adoption_pet_id: adoptionPetId,
              user_id: userId,
              status: 'pending',
              message: data.message || null
            }
          });
        case 8:
          newReq = _context4.v;
          return _context4.a(2, {
            EM: 'Create adoption request successful',
            EC: 0,
            DT: newReq
          });
        case 9:
          _context4.p = 9;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 9]]);
  }));
  return function createAdoptionRequest(_x, _x2) {
    return _ref4.apply(this, arguments);
  };
}();
var getMyAdoptionRequests = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(userIdStr) {
    var userId, requests, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          _context5.n = 1;
          return _prisma["default"].adoptionRequest.findMany({
            where: {
              user_id: userId
            },
            include: {
              adoption_pet: {
                include: {
                  adoption_pet_images: true
                }
              }
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 1:
          requests = _context5.v;
          return _context5.a(2, {
            EM: 'Get requests successful',
            EC: 0,
            DT: requests
          });
        case 2:
          _context5.p = 2;
          _t5 = _context5.v;
          console.error(_t5);
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 2]]);
  }));
  return function getMyAdoptionRequests(_x3) {
    return _ref5.apply(this, arguments);
  };
}();
var updateAdoptionRequestStatus = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(id, status) {
    var reqId, validStatuses, adoptionReq, result, _t6;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          _context7.p = 0;
          reqId = (0, _prismaHelpers.toBigIntId)(id);
          if (reqId) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2, {
            EM: 'Invalid request ID',
            EC: 1,
            DT: ''
          });
        case 1:
          validStatuses = ['pending', 'approved', 'rejected'];
          if (validStatuses.includes(status)) {
            _context7.n = 2;
            break;
          }
          return _context7.a(2, {
            EM: 'Invalid status',
            EC: 1,
            DT: ''
          });
        case 2:
          _context7.n = 3;
          return _prisma["default"].adoptionRequest.findUnique({
            where: {
              request_id: reqId
            }
          });
        case 3:
          adoptionReq = _context7.v;
          if (adoptionReq) {
            _context7.n = 4;
            break;
          }
          return _context7.a(2, {
            EM: 'Request not found',
            EC: -1,
            DT: ''
          });
        case 4:
          _context7.n = 5;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(tx) {
              var updatedReq;
              return _regenerator().w(function (_context6) {
                while (1) switch (_context6.n) {
                  case 0:
                    _context6.n = 1;
                    return tx.adoptionRequest.update({
                      where: {
                        request_id: reqId
                      },
                      data: {
                        status: status
                      }
                    });
                  case 1:
                    updatedReq = _context6.v;
                    if (!(status === 'approved')) {
                      _context6.n = 3;
                      break;
                    }
                    _context6.n = 2;
                    return tx.adoptionPet.update({
                      where: {
                        adoption_pet_id: adoptionReq.adoption_pet_id
                      },
                      data: {
                        status: 'adopted'
                      }
                    });
                  case 2:
                    _context6.n = 3;
                    return tx.adoptionRequest.updateMany({
                      where: {
                        adoption_pet_id: adoptionReq.adoption_pet_id,
                        status: 'pending'
                      },
                      data: {
                        status: 'rejected'
                      }
                    });
                  case 3:
                    return _context6.a(2, updatedReq);
                }
              }, _callee6);
            }));
            return function (_x6) {
              return _ref7.apply(this, arguments);
            };
          }());
        case 5:
          result = _context7.v;
          return _context7.a(2, {
            EM: 'Update status successful',
            EC: 0,
            DT: result
          });
        case 6:
          _context7.p = 6;
          _t6 = _context7.v;
          console.error(_t6);
          return _context7.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee7, null, [[0, 6]]);
  }));
  return function updateAdoptionRequestStatus(_x4, _x5) {
    return _ref6.apply(this, arguments);
  };
}();
module.exports = {
  getStations: getStations,
  getRescuePosts: getRescuePosts,
  getAdoptionPets: getAdoptionPets,
  createAdoptionRequest: createAdoptionRequest,
  getMyAdoptionRequests: getMyAdoptionRequests,
  updateAdoptionRequestStatus: updateAdoptionRequestStatus
};