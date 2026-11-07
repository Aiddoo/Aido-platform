import type { HttpClient } from '@src/core/ports/http-client';

export const createHttpClientStub = (): jest.Mocked<HttpClient> => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
});
