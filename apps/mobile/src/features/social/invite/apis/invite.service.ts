import {
  type GetInvitedFriendsQuery,
  inviteAvailabilityResponseSchema,
  invitePreviewResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import type { Logger } from '@src/core/ports/logger';
import { BusinessError, getErrorMessage } from '@src/shared/errors';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { parseInviteCode } from '../domains/invite-code.model';
import type { InvitePreview } from '../domains/invite-preview.model';
import type { RedemptionResult } from '../domains/invite-redemption.model';
import { INVITE_ERROR_CODE, type InviteErrorCode } from '../domains/invite.error';
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
import type { PendingRedemptionService } from './pending-redemption.service';

type InviteServiceError = ApiError | BusinessError<InviteErrorCode>;

interface InviteServicePorts {
  /** 미리보기·사용 가능 여부는 로그인 전에도 부른다 */
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
  /** 미리보기가 더는 쓸 수 없는 초대라고 알려 주면 남겨 둔 초대를 지운다 */
  pendingRedemptionService: Pick<PendingRedemptionService, 'clearPendingRedemptionIfTerminal'>;
  installationIdGateway: InstallationIdGateway;
  logger: Pick<Logger, 'warn'>;
}

export class InviteService {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;
  readonly #pendingRedemptionService: InviteServicePorts['pendingRedemptionService'];
  readonly #installationIdGateway: InstallationIdGateway;
  readonly #logger: Pick<Logger, 'warn'>;

  constructor({
    publicHttpClient,
    authHttpClient,
    pendingRedemptionService,
    installationIdGateway,
    logger,
  }: InviteServicePorts) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#pendingRedemptionService = pendingRedemptionService;
    this.#installationIdGateway = installationIdGateway;
    this.#logger = logger;
  }

  getAvailability = async (signal?: AbortSignal): Promise<Result<boolean, ApiError>> =>
    parseApiResponse(
      await this.#publicHttpClient.get('v1/invites/availability', { signal }),
      inviteAvailabilityResponseSchema,
      ({ enabled }) => enabled,
      '[InviteService] Invalid getAvailability response',
    );

  /** 이어서 열려던 초대가 없어졌거나 바뀌어 미리보기를 받지 못했으면 기기에 남긴 초대도 지워 다음 실행 때 다시 열지 않는다 */
  getPreview = async (
    rawCode: string,
    signal?: AbortSignal,
  ): Promise<Result<InvitePreview, InviteServiceError>> => {
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));
    }

    const result = await this.#publicHttpClient.get(`v1/invites/${inviteCode}`, { signal });
    if (!result.ok) {
      this.#pendingRedemptionService.clearPendingRedemptionIfTerminal(inviteCode, result.error);
      return result;
    }

    return parseApiResponse(
      result,
      invitePreviewResponseSchema,
      toInvitePreview,
      '[InviteService] Invalid getPreview response',
    );
  };

  /** 초대를 수락한다. 같은 기기에서 보상을 두 번 받지 않게 설치 식별자를 함께 보낸다 */
  redeem = async (rawCode: string): Promise<Result<RedemptionResult, InviteServiceError>> => {
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));
    }

    const installationId = await this.#installationIdGateway.get().catch((error: unknown) => {
      this.#logger.warn(INVITE_LOG_EVENT.INSTALLATION_ID_READ_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    });
    return parseApiResponse(
      await this.#authHttpClient.post(
        `v1/invites/${inviteCode}/redeem`,
        installationId == null ? {} : { installationId },
      ),
      redeemResponseSchema,
      toRedemptionResult,
      '[InviteService] Invalid redeem response',
    );
  };

  /** 내 초대 코드·링크와 발자국 요약. 처음 부르면 서버가 코드를 만든다 */
  getInvite = async (signal?: AbortSignal): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/invites/me', { signal }),
      inviteResponseSchema,
      toInvite,
      '[InviteService] Invalid getInvite response',
    );

  /** 링크를 새로 만든다. 이전 코드는 다시 쓸 수 없다 */
  rotateInviteCode = async (): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/invites/me/rotate'),
      inviteResponseSchema,
      toInvite,
      '[InviteService] Invalid rotateInviteCode response',
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
      '[InviteService] Invalid getInvitedFriends response',
    );
}
