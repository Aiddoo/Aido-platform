import type {
  AcceptFriendRequestResponse,
  CancelFriendRequestResponse,
  FriendsListResponse,
  ReceivedRequestsResponse,
  RejectFriendRequestResponse,
  RemoveFriendResponse,
  SentRequestsResponse,
} from '@aido/validators';

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface FriendRepository {
  /**
   * 받은 친구 요청 목록 조회
   */
  getReceivedRequests(params?: PaginationParams): Promise<ReceivedRequestsResponse>;

  /**
   * 보낸 친구 요청 목록 조회
   */
  getSentRequests(params?: PaginationParams): Promise<SentRequestsResponse>;

  /**
   * 친구 요청 수락
   */
  acceptRequest(userId: string): Promise<AcceptFriendRequestResponse>;

  /**
   * 친구 요청 거절
   */
  rejectRequest(userId: string): Promise<RejectFriendRequestResponse>;

  /**
   * 보낸 친구 요청 취소
   */
  cancelRequest(userId: string): Promise<CancelFriendRequestResponse>;

  /**
   * 친구 목록 조회
   */
  getFriends(params?: PaginationParams): Promise<FriendsListResponse>;

  /**
   * 친구 삭제
   */
  removeFriend(userId: string): Promise<RemoveFriendResponse>;
}
