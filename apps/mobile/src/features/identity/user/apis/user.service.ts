import { updateProfileResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { currentUserResponseSchema, type ProfileChange } from '../schemas/user.schema';
import { toUpdateProfileResult, toUser } from './user.mapper';

export class UserService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getCurrentUser = async (signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/auth/me', { signal }),
      currentUserResponseSchema,
      toUser,
      '[UserService] Invalid getCurrentUser response',
    );

  updateProfile = async (input: ProfileChange) =>
    parseApiResponse(
      await this.#httpClient.patch('v1/auth/profile', input),
      updateProfileResponseSchema,
      toUpdateProfileResult,
      '[UserService] Invalid updateProfile response',
    );
}
