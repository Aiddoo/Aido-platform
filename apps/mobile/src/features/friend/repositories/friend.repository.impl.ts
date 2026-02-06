import {
  type AcceptFriendRequestResponse,
  acceptFriendRequestResponseSchema,
  type CancelFriendRequestResponse,
  cancelFriendRequestResponseSchema,
  type FriendsListResponse,
  friendsListResponseSchema,
  type ReceivedRequestsResponse,
  type RejectFriendRequestResponse,
  type RemoveFriendResponse,
  receivedRequestsResponseSchema,
  rejectFriendRequestResponseSchema,
  removeFriendResponseSchema,
  type SendFriendRequestResponse,
  type SentRequestsResponse,
  sendFriendRequestResponseSchema,
  sentRequestsResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';

import type { FriendRequest, FriendUser, SendRequestResult } from '../models/friend.model';
import { toFriendRequestsPage, toFriendsPage, toSendRequestResult } from './friend.mapper';
import type { FriendRepository, PaginationParams } from './friend.repository';

export class FriendRepositoryImpl implements FriendRepository {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  async sendRequest(userTag: string): Promise<Result<SendRequestResult, ApiError>> {
    const result = await this.#httpClient.post<SendFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userTag)}`,
    );

    if (!result.ok) return result;

    const parsed = sendFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid sendRequest response:', parsed.error);
      throw new ParseError();
    }

    return ok(toSendRequestResult(parsed.data));
  }

  async getReceivedRequests(
    params?: PaginationParams,
  ): Promise<Result<Page<FriendRequest>, ApiError>> {
    const result = await this.#httpClient.get<ReceivedRequestsResponse>(
      'v1/follows/requests/received',
      { params: { cursor: params?.cursor, limit: params?.limit } },
    );

    if (!result.ok) return result;

    const parsed = receivedRequestsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid getReceivedRequests response:', parsed.error);
      throw new ParseError();
    }

    return ok(toFriendRequestsPage(parsed.data));
  }

  async getSentRequests(params?: PaginationParams): Promise<Result<Page<FriendRequest>, ApiError>> {
    const result = await this.#httpClient.get<SentRequestsResponse>('v1/follows/requests/sent', {
      params: { cursor: params?.cursor, limit: params?.limit },
    });

    if (!result.ok) return result;

    const parsed = sentRequestsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid getSentRequests response:', parsed.error);
      throw new ParseError();
    }

    return ok(toFriendRequestsPage(parsed.data));
  }

  async acceptRequest(userId: string): Promise<Result<void, ApiError>> {
    const result = await this.#httpClient.patch<AcceptFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userId)}/accept`,
    );

    if (!result.ok) return result;

    const parsed = acceptFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid acceptRequest response:', parsed.error);
      throw new ParseError();
    }

    return ok(undefined);
  }

  async rejectRequest(userId: string): Promise<Result<void, ApiError>> {
    const result = await this.#httpClient.patch<RejectFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userId)}/reject`,
    );

    if (!result.ok) return result;

    const parsed = rejectFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid rejectRequest response:', parsed.error);
      throw new ParseError();
    }

    return ok(undefined);
  }

  async cancelRequest(userId: string): Promise<Result<void, ApiError>> {
    const result = await this.#httpClient.delete<CancelFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userId)}`,
    );

    if (!result.ok) return result;

    const parsed = cancelFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid cancelRequest response:', parsed.error);
      throw new ParseError();
    }

    return ok(undefined);
  }

  async getFriends(params?: PaginationParams): Promise<Result<Page<FriendUser>, ApiError>> {
    const result = await this.#httpClient.get<FriendsListResponse>('v1/follows/friends', {
      params: { cursor: params?.cursor, limit: params?.limit },
    });

    if (!result.ok) return result;

    const parsed = friendsListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid getFriends response:', parsed.error);
      throw new ParseError();
    }

    return ok(toFriendsPage(parsed.data));
  }

  async removeFriend(userId: string): Promise<Result<void, ApiError>> {
    const result = await this.#httpClient.delete<RemoveFriendResponse>(
      `v1/follows/${encodeURIComponent(userId)}`,
    );

    if (!result.ok) return result;

    const parsed = removeFriendResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      console.error('[FriendRepository] Invalid removeFriend response:', parsed.error);
      throw new ParseError();
    }

    return ok(undefined);
  }
}
