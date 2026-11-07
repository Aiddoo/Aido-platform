import {
  acceptFriendRequestResponseSchema,
  cancelFriendRequestResponseSchema,
  rejectFriendRequestResponseSchema,
  removeFriendResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http';
import { BusinessError } from '@src/shared/errors/business-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import type { Page } from '@src/shared/types/page.types';

import { FRIEND_ERROR_CODE, type FriendErrorCode } from '../domains/friend.error';
import { FriendPolicy } from '../domains/friend.model';
import {
  friendRequestsPageSchema,
  friendsPageSchema,
  type PaginationParams,
  type SearchedUser,
  type SendRequestResult,
  type ReorderFriendInput,
  reorderedFriendSchema,
  searchedUsersPageSchema,
  type SearchUsersParams,
  sendRequestResultSchema,
} from '../schemas/friend.schema';
import { toFriendRequestsPage, toFriendsPage, toSearchedUsersPage } from './friend.mapper';

type FriendServiceError = ApiError | BusinessError<FriendErrorCode>;

function toNothing() {
  return undefined;
}

export class FriendService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  sendRequestByTag = async (
    userTag: string,
  ): Promise<Result<SendRequestResult, FriendServiceError>> => {
    const tag = userTag.trim();
    if (!tag) {
      return err(new BusinessError(FRIEND_ERROR_CODE.EMPTY_TAG));
    }
    if (!FriendPolicy.hasValidUserTag({ userTag: tag })) {
      return err(new BusinessError(FRIEND_ERROR_CODE.INVALID_TAG));
    }

    return parseApiResponse(
      await this.#httpClient.post(`v1/follows/${encodeURIComponent(tag)}`),
      sendRequestResultSchema,
      (dto) => dto,
      '[FriendService] Invalid sendRequest response',
    );
  };

  getReceivedRequests = async (params?: PaginationParams, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/requests/received', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      friendRequestsPageSchema,
      toFriendRequestsPage,
      '[FriendService] Invalid getReceivedRequests response',
    );

  getSentRequests = async (params?: PaginationParams, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/requests/sent', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      friendRequestsPageSchema,
      toFriendRequestsPage,
      '[FriendService] Invalid getSentRequests response',
    );

  acceptRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/follows/${encodeURIComponent(userId)}/accept`),
      acceptFriendRequestResponseSchema,
      toNothing,
      '[FriendService] Invalid acceptRequest response',
    );

  rejectRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/follows/${encodeURIComponent(userId)}/reject`),
      rejectFriendRequestResponseSchema,
      toNothing,
      '[FriendService] Invalid rejectRequest response',
    );

  cancelRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/follows/${encodeURIComponent(userId)}`),
      cancelFriendRequestResponseSchema,
      toNothing,
      '[FriendService] Invalid cancelRequest response',
    );

  getFriends = async (params?: PaginationParams, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/friends', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      friendsPageSchema,
      toFriendsPage,
      '[FriendService] Invalid getFriends response',
    );

  searchUsers = async (
    params: SearchUsersParams,
    signal?: AbortSignal,
  ): Promise<Result<Page<SearchedUser>, FriendServiceError>> => {
    const query = params.query.trim();
    // 2자 미만이면 네트워크 요청 없이 실패한다
    if (!FriendPolicy.hasValidSearchQuery({ query })) {
      return err(new BusinessError(FRIEND_ERROR_CODE.SEARCH_QUERY_TOO_SHORT));
    }

    return parseApiResponse(
      await this.#httpClient.get('v1/follows/search', {
        signal,
        params: { q: query, cursor: params.cursor, limit: params.limit },
      }),
      searchedUsersPageSchema,
      toSearchedUsersPage,
      '[FriendService] Invalid searchUsers response',
    );
  };

  reorderFriend = async (followId: string, input: ReorderFriendInput) =>
    parseApiResponse(
      await this.#httpClient.patch(
        `v1/follows/friends/${encodeURIComponent(followId)}/reorder`,
        input,
      ),
      reorderedFriendSchema,
      (dto) => dto.friend,
      '[FriendService] Invalid reorderFriend response',
    );

  removeFriend = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/follows/${encodeURIComponent(userId)}`),
      removeFriendResponseSchema,
      toNothing,
      '[FriendService] Invalid removeFriend response',
    );
}
