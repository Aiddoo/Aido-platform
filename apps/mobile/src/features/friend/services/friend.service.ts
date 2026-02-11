import type { ApiError } from '@src/shared/errors/api-error';
import { err, type Result } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';

import { type FriendError, FriendErrors } from '../models/friend.error';
import {
  FriendPolicy,
  type FriendRequest,
  type FriendUser,
  type SendRequestResult,
} from '../models/friend.model';
import type { FriendRepository, PaginationParams } from '../repositories/friend.repository';

export type FriendServiceError = ApiError | FriendError;

export class FriendService {
  readonly #repository: FriendRepository;

  constructor(repository: FriendRepository) {
    this.#repository = repository;
  }

  sendRequestByTag = async (
    userTag: string,
  ): Promise<Result<SendRequestResult, FriendServiceError>> => {
    const trimmed = userTag.trim();

    // 1. 빈 값 검증
    if (!trimmed) {
      return err(FriendErrors.emptyTag());
    }

    // 2. 태그 형식 검증 (8자리 영문 대문자·숫자, validators/API와 동일)
    if (!FriendPolicy.isValidTag(trimmed)) {
      return err(FriendErrors.invalidTag());
    }

    // 3. Repository 호출
    return this.#repository.sendRequest(trimmed);
  };

  getReceivedRequests = async (
    params?: PaginationParams,
  ): Promise<Result<Page<FriendRequest>, ApiError>> => {
    return this.#repository.getReceivedRequests(params);
  };

  getSentRequests = async (
    params?: PaginationParams,
  ): Promise<Result<Page<FriendRequest>, ApiError>> => {
    return this.#repository.getSentRequests(params);
  };

  acceptRequest = async (userId: string): Promise<Result<void, ApiError>> => {
    return this.#repository.acceptRequest(userId);
  };

  rejectRequest = async (userId: string): Promise<Result<void, ApiError>> => {
    return this.#repository.rejectRequest(userId);
  };

  cancelRequest = async (userId: string): Promise<Result<void, ApiError>> => {
    return this.#repository.cancelRequest(userId);
  };

  getFriends = async (params?: PaginationParams): Promise<Result<Page<FriendUser>, ApiError>> => {
    return this.#repository.getFriends(params);
  };

  removeFriend = async (userId: string): Promise<Result<void, ApiError>> => {
    return this.#repository.removeFriend(userId);
  };
}
