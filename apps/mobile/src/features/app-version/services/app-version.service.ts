import { appVersionResponseSchema } from '@aido/validators';
import type { AppStoreListingGateway } from '@src/core/ports/app-store';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata';
import { ParseError } from '@src/shared/errors/infra-error';

import type { AppVersionConfig } from '../models/app-version.model';
import { toAppVersionConfig } from './app-version.mapper';

export class AppVersionService {
  constructor(
    private readonly jsonFetcher: JsonFetcher,
    private readonly metadata: NativeApplicationMetadataGateway,
    private readonly listing: AppStoreListingGateway,
  ) {}

  getInstallation = () => this.metadata.getInstallation();

  getConfig = async (signal?: AbortSignal): Promise<AppVersionConfig> => {
    const raw = await this.jsonFetcher.get('v1/app-config/app-version', signal);
    const parsed = appVersionResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ParseError(`[AppVersionService] Invalid response: ${parsed.error.message}`);
    }
    return toAppVersionConfig(parsed.data);
  };

  openStoreListing = () => this.listing.openListing();
}
