import type {
  FriendRequestUser as FriendRequestDTO,
  FriendsListResponse,
  FriendUser as FriendUserDTO,
  ReceivedRequestsResponse,
  SearchUser as SearchedUserDTO,
  SearchUsersResponse,
  SendFriendRequestResponse,
  SentRequestsResponse,
} from '@aido/validators';
import type { Page } from '@src/shared/types/page.type';

import type {
  FriendRequest,
  FriendUser,
  SearchedUser,
  SendRequestResult,
} from '../models/friend.model';

// DTO → Domain 변환

export const toFriendUser = (dto: FriendUserDTO): FriendUser => ({
  id: dto.id,
  userTag: dto.userTag,
  name: dto.name,
  profileImage: dto.profileImage,
  followId: dto.followId,
  friendsSince: new Date(dto.friendsSince),
});

export const toFriendRequest = (dto: FriendRequestDTO): FriendRequest => ({
  id: dto.id,
  userTag: dto.userTag,
  name: dto.name,
  profileImage: dto.profileImage,
  requestedAt: new Date(dto.requestedAt),
});

export const toFriendsPage = (dto: FriendsListResponse): Page<FriendUser> => ({
  items: dto.friends.map(toFriendUser),
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});

export const toFriendRequestsPage = (
  dto: ReceivedRequestsResponse | SentRequestsResponse,
): Page<FriendRequest> => ({
  items: dto.requests.map(toFriendRequest),
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});

export const toSendRequestResult = (dto: SendFriendRequestResponse): SendRequestResult => ({
  autoAccepted: dto.autoAccepted,
});

export const toSearchedUser = (dto: SearchedUserDTO): SearchedUser => ({
  id: dto.id,
  userTag: dto.userTag,
  name: dto.name,
  profileImage: dto.profileImage,
  isFollowing: dto.isFollowing,
  isFollower: dto.isFollower,
  isFriend: dto.isFriend,
  requestPending: dto.requestPending,
});

export const toSearchedUsersPage = (dto: SearchUsersResponse): Page<SearchedUser> => ({
  items: dto.items.map(toSearchedUser),
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
  nextCursor: dto.nextCursor,
});
