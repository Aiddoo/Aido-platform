import { preferenceResponseSchema, updatePreferenceResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { type PreferenceChange } from '../schemas/preference-request.schema';
import { toPreference } from './preference.mapper';

export class PreferenceApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getPreference = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/auth/preference', { signal }),
      preferenceResponseSchema,
      toPreference,
      '[PreferenceApi] Invalid getPreference response',
    );

  updatePreference = async (change: PreferenceChange) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/preference', change),
      updatePreferenceResponseSchema,
      toPreference,
      '[PreferenceApi] Invalid updatePreference response',
    );
}
