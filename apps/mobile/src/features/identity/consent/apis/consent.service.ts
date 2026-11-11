import {
  type UpdateAiDataSharingConsentInput,
  updateAiDataSharingConsentResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { type ConsentAgreement } from '../schemas/consent-request.schema';
import {
  consentEnvelopeSchema,
  updateMarketingConsentEnvelopeSchema,
  updateMarketingPushConsentEnvelopeSchema,
} from '../schemas/consent-response.schema';
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

  getConsent = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/auth/consent', { signal }),
      consentEnvelopeSchema,
      toConsent,
      '[ConsentService] Invalid getConsent response',
    );

  updateMarketingConsent = async (input: ConsentAgreement) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/consent/marketing', input),
      updateMarketingConsentEnvelopeSchema,
      toUpdateMarketingConsentResult,
      '[ConsentService] Invalid updateMarketingConsent response',
    );

  updateMarketingPushConsent = async (input: ConsentAgreement) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/consent/marketing-push', input),
      updateMarketingPushConsentEnvelopeSchema,
      toUpdateMarketingPushConsentResult,
      '[ConsentService] Invalid updateMarketingPushConsent response',
    );

  updateAiDataSharingConsent = async (input: UpdateAiDataSharingConsentInput) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/consent/ai-data-sharing', input),
      updateAiDataSharingConsentResponseSchema,
      toUpdateAiDataSharingConsentResult,
      '[ConsentService] Invalid updateAiDataSharingConsent response',
    );
}
