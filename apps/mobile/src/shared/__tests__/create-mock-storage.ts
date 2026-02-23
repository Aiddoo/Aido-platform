import type { Storage } from '@src/core/ports/storage';

export const createMockStorage = (): jest.Mocked<Storage> => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
});
