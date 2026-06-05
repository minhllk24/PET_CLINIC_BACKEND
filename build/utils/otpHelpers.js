"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.verifyResetToken = exports.generateResetToken = exports.generateOtpCode = void 0;
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
require('dotenv').config();
var generateOtpCode = exports.generateOtpCode = function generateOtpCode() {
  // Generate a 6-digit random code
  return Math.floor(100000 + Math.random() * 900000).toString();
};
var generateResetToken = exports.generateResetToken = function generateResetToken(payload) {
  // Expires in 5 minutes to match the flow
  return _jsonwebtoken["default"].sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: '5m'
  });
};
var verifyResetToken = exports.verifyResetToken = function verifyResetToken(token) {
  try {
    var decoded = _jsonwebtoken["default"].verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    if (decoded.purpose !== 'reset_password') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};