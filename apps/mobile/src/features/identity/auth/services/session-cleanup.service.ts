import type { AppLogger } from '@src/core/ports/app-logger';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { SignOutEpoch } from '@src/core/session/sign-out-epoch';
import type { DraftService } from '@src/shared/draft/draft.service';
import { getErrorMessage } from '@src/shared/errors';

import { AUTH_LOG_EVENT } from '../constants/auth-log-events';
import type { UserDeviceDataService } from './user-device-data.service';

export interface SessionQueryCache {
  /** 진행 중 mutation이 끝나도 콜백이 돌지 않게 한다. 요청은 끊지 않는다 */
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
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  voiceNotes: { removeAll(): void };
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  deviceTimezone: { clear(): void };
  /** 계정 구분이 없는 키라 지우지 않으면 다음 계정이 앞사람의 초대를 받는다. 위층 기능이라 조립하는 곳이 넘긴다 */
  pendingRedemption: { clear(): void };
  userDeviceData: Pick<UserDeviceDataService, 'clearForUser'>;
  /** 위층 기능이라 조립하는 곳이 넘긴다 */
  pushDevice: { requestRelease(): void };
  /** 알림 payload에 받는 사람이 없어 지우지 않으면 다음 계정이 공용 기기에서 앞사람의 알림 문구를 본다 */
  pushNotification: Pick<PushNotificationGateway, 'dismissDelivered'>;
  /** 로그아웃·탈퇴만 올린다. 만료는 같은 사람이 돌아와 이어 쓰므로 늦은 저장을 막지 않는다 */
  signOutEpoch: Pick<SignOutEpoch, 'advance'>;
  logger: Pick<AppLogger, 'warn'>;
}

/** 한 단계가 실패해도 계속한다. 미인증 전환 커밋 전에 비우면 마운트된 인증 화면이 다시 요청해 401 루프를 돈다 */
export class SessionCleanupService {
  readonly #queryCache: SessionQueryCache;
  readonly #persistedQueryCache: SessionPersistedQueryCache;
  readonly #drafts: SessionCleanupServicePorts['drafts'];
  readonly #voiceNotes: SessionCleanupServicePorts['voiceNotes'];
  readonly #deviceTimezone: SessionCleanupServicePorts['deviceTimezone'];
  readonly #pendingRedemption: SessionCleanupServicePorts['pendingRedemption'];
  readonly #userDeviceData: SessionCleanupServicePorts['userDeviceData'];
  readonly #pushDevice: SessionCleanupServicePorts['pushDevice'];
  readonly #pushNotification: SessionCleanupServicePorts['pushNotification'];
  readonly #signOutEpoch: SessionCleanupServicePorts['signOutEpoch'];
  readonly #logger: SessionCleanupServicePorts['logger'];

  constructor({
    queryCache,
    persistedQueryCache,
    drafts,
    voiceNotes,
    deviceTimezone,
    pendingRedemption,
    userDeviceData,
    pushDevice,
    pushNotification,
    signOutEpoch,
    logger,
  }: SessionCleanupServicePorts) {
    this.#queryCache = queryCache;
    this.#persistedQueryCache = persistedQueryCache;
    this.#drafts = drafts;
    this.#voiceNotes = voiceNotes;
    this.#deviceTimezone = deviceTimezone;
    this.#pendingRedemption = pendingRedemption;
    this.#userDeviceData = userDeviceData;
    this.#pushDevice = pushDevice;
    this.#pushNotification = pushNotification;
    this.#signOutEpoch = signOutEpoch;
    this.#logger = logger;
  }

  /** 로그아웃·탈퇴: 캐시와 이 계정의 기기 데이터를 모두 지운다 */
  afterSignedOut = (): void => {
    // 지우기 전에 올려야 그 사이 늦게 온 초안·녹음 쓰기도 버린다
    this.#run('sign-out-epoch', () => this.#signOutEpoch.advance());
    this.afterSessionEnded();
    this.#run('drafts', () => this.#drafts.removeAll());
    this.#run('voice-notes', () => this.#voiceNotes.removeAll());
    this.#run('device-timezone', () => this.#deviceTimezone.clear());
    this.#run('pending-redemption', () => this.#pendingRedemption.clear());
    this.#dismissDeliveredNotifications();
  };

  /** 탈퇴: 그 계정의 안내 기록을 지운다. 로그아웃은 같은 사람이 돌아오므로 남긴다 */
  afterAccountDeleted = (accountId: string): void => {
    this.#run('user-device-data', () => this.#userDeviceData.clearForUser(accountId));
  };

  /** 세션 만료: 서버에 로그아웃을 알리지 못했으므로 이 기기의 푸시 등록도 푼다 */
  afterSessionExpired = (): void => {
    this.afterSessionEnded();
    this.#run('push-device-release', () => this.#pushDevice.requestRelease());
    // 만료 뒤에는 다른 계정이 로그인할 수 있다
    this.#dismissDeliveredNotifications();
  };

  /** 세션 만료·미인증 부팅: 캐시만 지운다. 같은 사람이 돌아오면 초안을 이어 쓴다 */
  afterSessionEnded = (): void => {
    this.#run('pending-mutations', () => this.#queryCache.abandonPendingMutations());
    this.#run('query-cache', () => this.#queryCache.clear());
    this.#run('persisted-query-cache', () => this.#persistedQueryCache.clear());
  };

  /** 마운트된 채 다시 그려진 관찰자가 비운 콜백을 복구해 정리 뒤 캐시를 채울 수 있어 로그인 직전에 다시 비운다 */
  beforeSignIn = (): void => {
    this.#run('sign-in-queries', () => this.#queryCache.clearQueries());
  };

  #dismissDeliveredNotifications = (): void => {
    const step = 'delivered-notifications';
    this.#run(step, () => {
      this.#pushNotification
        .dismissDelivered()
        .catch((error: unknown) => this.#warnStepFailed(step, error));
    });
  };

  #run = (step: string, cleanup: () => void): void => {
    try {
      cleanup();
    } catch (error) {
      this.#warnStepFailed(step, error);
    }
  };

  #warnStepFailed = (step: string, error: unknown): void => {
    this.#logger.warn(AUTH_LOG_EVENT.SESSION_CLEANUP_STEP_FAILED, {
      step,
      error: getErrorMessage(error),
    });
  };
}
