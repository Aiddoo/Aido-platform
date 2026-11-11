import { featureDiscoveryResponseSchema } from '@aido/api';
import { ok } from '@src/core/errors/result';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { toWhatsNewCampaignConfig } from './whats-new-campaign.mapper';

export class WhatsNewCampaignService {
  readonly #jsonFetcher: JsonFetcher;

  constructor(jsonFetcher: JsonFetcher) {
    this.#jsonFetcher = jsonFetcher;
  }

  getConfig = async (signal?: AbortSignal) =>
    parseApiResponse(
      ok(await this.#jsonFetcher.get('v1/app-config/feature-discovery', signal)),
      featureDiscoveryResponseSchema,
      toWhatsNewCampaignConfig,
      '[WhatsNewCampaignService] Invalid response',
    );
}
