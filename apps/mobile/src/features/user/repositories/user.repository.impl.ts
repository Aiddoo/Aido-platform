import {
  type CurrentUser,
  currentUserSchema,
  type UpdateProfileInput,
  type UpdateProfileResponse,
  updateProfileResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';

import type { UpdateProfileResult, User } from '../models/user.model';
import { toUpdateProfileResult, toUser } from './user.mapper';
import type { UserRepository } from './user.repository';

export class UserRepositoryImpl implements UserRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async getCurrentUser(): Promise<Result<User, ApiError>> {
    const result = await this.#httpClient.get<CurrentUser>('v1/auth/me');

    if (!result.ok) return result;

    const parsed = currentUserSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[UserRepository] Invalid getCurrentUser response: ${parsed.error.message}`,
      );
    }

    return ok(toUser(parsed.data));
  }

  async updateProfile(input: UpdateProfileInput): Promise<Result<UpdateProfileResult, ApiError>> {
    const result = await this.#httpClient.patch<UpdateProfileResponse>('v1/auth/profile', input);

    if (!result.ok) return result;

    const parsed = updateProfileResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[UserRepository] Invalid updateProfile response: ${parsed.error.message}`,
      );
    }

    return ok(toUpdateProfileResult(parsed.data));
  }
}
