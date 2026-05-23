"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.refreshNewTokenService = exports.generateRefreshToken = exports.generateAccessToken = void 0;
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
var _excluded = ["iat", "exp"];
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
function _objectWithoutProperties(e, t) { if (null == e) return {}; var o, r, i = _objectWithoutPropertiesLoose(e, t); if (Object.getOwnPropertySymbols) { var n = Object.getOwnPropertySymbols(e); for (r = 0; r < n.length; r++) o = n[r], -1 === t.indexOf(o) && {}.propertyIsEnumerable.call(e, o) && (i[o] = e[o]); } return i; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (-1 !== e.indexOf(n)) continue; t[n] = r[n]; } return t; }
require('dotenv').config();
var generateAccessToken = exports.generateAccessToken = function generateAccessToken(payload) {
  return _jsonwebtoken["default"].sign(payload, process.env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: '15m'
  });
};
var generateRefreshToken = exports.generateRefreshToken = function generateRefreshToken(payload) {
  return _jsonwebtoken["default"].sign(payload, process.env.JWT_REFRESH_TOKEN_SECRET, {
    expiresIn: '30d'
  });
};
var refreshNewTokenService = exports.refreshNewTokenService = function refreshNewTokenService(token) {
  try {
    var _Jwt$verify = _jsonwebtoken["default"].verify(token, process.env.JWT_REFRESH_TOKEN_SECRET),
      iat = _Jwt$verify.iat,
      exp = _Jwt$verify.exp,
      rest = _objectWithoutProperties(_Jwt$verify, _excluded);
    return generateAccessToken(rest);
  } catch (error) {
    return null;
  }
};