import type { Logger } from '@src/core/ports/logger';

export const createLoggerStub = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
