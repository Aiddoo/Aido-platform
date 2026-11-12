import type { AppLogger } from '@src/core/ports/app-logger';

export function createLoggerStub(): jest.Mocked<AppLogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
