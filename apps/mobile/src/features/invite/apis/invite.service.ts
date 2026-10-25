import { inviteAvailabilityResponseSchema, invitePreviewResponseSchema } from '@aido/api';
import type { HttpClient } from '@src/core/ports/http';
import type { ApiError } from '@src/shared/errors/api-error';
import { ParseError } from '@src/shared/errors/infra-error';
import { err, ok, type Result } from '@src/shared/errors/result';

import type { InvitePreview } from '../domains/invite-preview.model';
import {
  type InviteLinkSource,
  type PendingRedemption,
  InviteRedemptionPolicy,
} from '../domains/invite-redemption.model';
import { type InviteError, InviteErrors } from '../domains/invite.error';
import { type InviteCode, parseInviteCode } from '../domains/invite.model';
import { parseInstallReferrerInviteCode } from '../utils/install-referrer';
import type { InstallReferrerRepository } from './install-referrer.repository';
import { toInvitePreview } from './invite.mapper';
import type { PendingRedemptionRepository } from './pending-redemption.repository';

type InviteServiceError = ApiError | InviteError;

interface InviteServiceDependencies {
  /** 미리보기·사용 가능 여부는 로그인 전에도 부른다 */
  publicHttpClient: HttpClient;
  pendingRedemptionRepository: PendingRedemptionRepository;
  installReferrerRepository: InstallReferrerRepository;
}

interface SavePendingRedemptionInput {
  inviteCode: InviteCode;
  source: InviteLinkSource;
  ownerId: string | null;
}

export class InviteService {
  readonly #publicHttpClient: HttpClient;
  readonly #pendingRedemptionRepository: PendingRedemptionRepository;
  readonly #installReferrerRepository: InstallReferrerRepository;

  constructor({
    publicHttpClient,
    pendingRedemptionRepository,
    installReferrerRepository,
  }: InviteServiceDependencies) {
    this.#publicHttpClient = publicHttpClient;
    this.#pendingRedemptionRepository = pendingRedemptionRepository;
    this.#installReferrerRepository = installReferrerRepository;
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

  savePendingRedemption = (input: SavePendingRedemptionInput, now: Date) => {
    this.#pendingRedemptionRepository.save({ ...input, savedAt: now });
  };

  /** 이 사용자가 이어서 열 초대를 꺼낸다. 지났거나 남의 초대면 지우고 null이다 */
  takePendingRedemption = (userId: string, now: Date): PendingRedemption | null => {
    const pending = this.#pendingRedemptionRepository.get();
    if (pending == null) {
      return null;
    }

    this.#pendingRedemptionRepository.clear();
    if (
      !InviteRedemptionPolicy.isFresh(pending, now) ||
      !InviteRedemptionPolicy.belongsTo(pending, userId)
    ) {
      return null;
    }

    return pending;
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
      ownerId: null,
    };
    this.#pendingRedemptionRepository.save(pending);
    return pending;
  };
}
