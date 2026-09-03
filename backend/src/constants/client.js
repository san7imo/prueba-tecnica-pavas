export const CLIENT_LIFECYCLE = Object.freeze({
  ACTIVE: 'active',
  DELETED: 'deleted',
  ALL: 'all',
});

export const CLIENT_LIFECYCLES = Object.freeze(
  Object.values(CLIENT_LIFECYCLE),
);

export const CLIENT_DUPLICATE_FIELD = Object.freeze({
  EMAIL: 'email',
  PHONE: 'phone',
});
