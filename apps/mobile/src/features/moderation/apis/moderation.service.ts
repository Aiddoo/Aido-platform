import {
  blockUserResponseSchema,
  type CreateUserReportInput,
  createUserReportResponseSchema,
  type GetBlockedUsersQuery,
  unblockUserResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { ok, type Result } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';

import type { BlockedUser } from '../domains/user-block.model';
import { BlockedUsersPageSchema, toBlockedUsersPage } from './user-block.mapper';

/** 사용자 차단·해제·목록과 콘텐츠 신고. 차단 효과(친구 끊기, 서로 가리기)는 서버가 맡는다 */
export class ModerationService {
  readonly #httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.#httpClient = httpClient;
  }

  blockUser = async (userId: string): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.post(`v1/blocks/${encodeURIComponent(userId)}`);
    if (!result.ok) {
      return result;
    }

    const parsed = blockUserResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ModerationService] Invalid blockUser response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };

  unblockUser = async (userId: string): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.delete(`v1/blocks/${encodeURIComponent(userId)}`);
    if (!result.ok) {
      return result;
    }

    const parsed = unblockUserResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ModerationService] Invalid unblockUser response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };

  getBlockedUsers = async (
    params: Partial<GetBlockedUsersQuery>,
    signal?: AbortSignal,
  ): Promise<Result<Page<BlockedUser>, ApiError>> => {
    const result = await this.#httpClient.get('v1/blocks', {
      signal,
      params: { cursor: params.cursor, limit: params.limit },
    });
    if (!result.ok) {
      return result;
    }

    const parsed = BlockedUsersPageSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ModerationService] Invalid getBlockedUsers response: ${parsed.error.message}`,
      );
    }

    return ok(toBlockedUsersPage(parsed.data));
  };

  reportContent = async (input: CreateUserReportInput): Promise<Result<void, ApiError>> => {
    const result = await this.#httpClient.post('v1/reports', input);
    if (!result.ok) {
      return result;
    }

    const parsed = createUserReportResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[ModerationService] Invalid reportContent response: ${parsed.error.message}`,
      );
    }

    return ok(undefined);
  };
}
