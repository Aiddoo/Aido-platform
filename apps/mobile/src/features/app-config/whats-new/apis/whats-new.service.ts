import { featureDiscoveryResponseSchema } from '@aido/api';
import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { ParseError } from '@src/shared/errors/infra-error';

import type { WhatsNewConfig } from '../domains/whats-new.model';
import { toWhatsNewConfig } from './whats-new.mapper';

export class WhatsNewService {
  readonly #jsonFetcher: JsonFetcher;

  constructor(jsonFetcher: JsonFetcher) {
    this.#jsonFetcher = jsonFetcher;
  }

  getConfig = async (signal?: AbortSignal): Promise<WhatsNewConfig> => {
    const response = await this.#jsonFetcher.get('v1/app-config/feature-discovery', signal);
    const parsed = featureDiscoveryResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw new ParseError(`[WhatsNewService] Invalid whats-new response: ${parsed.error.message}`);
    }

    return toWhatsNewConfig(parsed.data);
  };
}
