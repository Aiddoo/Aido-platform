import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { FEATURE_DISCOVERY_QUERY_KEYS } from '@src/features/feature-discovery/presentations/constants/feature-discovery-query-keys.constant';
import type { User } from '@src/features/user/models/user.model';
import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import { QueryClient } from '@tanstack/react-query';
import { createActivationProgressRepository } from '../repositories/activation-progress.repository';
import { ActivationService } from '../services/activation.service';
import {
  recordTodoCompletionForActivation,
  recordTodoCreatedForActivation,
  unlockPushRegistrationForActivation,
} from './activation-mutations';
import { ACTIVATION_QUERY_KEYS } from './constants/activation-query-keys.constant';

function createService(): ActivationService {
  const values = new Map<string, string>();
  const storage: SyncStorage = {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
  return new ActivationService(createActivationProgressRepository(storage));
}

const config: FeatureDiscoveryConfig = {
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: new Date('2026-08-01T00:00:00.000Z'),
  autoOpen: true,
};

const user = {
  id: 'new-user',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
} as User;

describe('activation mutation bridge', () => {
  it('생성 진행 상태를 공용 Query 캐시에 반영한다', () => {
    // Given
    const queryClient = new QueryClient();
    queryClient.setQueryData(FEATURE_DISCOVERY_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();

    // When
    recordTodoCreatedForActivation({
      queryClient,
      service,
      now: new Date('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(
      queryClient.getQueryData(
        ACTIVATION_QUERY_KEYS.progress('new-user', 'feature-discovery-2026-08'),
      ),
    ).toEqual({
      todoCreatedAt: new Date('2026-08-02T00:00:00.000Z'),
      activatedAt: null,
      pushRegistrationUnlockedAt: null,
    });
  });

  it('완료 성공에서 이벤트를 한 번 반환하고 활성 상태를 캐시에 반영한다', () => {
    // Given
    const queryClient = new QueryClient();
    queryClient.setQueryData(FEATURE_DISCOVERY_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();
    recordTodoCreatedForActivation({
      queryClient,
      service,
      now: new Date('2026-08-02T00:00:00.000Z'),
    });

    // When
    const first = recordTodoCompletionForActivation({
      queryClient,
      service,
      completed: true,
      now: new Date('2026-08-03T00:00:00.000Z'),
    });
    const duplicate = recordTodoCompletionForActivation({
      queryClient,
      service,
      completed: true,
      now: new Date('2026-08-04T00:00:00.000Z'),
    });

    // Then
    expect(first).toEqual({
      campaign_id: 'feature-discovery-2026-08',
      days_since_signup: 2,
    });
    expect(duplicate).toBeNull();
    expect(
      queryClient.getQueryData(
        ACTIVATION_QUERY_KEYS.progress('new-user', 'feature-discovery-2026-08'),
      ),
    ).toEqual({
      todoCreatedAt: new Date('2026-08-02T00:00:00.000Z'),
      activatedAt: new Date('2026-08-03T00:00:00.000Z'),
      pushRegistrationUnlockedAt: null,
    });
  });

  it('설정의 명시적 푸시 동작을 진행 상태와 공용 캐시에 기록한다', () => {
    // Given
    const queryClient = new QueryClient();
    queryClient.setQueryData(FEATURE_DISCOVERY_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();

    // When
    const unlocked = unlockPushRegistrationForActivation({
      queryClient,
      service,
      now: new Date('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(unlocked).toBe(true);
    expect(
      queryClient.getQueryData(
        ACTIVATION_QUERY_KEYS.progress('new-user', 'feature-discovery-2026-08'),
      ),
    ).toEqual({
      todoCreatedAt: null,
      activatedAt: null,
      pushRegistrationUnlockedAt: new Date('2026-08-02T00:00:00.000Z'),
    });
  });

  it('기존 사용자는 신규 코호트 게이트 해제 대상이 아님을 반환한다', () => {
    // Given
    const queryClient = new QueryClient();
    queryClient.setQueryData(FEATURE_DISCOVERY_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), {
      ...user,
      id: 'existing-user',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    // When
    const unlocked = unlockPushRegistrationForActivation({
      queryClient,
      service: createService(),
      now: new Date('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(unlocked).toBe(false);
  });
});
