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
} from '@aido/api/contracts/follow/v1';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

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

export class FriendApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  // 태그 형식은 친구 추가 폼(addFriendFormSchema)이 계약 규칙으로 막는다
  sendRequestByTag = async (userTag: string) =>
    parseApiResponse(
      await this.#httpClient.post(`v1/follows/${encodeURIComponent(userTag.trim())}`),
      sendFriendRequestResponseSchema,
      toSendFriendRequestResult,
      '[FriendApi] Invalid sendRequest response',
    );

  getReceivedRequests = async (params?: PaginationQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/requests/received', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      receivedRequestsResponseSchema,
      toFriendRequestsPage,
      '[FriendApi] Invalid getReceivedRequests response',
    );

  getSentRequests = async (params?: PaginationQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/requests/sent', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      sentRequestsResponseSchema,
      toFriendRequestsPage,
      '[FriendApi] Invalid getSentRequests response',
    );

  acceptRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/follows/${encodeURIComponent(userId)}/accept`),
      acceptFriendRequestResponseSchema,
      noop,
      '[FriendApi] Invalid acceptRequest response',
    );

  rejectRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.patch(`v1/follows/${encodeURIComponent(userId)}/reject`),
      rejectFriendRequestResponseSchema,
      noop,
      '[FriendApi] Invalid rejectRequest response',
    );

  cancelRequest = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/follows/${encodeURIComponent(userId)}`),
      cancelFriendRequestResponseSchema,
      noop,
      '[FriendApi] Invalid cancelRequest response',
    );

  getFriends = async (params?: PaginationQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/friends', {
        signal,
        params: { cursor: params?.cursor, limit: params?.limit },
      }),
      friendsListResponseSchema,
      toFriendsPage,
      '[FriendApi] Invalid getFriends response',
    );

  // 짧은 검색어는 조회 옵션(isValidSearchQuery)이 요청 전에 거른다
  searchUsers = async (params: SearchUsersQuery, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/follows/search', {
        signal,
        params: { q: params.query.trim(), cursor: params.cursor, limit: params.limit },
      }),
      searchUsersResponseSchema,
      toSearchedUsersPage,
      '[FriendApi] Invalid searchUsers response',
    );

  reorderFriend = async (followId: string, input: ReorderFriendInput) =>
    parseApiResponse(
      await this.#httpClient.patch(
        `v1/follows/friends/${encodeURIComponent(followId)}/reorder`,
        input,
      ),
      reorderFriendResponseSchema,
      (dto) => toFriendUser(dto.friend),
      '[FriendApi] Invalid reorderFriend response',
    );

  removeFriend = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/follows/${encodeURIComponent(userId)}`),
      removeFriendResponseSchema,
      noop,
      '[FriendApi] Invalid removeFriend response',
    );
}
