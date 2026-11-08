import type { Logger } from '@src/core/ports/logger';
import type { DraftService } from '@src/shared/draft/draft.service';
import { getErrorMessage } from '@src/shared/errors';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';

export interface SessionQueryCache {
  abandonPendingMutations(): void;
  clear(): void;
  clearQueries(): void;
}

interface SessionPersistedQueryCache {
  clear(): void;
}

interface SessionCleanupServicePorts {
  queryCache: SessionQueryCache;
  persistedQueryCache: SessionPersistedQueryCache;
  drafts: Pick<DraftService, 'removeAll'>;
  voiceNotes: { removeAll(): void };
  deviceTimezone: { clear(): void };
  // 계정 구분이 없는 키라 지우지 않으면 다음 계정이 앞사람의 초대를 받는다
  pendingRedemption: { clear(): void };
  accountGuides: readonly { removeAccount(accountId: string): void }[];
  logger: Pick<Logger, 'warn'>;
}

// 미인증 전환이 커밋된 뒤 호출한다. 같은 tick에 비우면 마운트된 인증 화면이 다시 요청해 401 루프를 돈다
export class SessionCleanupService {
  readonly #queryCache: SessionQueryCache;
  readonly #persistedQueryCache: SessionPersistedQueryCache;
  readonly #drafts: SessionCleanupServicePorts['drafts'];
  readonly #voiceNotes: SessionCleanupServicePorts['voiceNotes'];
  readonly #deviceTimezone: SessionCleanupServicePorts['deviceTimezone'];
  readonly #pendingRedemption: SessionCleanupServicePorts['pendingRedemption'];
  readonly #accountGuides: SessionCleanupServicePorts['accountGuides'];
  readonly #logger: SessionCleanupServicePorts['logger'];

  constructor({
    queryCache,
    persistedQueryCache,
    drafts,
    voiceNotes,
    deviceTimezone,
    pendingRedemption,
    accountGuides,
    logger,
  }: SessionCleanupServicePorts) {
    this.#queryCache = queryCache;
    this.#persistedQueryCache = persistedQueryCache;
    this.#drafts = drafts;
    this.#voiceNotes = voiceNotes;
    this.#deviceTimezone = deviceTimezone;
    this.#pendingRedemption = pendingRedemption;
    this.#accountGuides = accountGuides;
    this.#logger = logger;
  }

  afterSignedOut = (): void => {
    this.afterSessionEnded();
    this.#run('drafts', () => this.#drafts.removeAll());
    this.#run('voice-notes', () => this.#voiceNotes.removeAll());
    this.#run('device-timezone', () => this.#deviceTimezone.clear());
    this.#run('pending-redemption', () => this.#pendingRedemption.clear());
  };

  // 로그아웃은 같은 사람이 돌아오므로 안내 기록을 남긴다
  afterAccountDeleted = (accountId: string): void => {
    this.#accountGuides.forEach((guides) => {
      this.#run('account-guides', () => guides.removeAccount(accountId));
    });
  };

  // 같은 사람이 돌아오면 초안을 이어 쓰도록 캐시만 지운다
  afterSessionEnded = (): void => {
    this.#run('pending-mutations', () => this.#queryCache.abandonPendingMutations());
    this.#run('query-cache', () => this.#queryCache.clear());
    this.#run('persisted-query-cache', () => this.#persistedQueryCache.clear());
  };

  // 비운 콜백을 복구한 관찰자가 정리 뒤 캐시를 채우지 않게 다시 비운다
  beforeSignIn = (): void => {
    this.#run('sign-in-queries', () => this.#queryCache.clearQueries());
  };

  #run = (step: string, cleanup: () => void): void => {
    try {
      cleanup();
    } catch (error) {
      this.#logger.warn(AUTH_LOG_EVENT.SESSION_CLEANUP_STEP_FAILED, {
        step,
        error: getErrorMessage(error),
      });
    }
  };
}
