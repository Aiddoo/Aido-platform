import {
  type GetInvitedFriendsQuery,
  inviteAvailabilityResponseSchema,
  invitePreviewResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http-client';
import type { InstallReferrerGateway } from '@src/core/ports/install-referrer-gateway';
import type { InstallationIdGateway } from '@src/core/ports/installation-id-gateway';
import type { Logger } from '@src/core/ports/logger';
import type { Instant } from '@src/shared/date/instant';
import { BusinessError } from '@src/shared/errors/business-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { getErrorMessage } from '@src/shared/errors/to-error';
import type { Page } from '@src/shared/types/page.types';
import { identity } from 'es-toolkit';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { InviteCodePolicy } from '../domains/invite-code.model';
import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import {
  INVITE_ERROR_CODE,
  type InviteErrorCode,
  isTerminalRedeemFailure,
  toRedeemFailureReason,
} from '../domains/invite.error';
import type { InvitePreview } from '../schemas/invite-preview.schema';
import {
  type InviteLinkSource,
  type PendingRedemption,
  type RedemptionResult,
  redemptionResultSchema,
} from '../schemas/invite-redemption.schema';
import { type Invite, type InviteCode, inviteSchema } from '../schemas/invite.schema';
import { type InvitedFriend, invitedFriendsPageSchema } from '../schemas/invited-friend.schema';
import { parseInstallReferrerInviteCode } from '../utils/install-referrer';
import type { InstallReferrerRepository } from './install-referrer.repository';
import { toInvitedFriendsPage, toInvitePreview } from './invite.mapper';
import type { PendingRedemptionRepository } from './pending-redemption.repository';

type InviteServiceError = ApiError | BusinessError<InviteErrorCode>;

interface InviteServicePorts {
  /** 미리보기·사용 가능 여부는 로그인 전에도 부른다 */
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
  pendingRedemptionRepository: PendingRedemptionRepository;
  installReferrerRepository: InstallReferrerRepository;
  installReferrerGateway: InstallReferrerGateway;
  installationIdGateway: InstallationIdGateway;
  logger: Pick<Logger, 'warn'>;
}

interface SavePendingRedemptionInput {
  inviteCode: InviteCode;
  source: InviteLinkSource;
}

export class InviteService {
  readonly #publicHttpClient: HttpClient;
  readonly #authHttpClient: HttpClient;
  readonly #pendingRedemptionRepository: PendingRedemptionRepository;
  readonly #installReferrerRepository: InstallReferrerRepository;
  readonly #installReferrerGateway: InstallReferrerGateway;
  readonly #installationIdGateway: InstallationIdGateway;
  readonly #logger: Pick<Logger, 'warn'>;

  constructor({
    publicHttpClient,
    authHttpClient,
    pendingRedemptionRepository,
    installReferrerRepository,
    installReferrerGateway,
    installationIdGateway,
    logger,
  }: InviteServicePorts) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#pendingRedemptionRepository = pendingRedemptionRepository;
    this.#installReferrerRepository = installReferrerRepository;
    this.#installReferrerGateway = installReferrerGateway;
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

  getPreview = async (
    rawCode: string,
    signal?: AbortSignal,
  ): Promise<Result<InvitePreview, InviteServiceError>> => {
    const inviteCode = InviteCodePolicy.parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));
    }

    const result = await this.#publicHttpClient.get(`v1/invites/${inviteCode}`, { signal });
    if (!result.ok) {
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
    const inviteCode = InviteCodePolicy.parseInviteCode(rawCode);
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
      redemptionResultSchema,
      identity,
      '[InviteService] Invalid redeem response',
    );
  };

  /** 내 초대 코드·링크와 발자국 요약. 처음 부르면 서버가 코드를 만든다 */
  getInvite = async (signal?: AbortSignal): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/invites/me', { signal }),
      inviteSchema,
      identity,
      '[InviteService] Invalid getInvite response',
    );

  /** 링크를 새로 만든다. 이전 코드는 다시 쓸 수 없다 */
  rotateInviteCode = async (): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/invites/me/rotate'),
      inviteSchema,
      identity,
      '[InviteService] Invalid rotateInviteCode response',
    );

  getInvitedFriends = async (
    params: Partial<GetInvitedFriendsQuery>,
    signal?: AbortSignal,
  ): Promise<Result<Page<InvitedFriend>, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/invites/me/invitees', {
        signal,
        params: { cursor: params.cursor, limit: params.limit, status: params.status },
      }),
      invitedFriendsPageSchema,
      toInvitedFriendsPage,
      '[InviteService] Invalid getInvitedFriends response',
    );

  savePendingRedemption = (input: SavePendingRedemptionInput, now: Instant) => {
    this.#pendingRedemptionRepository.save({ ...input, savedAt: now });
  };

  /**
   * 로그인 전에 남긴 초대 중 아직 이어서 열 수 있는 것. 없거나 기한이 지났으면 null이다.
   * 로그인 전에만 남기므로 처음 로그인한 계정이 이어서 연다. 저장소는 바꾸지 않아
   * 카드가 뜨기 전에 앱이 꺼져도 다음 실행 때 이어서 연다.
   */
  findFreshPendingRedemption = (now: Instant): PendingRedemption | null => {
    const pending = this.#pendingRedemptionRepository.find();
    if (pending == null || !InviteRedemptionPolicy.isFresh(pending, now)) {
      return null;
    }

    return pending;
  };

  /** 기한이 지난 초대를 저장소에서 지운다 */
  discardStalePendingRedemption = (now: Instant) => {
    const pending = this.#pendingRedemptionRepository.find();
    if (pending != null && !InviteRedemptionPolicy.isFresh(pending, now)) {
      this.#pendingRedemptionRepository.clear();
    }
  };

  /** 사용자가 초대 카드를 봤을 때. 닫고 나가도 다음 실행 때 다시 열지 않는다 */
  clearPendingRedemption = () => {
    this.#pendingRedemptionRepository.clear();
  };

  /** 이어서 열려던 초대가 없어졌거나 바뀌어 미리보기를 받지 못했으면 다음 실행 때 다시 열지 않는다 */
  clearPendingRedemptionIfTerminal = (inviteCode: string, error: unknown) => {
    if (
      this.#pendingRedemptionRepository.find()?.inviteCode === inviteCode &&
      isTerminalRedeemFailure(toRedeemFailureReason(error))
    ) {
      this.#pendingRedemptionRepository.clear();
    }
  };

  /** 처음 실행 때 Play 설치 referrer의 초대 코드를 이어서 열 초대로 남긴다 */
  captureInstallReferrer = async (now: Instant): Promise<PendingRedemption | null> => {
    if (this.#installReferrerRepository.hasChecked()) {
      return null;
    }

    // 읽기에 실패해도 다음 실행마다 다시 묻지 않는다
    this.#installReferrerRepository.markChecked();
    const referrer = await this.#installReferrerGateway.get();
    const inviteCode = referrer == null ? null : parseInstallReferrerInviteCode(referrer);
    if (inviteCode == null) {
      return null;
    }

    const pending: PendingRedemption = {
      inviteCode,
      source: 'install_referrer',
      savedAt: now,
    };
    this.#pendingRedemptionRepository.save(pending);
    return pending;
  };
}
