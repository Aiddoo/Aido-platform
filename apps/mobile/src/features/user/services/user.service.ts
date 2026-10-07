import { currentUserSchema, type UpdateProfileInput, updateProfileResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { UpdateProfileResult, User } from '../models/user.model';
import { toUpdateProfileResult, toUser } from './user.mapper';

export class UserService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  getCurrentUser = async (signal?: AbortSignal): Promise<Result<User, ApiError>> => {
    const result = await this.#httpClient.get('v1/auth/me', { signal });

    if (!result.ok) {
      return result;
    }

    const parsed = currentUserSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[UserService] Invalid getCurrentUser response: ${parsed.error.message}`,
      );
    }

    return ok(toUser(parsed.data));
  };

  updateProfile = async (
    input: UpdateProfileInput,
  ): Promise<Result<UpdateProfileResult, ApiError>> => {
    const result = await this.#httpClient.patch('v1/auth/profile', input);

    if (!result.ok) {
      return result;
    }

    const parsed = updateProfileResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[UserService] Invalid updateProfile response: ${parsed.error.message}`);
    }

    return ok(toUpdateProfileResult(parsed.data));
  };
}
