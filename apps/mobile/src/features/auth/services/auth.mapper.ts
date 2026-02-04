import type { AuthTokens as AuthTokensDTO, CurrentUser } from '@aido/validators';
import { AuthPolicy } from '../models/auth.policy';
import type { AuthTokens } from '../models/auth-tokens.model';
import type { User } from '../models/user.model';

export const toUser = (dto: CurrentUser): User => ({
  id: dto.userId,
  email: dto.email,
  name: dto.name,
  profileImage: dto.profileImage,
  userTag: dto.userTag,
  subscriptionStatus: dto.subscriptionStatus,
  createdAt: new Date(dto.createdAt),
  isSubscribed: AuthPolicy.isSubscriptionActive(dto.subscriptionStatus),
});

export const toAuthTokens = (dto: AuthTokensDTO): AuthTokens => ({
  userId: dto.userId,
  accessToken: dto.accessToken,
  refreshToken: dto.refreshToken,
  userName: dto.name,
  userProfileImage: dto.profileImage,
});
