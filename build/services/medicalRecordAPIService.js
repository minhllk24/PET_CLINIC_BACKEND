"use strict";

var _prisma = _interopRequireDefault(require("../configs/prisma"));
var _prismaHelpers = require("../utils/prismaHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
var getRecordsByPet = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(petIdStr, user) {
    var petId, pet, records, _t;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          _context.p = 0;
          petId = (0, _prismaHelpers.toBigIntId)(petIdStr);
          if (petId) {
            _context.n = 1;
            break;
          }
          return _context.a(2, {
            EM: 'Invalid pet ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context.n = 2;
          return _prisma["default"].pet.findUnique({
            where: {
              pet_id: petId
            }
          });
        case 2:
          pet = _context.v;
          if (pet) {
            _context.n = 3;
            break;
          }
          return _context.a(2, {
            EM: 'Pet not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(user.role_code === 'CUSTOMER' && user.user_id !== pet.owner_user_id.toString())) {
            _context.n = 4;
            break;
          }
          return _context.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 4:
          _context.n = 5;
          return _prisma["default"].medicalRecord.findMany({
            where: {
              pet_id: petId
            },
            include: {
              doctor: {
                select: {
                  full_name: true
                }
              },
              attachments: true
            },
            orderBy: {
              visit_date: 'desc'
            }
          });
        case 5:
          records = _context.v;
          return _context.a(2, {
            EM: 'Get medical records successful',
            EC: 0,
            DT: records
          });
        case 6:
          _context.p = 6;
          _t = _context.v;
          console.error(_t);
          return _context.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee, null, [[0, 6]]);
  }));
  return function getRecordsByPet(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();
var getRecordById = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(id, user) {
    var recordId, record, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          recordId = (0, _prismaHelpers.toBigIntId)(id);
          if (recordId) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Invalid record ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context2.n = 2;
          return _prisma["default"].medicalRecord.findUnique({
            where: {
              record_id: recordId
            },
            include: {
              doctor: {
                select: {
                  full_name: true
                }
              },
              pet: {
                select: {
                  owner_user_id: true
                }
              },
              attachments: true
            }
          });
        case 2:
          record = _context2.v;
          if (record) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'Record not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(user.role_code === 'CUSTOMER' && user.user_id !== record.pet.owner_user_id.toString())) {
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
            EM: 'Get record successful',
            EC: 0,
            DT: record
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
  return function getRecordById(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();
var createRecord = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(data, user) {
    var petId, pet, sourceType, doctorId, newRecord, attData, fileAttData, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          if (data.pet_id) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Missing pet_id',
            EC: 1,
            DT: ''
          });
        case 1:
          petId = (0, _prismaHelpers.toBigIntId)(data.pet_id);
          _context3.n = 2;
          return _prisma["default"].pet.findUnique({
            where: {
              pet_id: petId
            }
          });
        case 2:
          pet = _context3.v;
          if (pet) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, {
            EM: 'Pet not found',
            EC: -1,
            DT: ''
          });
        case 3:
          sourceType = 'doctor_created';
          doctorId = null;
          if (!(user.role_code === 'CUSTOMER')) {
            _context3.n = 5;
            break;
          }
          if (!(user.user_id !== pet.owner_user_id.toString())) {
            _context3.n = 4;
            break;
          }
          return _context3.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 4:
          sourceType = 'user_uploaded';
          _context3.n = 6;
          break;
        case 5:
          doctorId = (0, _prismaHelpers.toBigIntId)(user.user_id);
        case 6:
          _context3.n = 7;
          return _prisma["default"].medicalRecord.create({
            data: {
              pet_id: petId,
              doctor_id: doctorId || (data.doctor_id ? (0, _prismaHelpers.toBigIntId)(data.doctor_id) : null),
              appointment_id: data.appointment_id ? (0, _prismaHelpers.toBigIntId)(data.appointment_id) : null,
              record_name: data.record_name || 'Hồ sơ bệnh án mới',
              visit_date: data.visit_date ? new Date(data.visit_date) : new Date(),
              symptoms: data.symptoms || null,
              diagnosis: data.diagnosis || null,
              treatment_note: data.treatment_note || null,
              created_by_user_id: (0, _prismaHelpers.toBigIntId)(user.user_id),
              source_type: sourceType
            }
          });
        case 7:
          newRecord = _context3.v;
          // Add attachments if provided
          attData = [];
          if (data.attachments && Array.isArray(data.attachments)) {
            attData = data.attachments.map(function (att) {
              return {
                record_id: newRecord.record_id,
                file_url: att.file_url,
                file_type: att.file_type || 'image',
                file_name: att.file_name || 'Attachment'
              };
            });
          }

          // Add uploaded files from multer
          if (data.files && Array.isArray(data.files)) {
            fileAttData = data.files.map(function (file) {
              return {
                record_id: newRecord.record_id,
                file_url: "/uploads/".concat(file.filename),
                file_type: file.mimetype.startsWith('image/') ? 'image' : 'document',
                file_name: file.originalname
              };
            });
            attData = [].concat(_toConsumableArray(attData), _toConsumableArray(fileAttData));
          }
          if (!(attData.length > 0)) {
            _context3.n = 8;
            break;
          }
          _context3.n = 8;
          return _prisma["default"].medicalRecordAttachment.createMany({
            data: attData
          });
        case 8:
          return _context3.a(2, {
            EM: 'Create record successful',
            EC: 0,
            DT: newRecord
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
  return function createRecord(_x5, _x6) {
    return _ref3.apply(this, arguments);
  };
}();
var updateRecord = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(id, data, user) {
    var recordId, record, updatedRecord, fileAttData, _t4;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          _context4.p = 0;
          recordId = (0, _prismaHelpers.toBigIntId)(id);
          if (recordId) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, {
            EM: 'Invalid record ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context4.n = 2;
          return _prisma["default"].medicalRecord.findUnique({
            where: {
              record_id: recordId
            },
            include: {
              pet: true
            }
          });
        case 2:
          record = _context4.v;
          if (record) {
            _context4.n = 3;
            break;
          }
          return _context4.a(2, {
            EM: 'Record not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(user.role_code === 'CUSTOMER')) {
            _context4.n = 5;
            break;
          }
          if (!(record.source_type !== 'user_uploaded' || user.user_id !== record.pet.owner_user_id.toString())) {
            _context4.n = 4;
            break;
          }
          return _context4.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 4:
          _context4.n = 6;
          break;
        case 5:
          if (!(record.source_type === 'doctor_created' && record.doctor_id && record.doctor_id.toString() !== user.user_id && user.role_code !== 'ADMIN')) {
            _context4.n = 6;
            break;
          }
          return _context4.a(2, {
            EM: 'Permission denied, only the creator doctor can edit',
            EC: -1,
            DT: ''
          });
        case 6:
          _context4.n = 7;
          return _prisma["default"].medicalRecord.update({
            where: {
              record_id: recordId
            },
            data: {
              record_name: data.record_name !== undefined ? data.record_name : record.record_name,
              symptoms: data.symptoms !== undefined ? data.symptoms : record.symptoms,
              diagnosis: data.diagnosis !== undefined ? data.diagnosis : record.diagnosis,
              treatment_note: data.treatment_note !== undefined ? data.treatment_note : record.treatment_note,
              visit_date: data.visit_date ? new Date(data.visit_date) : record.visit_date,
              doctor_id: data.doctor_id !== undefined ? data.doctor_id ? (0, _prismaHelpers.toBigIntId)(data.doctor_id) : null : record.doctor_id
            }
          });
        case 7:
          updatedRecord = _context4.v;
          if (!(data.files && Array.isArray(data.files))) {
            _context4.n = 8;
            break;
          }
          fileAttData = data.files.map(function (file) {
            return {
              record_id: recordId,
              file_url: "/uploads/".concat(file.filename),
              file_type: file.mimetype.startsWith('image/') ? 'image' : 'document',
              file_name: file.originalname
            };
          });
          _context4.n = 8;
          return _prisma["default"].medicalRecordAttachment.createMany({
            data: fileAttData
          });
        case 8:
          return _context4.a(2, {
            EM: 'Update record successful',
            EC: 0,
            DT: updatedRecord
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
  return function updateRecord(_x7, _x8, _x9) {
    return _ref4.apply(this, arguments);
  };
}();
var deleteRecord = /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(id, user) {
    var recordId, record, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          recordId = (0, _prismaHelpers.toBigIntId)(id);
          if (recordId) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, {
            EM: 'Invalid record ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context5.n = 2;
          return _prisma["default"].medicalRecord.findUnique({
            where: {
              record_id: recordId
            },
            include: {
              pet: true
            }
          });
        case 2:
          record = _context5.v;
          if (record) {
            _context5.n = 3;
            break;
          }
          return _context5.a(2, {
            EM: 'Record not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(user.role_code === 'CUSTOMER')) {
            _context5.n = 4;
            break;
          }
          if (!(record.source_type !== 'user_uploaded' || user.user_id !== record.pet.owner_user_id.toString())) {
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
          return _prisma["default"].medicalRecord["delete"]({
            where: {
              record_id: recordId
            }
          });
        case 5:
          return _context5.a(2, {
            EM: 'Delete record successful',
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
  return function deleteRecord(_x0, _x1) {
    return _ref5.apply(this, arguments);
  };
}();
module.exports = {
  getRecordsByPet: getRecordsByPet,
  getRecordById: getRecordById,
  createRecord: createRecord,
  updateRecord: updateRecord,
  deleteRecord: deleteRecord
};