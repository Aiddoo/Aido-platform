import { appVersionResponseSchema } from '@aido/api';
import { ok, unwrap } from '@src/core/errors/result';
import type { AppStoreListingGateway } from '@src/core/ports/app-store';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { toAppVersionConfig } from './app-version.mapper';

export class AppVersionService {
  constructor(
    private readonly jsonFetcher: JsonFetcher,
    private readonly metadata: NativeApplicationMetadataGateway,
    private readonly listing: AppStoreListingGateway,
  ) {}

  getInstallation = () => this.metadata.getInstallation();

  getConfig = async (signal?: AbortSignal) =>
    unwrap(
      parseApiResponse(
        ok(await this.jsonFetcher.get('v1/app-config/app-version', signal)),
        appVersionResponseSchema,
        toAppVersionConfig,
        '[AppVersionService] Invalid response',
      ),
    );

  openStoreListing = () => this.listing.openListing();
}
