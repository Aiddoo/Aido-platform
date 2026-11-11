import { updateProfileResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { type ProfileChange } from '../schemas/update-profile-request.schema';
import { currentUserResponseSchema } from '../schemas/user-response.schema';
import { toUpdateProfileResult, toUser } from './user.mapper';

export class UserApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getCurrentUser = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/auth/me', { signal }),
      currentUserResponseSchema,
      toUser,
      '[UserApi] Invalid getCurrentUser response',
    );

  updateProfile = async (input: ProfileChange) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/profile', input),
      updateProfileResponseSchema,
      toUpdateProfileResult,
      '[UserApi] Invalid updateProfile response',
    );
}
