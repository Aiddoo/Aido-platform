import type { CreateUserReportInput } from '@aido/api';
import {
  blockedUsersResponseSchema,
  blockUserResponseSchema,
  createUserReportResponseSchema,
  unblockUserResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { noop } from 'es-toolkit';

import { toBlockedUsersPage } from './user-block.mapper';

/** 사용자 차단·해제·목록과 콘텐츠 신고. 차단 효과(친구 끊기, 서로 가리기)는 서버가 맡는다 */
export class ModerationApi {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  blockUser = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.post(`v1/blocks/${encodeURIComponent(userId)}`),
      blockUserResponseSchema,
      noop,
      '[ModerationApi] Invalid blockUser response',
    );

  unblockUser = async (userId: string) =>
    parseApiResponse(
      await this.#httpClient.delete(`v1/blocks/${encodeURIComponent(userId)}`),
      unblockUserResponseSchema,
      noop,
      '[ModerationApi] Invalid unblockUser response',
    );

  getBlockedUsers = async (params: { cursor?: string; limit: number }, signal?: AbortSignal) =>
    parseApiResponse(
      await this.#httpClient.get('v1/blocks', {
        signal,
        params,
      }),
      blockedUsersResponseSchema,
      toBlockedUsersPage,
      '[ModerationApi] Invalid getBlockedUsers response',
    );

  reportContent = async (request: CreateUserReportInput) =>
    parseApiResponse(
      await this.#httpClient.post('v1/reports', request),
      createUserReportResponseSchema,
      noop,
      '[ModerationApi] Invalid reportContent response',
    );
}
