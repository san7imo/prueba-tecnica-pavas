export const normalizeClientDocumentNumber = (value) =>
  String(value ?? '').trim().replace(/[\s.-]/g, '');
