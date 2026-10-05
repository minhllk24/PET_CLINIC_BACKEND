class AppError extends Error {
  constructor(status, title, code, detail, errors = null) {
    super(detail);
    this.type = `https://httpstatuses.com/${status}`;
    this.title = title;
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
