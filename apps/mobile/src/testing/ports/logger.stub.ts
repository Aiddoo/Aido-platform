import type { AppLogger } from '@src/core/ports/app-logger';

import { mockMethod } from '../mock-method';

export function createLoggerStub(): jest.Mocked<AppLogger> {
  return {
    debug: mockMethod<AppLogger['debug']>(),
    info: mockMethod<AppLogger['info']>(),
    warn: mockMethod<AppLogger['warn']>(),
    error: mockMethod<AppLogger['error']>(),
  };
}
