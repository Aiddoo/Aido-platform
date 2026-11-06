import { preferenceResponseSchema, updatePreferenceResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { PreferenceChange } from '../schemas/preference.schema';
import { toPreference } from './preference.mapper';

export class PreferenceService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getPreference = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/auth/preference', { signal }),
      preferenceResponseSchema,
      toPreference,
      '[PreferenceService] Invalid getPreference response',
    );

  updatePreference = async (change: PreferenceChange) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/preference', change),
      updatePreferenceResponseSchema,
      toPreference,
      '[PreferenceService] Invalid updatePreference response',
    );
}
