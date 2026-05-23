"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hashPassword = exports.comparePassword = void 0;
var _bcryptjs = _interopRequireDefault(require("bcryptjs"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
var salt = _bcryptjs["default"].genSaltSync(10);
var hashPassword = exports.hashPassword = function hashPassword(password) {
  return _bcryptjs["default"].hashSync(password, salt);
};
var comparePassword = exports.comparePassword = function comparePassword(password, hash) {
  return _bcryptjs["default"].compareSync(password, hash);
};