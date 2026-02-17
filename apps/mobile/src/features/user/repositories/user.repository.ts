import type { UpdateProfileInput } from '@aido/validators';
import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';
import type { UpdateProfileResult, User } from '../models/user.model';

export interface UserRepository {
  getCurrentUser(): Promise<Result<User, ApiError>>;
  updateProfile(input: UpdateProfileInput): Promise<Result<UpdateProfileResult, ApiError>>;
}
