import { describe, expect, it, vi } from 'vitest';

import { USER_ROLE } from '../src/constants/auth.js';
import { authorize } from '../src/middlewares/authorize.js';

const invoke = (request, ...roles) => {
  const next = vi.fn();
  authorize(...roles)(request, {}, next);
  return next;
};

describe('authorize middleware', () => {
  it('returns 401 when authenticate has not established a user', () => {
    const next = invoke({}, USER_ROLE.ADMIN);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED' }),
    );
  });

  it('returns 403 for an authenticated role outside the allowed set', () => {
    const next = invoke({ user: { role: USER_ROLE.MECHANIC } }, USER_ROLE.ADMIN);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' }),
    );
  });

  it('continues for any explicitly allowed role', () => {
    const next = invoke(
      { user: { role: USER_ROLE.MECHANIC } },
      USER_ROLE.ADMIN,
      USER_ROLE.MECHANIC,
    );
    expect(next).toHaveBeenCalledWith();
  });
});
