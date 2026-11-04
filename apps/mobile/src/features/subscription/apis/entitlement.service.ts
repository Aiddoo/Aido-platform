import { entitlementSnapshotSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { Logger } from '@src/core/ports/logger';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import { SUBSCRIPTION_LOG_EVENT } from '../constants/subscription-log-events';
import type { EntitlementSnapshot } from '../domains/entitlement.model';
import { toEntitlementSnapshot } from './entitlement.mapper';

/** 서버가 계산한 권한·한도·사용량(GET /v1/entitlements) */
export class EntitlementService {
  readonly #httpClient: HttpClient;
  readonly #logger: Logger;

  constructor(httpClient: HttpClient, logger: Logger) {
    this.#httpClient = httpClient;
    this.#logger = logger;
  }

  getEntitlements = async (
    signal?: AbortSignal,
  ): Promise<Result<EntitlementSnapshot, ApiError>> => {
    const result = await this.#httpClient.get('v1/entitlements', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = entitlementSnapshotSchema.safeParse(result.value);
    if (!parsed.success) {
      this.#logger.error(SUBSCRIPTION_LOG_EVENT.ENTITLEMENT_SNAPSHOT_MAPPING_FAILED, undefined, {
        zodError: parsed.error.message,
      });
      throw new ParseError(
        `[EntitlementService] Invalid getEntitlements response: ${parsed.error.message}`,
      );
    }

    return ok(toEntitlementSnapshot(parsed.data));
  };
}
