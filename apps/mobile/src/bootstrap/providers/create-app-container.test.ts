import type { SyncStorage } from '@src/core/ports/sync-storage';
import { upsellDismissalStoredValue } from '@src/features/billing/subscription/schemas/upsell-dismissal-storage.schema';
import { AUTH_LOG_EVENT } from '@src/features/identity/auth/constants/auth-log-events';
import { deviceTimezoneStoredValue } from '@src/features/notification/schemas/device-timezone-storage.schema';
import { pushNoticeDismissedAtStoredValue } from '@src/features/notification/schemas/push-notice-dismissed-at-storage.schema';
import { pushPermissionDeferredAtStoredValue } from '@src/features/notification/schemas/push-permission-deferred-at-storage.schema';
import { createPendingRedemption } from '@src/features/social/invite/__tests__/invite.fixtures';
import { pendingRedemptionStoredValue } from '@src/features/social/invite/schemas/pending-redemption-storage.schema';
import { toInstant } from '@src/shared/date/instant';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createAppLoggerStub,
  createMemorySyncStorage,
  createTestDi,
  createTestPorts,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';

import { pendingStorageCleanupStoredValue } from '../schemas/pending-storage-cleanup-storage.schema';
import { createAppContainer } from './create-app-container';

const DISMISSED_AT = toInstant('2026-11-09T01:02:03.000Z');

function rememberPrompts(storage: SyncStorage, userId: string) {
  writeStoredValue(
    storage,
    upsellDismissalStoredValue,
    { AI_PARSE: createDateKey('2026-11-10') },
    userId,
  );
  writeStoredValue(storage, pushPermissionDeferredAtStoredValue, DISMISSED_AT, userId);
  writeStoredValue(storage, pushNoticeDismissedAtStoredValue, DISMISSED_AT, userId);
}

function readPrompts(storage: SyncStorage, userId: string) {
  return {
    upsell: readStoredValue(storage, upsellDismissalStoredValue, userId),
    deferredAt: readStoredValue(storage, pushPermissionDeferredAtStoredValue, userId),
    noticeDismissedAt: readStoredValue(storage, pushNoticeDismissedAtStoredValue, userId),
  };
}

describe('createAppContainer', () => {
  describe('sessionCleanupService', () => {
    it('로그아웃·탈퇴만 로그아웃 세대를 올리고 세션 만료는 올리지 않아 같은 사람의 늦은 저장을 막지 않는다', () => {
      // Given
      const di = createAppContainer(createTestPorts());

      // When
      di.sessionCleanupService.afterSessionExpired();

      // Then
      expect(di.signOutEpoch.current()).toBe(0);

      // When
      di.sessionCleanupService.afterSignedOut();

      // Then
      expect(di.signOutEpoch.current()).toBe(1);
    });

    it.each([
      ['로그아웃', 'afterSignedOut', { queryCache: true, drafts: true }],
      ['세션 만료', 'afterSessionExpired', { queryCache: true, drafts: false }],
      ['미인증 부팅', 'afterSessionEnded', { queryCache: true, drafts: false }],
    ] as const)(
      '암호화 저장소를 열지 못한 실행의 %s는 디스크 정리를 다음에 열 때로 표시한다',
      (_reason, step, expected) => {
        // Given
        const syncStorage = createMemorySyncStorage();
        const { sessionCleanupService } = createAppContainer(
          createTestPorts({ syncStorage, queryCacheStorage: null }),
        );

        // When
        sessionCleanupService[step]();

        // Then
        expect(readStoredValue(syncStorage, pendingStorageCleanupStoredValue)).toEqual(expected);
      },
    );

    it('암호화 저장소를 연 실행의 로그아웃은 바로 지워 정리 표시를 남기지 않는다', () => {
      // Given
      const syncStorage = createMemorySyncStorage();
      const { sessionCleanupService } = createTestDi({ ports: { syncStorage } });

      // When
      sessionCleanupService.afterSignedOut();

      // Then
      expect(readStoredValue(syncStorage, pendingStorageCleanupStoredValue)).toBeNull();
    });

    it('로그아웃하면 이어서 열 초대와 기기 시간대를 지워 다음 계정이 앞사람의 초대를 받지 않는다', () => {
      // Given
      const syncStorage = createMemorySyncStorage();
      const { sessionCleanupService } = createTestDi({ ports: { syncStorage } });
      writeStoredValue(syncStorage, pendingRedemptionStoredValue, createPendingRedemption());
      writeStoredValue(syncStorage, deviceTimezoneStoredValue, {
        userId: 'account-1',
        deviceTimezone: { timeZone: 'Asia/Seoul', offsetMinutes: 540 },
      });

      // When
      sessionCleanupService.afterSignedOut();

      // Then
      expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toBeNull();
      expect(readStoredValue(syncStorage, deviceTimezoneStoredValue)).toBeNull();
    });

    it('탈퇴하면 그 계정의 안내 기록만 지우고 같은 기기의 다른 계정 기록은 남긴다', () => {
      // Given
      const syncStorage = createMemorySyncStorage();
      const { sessionCleanupService } = createTestDi({ ports: { syncStorage } });
      rememberPrompts(syncStorage, 'account-1');
      rememberPrompts(syncStorage, 'account-2');

      // When
      sessionCleanupService.afterAccountDeleted('account-1');

      // Then
      expect(readPrompts(syncStorage, 'account-1')).toEqual({
        upsell: {},
        deferredAt: null,
        noticeDismissedAt: null,
      });
      expect(readPrompts(syncStorage, 'account-2')).toEqual({
        upsell: { AI_PARSE: '2026-11-10' },
        deferredAt: DISMISSED_AT,
        noticeDismissedAt: DISMISSED_AT,
      });
    });

    it('저장소가 지우지 못하면 그 단계를 기록하고 나머지 정리를 이어 간다', () => {
      // Given
      const syncStorage = createMemorySyncStorage();
      syncStorage.remove.mockImplementation(() => {
        throw new Error('mmkv unavailable');
      });
      const logger = createAppLoggerStub();
      const { sessionCleanupService } = createTestDi({ ports: { syncStorage, logger } });

      // When
      sessionCleanupService.afterSignedOut();
      sessionCleanupService.afterAccountDeleted('account-1');

      // Then
      expect(logger.warn).toHaveBeenCalledWith(AUTH_LOG_EVENT.SESSION_CLEANUP_STEP_FAILED, {
        step: 'device-timezone',
        error: 'mmkv unavailable',
      });
      expect(logger.warn).toHaveBeenCalledWith(AUTH_LOG_EVENT.SESSION_CLEANUP_STEP_FAILED, {
        step: 'pending-redemption',
        error: 'mmkv unavailable',
      });
      expect(logger.warn).toHaveBeenCalledWith(AUTH_LOG_EVENT.USER_DEVICE_DATA_CLEAR_FAILED, {
        repository: 'upsell-dismissal',
        error: 'mmkv unavailable',
      });
    });
  });
});
