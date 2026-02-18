import type { CurrentUser, UpdateProfileResponse } from '@aido/validators';
import type { UpdateProfileResult, User } from '../models/user.model';

export const toUser = (dto: CurrentUser): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name,
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  subscriptionStatus: dto.subscriptionStatus,
  createdAt: new Date(dto.createdAt),
});

export const toUpdateProfileResult = (dto: UpdateProfileResponse): UpdateProfileResult => ({
  name: dto.name,
  profileImage: dto.profileImage,
});
