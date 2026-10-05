export const sendSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json(data);
};

export const sendCreated = (res, data) => {
  return sendSuccess(res, data, 201);
};

export const sendNoContent = (res) => {
  return res.status(204).send();
};

export const createCursorPage = (items, nextCursor = null) => {
  return {
    items,
    nextCursor,
  };
};
