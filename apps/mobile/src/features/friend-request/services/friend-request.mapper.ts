import type {
  FriendRequestUser as FriendRequestUserDTO,
  ReceivedRequestsResponse,
  SentRequestsResponse,
} from '@aido/validators';
import type {
  FriendRequestUser,
  ReceivedRequestsResult,
  SentRequestsResult,
} from '../models/friend-request.model';

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
