import {
  type GetInvitedFriendsQuery,
  inviteAvailabilityResponseSchema,
  invitePreviewResponseSchema,
} from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { InstallationIdGateway } from '@src/core/ports/installation-id';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';
import type { Page } from '@src/shared/types/page.type';

import type { InvitePreview } from '../domains/invite-preview.model';
import { type RedemptionResult, RedemptionResultSchema } from '../domains/invite-redemption.model';
import {
  type InviteLinkSource,
  type PendingRedemption,
  InviteRedemptionPolicy,
} from '../domains/invite-redemption.model';
import { type InviteError, InviteErrors } from '../domains/invite.error';
import { type InviteCode, parseInviteCode } from '../domains/invite.model';
import { type Invite, InviteSchema } from '../domains/invite.model';
import type { InvitedFriend } from '../domains/invited-friend.model';
import { parseInstallReferrerInviteCode } from '../utils/install-referrer';
import type { AllDoneBannerRepository } from './all-done-banner.repository';
import type { InstallReferrerRepository } from './install-referrer.repository';
import { InvitedFriendsPageSchema, toInvitedFriendsPage, toInvitePreview } from './invite.mapper';
import type { PawPrintCelebrationRepository } from './paw-print-celebration.repository';
import type { PendingRedemptionRepository } from './pending-redemption.repository';

type InviteServiceError = ApiError | InviteError;

interface InviteServiceDependencies {
  /** 미리보기·사용 가능 여부는 로그인 전에도 부른다 */
  publicHttpClient: HttpClient;
  authHttpClient: HttpClient;
  pendingRedemptionRepository: PendingRedemptionRepository;
  installReferrerRepository: InstallReferrerRepository;
  pawPrintCelebrationRepository: PawPrintCelebrationRepository;
  installationIdGateway: InstallationIdGateway;
  allDoneBannerRepository: AllDoneBannerRepository;
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

  constructor({
    publicHttpClient,
    authHttpClient,
    pendingRedemptionRepository,
    installReferrerRepository,
    pawPrintCelebrationRepository,
    installationIdGateway,
    allDoneBannerRepository,
  }: InviteServiceDependencies) {
    this.#publicHttpClient = publicHttpClient;
    this.#authHttpClient = authHttpClient;
    this.#pendingRedemptionRepository = pendingRedemptionRepository;
    this.#installReferrerRepository = installReferrerRepository;
    this.#pawPrintCelebrationRepository = pawPrintCelebrationRepository;
    this.#installationIdGateway = installationIdGateway;
    this.#allDoneBannerRepository = allDoneBannerRepository;
  }

  getAvailability = async (signal?: AbortSignal): Promise<Result<boolean, ApiError>> => {
    const result = await this.#publicHttpClient.get('v1/invites/availability', { signal });
    if (!result.ok) {
      return result;
    }

    const parsed = inviteAvailabilityResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[InviteService] Invalid getAvailability response: ${parsed.error.message}`,
      );
    }

    return ok(parsed.data.enabled);
  };

  getPreview = async (
    rawCode: string,
    signal?: AbortSignal,
  ): Promise<Result<InvitePreview, InviteServiceError>> => {
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(InviteErrors.invalidCode());
    }

    const result = await this.#publicHttpClient.get(`v1/invites/${inviteCode}`, { signal });
    if (!result.ok) {
      return result;
    }

    const parsed = invitePreviewResponseSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[InviteService] Invalid getPreview response: ${parsed.error.message}`);
    }

    return ok(toInvitePreview(parsed.data));
  };

  /** 초대를 수락한다. 같은 기기에서 보상을 두 번 받지 않게 설치 식별자를 함께 보낸다 */
  redeem = async (rawCode: string): Promise<Result<RedemptionResult, InviteServiceError>> => {
    const inviteCode = parseInviteCode(rawCode);
    if (inviteCode == null) {
      return err(InviteErrors.invalidCode());
    }

    const installationId = await this.#installationIdGateway.get().catch(() => null);
    const result = await this.#authHttpClient.post(
      `v1/invites/${inviteCode}/redeem`,
      installationId == null ? {} : { installationId },
    );
    if (!result.ok) {
      return result;
    }

    const parsed = RedemptionResultSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(`[InviteService] Invalid redeem response: ${parsed.error.message}`);
    }

    return ok(parsed.data);
  };

  /** 내 초대 코드·링크와 발자국 요약. 처음 부르면 서버가 코드를 만든다 */
  getInvite = async (signal?: AbortSignal): Promise<Result<Invite, ApiError>> => {
    const result = await this.#authHttpClient.get('v1/invites/me', { signal });
    if (!result.ok) {
      return result;
    }

    return ok(this.#parseInvite(result.value, 'getInvite'));
  };

  /** 링크를 새로 만든다. 이전 코드는 다시 쓸 수 없다 */
  rotateInviteCode = async (): Promise<Result<Invite, ApiError>> => {
    const result = await this.#authHttpClient.post('v1/invites/me/rotate');
    if (!result.ok) {
      return result;
    }

    return ok(this.#parseInvite(result.value, 'rotateInviteCode'));
  };

  getInvitedFriends = async (
    params: Partial<GetInvitedFriendsQuery>,
    signal?: AbortSignal,
  ): Promise<Result<Page<InvitedFriend>, ApiError>> => {
    const result = await this.#authHttpClient.get('v1/invites/me/invitees', {
      signal,
      params: { cursor: params.cursor, limit: params.limit, status: params.status },
    });
    if (!result.ok) {
      return result;
    }

    const parsed = InvitedFriendsPageSchema.safeParse(result.value);
    if (!parsed.success) {
      throw new ParseError(
        `[InviteService] Invalid getInvitedFriends response: ${parsed.error.message}`,
      );
    }

    return ok(toInvitedFriendsPage(parsed.data));
  };

  isAllDoneBannerDismissed = (userId: string, dateKey: string) =>
    this.#allDoneBannerRepository.isDismissed(userId, dateKey);

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

  #parseInvite(value: unknown, method: string): Invite {
    const parsed = InviteSchema.safeParse(value);
    if (!parsed.success) {
      throw new ParseError(`[InviteService] Invalid ${method} response: ${parsed.error.message}`);
    }

    return parsed.data;
  }

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
