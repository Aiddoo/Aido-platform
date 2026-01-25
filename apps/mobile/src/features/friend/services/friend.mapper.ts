import type {
  FriendRequestUser as FriendRequestUserDTO,
  FriendsListResponse,
  FriendUser as FriendUserDTO,
  ReceivedRequestsResponse,
  SendFriendRequestResponse,
  SentRequestsResponse,
} from '@aido/validators';
import type {
  FriendRequestUser,
  FriendsResult,
  FriendUser,
  ReceivedRequestsResult,
  SendRequestResult,
  SentRequestsResult,
} from '../models/friend.model';

export const toFriendRequestUser = (dto: FriendRequestUserDTO): FriendRequestUser => ({
  id: dto.id,
  userTag: dto.userTag,
  name: dto.name,
  profileImage: dto.profileImage,
  requestedAt: new Date(dto.requestedAt),
});

export const toReceivedRequestsResult = (
  dto: ReceivedRequestsResponse,
): ReceivedRequestsResult => ({
  requests: dto.requests.map(toFriendRequestUser),
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});

export const toSentRequestsResult = (dto: SentRequestsResponse): SentRequestsResult => ({
  requests: dto.requests.map(toFriendRequestUser),
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});

export const toFriendUser = (dto: FriendUserDTO): FriendUser => ({
  followId: dto.followId,
  id: dto.id,
  userTag: dto.userTag,
  name: dto.name,
  profileImage: dto.profileImage,
  friendsSince: new Date(dto.friendsSince),
});

export const toFriendsResult = (dto: FriendsListResponse): FriendsResult => ({
  friends: dto.friends.map(toFriendUser),
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
});

export const toSendRequestResult = (dto: SendFriendRequestResponse): SendRequestResult => ({
  message: dto.message,
  autoAccepted: dto.autoAccepted,
});
