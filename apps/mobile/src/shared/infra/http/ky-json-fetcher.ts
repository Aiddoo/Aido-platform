import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { HTTPError, type KyInstance } from 'ky';

import { readJsonBody, toApiError, toTransportError } from './ky-error';

export class KyJsonFetcher implements JsonFetcher {
  readonly #client: Pick<KyInstance, 'get'>;

  constructor(client: Pick<KyInstance, 'get'>) {
    this.#client = client;
  }

  get = async (url: string, signal?: AbortSignal): Promise<unknown> => {
    try {
      return await readJsonBody(() => this.#client.get(url, { signal }).json<unknown>());
    } catch (error) {
      const transportError = toTransportError(error);
      if (transportError != null) {
        throw transportError;
      }

      if (error instanceof HTTPError) {
        throw toApiError(error);
      }

      throw error;
    }
  };
}
