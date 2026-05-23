"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.requireRole = exports.authUserOrAdmin = exports.authMiddleware = void 0;
var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));
var _responseHelpers = require("../utils/responseHelpers");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
require('dotenv').config();
var extractToken = function extractToken(req) {
  if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};
var authMiddleware = exports.authMiddleware = function authMiddleware(req, res, next) {
  var token = extractToken(req);
  if (!token) {
    return (0, _responseHelpers.sendResponse)(res, 401, 'Unauthenticated user', -999);
  }
  try {
    var decoded = _jsonwebtoken["default"].verify(token, process.env.JWT_ACCESS_TOKEN_SECRET);
    req.user = decoded; // { user_id, role_code, email, full_name }
    next();
  } catch (error) {
    return (0, _responseHelpers.sendResponse)(res, 401, 'Token is invalid or expired', -999);
  }
};
var requireRole = exports.requireRole = function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role_code)) {
      return (0, _responseHelpers.sendResponse)(res, 403, 'You don\'t have permission!', -1);
    }
    next();
  };
};
var authUserOrAdmin = exports.authUserOrAdmin = function authUserOrAdmin(req, res, next) {
  var _req$user, _req$user2;
  var userIdParams = req.params.id;
  var userRole = (_req$user = req.user) === null || _req$user === void 0 ? void 0 : _req$user.role_code;
  var currentUserId = (_req$user2 = req.user) === null || _req$user2 === void 0 ? void 0 : _req$user2.user_id;
  if (userRole === 'ADMIN' || currentUserId === userIdParams) {
    next();
  } else {
    return (0, _responseHelpers.sendResponse)(res, 403, 'You don\'t have permission!', -1);
  }
};