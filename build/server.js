"use strict";

var _express = _interopRequireDefault(require("express"));
var _bodyParser = _interopRequireDefault(require("body-parser"));
var _cookieParser = _interopRequireDefault(require("cookie-parser"));
var _viewEngine = _interopRequireDefault(require("./configs/viewEngine"));
var _cors = _interopRequireDefault(require("./configs/cors"));
var _api = _interopRequireDefault(require("./routes/api"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
require('dotenv').config();
var app = (0, _express["default"])();
var PORT = process.env.PORT || 8080;

// Config CORS
(0, _cors["default"])(app);

// Config View Engine
(0, _viewEngine["default"])(app);

// Config Middlewares
app.use((0, _cookieParser["default"])());
app.use(_bodyParser["default"].json({
  limit: '50mb'
}));
app.use(_bodyParser["default"].urlencoded({
  limit: '50mb',
  extended: true
}));

// Middleware fix BigInt JSON serialization from Prisma
app.use(function (req, res, next) {
  var oldJson = res.json;
  res.json = function (data) {
    return oldJson.call(this, JSON.parse(JSON.stringify(data, function (_, value) {
      return typeof value === 'bigint' ? value.toString() : value;
    })));
  };
  next();
});

// Init API Routes
(0, _api["default"])(app);
app.listen(PORT, function () {
  console.log('SERVER is running on PORT:', PORT);
});