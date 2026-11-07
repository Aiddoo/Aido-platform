import type { JsonFetcher } from '@src/core/ports/json-fetcher';

export const createJsonFetcherStub = (): jest.Mocked<JsonFetcher> => ({
  get: jest.fn(),
});
