import { InvalidTagError } from '../models/friend.error';
import {
  FriendPolicy,
  type FriendsResult,
  type ReceivedRequestsResult,
  type SendRequestResult,
  type SentRequestsResult,
} from '../models/friend.model';
import type { FriendRepository, PaginationParams } from '../repositories/friend.repository';
import {
  toFriendsResult,
  toReceivedRequestsResult,
  toSendRequestResult,
  toSentRequestsResult,
} from './friend.mapper';

export class FriendService {
  readonly #repository: FriendRepository;

  constructor(repository: FriendRepository) {
    this.#repository = repository;
  }

  sendRequestByTag = async (userTag: string): Promise<SendRequestResult> => {
    if (!FriendPolicy.isValidTag(userTag)) {
      throw new InvalidTagError();
    }

    const dto = await this.#repository.sendRequest(userTag);
    return toSendRequestResult(dto);
  };

  getReceivedRequests = async (params?: PaginationParams): Promise<ReceivedRequestsResult> => {
    const dto = await this.#repository.getReceivedRequests(params);
    return toReceivedRequestsResult(dto);
  };

  getSentRequests = async (params?: PaginationParams): Promise<SentRequestsResult> => {
    const dto = await this.#repository.getSentRequests(params);
    return toSentRequestsResult(dto);
  };

  acceptRequest = async (userId: string): Promise<void> => {
    await this.#repository.acceptRequest(userId);
  };

  rejectRequest = async (userId: string): Promise<void> => {
    await this.#repository.rejectRequest(userId);
  };

  cancelRequest = async (userId: string): Promise<void> => {
    await this.#repository.cancelRequest(userId);
  };

  getFriends = async (params?: PaginationParams): Promise<FriendsResult> => {
    const dto = await this.#repository.getFriends(params);
    return toFriendsResult(dto);
  };

  removeFriend = async (userId: string): Promise<void> => {
    await this.#repository.removeFriend(userId);
  };
}
