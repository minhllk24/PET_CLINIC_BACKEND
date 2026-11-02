class AppError extends Error {
  constructor(status, title, code, detail, errors = null) {
    const errorDetail = detail || title || 'An error occurred';
    super(errorDetail);
    this.type = `https://httpstatuses.com/${status}`;
    this.title = title;
    this.status = status;
    this.code = code;
    this.detail = errorDetail;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
