import {
  type GetInvitedFriendsQuery,
  inviteAvailabilityResponseSchema,
  invitePreviewResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import type { Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import type { InviteCode } from '../domains/invite-code.model';
import type { InvitePreview } from '../domains/invite-preview.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import type { Invite } from '../domains/invite.model';
import type { InvitedFriendPage } from '../domains/invited-friend.model';
import {
  inviteResponseSchema,
  invitedFriendsResponseSchema,
  redeemResponseSchema,
} from '../schemas/invite-response.schema';
import {
  toInvite,
  toInvitedFriendsPage,
  toInvitePreview,
  toRedemptionResult,
} from './invite.mapper';

interface InviteApiClients {
  /** 미리보기·사용 가능 여부는 로그인 전에도 부른다 */
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
}

export class InviteApi {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;

  constructor({ publicHttpClient, authHttpClient }: InviteApiClients) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
  }

  getAvailability = async (signal?: AbortSignal): Promise<Result<boolean, ApiError>> =>
    parseApiResponse(
      await this.#publicHttpClient.get('v1/invites/availability', { signal }),
      inviteAvailabilityResponseSchema,
      ({ enabled }) => enabled,
      '[InviteApi] Invalid getAvailability response',
    );

  getPreview = async (
    inviteCode: InviteCode,
    signal?: AbortSignal,
  ): Promise<Result<InvitePreview, ApiError>> =>
    parseApiResponse(
      await this.#publicHttpClient.get(`v1/invites/${inviteCode}`, { signal }),
      invitePreviewResponseSchema,
      toInvitePreview,
      '[InviteApi] Invalid getPreview response',
    );

  /** 같은 기기에서 보상을 두 번 받지 않게 설치 식별자를 함께 보낸다. 읽지 못했으면 빼고 보낸다 */
  redeem = async (
    inviteCode: InviteCode,
    installationId: string | null,
  ): Promise<Result<RedemptionResult, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.post(
        `v1/invites/${inviteCode}/redeem`,
        installationId == null ? {} : { installationId },
      ),
      redeemResponseSchema,
      toRedemptionResult,
      '[InviteApi] Invalid redeem response',
    );

  /** 내 초대 코드·링크와 발자국 요약. 처음 부르면 서버가 코드를 만든다 */
  getInvite = async (signal?: AbortSignal): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/invites/me', { signal }),
      inviteResponseSchema,
      toInvite,
      '[InviteApi] Invalid getInvite response',
    );

  /** 링크를 새로 만든다. 이전 코드는 다시 쓸 수 없다 */
  rotateInviteCode = async (): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/invites/me/rotate'),
      inviteResponseSchema,
      toInvite,
      '[InviteApi] Invalid rotateInviteCode response',
    );

  getInvitedFriends = async (
    params: Partial<GetInvitedFriendsQuery>,
    signal?: AbortSignal,
  ): Promise<Result<InvitedFriendPage, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/invites/me/invitees', {
        signal,
        params: { cursor: params.cursor, limit: params.limit, status: params.status },
      }),
      invitedFriendsResponseSchema,
      toInvitedFriendsPage,
      '[InviteApi] Invalid getInvitedFriends response',
    );
}
