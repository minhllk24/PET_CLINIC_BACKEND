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
var getMyHistory = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(userIdStr) {
    var userId, appointments, _t;
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
          return _prisma["default"].appointment.findMany({
            where: {
              user_id: userId
            },
            include: {
              doctor: {
                select: {
                  full_name: true
                }
              },
              pet: {
                select: {
                  pet_name: true,
                  species: true
                }
              },
              appointment_services: {
                include: {
                  service: {
                    select: {
                      service_name: true
                    }
                  }
                }
              }
            },
            orderBy: [{
              appointment_date: 'desc'
            }, {
              start_time: 'desc'
            }]
          });
        case 2:
          appointments = _context.v;
          return _context.a(2, {
            EM: 'Get history successful',
            EC: 0,
            DT: appointments
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
  return function getMyHistory(_x) {
    return _ref.apply(this, arguments);
  };
}();
var getAppointmentById = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(id, currentUser) {
    var appointmentId, appointment, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _context2.p = 0;
          appointmentId = (0, _prismaHelpers.toBigIntId)(id);
          if (appointmentId) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, {
            EM: 'Invalid appointment ID',
            EC: 1,
            DT: ''
          });
        case 1:
          _context2.n = 2;
          return _prisma["default"].appointment.findUnique({
            where: {
              appointment_id: appointmentId
            },
            include: {
              doctor: {
                select: {
                  full_name: true
                }
              },
              pet: {
                select: {
                  pet_name: true
                }
              },
              appointment_services: {
                include: {
                  service: true
                }
              },
              appointment_status_history: true
            }
          });
        case 2:
          appointment = _context2.v;
          if (appointment) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            EM: 'Appointment not found',
            EC: -1,
            DT: ''
          });
        case 3:
          if (!(currentUser.role_code === 'CUSTOMER' && currentUser.user_id !== appointment.user_id.toString())) {
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
            EM: 'Get appointment successful',
            EC: 0,
            DT: appointment
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
  return function getAppointmentById(_x2, _x3) {
    return _ref2.apply(this, arguments);
  };
}();
var getAvailableSlots = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(query) {
    var date, doctor_id, branch_id, whereCondition, slots, _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _context3.p = 0;
          date = query.date, doctor_id = query.doctor_id, branch_id = query.branch_id;
          if (date) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, {
            EM: 'Missing date',
            EC: 1,
            DT: ''
          });
        case 1:
          whereCondition = {
            slot_date: new Date(date),
            status: 'available'
          };
          if (doctor_id) whereCondition.doctor_id = (0, _prismaHelpers.toBigIntId)(doctor_id);
          if (branch_id) whereCondition.branch_id = (0, _prismaHelpers.toBigIntId)(branch_id);
          _context3.n = 2;
          return _prisma["default"].clinicSlot.findMany({
            where: whereCondition,
            include: {
              doctor: {
                select: {
                  full_name: true
                }
              }
            },
            orderBy: {
              start_time: 'asc'
            }
          });
        case 2:
          slots = _context3.v;
          return _context3.a(2, {
            EM: 'Get slots successful',
            EC: 0,
            DT: slots
          });
        case 3:
          _context3.p = 3;
          _t3 = _context3.v;
          console.error(_t3);
          return _context3.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee3, null, [[0, 3]]);
  }));
  return function getAvailableSlots(_x4) {
    return _ref3.apply(this, arguments);
  };
}();
var createAppointment = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(userIdStr, data) {
    var userId, slot_id, pet_id, service_ids, reason, slotIdBig, petIdBig, result, _t5;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          _context5.p = 0;
          userId = (0, _prismaHelpers.toBigIntId)(userIdStr);
          slot_id = data.slot_id, pet_id = data.pet_id, service_ids = data.service_ids, reason = data.reason;
          if (!(!slot_id || !service_ids || !Array.isArray(service_ids) || service_ids.length === 0)) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, {
            EM: 'Missing slot_id or service_ids',
            EC: 1,
            DT: ''
          });
        case 1:
          slotIdBig = (0, _prismaHelpers.toBigIntId)(slot_id);
          petIdBig = pet_id ? (0, _prismaHelpers.toBigIntId)(pet_id) : null; // We must use transaction to ensure slot availability
          _context5.n = 2;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(tx) {
              var slot, newBookedCount, newStatus, snapshot_pet_name, snapshot_species, pet, _pet$species, totalEstimatedPrice, services, _iterator, _step, s, newAppointment, _iterator2, _step2, _s, _t4;
              return _regenerator().w(function (_context4) {
                while (1) switch (_context4.p = _context4.n) {
                  case 0:
                    _context4.n = 1;
                    return tx.clinicSlot.findUnique({
                      where: {
                        slot_id: slotIdBig
                      }
                    });
                  case 1:
                    slot = _context4.v;
                    if (slot) {
                      _context4.n = 2;
                      break;
                    }
                    throw new Error('Slot not found');
                  case 2:
                    if (!(slot.status !== 'available' || slot.booked_count >= slot.max_capacity)) {
                      _context4.n = 3;
                      break;
                    }
                    throw new Error('Slot is fully booked or unavailable');
                  case 3:
                    // 2. Increase booked count
                    newBookedCount = slot.booked_count + 1;
                    newStatus = slot.status;
                    if (newBookedCount >= slot.max_capacity) {
                      newStatus = 'full';
                    }
                    _context4.n = 4;
                    return tx.clinicSlot.update({
                      where: {
                        slot_id: slotIdBig
                      },
                      data: {
                        booked_count: newBookedCount,
                        status: newStatus
                      }
                    });
                  case 4:
                    // 3. Get pet info if any
                    snapshot_pet_name = null;
                    snapshot_species = null;
                    if (!petIdBig) {
                      _context4.n = 6;
                      break;
                    }
                    _context4.n = 5;
                    return tx.pet.findUnique({
                      where: {
                        pet_id: petIdBig
                      },
                      include: {
                        species: true
                      }
                    });
                  case 5:
                    pet = _context4.v;
                    if (pet) {
                      snapshot_pet_name = pet.pet_name;
                      snapshot_species = ((_pet$species = pet.species) === null || _pet$species === void 0 ? void 0 : _pet$species.species_name) || null;
                    }
                  case 6:
                    // 4. Calculate total estimated price from services
                    totalEstimatedPrice = 0;
                    _context4.n = 7;
                    return tx.clinicService.findMany({
                      where: {
                        service_id: {
                          "in": service_ids.map(function (id) {
                            return (0, _prismaHelpers.toBigIntId)(id);
                          })
                        }
                      }
                    });
                  case 7:
                    services = _context4.v;
                    _iterator = _createForOfIteratorHelper(services);
                    try {
                      for (_iterator.s(); !(_step = _iterator.n()).done;) {
                        s = _step.value;
                        totalEstimatedPrice += parseFloat(s.base_price);
                      }

                      // 5. Create appointment
                    } catch (err) {
                      _iterator.e(err);
                    } finally {
                      _iterator.f();
                    }
                    _context4.n = 8;
                    return tx.appointment.create({
                      data: {
                        user_id: userId,
                        pet_id: petIdBig,
                        doctor_id: slot.doctor_id,
                        branch_id: slot.branch_id,
                        appointment_date: slot.slot_date,
                        start_time: slot.start_time,
                        end_time: slot.end_time,
                        status: 'pending',
                        reason: reason || null,
                        snapshot_pet_name: snapshot_pet_name,
                        snapshot_species: snapshot_species,
                        total_estimated_price: totalEstimatedPrice
                      }
                    });
                  case 8:
                    newAppointment = _context4.v;
                    // 6. Create appointment_services
                    _iterator2 = _createForOfIteratorHelper(services);
                    _context4.p = 9;
                    _iterator2.s();
                  case 10:
                    if ((_step2 = _iterator2.n()).done) {
                      _context4.n = 12;
                      break;
                    }
                    _s = _step2.value;
                    _context4.n = 11;
                    return tx.appointmentService.create({
                      data: {
                        appointment_id: newAppointment.appointment_id,
                        service_id: _s.service_id,
                        price_at_booking: _s.base_price
                      }
                    });
                  case 11:
                    _context4.n = 10;
                    break;
                  case 12:
                    _context4.n = 14;
                    break;
                  case 13:
                    _context4.p = 13;
                    _t4 = _context4.v;
                    _iterator2.e(_t4);
                  case 14:
                    _context4.p = 14;
                    _iterator2.f();
                    return _context4.f(14);
                  case 15:
                    _context4.n = 16;
                    return tx.appointmentStatusHistory.create({
                      data: {
                        appointment_id: newAppointment.appointment_id,
                        status_from: null,
                        status_to: 'pending',
                        changed_by: userId,
                        note: 'Created by user'
                      }
                    });
                  case 16:
                    return _context4.a(2, newAppointment);
                }
              }, _callee4, null, [[9, 13, 14, 15]]);
            }));
            return function (_x7) {
              return _ref5.apply(this, arguments);
            };
          }());
        case 2:
          result = _context5.v;
          return _context5.a(2, {
            EM: 'Create appointment successful',
            EC: 0,
            DT: result
          });
        case 3:
          _context5.p = 3;
          _t5 = _context5.v;
          console.error(_t5);
          if (!(_t5.message === 'Slot is fully booked or unavailable')) {
            _context5.n = 4;
            break;
          }
          return _context5.a(2, {
            EM: _t5.message,
            EC: 2,
            DT: ''
          });
        case 4:
          return _context5.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee5, null, [[0, 3]]);
  }));
  return function createAppointment(_x5, _x6) {
    return _ref4.apply(this, arguments);
  };
}();
var updateAppointmentStatus = /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(id, status, user) {
    var note,
      appointmentId,
      validStatuses,
      appointment,
      result,
      _args7 = arguments,
      _t6;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          note = _args7.length > 3 && _args7[3] !== undefined ? _args7[3] : '';
          _context7.p = 1;
          appointmentId = (0, _prismaHelpers.toBigIntId)(id);
          if (appointmentId) {
            _context7.n = 2;
            break;
          }
          return _context7.a(2, {
            EM: 'Invalid ID',
            EC: 1,
            DT: ''
          });
        case 2:
          validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
          if (validStatuses.includes(status)) {
            _context7.n = 3;
            break;
          }
          return _context7.a(2, {
            EM: 'Invalid status',
            EC: 1,
            DT: ''
          });
        case 3:
          _context7.n = 4;
          return _prisma["default"].appointment.findUnique({
            where: {
              appointment_id: appointmentId
            }
          });
        case 4:
          appointment = _context7.v;
          if (appointment) {
            _context7.n = 5;
            break;
          }
          return _context7.a(2, {
            EM: 'Appointment not found',
            EC: -1,
            DT: ''
          });
        case 5:
          if (!(user.role_code === 'CUSTOMER' && status !== 'cancelled')) {
            _context7.n = 6;
            break;
          }
          return _context7.a(2, {
            EM: 'Customers can only cancel appointments',
            EC: -1,
            DT: ''
          });
        case 6:
          if (!(user.role_code === 'CUSTOMER' && user.user_id !== appointment.user_id.toString())) {
            _context7.n = 7;
            break;
          }
          return _context7.a(2, {
            EM: 'Permission denied',
            EC: -1,
            DT: ''
          });
        case 7:
          _context7.n = 8;
          return _prisma["default"].$transaction(/*#__PURE__*/function () {
            var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(tx) {
              var slot, newBookedCount, updated;
              return _regenerator().w(function (_context6) {
                while (1) switch (_context6.n) {
                  case 0:
                    if (!(status === 'cancelled' && appointment.status !== 'cancelled')) {
                      _context6.n = 2;
                      break;
                    }
                    _context6.n = 1;
                    return tx.clinicSlot.findFirst({
                      where: {
                        doctor_id: appointment.doctor_id,
                        slot_date: appointment.appointment_date,
                        start_time: appointment.start_time
                      }
                    });
                  case 1:
                    slot = _context6.v;
                    if (!slot) {
                      _context6.n = 2;
                      break;
                    }
                    newBookedCount = Math.max(0, slot.booked_count - 1);
                    _context6.n = 2;
                    return tx.clinicSlot.update({
                      where: {
                        slot_id: slot.slot_id
                      },
                      data: {
                        booked_count: newBookedCount,
                        status: newBookedCount < slot.max_capacity ? 'available' : slot.status
                      }
                    });
                  case 2:
                    _context6.n = 3;
                    return tx.appointment.update({
                      where: {
                        appointment_id: appointmentId
                      },
                      data: {
                        status: status
                      }
                    });
                  case 3:
                    updated = _context6.v;
                    _context6.n = 4;
                    return tx.appointmentStatusHistory.create({
                      data: {
                        appointment_id: appointmentId,
                        status_from: appointment.status,
                        status_to: status,
                        changed_by: (0, _prismaHelpers.toBigIntId)(user.user_id),
                        note: note
                      }
                    });
                  case 4:
                    return _context6.a(2, updated);
                }
              }, _callee6);
            }));
            return function (_x1) {
              return _ref7.apply(this, arguments);
            };
          }());
        case 8:
          result = _context7.v;
          return _context7.a(2, {
            EM: 'Update status successful',
            EC: 0,
            DT: result
          });
        case 9:
          _context7.p = 9;
          _t6 = _context7.v;
          console.error(_t6);
          return _context7.a(2, {
            EM: 'Something went wrong',
            EC: -2,
            DT: ''
          });
      }
    }, _callee7, null, [[1, 9]]);
  }));
  return function updateAppointmentStatus(_x8, _x9, _x0) {
    return _ref6.apply(this, arguments);
  };
}();
module.exports = {
  getMyHistory: getMyHistory,
  getAppointmentById: getAppointmentById,
  getAvailableSlots: getAvailableSlots,
  createAppointment: createAppointment,
  updateAppointmentStatus: updateAppointmentStatus
};