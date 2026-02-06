import type { ApiError } from '@src/shared/errors/api-error';
import type { Result } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';
import type { FriendRequest, FriendUser, SendRequestResult } from '../models/friend.model';

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

export interface FriendRepository {
  sendRequest(userTag: string): Promise<Result<SendRequestResult, ApiError>>;
  getReceivedRequests(params?: PaginationParams): Promise<Result<Page<FriendRequest>, ApiError>>;
  getSentRequests(params?: PaginationParams): Promise<Result<Page<FriendRequest>, ApiError>>;
  acceptRequest(userId: string): Promise<Result<void, ApiError>>;
  rejectRequest(userId: string): Promise<Result<void, ApiError>>;
  cancelRequest(userId: string): Promise<Result<void, ApiError>>;
  getFriends(params?: PaginationParams): Promise<Result<Page<FriendUser>, ApiError>>;
  removeFriend(userId: string): Promise<Result<void, ApiError>>;
}
