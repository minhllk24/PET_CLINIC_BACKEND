"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.toBigIntId = exports.serializeBigInt = void 0;
var toBigIntId = exports.toBigIntId = function toBigIntId(id) {
  if (!id || isNaN(Number(id))) return null;
  return BigInt(id);
};
var serializeBigInt = exports.serializeBigInt = function serializeBigInt(data) {
  return JSON.parse(JSON.stringify(data, function (_, value) {
    return typeof value === 'bigint' ? value.toString() : value;
  }));
};