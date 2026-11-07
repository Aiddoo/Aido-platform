import { appVersionResponseSchema } from '@aido/api';
import { ok } from '@src/core/errors/result';
import type { AppStoreListingGateway } from '@src/core/ports/app-store';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { toAppVersionConfig } from './app-version.mapper';

export class AppVersionService {
  readonly #jsonFetcher: JsonFetcher;
  readonly #metadata: NativeApplicationMetadataGateway;
  readonly #listing: AppStoreListingGateway;

  constructor(
    jsonFetcher: JsonFetcher,
    metadata: NativeApplicationMetadataGateway,
    listing: AppStoreListingGateway,
  ) {
    this.#jsonFetcher = jsonFetcher;
    this.#metadata = metadata;
    this.#listing = listing;
  }

  getInstallation = () => this.#metadata.getInstallation();

  getConfig = async (signal?: AbortSignal) =>
    parseApiResponse(
      ok(await this.#jsonFetcher.get('v1/app-config/app-version', signal)),
      appVersionResponseSchema,
      toAppVersionConfig,
      '[AppVersionService] Invalid response',
    );

  openStoreListing = () => this.#listing.openListing();
}
