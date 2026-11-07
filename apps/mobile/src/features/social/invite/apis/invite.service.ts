import {
  type GetInvitedFriendsQuery,
  inviteAvailabilityResponseSchema,
  invitePreviewResponseSchema,
} from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, type Result } from '@src/core/errors/result';
import type { HttpClient } from '@src/core/ports/http';
import type { InstallationIdGateway } from '@src/core/ports/installation-id';
import type { Logger } from '@src/core/ports/logger';
import { BusinessError } from '@src/shared/errors/business-error';
import { parseApiResponse } from '@src/shared/errors/parse-api-response';
import { getErrorMessage } from '@src/shared/errors/to-error';
import type { Page } from '@src/shared/types/page.types';
import { identity } from 'es-toolkit';

import { INVITE_LOG_EVENT } from '../constants/invite-log-events';
import { InviteRedemptionPolicy } from '../domains/invite-redemption.model';
import {
  INVITE_ERROR_CODE,
  type InviteErrorCode,
  isTerminalRedeemFailure,
  toRedeemFailureReason,
} from '../domains/invite.error';
import { parseInviteCode } from '../domains/invite.model';
import type { InvitePreview } from '../schemas/invite-preview.schema';
import {
  type InviteLinkSource,
  type PendingRedemption,
  type RedemptionResult,
  RedemptionResultSchema,
} from '../schemas/invite-redemption.schema';
import { type Invite, type InviteCode, InviteSchema } from '../schemas/invite.schema';
import { type InvitedFriend, InvitedFriendsPageSchema } from '../schemas/invited-friend.schema';
import { parseInstallReferrerInviteCode } from '../utils/install-referrer';
import type { AllDoneBannerRepository } from './all-done-banner.repository';
import type { InstallReferrerRepository } from './install-referrer.repository';
import { toInvitedFriendsPage, toInvitePreview } from './invite.mapper';
import type { PawPrintCelebrationRepository } from './paw-print-celebration.repository';
import type { PendingRedemptionRepository } from './pending-redemption.repository';

type InviteServiceError = ApiError | BusinessError<InviteErrorCode>;

interface InviteServiceDependencies {
  /** 미리보기·사용 가능 여부는 로그인 전에도 부른다 */
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
  pendingRedemptionRepository: PendingRedemptionRepository;
  installReferrerRepository: InstallReferrerRepository;
  pawPrintCelebrationRepository: PawPrintCelebrationRepository;
  installationIdGateway: InstallationIdGateway;
  allDoneBannerRepository: AllDoneBannerRepository;
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
  readonly #pawPrintCelebrationRepository: PawPrintCelebrationRepository;
  readonly #installationIdGateway: InstallationIdGateway;
  readonly #allDoneBannerRepository: AllDoneBannerRepository;
  readonly #logger: Pick<Logger, 'warn'>;

  constructor({
    publicHttpClient,
    authHttpClient,
    pendingRedemptionRepository,
    installReferrerRepository,
    pawPrintCelebrationRepository,
    installationIdGateway,
    allDoneBannerRepository,
    logger,
  }: InviteServiceDependencies) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#pendingRedemptionRepository = pendingRedemptionRepository;
    this.#installReferrerRepository = installReferrerRepository;
    this.#pawPrintCelebrationRepository = pawPrintCelebrationRepository;
    this.#installationIdGateway = installationIdGateway;
    this.#allDoneBannerRepository = allDoneBannerRepository;
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
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(new BusinessError(INVITE_ERROR_CODE.INVALID_CODE));
    }

    const result = await this.#publicHttpClient.get(`v1/invites/${inviteCode}`, { signal });
    if (!result.ok) {
      // 이어서 열려던 초대가 없어졌거나 바뀌었으면 다음 실행 때 다시 열지 않는다
      if (
        this.#pendingRedemptionRepository.get()?.inviteCode === inviteCode &&
        isTerminalRedeemFailure(toRedeemFailureReason(result.error))
      ) {
        this.#pendingRedemptionRepository.clear();
      }
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
      RedemptionResultSchema,
      identity,
      '[InviteService] Invalid redeem response',
    );
  };

  /** 내 초대 코드·링크와 발자국 요약. 처음 부르면 서버가 코드를 만든다 */
  getInvite = async (signal?: AbortSignal): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.get('v1/invites/me', { signal }),
      InviteSchema,
      identity,
      '[InviteService] Invalid getInvite response',
    );

  /** 링크를 새로 만든다. 이전 코드는 다시 쓸 수 없다 */
  rotateInviteCode = async (): Promise<Result<Invite, ApiError>> =>
    parseApiResponse(
      await this.#authHttpClient.post('v1/invites/me/rotate'),
      InviteSchema,
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
      InvitedFriendsPageSchema,
      toInvitedFriendsPage,
      '[InviteService] Invalid getInvitedFriends response',
    );

  dismissAllDoneBanner = (userId: string, dateKey: string) => {
    this.#allDoneBannerRepository.dismiss(userId, dateKey);
  };

  getCelebratedPawPrintCount = (userId: string) =>
    this.#pawPrintCelebrationRepository.getCelebratedCount(userId);

  /** 줄어든 경우(보상 회수 등)에도 그 수로 맞춰 다음 발자국에서 다시 축하한다 */
  markPawPrintsCelebrated = (userId: string, pawPrintedCount: number) => {
    this.#pawPrintCelebrationRepository.setCelebratedCount(userId, pawPrintedCount);
  };

  savePendingRedemption = (input: SavePendingRedemptionInput, now: Date) => {
    this.#pendingRedemptionRepository.save({ ...input, savedAt: now });
  };

  /**
   * 로그인 전에 남긴 초대를 찾는다. 지났으면 지우고 null이다. 로그인 전에만 남기므로 처음 로그인한
   * 계정이 이어서 연다. 찾기만 하고 지우지 않아 카드가 뜨기 전에 앱이 꺼져도 다음 실행 때 이어서 연다.
   */
  findPendingRedemption = (now: Date): PendingRedemption | null => {
    const pending = this.#pendingRedemptionRepository.get();
    if (pending == null) {
      return null;
    }

    if (!InviteRedemptionPolicy.isFresh(pending, now)) {
      this.#pendingRedemptionRepository.clear();
      return null;
    }

    return pending;
  };

  /** 수락했거나 다시 열어도 같은 실패라 더 이어서 열 필요가 없을 때 */
  clearPendingRedemption = () => {
    this.#pendingRedemptionRepository.clear();
  };

  /** 처음 실행 때 Play 설치 referrer의 초대 코드를 이어서 열 초대로 남긴다 */
  captureInstallReferrer = async (now: Date): Promise<PendingRedemption | null> => {
    if (this.#installReferrerRepository.hasChecked()) {
      return null;
    }

    // 읽기에 실패해도 다음 실행마다 다시 묻지 않는다
    this.#installReferrerRepository.markChecked();
    const referrer = await this.#installReferrerRepository.read();
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
