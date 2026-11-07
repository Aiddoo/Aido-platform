import type { Logger } from '@src/core/ports/logger';
import type { DraftService } from '@src/shared/draft/draft.service';
import { getErrorMessage } from '@src/shared/errors';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

export interface SessionQueryCache {
  /** 진행 중 mutation이 끝나도 콜백이 돌지 않게 한다. 요청은 끊지 않는다 */
  abandonPendingMutations(): void;
  clear(): void;
  clearQueries(): void;
}

interface SessionPersistedQueryCache {
  clear(): void;
}

interface SessionCleanupPorts {
  queryCache: SessionQueryCache;
  persistedQueryCache: SessionPersistedQueryCache;
  drafts: Pick<DraftService, 'removeAll'>;
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  voiceNotes: { removeAll(): void };
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  deviceTimezone: { clear(): void };
  /** 계정 구분이 없는 키라 지우지 않으면 다음 계정이 앞사람의 초대를 받는다. 위층 기능이라 조립하는 곳이 넘긴다 */
  pendingRedemption: { clear(): void };
  /** 계정별 안내 기록. 위층 기능이라 조립하는 곳이 넘긴다 */
  accountGuides: readonly { removeAccount(accountId: string): void }[];
  logger: Pick<Logger, 'warn'>;
}

/**
 * 세션이 끝날 때 기기에 남은 계정 데이터를 정리한다.
 * 다음 사람에게 보이면 안 되는 데이터라 한 단계가 실패해도 나머지를 계속한다.
 * 호출은 미인증 전환이 커밋된 뒤여야 한다. 같은 tick에 비우면 아직 마운트된 인증 화면이
 * 다시 요청해 401 루프를 돈다.
 */
export class SessionCleanupService {
  readonly #ports: SessionCleanupPorts;

  constructor(ports: SessionCleanupPorts) {
    this.#ports = ports;
  }

  /** 로그아웃·탈퇴: 캐시와 이 계정의 기기 데이터를 모두 지운다 */
  afterSignedOut = (): void => {
    this.afterSessionEnded();
    this.#run('drafts', () => this.#ports.drafts.removeAll());
    this.#run('voice-notes', () => this.#ports.voiceNotes.removeAll());
    this.#run('device-timezone', () => this.#ports.deviceTimezone.clear());
    this.#run('pending-redemption', () => this.#ports.pendingRedemption.clear());
  };

  /** 탈퇴: 그 계정의 안내 기록을 지운다. 로그아웃은 같은 사람이 돌아오므로 남긴다 */
  afterAccountDeleted = (accountId: string): void => {
    this.#ports.accountGuides.forEach((guides) => {
      this.#run('account-guides', () => guides.removeAccount(accountId));
    });
  };

  /** 세션 만료·미인증 부팅: 캐시만 지운다. 같은 사람이 돌아오면 초안을 이어 쓴다 */
  afterSessionEnded = (): void => {
    this.#run('pending-mutations', () => this.#ports.queryCache.abandonPendingMutations());
    this.#run('query-cache', () => this.#ports.queryCache.clear());
    this.#run('persisted-query-cache', () => this.#ports.persistedQueryCache.clear());
  };

  /**
   * 마운트된 채 다시 그려진 관찰자는 비운 콜백을 복구한다. 그 콜백이 정리 뒤 캐시를 채워도
   * 다음 계정이 지난 값을 신선한 값으로 읽어 지난 계정의 초안만 남기는 일이 없게 다시 비운다.
   */
  beforeSignIn = (): void => {
    this.#run('sign-in-queries', () => this.#ports.queryCache.clearQueries());
  };

  #run = (step: string, cleanup: () => void): void => {
    try {
      cleanup();
    } catch (error) {
      this.#ports.logger.warn(AUTH_LOG_EVENT.SESSION_CLEANUP_STEP_FAILED, {
        step,
        error: getErrorMessage(error),
      });
    }
  };
}
