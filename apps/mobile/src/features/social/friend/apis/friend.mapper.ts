import type { Page } from '@src/shared/types/page.types';

import type {
  FriendRequest,
  FriendRequestsPageDto,
  FriendsPageDto,
  FriendUser,
  SearchedUser,
  SearchedUsersPageDto,
} from '../schemas/friend.schema';

export function toFriendsPage(dto: FriendsPageDto): Page<FriendUser> {
  return { items: dto.friends, totalCount: dto.totalCount, hasMore: dto.hasMore };
}

export function toFriendRequestsPage(dto: FriendRequestsPageDto): Page<FriendRequest> {
  return { items: dto.requests, totalCount: dto.totalCount, hasMore: dto.hasMore };
}

export function toSearchedUsersPage(dto: SearchedUsersPageDto): Page<SearchedUser> {
  return {
    items: dto.items,
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
    nextCursor: dto.nextCursor,
  };
}
