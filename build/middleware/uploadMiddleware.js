"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;
var _multer = _interopRequireDefault(require("multer"));
var _path = _interopRequireDefault(require("path"));
var _fs = _interopRequireDefault(require("fs"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
// Đảm bảo thư mục tồn tại
var uploadDir = _path["default"].join(__dirname, '../public/uploads');
if (!_fs["default"].existsSync(uploadDir)) {
  _fs["default"].mkdirSync(uploadDir, {
    recursive: true
  });
}
var storage = _multer["default"].diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function filename(req, file, cb) {
    // Generate unique name: timestamp-originalname
    var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    var ext = _path["default"].extname(file.originalname);
    var nameWithoutExt = _path["default"].basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
  }
});

// Chấp nhận các loại file thông dụng (ảnh, pdf)
var fileFilter = function fileFilter(req, file, cb) {
  var allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and PDF are allowed.'), false);
  }
};
var upload = (0, _multer["default"])({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter: fileFilter
});
var _default = exports["default"] = upload;