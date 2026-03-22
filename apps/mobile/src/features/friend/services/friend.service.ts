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
  type ReorderFriendInput,
  type ReorderFriendResponse,
  receivedRequestsResponseSchema,
  rejectFriendRequestResponseSchema,
  removeFriendResponseSchema,
  reorderFriendResponseSchema,
  type SendFriendRequestResponse,
  type SentRequestsResponse,
  sendFriendRequestResponseSchema,
  sentRequestsResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';

import { type FriendError, FriendErrors } from '../models/friend.error';
import {
  FriendPolicy,
  type FriendRequest,
  type FriendUser,
  type PaginationParams,
  type SendRequestResult,
} from '../models/friend.model';
import {
  toFriendRequestsPage,
  toFriendsPage,
  toFriendUser,
  toSendRequestResult,
} from './friend.mapper';

export type FriendServiceError = ApiError | FriendError;

export class FriendService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  sendRequestByTag = async (
    userTag: string,
  ): Promise<Result<SendRequestResult, FriendServiceError>> => {
    const trimmed = userTag.trim();

    if (!trimmed) {
      return err(FriendErrors.emptyTag());
    }

    if (!FriendPolicy.isValidTag(trimmed)) {
      return err(FriendErrors.invalidTag());
    }

    const result = await this.#httpClient.post<SendFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(trimmed)}`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = sendFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[FriendService] Invalid sendRequest response: ${parsed.error.message}`);
    }

    return ok(toSendRequestResult(parsed.data));
  };

  acceptInviteByTag = async (
    userTag: string,
  ): Promise<Result<SendRequestResult, FriendServiceError>> => {
    const trimmed = userTag.trim();

    if (!trimmed) {
      return err(FriendErrors.emptyTag());
    }

    if (!FriendPolicy.isValidTag(trimmed)) {
      return err(FriendErrors.invalidTag());
    }

    const result = await this.#httpClient.post<SendFriendRequestResponse>(
      `v1/follows/invite/${encodeURIComponent(trimmed)}`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = sendFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid acceptInvite response: ${parsed.error.message}`,
      );
    }

    return ok(toSendRequestResult(parsed.data));
  };

  getReceivedRequests = async (
    params?: PaginationParams,
  ): Promise<Result<Page<FriendRequest>, ApiError>> => {
    const result = await this.#httpClient.get<ReceivedRequestsResponse>(
      'v1/follows/requests/received',
      { params: { cursor: params?.cursor, limit: params?.limit } },
    );

    if (!result.ok) {
      return result;
    }

    const parsed = receivedRequestsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid getReceivedRequests response: ${parsed.error.message}`,
      );
    }

    return ok(toFriendRequestsPage(parsed.data));
  };

  getSentRequests = async (
    params?: PaginationParams,
  ): Promise<Result<Page<FriendRequest>, ApiError>> => {
    const result = await this.#httpClient.get<SentRequestsResponse>('v1/follows/requests/sent', {
      params: { cursor: params?.cursor, limit: params?.limit },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = sentRequestsResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid getSentRequests response: ${parsed.error.message}`,
      );
    }

    return ok(toFriendRequestsPage(parsed.data));
  };

  acceptRequest = async (userId: string): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.patch<AcceptFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userId)}/accept`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = acceptFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid acceptRequest response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };

  rejectRequest = async (userId: string): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.patch<RejectFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userId)}/reject`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = rejectFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid rejectRequest response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };

  cancelRequest = async (userId: string): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.delete<CancelFriendRequestResponse>(
      `v1/follows/${encodeURIComponent(userId)}`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = cancelFriendRequestResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid cancelRequest response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };

  getFriends = async (params?: PaginationParams): Promise<Result<Page<FriendUser>, ApiError>> => {
    const result = await this.#httpClient.get<FriendsListResponse>('v1/follows/friends', {
      params: { cursor: params?.cursor, limit: params?.limit },
    });

    if (!result.ok) {
      return result;
    }

    const parsed = friendsListResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[FriendService] Invalid getFriends response: ${parsed.error.message}`);
    }

    return ok(toFriendsPage(parsed.data));
  };

  reorderFriend = async (
    followId: string,
    input: ReorderFriendInput,
  ): Promise<Result<FriendUser, ApiError>> => {
    const result = await this.#httpClient.patch<ReorderFriendResponse>(
      `v1/follows/friends/${encodeURIComponent(followId)}/reorder`,
      input,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = reorderFriendResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid reorderFriend response: ${parsed.error.message}`,
      );
    }

    return ok(toFriendUser(parsed.data.friend));
  };

  removeFriend = async (userId: string): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.delete<RemoveFriendResponse>(
      `v1/follows/${encodeURIComponent(userId)}`,
    );

    if (!result.ok) {
      return result;
    }

    const parsed = removeFriendResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[FriendService] Invalid removeFriend response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };
}
