import type { UpdateProfileInput } from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';

import type { UpdateProfileResult, User } from '../models/user.model';
import type { UserRepository } from '../repositories/user.repository';

export class UserService {
  readonly #repository: UserRepository;

  constructor(repository: UserRepository) {
    this.#repository = repository;
  }

  getCurrentUser = async (): Promise<Result<User, ApiError>> => {
    return this.#repository.getCurrentUser();
  };

  updateProfile = async (
    input: UpdateProfileInput,
  ): Promise<Result<UpdateProfileResult, ApiError>> => {
    return this.#repository.updateProfile(input);
  };
}
