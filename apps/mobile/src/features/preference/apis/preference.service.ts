import {
  preferenceResponseSchema,
  updatePreferenceResponseSchema,
  type UpdatePreferenceInput,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { Preference } from '../domains/preference.model';
import { toPreference } from './preference.mapper';

export class PreferenceService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getPreference = async (signal?: AbortSignal): Promise<Result<Preference, ApiError>> => {
    const result = await this.#httpClient.get('v1/auth/preference', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = preferenceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[PreferenceService] Invalid getPreference response: ${parsed.error.message}`,
      );
    }

    return ok(toPreference(parsed.data));
  };

  updatePreference = async (
    input: UpdatePreferenceInput,
  ): Promise<Result<Preference, ApiError>> => {
    const result = await this.#httpClient.patch('v1/auth/preference', input);

    if (!result.ok) {
      return result;
    }

    const parsed = updatePreferenceResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[PreferenceService] Invalid updatePreference response: ${parsed.error.message}`,
      );
    }

    return ok(toPreference(parsed.data));
  };
}
