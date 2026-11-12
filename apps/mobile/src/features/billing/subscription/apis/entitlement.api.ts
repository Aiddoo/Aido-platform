import { entitlementSnapshotSchema } from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { AppLogger } from '@src/core/ports/app-logger';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import { type EntitlementSnapshot } from '../domains/entitlement.model';
import { toEntitlementSnapshot } from './entitlement.mapper';

export class EntitlementApi {
  readonly #httpClient: HttpClient;
  readonly #logger: AppLogger;

  constructor(httpClient: HttpClient, logger: AppLogger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getEntitlements = async (
    signal?: AbortSignal,
  ): Promise<Result<EntitlementSnapshot, ApiError>> => {
    const result = await this.#httpClient.get('v1/entitlements', { signal });

    return parseApiResponse(
      result,
      entitlementSnapshotSchema,
      toEntitlementSnapshot,
      '[EntitlementApi] Invalid getEntitlements response',
      (zodError) => {
        this.#logger.error(SUBSCRIPTION_LOG_EVENT.ENTITLEMENT_SNAPSHOT_MAPPING_FAILED, undefined, {
          zodError,
        });
      },
    );
  };
}
