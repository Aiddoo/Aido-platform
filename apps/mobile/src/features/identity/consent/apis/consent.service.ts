import {
  consentResponseSchema,
  type UpdateAiDataSharingConsentInput,
  type UpdateMarketingConsentInput,
  type UpdateMarketingPushConsentInput,
  updateAiDataSharingConsentResponseSchema,
  updateMarketingConsentResponseSchema,
  updateMarketingPushConsentResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type {
  Consent,
  UpdateAiDataSharingConsentResult,
  UpdateMarketingConsentResult,
  UpdateMarketingPushConsentResult,
} from '../domains/consent.model';
import {
  toConsent,
  toUpdateAiDataSharingConsentResult,
  toUpdateMarketingConsentResult,
  toUpdateMarketingPushConsentResult,
} from './consent.mapper';

export class ConsentService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getConsent = async (signal?: AbortSignal): Promise<Result<Consent, ApiError>> => {
    const result = await this.#httpClient.get('v1/auth/consent', { signal });
    if (!result.ok) {
      return result;
    }

    const parsed = consentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[ConsentService] Invalid getConsent response: ${parsed.error.message}`);
    }

    return ok(toConsent(parsed.data));
  };

  updateMarketingConsent = async (
    input: UpdateMarketingConsentInput,
  ): Promise<Result<UpdateMarketingConsentResult, ApiError>> => {
    const result = await this.#httpClient.patch('v1/auth/consent/marketing', input);
    if (!result.ok) {
      return result;
    }

    const parsed = updateMarketingConsentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ConsentService] Invalid updateMarketingConsent response: ${parsed.error.message}`,
      );
    }

    return ok(toUpdateMarketingConsentResult(parsed.data));
  };

  updateMarketingPushConsent = async (
    input: UpdateMarketingPushConsentInput,
  ): Promise<Result<UpdateMarketingPushConsentResult, ApiError>> => {
    const result = await this.#httpClient.patch('v1/auth/consent/marketing-push', input);
    if (!result.ok) {
      return result;
    }
    const parsed = updateMarketingPushConsentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ConsentService] Invalid updateMarketingPushConsent response: ${parsed.error.message}`,
      );
    }
    return ok(toUpdateMarketingPushConsentResult(parsed.data));
  };

  updateAiDataSharingConsent = async (
    input: UpdateAiDataSharingConsentInput,
  ): Promise<Result<UpdateAiDataSharingConsentResult, ApiError>> => {
    const result = await this.#httpClient.patch('v1/auth/consent/ai-data-sharing', input);
    if (!result.ok) {
      return result;
    }

    const parsed = updateAiDataSharingConsentResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ConsentService] Invalid updateAiDataSharingConsent response: ${parsed.error.message}`,
      );
    }

    return ok(toUpdateAiDataSharingConsentResult(parsed.data));
  };
}
