import type {
  FriendsResult,
  ReceivedRequestsResult,
  SendRequestResult,
  SentRequestsResult,
} from '../models/friend.model';
import type { FriendRepository, PaginationParams } from '../repositories/friend.repository';
import {
  toFriendsResult,
  toReceivedRequestsResult,
  toSendRequestResult,
  toSentRequestsResult,
} from './friend.mapper';

export class FriendService {
  constructor(private readonly _repository: FriendRepository) {}

  sendRequestByTag = async (userTag: string): Promise<SendRequestResult> => {
    const dto = await this._repository.sendRequest(userTag);
    return toSendRequestResult(dto);
  };

  getReceivedRequests = async (params?: PaginationParams): Promise<ReceivedRequestsResult> => {
    const dto = await this._repository.getReceivedRequests(params);
    return toReceivedRequestsResult(dto);
  };

  getSentRequests = async (params?: PaginationParams): Promise<SentRequestsResult> => {
    const dto = await this._repository.getSentRequests(params);
    return toSentRequestsResult(dto);
  };

  acceptRequest = async (userId: string): Promise<void> => {
    await this._repository.acceptRequest(userId);
  };

  rejectRequest = async (userId: string): Promise<void> => {
    await this._repository.rejectRequest(userId);
  };

  cancelRequest = async (userId: string): Promise<void> => {
    await this._repository.cancelRequest(userId);
  };

  getFriends = async (params?: PaginationParams): Promise<FriendsResult> => {
    const dto = await this._repository.getFriends(params);
    return toFriendsResult(dto);
  };

  removeFriend = async (userId: string): Promise<void> => {
    await this._repository.removeFriend(userId);
  };
}
