import { featureDiscoveryResponseSchema } from '@aido/validators';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { ParseError } from '@src/shared/errors/infra-error';

import type { FeatureDiscoveryConfig } from '../models/feature-discovery.model';
import { toFeatureDiscoveryConfig } from './feature-discovery.mapper';

export class FeatureDiscoveryService {
  readonly #jsonFetcher: JsonFetcher;

  constructor(jsonFetcher: JsonFetcher) {
    this.#jsonFetcher = jsonFetcher;
  }

  getConfig = async (): Promise<FeatureDiscoveryConfig> => {
    const response = await this.#jsonFetcher.get('v1/app-config/feature-discovery');
    const parsed = featureDiscoveryResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new ParseError(
        `[FeatureDiscoveryService] Invalid feature discovery response: ${parsed.error.message}`,
      );
    }

    return toFeatureDiscoveryConfig(parsed.data);
  };
}
