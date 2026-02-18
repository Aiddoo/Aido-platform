import type { CurrentUser, UpdateProfileResponse } from '@aido/validators';
import type { UpdateProfileResult, User } from '../models/user.model';
import { UserPolicy } from '../models/user.model';

export const toUser = (dto: CurrentUser): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name ?? '열정적인 사용자',
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  subscriptionStatus: dto.subscriptionStatus,
  createdAt: new Date(dto.createdAt),
  isSubscribed: UserPolicy.isPremiumUser(dto.subscriptionStatus),
});

export const toUpdateProfileResult = (dto: UpdateProfileResponse): UpdateProfileResult => ({
  name: dto.name ?? '열정적인 사용자',
  profileImage: dto.profileImage,
});
