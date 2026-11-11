import {
  acceptFriendRequestResponseSchema,
  cancelFriendRequestResponseSchema,
  friendsListResponseSchema,
  receivedRequestsResponseSchema,
  rejectFriendRequestResponseSchema,
  removeFriendResponseSchema,
  reorderFriendResponseSchema,
  searchUsersResponseSchema,
  sendFriendRequestResponseSchema,
  sentRequestsResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { BusinessError } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import { FRIEND_ERROR_CODE, type FriendErrorCode } from '../domains/friend.error';
import {
  isValidSearchQuery,
  isValidUserTag,
  type SearchedUserPage,
  type SendFriendRequestResult,
} from '../domains/friend.model';
import type {
  PaginationQuery,
  ReorderFriendInput,
  SearchUsersQuery,
} from '../schemas/friend-request.schema';
import {
  toFriendRequestsPage,
  toFriendsPage,
  toFriendUser,
  toSearchedUsersPage,
  toSendFriendRequestResult,
} from './friend.mapper';

type FriendServiceError = ApiError | BusinessError<FriendErrorCode>;

export class FriendService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  sendRequestByTag = async (
    userTag: string,
  ): Promise<Result<SendFriendRequestResult, FriendServiceError>> => {
    const tag = userTag.trim();
    if (!tag) {
      return err(new BusinessError(FRIEND_ERROR_CODE.EMPTY_TAG));
    }
    if (!isValidUserTag(tag)) {
      return err(new BusinessError(FRIEND_ERROR_CODE.INVALID_TAG));
    }

    return parseApiResponse(
      await this.#httpClient.post(`v1/follows/${encodeURIComponent(tag)}`),
      sendFriendRequestResponseSchema,
      toSendFriendRequestResult,
      '[FriendService] Invalid sendRequest response',
    );
  };

  getReceivedRequests = async (params?: PaginationQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/requests/received', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      receivedRequestsResponseSchema,
      toFriendRequestsPage,
      '[FriendService] Invalid getReceivedRequests response',
    );

  getSentRequests = async (params?: PaginationQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/requests/sent', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      sentRequestsResponseSchema,
      toFriendRequestsPage,
      '[FriendService] Invalid getSentRequests response',
    );

  acceptRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/follows/${encodeURIComponent(userId)}/accept`),
      acceptFriendRequestResponseSchema,
      noop,
      '[FriendService] Invalid acceptRequest response',
    );

  rejectRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/follows/${encodeURIComponent(userId)}/reject`),
      rejectFriendRequestResponseSchema,
      noop,
      '[FriendService] Invalid rejectRequest response',
    );

  cancelRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/follows/${encodeURIComponent(userId)}`),
      cancelFriendRequestResponseSchema,
      noop,
      '[FriendService] Invalid cancelRequest response',
    );

  getFriends = async (params?: PaginationQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/friends', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      friendsListResponseSchema,
      toFriendsPage,
      '[FriendService] Invalid getFriends response',
    );

  searchUsers = async (
    params: SearchUsersQuery,
    signal?: AbortSignal,
  ): Promise<Result<SearchedUserPage, FriendServiceError>> => {
    const query = params.query.trim();
    // 2자 미만이면 네트워크 요청 없이 실패한다
    if (!isValidSearchQuery(query)) {
      return err(new BusinessError(FRIEND_ERROR_CODE.SEARCH_QUERY_TOO_SHORT));
    }

    return parseApiResponse(
      await this.#httpClient.get('v1/follows/search', {
        signal,
        params: { q: query, cursor: params.cursor, limit: params.limit },
      }),
      searchUsersResponseSchema,
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
      reorderFriendResponseSchema,
      (dto) => toFriendUser(dto.friend),
      '[FriendService] Invalid reorderFriend response',
    );

  removeFriend = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/follows/${encodeURIComponent(userId)}`),
      removeFriendResponseSchema,
      noop,
      '[FriendService] Invalid removeFriend response',
    );
}
