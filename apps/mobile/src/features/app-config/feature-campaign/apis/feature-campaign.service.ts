import { featureDiscoveryResponseSchema } from '@aido/api';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { ParseError } from '@src/shared/errors/infra-error';

import type { FeatureCampaignConfig } from '../schemas/feature-campaign.schema';
import { toFeatureCampaignConfig } from './feature-campaign.mapper';

export class FeatureCampaignService {
  readonly #jsonFetcher: JsonFetcher;

  constructor(jsonFetcher: JsonFetcher) {
    this.#jsonFetcher = jsonFetcher;
  }

  getConfig = async (signal?: AbortSignal): Promise<FeatureCampaignConfig> => {
    const response = await this.#jsonFetcher.get('v1/app-config/feature-discovery', signal);
    const parsed = featureDiscoveryResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new ParseError(`[FeatureCampaignService] Invalid response: ${parsed.error.message}`);
    }

    return toFeatureCampaignConfig(parsed.data);
  };
}
