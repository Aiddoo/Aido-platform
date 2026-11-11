import type { InstallReferrerGateway } from '@src/core/ports/install-referrer-gateway';
import type { Instant } from '@src/shared/date/instant';

import type { InviteCode } from '../domains/invite-code.model';
import { PendingRedemptionPolicy } from '../domains/invite-redemption.model';
import { type InviteLinkSource, type PendingRedemption } from '../domains/invite-redemption.model';
import { isTerminalRedeemFailure, toRedeemFailureReason } from '../domains/invite.error';
import { parseInstallReferrerInviteCode } from '../utils/install-referrer';
import type { InstallReferrerRepository } from './install-referrer.repository';
import type { PendingRedemptionRepository } from './pending-redemption.repository';

interface PendingRedemptionServicePorts {
  pendingRedemptionRepository: PendingRedemptionRepository;
  installReferrerRepository: InstallReferrerRepository;
  installReferrerGateway: InstallReferrerGateway;
}

interface SavePendingRedemptionInput {
  inviteCode: InviteCode;
  source: InviteLinkSource;
}

/** 로그인 전에 받은 초대(링크·설치 referrer)를 기기에 남겼다가 이어서 여는 흐름 */
export class PendingRedemptionService {
  readonly #pendingRedemptionRepository: PendingRedemptionRepository;
  readonly #installReferrerRepository: InstallReferrerRepository;
  readonly #installReferrerGateway: InstallReferrerGateway;

  constructor({
    pendingRedemptionRepository,
    installReferrerRepository,
    installReferrerGateway,
  }: PendingRedemptionServicePorts) {
    this.#pendingRedemptionRepository = pendingRedemptionRepository;
    this.#installReferrerRepository = installReferrerRepository;
    this.#installReferrerGateway = installReferrerGateway;
  }

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
    if (pending == null || !PendingRedemptionPolicy.isFresh(pending, now)) {
      return null;
    }

    return pending;
  };

  /** 기한이 지난 초대를 저장소에서 지운다 */
  discardStalePendingRedemption = (now: Instant) => {
    const pending = this.#pendingRedemptionRepository.find();
    if (pending != null && !PendingRedemptionPolicy.isFresh(pending, now)) {
      this.#pendingRedemptionRepository.clear();
    }
  };

  /** 사용자가 초대 카드를 봤을 때. 닫고 나가도 다음 실행 때 다시 열지 않는다 */
  clearPendingRedemption = () => {
    this.#pendingRedemptionRepository.clear();
  };

  /** 남겨 둔 초대가 이 코드이고 더는 쓸 수 없는 실패면 지워 다음 실행 때 다시 열지 않는다 */
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
