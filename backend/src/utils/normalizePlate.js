export const normalizePlate = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toUpperCase().replace(/\s+/g, '');
};

