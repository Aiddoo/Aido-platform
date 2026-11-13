import { appVersionResponseSchema } from '@aido/api';
import { ok } from '@src/core/errors/result';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { toAppVersionConfig } from './app-version.mapper';

export class AppVersionApi {
  readonly #jsonFetcher: JsonFetcher;

  constructor(jsonFetcher: JsonFetcher) {
    this.#jsonFetcher = jsonFetcher;
  }

  getConfig = async (signal?: AbortSignal) =>
    parseApiResponse(
      ok(await this.#jsonFetcher.get('v1/app-config/app-version', signal)),
      appVersionResponseSchema,
      toAppVersionConfig,
      '[AppVersionApi] Invalid response',
    );
}
