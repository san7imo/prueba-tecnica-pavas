import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { resetAuthSessionForTests } from '../src/features/auth/authSession.js';

afterEach(() => {
  cleanup();
  resetAuthSessionForTests();
  vi.restoreAllMocks();
});
