import type {
  AcceptFriendRequestResponse,
  CancelFriendRequestResponse,
  FriendsListResponse,
  ReceivedRequestsResponse,
  RejectFriendRequestResponse,
  RemoveFriendResponse,
  SendFriendRequestResponse,
  SentRequestsResponse,
} from '@aido/validators';

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface FriendRepository {
  sendRequest(userTag: string): Promise<SendFriendRequestResponse>;
  getReceivedRequests(params?: PaginationParams): Promise<ReceivedRequestsResponse>;
  getSentRequests(params?: PaginationParams): Promise<SentRequestsResponse>;
  acceptRequest(userId: string): Promise<AcceptFriendRequestResponse>;
  rejectRequest(userId: string): Promise<RejectFriendRequestResponse>;
  cancelRequest(userId: string): Promise<CancelFriendRequestResponse>;
  getFriends(params?: PaginationParams): Promise<FriendsListResponse>;
  removeFriend(userId: string): Promise<RemoveFriendResponse>;
}
