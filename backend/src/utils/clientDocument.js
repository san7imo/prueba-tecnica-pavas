const CLIENT_DOCUMENT_PATTERN = /^\d{5,20}$/;

export const normalizeClientDocumentNumber = (value) =>
  String(value ?? '').trim().replace(/[\s.-]/g, '');

export const isValidClientDocumentNumber = (value) =>
  typeof value === 'string' && CLIENT_DOCUMENT_PATTERN.test(value);

