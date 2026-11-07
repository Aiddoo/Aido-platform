import { FEATURE_CAMPAIGN_QUERY_KEYS } from '@src/features/app-config/feature-campaign/constants/feature-campaign-query-keys';
import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createMemorySyncStorage, createTestQueryClient } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';
import type { QueryClient } from '@tanstack/react-query';

import { createActivationProgressRepository } from '../apis/activation-progress.repository';
import { ActivationService } from '../apis/activation.service';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import {
  recordTodoCompletionForActivation,
  recordTodoCreatedForActivation,
  tryUnlockPushRegistration,
} from './activation-cache';

function createService(): ActivationService {
  return new ActivationService(createActivationProgressRepository(createMemorySyncStorage()));
}

const config: FeatureCampaignConfig = {
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: toInstant('2026-08-01T00:00:00.000Z'),
  autoOpen: true,
};

const user = toUser(
  createCurrentUserDto({ userId: 'new-user', createdAt: '2026-08-01T00:00:00.000Z' }),
);

describe('activation mutation bridge', () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = createTestQueryClient();
  });
  it('생성 진행 상태를 공용 Query 캐시에 반영한다', () => {
    // Given
    queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();

    // When
    recordTodoCreatedForActivation({
      queryClient,
      service,
      now: toInstant('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(
      queryClient.getQueryData(
        ACTIVATION_QUERY_KEYS.progress({
          accountId: 'new-user',
          campaignId: 'feature-discovery-2026-08',
        }),
      ),
    ).toEqual({
      todoCreatedAt: toInstant('2026-08-02T00:00:00.000Z'),
      activatedAt: null,
      pushRegistrationUnlockedAt: null,
    });
  });

  it('완료 성공에서 이벤트를 한 번 반환하고 활성 상태를 캐시에 반영한다', () => {
    // Given
    queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();
    recordTodoCreatedForActivation({
      queryClient,
      service,
      now: toInstant('2026-08-02T00:00:00.000Z'),
    });

    // When
    const first = recordTodoCompletionForActivation({
      queryClient,
      service,
      isCompleted: true,
      now: toInstant('2026-08-03T00:00:00.000Z'),
    });
    const duplicate = recordTodoCompletionForActivation({
      queryClient,
      service,
      isCompleted: true,
      now: toInstant('2026-08-04T00:00:00.000Z'),
    });

    // Then
    expect(first).toEqual({
      campaign_id: 'feature-discovery-2026-08',
      days_since_signup: 2,
    });
    expect(duplicate).toBeNull();
    expect(
      queryClient.getQueryData(
        ACTIVATION_QUERY_KEYS.progress({
          accountId: 'new-user',
          campaignId: 'feature-discovery-2026-08',
        }),
      ),
    ).toEqual({
      todoCreatedAt: toInstant('2026-08-02T00:00:00.000Z'),
      activatedAt: toInstant('2026-08-03T00:00:00.000Z'),
      pushRegistrationUnlockedAt: null,
    });
  });

  it('설정의 명시적 푸시 동작을 진행 상태와 공용 캐시에 기록한다', () => {
    // Given
    queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();

    // When
    const unlocked = tryUnlockPushRegistration({
      queryClient,
      service,
      now: toInstant('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(unlocked).toBe(true);
    expect(
      queryClient.getQueryData(
        ACTIVATION_QUERY_KEYS.progress({
          accountId: 'new-user',
          campaignId: 'feature-discovery-2026-08',
        }),
      ),
    ).toEqual({
      todoCreatedAt: null,
      activatedAt: null,
      pushRegistrationUnlockedAt: toInstant('2026-08-02T00:00:00.000Z'),
    });
  });

  it('이미 요청 시점이 열려 있으면 다시 켤 때는 직접 물으라고 false를 돌려준다', () => {
    // Given
    queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();
    tryUnlockPushRegistration({
      queryClient,
      service,
      now: toInstant('2026-08-02T00:00:00.000Z'),
    });

    // When
    const unlocked = tryUnlockPushRegistration({
      queryClient,
      service,
      now: toInstant('2026-08-03T00:00:00.000Z'),
    });

    // Then
    expect(unlocked).toBe(false);
  });

  it('이미 활성화된 신규 사용자가 처음 켜도 요청 키가 그대로라 직접 물으라고 false를 돌려준다', () => {
    // Given
    queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), user);
    const service = createService();
    recordTodoCreatedForActivation({
      queryClient,
      service,
      now: toInstant('2026-08-02T00:00:00.000Z'),
    });
    recordTodoCompletionForActivation({
      queryClient,
      service,
      isCompleted: true,
      now: toInstant('2026-08-03T00:00:00.000Z'),
    });

    // When
    const unlocked = tryUnlockPushRegistration({
      queryClient,
      service,
      now: toInstant('2026-08-04T00:00:00.000Z'),
    });

    // Then
    expect(unlocked).toBe(false);
  });

  it('기존 사용자는 신규 코호트 게이트 해제 대상이 아님을 반환한다', () => {
    // Given
    queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
    queryClient.setQueryData(USER_QUERY_KEYS.me(), {
      ...user,
      id: 'existing-user',
      createdAt: toInstant('2026-07-01T00:00:00.000Z'),
    });

    // When
    const unlocked = tryUnlockPushRegistration({
      queryClient,
      service: createService(),
      now: toInstant('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(unlocked).toBe(false);
  });
});
