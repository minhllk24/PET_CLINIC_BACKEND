export const toBigIntId = (id) => {
  if (!id || isNaN(Number(id))) return null;
  return BigInt(id);
};

export const serializeBigInt = (data) => {
  return JSON.parse(JSON.stringify(data, (_, value) => {
    return typeof value === 'bigint' ? value.toString() : value;
  }));
};
