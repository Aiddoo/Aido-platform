import type { Logger } from '@src/core/ports/logger';

export function createLoggerStub(): jest.Mocked<Logger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
