import type { HttpClient } from '@src/core/ports/http';

export const createMockHttpClient = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});
