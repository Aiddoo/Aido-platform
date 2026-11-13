import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { SyncStorage } from '@src/core/ports/sync-storage';
import { upsellDismissalStoredValue } from '@src/features/billing/subscription/schemas/upsell-dismissal-storage.schema';
import { createStoreReviewRepository } from '@src/features/device/store-review/repositories/store-review.repository';
import { AUTH_LOG_EVENT } from '@src/features/identity/auth/constants/auth-log-events';
import { deviceTimezoneStoredValue } from '@src/features/notification/schemas/device-timezone-storage.schema';
import { pushNoticeDismissedAtStoredValue } from '@src/features/notification/schemas/push-notice-dismissed-at-storage.schema';
import { pushPermissionDeferredAtStoredValue } from '@src/features/notification/schemas/push-permission-deferred-at-storage.schema';
import { createPendingRedemption } from '@src/features/social/invite/__tests__/invite.fixtures';
import { pendingRedemptionStoredValue } from '@src/features/social/invite/schemas/pending-redemption-storage.schema';
import { toInstant } from '@src/shared/date/instant';
import {
  readStoredValue,
  type StoredValueDefinition,
  writeStoredValue,
} from '@src/shared/storage/define-stored-value';
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
const SRC_ROOT = join(__dirname, '../..');
const DELETED_ACCOUNT_ID = 'account-1';
const REMAINING_ACCOUNT_ID = 'account-2';

type ScopedStoredValue = StoredValueDefinition<unknown, unknown> & {
  key: (scope: unknown) => string;
};

function isScopedDeviceStoredValue(value: unknown): value is ScopedStoredValue {
  return (
    typeof value === 'object' &&
    value != null &&
    'schema' in value &&
    'area' in value &&
    value.area === 'device' &&
    'key' in value &&
    typeof value.key === 'function'
  );
}

/** 저장 값 정의 파일을 모두 읽어 범위 키를 쓰는 기기 값(계정 기록)을 찾는다. 새 정의도 등록하지 않으면 빠지지 않는다 */
function findScopedDeviceStoredValues() {
  return readdirSync(SRC_ROOT, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('-storage.schema.ts'))
    .flatMap((path) => {
      const loaded: unknown = jest.requireActual(join(SRC_ROOT, path));
      return typeof loaded === 'object' && loaded != null ? Object.entries(loaded) : [];
    })
    .flatMap(([name, value]) => (isScopedDeviceStoredValue(value) ? [{ name, value }] : []));
}

/** 범위가 계정 id 문자열이든 `{ accountId }` 객체든 그 계정의 키를 만든다 */
function createAccountScope(accountId: string) {
  return { accountId, userId: accountId, toString: () => accountId };
}

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

    it('암호화 저장소를 열지 못한 실행에서 로그아웃하면 그 실행이 메모리에 들고 있던 초안도 버린다', () => {
      // Given
      const draftStorage = createMemorySyncStorage();
      const container = createAppContainer(
        createTestPorts({ draftStorage, queryCacheStorage: null }),
      );
      draftStorage.set('aido_draft_v1:account-1:memo:create', '{"value":{}}');

      // When
      container.sessionCleanupService.afterSignedOut();

      // Then
      expect(draftStorage.keys()).toEqual([]);
    });

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
      sessionCleanupService.beforeAccountDeletion('account-1');
      sessionCleanupService.afterSignedOut();

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
      sessionCleanupService.beforeAccountDeletion('account-1');
      sessionCleanupService.afterSignedOut();

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

  describe('탈퇴 정리 등록부', () => {
    const scopedStoredValues = findScopedDeviceStoredValues();

    it('범위 키를 쓰는 기기 저장 값 정의를 찾는다', () => {
      // When·Then
      expect(scopedStoredValues.length).toBeGreaterThan(0);
    });

    it.each(scopedStoredValues)(
      '$name: 탈퇴하면 그 계정 값만 지우고 같은 기기의 다른 계정 값은 남긴다',
      ({ value }) => {
        // Given
        const syncStorage = createMemorySyncStorage();
        const { sessionCleanupService } = createTestDi({ ports: { syncStorage } });
        const remainingKey = value.key(createAccountScope(REMAINING_ACCOUNT_ID));
        syncStorage.set(value.key(createAccountScope(DELETED_ACCOUNT_ID)), 'saved');
        syncStorage.set(remainingKey, 'saved');

        // When
        sessionCleanupService.beforeAccountDeletion(DELETED_ACCOUNT_ID);
        sessionCleanupService.afterSignedOut();

        // Then
        expect(syncStorage.keys()).toEqual([remainingKey]);
      },
    );

    it('정의 없이 키를 만드는 저장소의 계정 기록도 탈퇴하면 지운다', () => {
      // Given
      const syncStorage = createMemorySyncStorage();
      const { sessionCleanupService, whatsNewRepository, marketingPushPromptRepository } =
        createTestDi({ ports: { syncStorage } });
      [DELETED_ACCOUNT_ID, REMAINING_ACCOUNT_ID].forEach((accountId) => {
        whatsNewRepository.claimSeen({ userId: accountId, campaignId: 'campaign-1' }, DISMISSED_AT);
        marketingPushPromptRepository.dismiss(accountId, DISMISSED_AT);
        createStoreReviewRepository(syncStorage).update(accountId, (state) => ({
          ...state,
          requestedAt: [DISMISSED_AT],
        }));
      });

      // When
      sessionCleanupService.beforeAccountDeletion(DELETED_ACCOUNT_ID);
      sessionCleanupService.afterSignedOut();

      // Then
      expect(syncStorage.keys().filter((key) => key.includes(DELETED_ACCOUNT_ID))).toEqual([]);
      expect(syncStorage.keys().filter((key) => key.includes(REMAINING_ACCOUNT_ID))).toHaveLength(
        4,
      );
    });
  });
});
