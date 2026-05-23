"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var getMyPets = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(userIdStr) {
    var userId, pets, formattedPets, _t;
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
          return _prisma["default"].pet.findMany({
            where: {
              owner_user_id: userId,
              status: 'active'
            },
            include: {
              species: true,
              breed: true,
              pet_images: {
                where: {
                  is_primary: true
                }
              },
              medical_records: {
                orderBy: {
                  visit_date: 'desc'
                },
                take: 1,
                select: {
                  visit_date: true
                }
              }
            },
            orderBy: {
              created_at: 'desc'
            }
          });
        case 2:
          pets = _context.v;
          // Format latest_exam_date
          formattedPets = pets.map(function (pet) {
            return _objectSpread(_objectSpread({}, pet), {}, {
              latest_exam_date: pet.medical_records.length > 0 ? pet.medical_records[0].visit_date : null,
              medical_records: undefined // hide raw array
            });
          });
          return _context.a(2, {
            EM: 'Get my pets successful',
            EC: 0,
            DT: formattedPets
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
  return function getMyPets(_x) {
    return _ref.apply(this, arguments);
  };
}();
var getPetById = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(id, currentUser) {
    var petId, pet, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          petId = (0, _prismaHelpers.toBigIntId)(id);
          if (petId) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Invalid pet ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context2.n = 2;
          return _prisma["default"].pet.findUnique({
            where: {
              pet_id: petId
            },
            include: {
              species: true,
              breed: true,
              pet_images: true
            }
          });
        case 2:
          pet = _context2.v;
          if (pet) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'Pet not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(currentUser.role_code !== 'ADMIN' && currentUser.user_id !== pet.owner_user_id.toString())) {
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
            EM: 'Get pet successful',
            EC: 0,
            DT: pet
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
  return function getPetById(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
}();
var createPet = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(userIdStr, data) {
    var userId, speciesId, breedId, newPet, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
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
          if (!(!data.pet_name || !data.species_id)) {
            _context3.n = 2;
            break;
          }
          return _context3.a(2, {
            EM: 'Missing pet_name or species_id',
            EC: 1,
            DT: ''
          });
        case 2:
          speciesId = (0, _prismaHelpers.toBigIntId)(data.species_id);
          breedId = data.breed_id ? (0, _prismaHelpers.toBigIntId)(data.breed_id) : null;
          _context3.n = 3;
          return _prisma["default"].pet.create({
            data: {
              owner_user_id: userId,
              pet_name: data.pet_name,
              species_id: speciesId,
              breed_id: breedId,
              gender: data.gender || 'unknown',
              birth_date: data.birth_date ? new Date(data.birth_date) : null,
              weight_kg: data.weight_kg ? parseFloat(data.weight_kg) : null,
              profile_image_url: data.profile_image_url || null,
              health_status: data.health_status || 'unknown',
              medical_note: data.medical_note || null
            }
          });
        case 3:
          newPet = _context3.v;
          return _context3.a(2, {
            EM: 'Create pet successful',
            EC: 0,
            DT: newPet
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
  return function createPet(_x4, _x5) {
    return _ref3.apply(this, arguments);
  };
}();
var updatePet = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(id, data, currentUser) {
    var petId, existingPet, updateData, updatedPet, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          petId = (0, _prismaHelpers.toBigIntId)(id);
          if (petId) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid pet ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].pet.findUnique({
            where: {
              pet_id: petId
            }
          });
        case 2:
          existingPet = _context4.v;
          if (existingPet) {
            _context4.n = 3;
            break;
          }
          return _context4.a(2, {
            EM: 'Pet not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(currentUser.role_code !== 'ADMIN' && currentUser.user_id !== existingPet.owner_user_id.toString())) {
            _context4.n = 4;
            break;
          }
          return _context4.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 4:
          updateData = {};
          if (data.pet_name) updateData.pet_name = data.pet_name;
          if (data.species_id) updateData.species_id = (0, _prismaHelpers.toBigIntId)(data.species_id);
          if (data.breed_id) updateData.breed_id = (0, _prismaHelpers.toBigIntId)(data.breed_id);
          if (data.gender) updateData.gender = data.gender;
          if (data.birth_date) updateData.birth_date = new Date(data.birth_date);
          if (data.weight_kg) updateData.weight_kg = parseFloat(data.weight_kg);
          if (data.profile_image_url) updateData.profile_image_url = data.profile_image_url;
          if (data.health_status) updateData.health_status = data.health_status;
          if (data.medical_note !== undefined) updateData.medical_note = data.medical_note;
          if (data.status && currentUser.role_code === 'ADMIN') updateData.status = data.status;
          _context4.n = 5;
          return _prisma["default"].pet.update({
            where: {
              pet_id: petId
            },
            data: updateData
          });
        case 5:
          updatedPet = _context4.v;
          return _context4.a(2, {
            EM: 'Update pet successful',
            EC: 0,
            DT: updatedPet
          });
        case 6:
          _context4.p = 6;
          _t4 = _context4.v;
          console.error(_t4);
          return _context4.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee4, null, [[0, 6]]);
  }));
  return function updatePet(_x6, _x7, _x8) {
    return _ref4.apply(this, arguments);
  };
}();
var deletePet = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(id, currentUser) {
    var petId, existingPet, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          petId = (0, _prismaHelpers.toBigIntId)(id);
          if (petId) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, {
            EM: 'Invalid pet ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context5.n = 2;
          return _prisma["default"].pet.findUnique({
            where: {
              pet_id: petId
            }
          });
        case 2:
          existingPet = _context5.v;
          if (existingPet) {
            _context5.n = 3;
            break;
          }
          return _context5.a(2, {
            EM: 'Pet not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(currentUser.role_code !== 'ADMIN' && currentUser.user_id !== existingPet.owner_user_id.toString())) {
            _context5.n = 4;
            break;
          }
          return _context5.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 4:
          _context5.n = 5;
          return _prisma["default"].pet.update({
            where: {
              pet_id: petId
            },
            data: {
              status: 'deleted'
            }
          });
        case 5:
          return _context5.a(2, {
            EM: 'Delete pet successful',
            EC: 0,
            DT: ''
          });
        case 6:
          _context5.p = 6;
          _t5 = _context5.v;
          console.error(_t5);
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 6]]);
  }));
  return function deletePet(_x9, _x0) {
    return _ref5.apply(this, arguments);
  };
}();
var getSpecies = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6() {
    var species, _t6;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.p = _context6.n) {
        case 0:
          _context6.p = 0;
          _context6.n = 1;
          return _prisma["default"].petSpecies.findMany({
            where: {
              status: 'active'
            }
          });
        case 1:
          species = _context6.v;
          return _context6.a(2, {
            EM: 'Get species successful',
            EC: 0,
            DT: species
          });
        case 2:
          _context6.p = 2;
          _t6 = _context6.v;
          console.error(_t6);
          return _context6.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee6, null, [[0, 2]]);
  }));
  return function getSpecies() {
    return _ref6.apply(this, arguments);
  };
}();
var getBreedsBySpecies = /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(speciesIdStr) {
    var speciesId, breeds, _t7;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          _context7.p = 0;
          speciesId = (0, _prismaHelpers.toBigIntId)(speciesIdStr);
          if (speciesId) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2, {
            EM: 'Invalid species ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context7.n = 2;
          return _prisma["default"].petBreed.findMany({
            where: {
              species_id: speciesId
            }
          });
        case 2:
          breeds = _context7.v;
          return _context7.a(2, {
            EM: 'Get breeds successful',
            EC: 0,
            DT: breeds
          });
        case 3:
          _context7.p = 3;
          _t7 = _context7.v;
          console.error(_t7);
          return _context7.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee7, null, [[0, 3]]);
  }));
  return function getBreedsBySpecies(_x1) {
    return _ref7.apply(this, arguments);
  };
}();
module.exports = {
  getMyPets: getMyPets,
  getPetById: getPetById,
  createPet: createPet,
  updatePet: updatePet,
  deletePet: deletePet,
  getSpecies: getSpecies,
  getBreedsBySpecies: getBreedsBySpecies
};