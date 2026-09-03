export const CLIENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CLIENT_PHONE_PATTERN = /^\+?\d{7,20}$/;

export const normalizeClientEmail = (value) => value.trim().toLowerCase();

export const normalizeClientPhone = (value) =>
  value.trim().replace(/[\s\-.()]/g, '');

export const normalizeClientPhoneSearch = (value) => {
  const normalized = normalizeClientPhone(value);
  return /^\+?\d+$/.test(normalized) ? normalized : undefined;
};

export const isValidClientEmail = (value) =>
  value.length <= 254 && CLIENT_EMAIL_PATTERN.test(value);

export const isValidClientPhone = (value) =>
  CLIENT_PHONE_PATTERN.test(value);
