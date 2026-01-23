import {
  type AcceptFriendRequestResponse,
  acceptFriendRequestResponseSchema,
  type CancelFriendRequestResponse,
  cancelFriendRequestResponseSchema,
  type ReceivedRequestsResponse,
  type RejectFriendRequestResponse,
  receivedRequestsResponseSchema,
  rejectFriendRequestResponseSchema,
  type SentRequestsResponse,
  sentRequestsResponseSchema,
} from '@aido/validators';
import type { HttpClient } from '@src/core/ports/http';
import type { FriendRequestRepository, PaginationParams } from './friend-request.repository';

export class FriendRequestRepositoryImpl implements FriendRequestRepository {
  constructor(private readonly _httpClient: HttpClient) {}

  async getReceivedRequests(params?: PaginationParams): Promise<ReceivedRequestsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const url = queryString
      ? `v1/follows/requests/received?${queryString}`
      : 'v1/follows/requests/received';

    const { data } = await this._httpClient.get<ReceivedRequestsResponse>(url);

    const result = receivedRequestsResponseSchema.safeParse(data);
    if (!result.success) {
      console.error(
        '[FriendRequestRepository] Invalid getReceivedRequests response:',
        result.error,
      );
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async getSentRequests(params?: PaginationParams): Promise<SentRequestsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.cursor) searchParams.set('cursor', params.cursor);
    if (params?.limit) searchParams.set('limit', params.limit.toString());

    const queryString = searchParams.toString();
    const url = queryString
      ? `v1/follows/requests/sent?${queryString}`
      : 'v1/follows/requests/sent';

    const { data } = await this._httpClient.get<SentRequestsResponse>(url);

    const result = sentRequestsResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[FriendRequestRepository] Invalid getSentRequests response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async acceptRequest(userId: string): Promise<AcceptFriendRequestResponse> {
    const { data } = await this._httpClient.patch<AcceptFriendRequestResponse>(
      `v1/follows/${userId}/accept`,
    );

    const result = acceptFriendRequestResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[FriendRequestRepository] Invalid acceptRequest response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async rejectRequest(userId: string): Promise<RejectFriendRequestResponse> {
    const { data } = await this._httpClient.patch<RejectFriendRequestResponse>(
      `v1/follows/${userId}/reject`,
    );

    const result = rejectFriendRequestResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[FriendRequestRepository] Invalid rejectRequest response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }

  async cancelRequest(userId: string): Promise<CancelFriendRequestResponse> {
    const { data } = await this._httpClient.delete<CancelFriendRequestResponse>(
      `v1/follows/${userId}`,
    );

    const result = cancelFriendRequestResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[FriendRequestRepository] Invalid cancelRequest response:', result.error);
      throw new Error('Invalid API response format');
    }

    return result.data;
  }
}
