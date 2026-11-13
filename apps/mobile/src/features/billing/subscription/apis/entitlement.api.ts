import { entitlementSnapshotSchema } from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { type EntitlementSnapshot } from '../domains/entitlement.model';
import { toEntitlementSnapshot } from './entitlement.mapper';

export class EntitlementApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
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
    );
  };
}
