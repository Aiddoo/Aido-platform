import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import type { KyInstance } from 'ky';

export class KyJsonFetcher implements JsonFetcher {
  readonly #client: Pick<KyInstance, 'get'>;

  constructor(client: Pick<KyInstance, 'get'>) {
    this.#client = client;
  }

  get = async (url: string): Promise<unknown> => this.#client.get(url).json<unknown>();
}
