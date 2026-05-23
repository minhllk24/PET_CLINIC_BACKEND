"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sendResponse = void 0;
var sendResponse = exports.sendResponse = function sendResponse(res, statusCode, em, ec) {
  var dt = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : '';
  return res.status(statusCode).json({
    EM: em,
    EC: ec,
    DT: dt
  });
};