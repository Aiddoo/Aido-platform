import type { InstallReferrerGateway } from '@src/core/ports/install-referrer-gateway';
import type { SyncStorage } from '@src/core/ports/sync-storage';
import { type Instant } from '@src/shared/date/instant';
import {
  readStoredValue,
  removeStoredValue,
  writeStoredValue,
} from '@src/shared/storage/define-stored-value';

import { isTerminalRedeemFailure, toRedeemFailureReason } from '../domains/invite.error';
import type { PendingRedemption } from '../domains/pending-redemption.model';
import { installReferrerCheckedStoredValue } from '../schemas/install-referrer-checked-storage.schema';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';
import { parseInstallReferrerInviteCode } from '../utils/install-referrer';

/** 로그인 전에 받은 초대(링크·설치 referrer)를 기기에 남겼다가 이어서 여는 흐름 */
export class PendingRedemptionService {
  readonly #storage: SyncStorage;
  readonly #installReferrerGateway: InstallReferrerGateway;

  constructor(storage: SyncStorage, installReferrerGateway: InstallReferrerGateway) {
    this.#storage = storage;
    this.#installReferrerGateway = installReferrerGateway;
  }

  /** 남겨 둔 초대가 이 코드이고 더는 쓸 수 없는 실패면 지워 다음 실행 때 다시 열지 않는다 */
  clearPendingRedemptionIfTerminal = (inviteCode: string, error: unknown) => {
    if (
      readStoredValue(this.#storage, pendingRedemptionStoredValue)?.inviteCode === inviteCode &&
      isTerminalRedeemFailure(toRedeemFailureReason(error))
    ) {
      removeStoredValue(this.#storage, pendingRedemptionStoredValue);
    }
  };

  /** 처음 실행 때 Play 설치 referrer의 초대 코드를 이어서 열 초대로 남긴다 */
  captureInstallReferrer = async (now: Instant): Promise<PendingRedemption | null> => {
    if (readStoredValue(this.#storage, installReferrerCheckedStoredValue) != null) {
      return null;
    }

    // 읽기에 실패해도 다음 실행마다 다시 묻지 않는다
    writeStoredValue(this.#storage, installReferrerCheckedStoredValue, '1');
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
    writeStoredValue(this.#storage, pendingRedemptionStoredValue, pending);
    return pending;
  };
}
