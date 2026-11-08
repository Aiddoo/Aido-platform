import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/schemas/feature-campaign.schema';
import { createMemorySyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createActivationProgressRepository } from './activation-progress.repository';
import { ActivationService } from './activation.service';

const config: FeatureCampaignConfig = {
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: toInstant('2026-08-01T00:00:00.000Z'),
  autoOpen: true,
};

function createService(): ActivationService {
  return new ActivationService(createActivationProgressRepository(createMemorySyncStorage()));
}

describe('ActivationService', () => {
  it('신규 사용자의 생성 후 완료 성공에서 활성화 이벤트 payload를 한 번 반환한다', () => {
    // Given
    const service = createService();
    const user = { id: 'new-user', createdAt: toInstant('2026-08-01T00:00:00.000Z') };
    service.recordTodoCreated({
      config,
      user,
      now: toInstant('2026-08-02T10:00:00.000Z'),
    });

    // When
    const first = service.recordTodoCompletion({
      config,
      user,
      isCompleted: true,
      now: toInstant('2026-08-03T12:00:00.000Z'),
    });
    const duplicate = service.recordTodoCompletion({
      config,
      user,
      isCompleted: true,
      now: toInstant('2026-08-04T12:00:00.000Z'),
    });

    // Then
    expect(first.event).toEqual({
      campaign_id: 'feature-discovery-2026-08',
      days_since_signup: 2,
    });
    expect(duplicate.event).toBeNull();
  });

  it('완료 해제와 기존 사용자의 동작은 진행 상태를 바꾸지 않는다', () => {
    // Given
    const service = createService();
    const existingUser = {
      id: 'existing-user',
      createdAt: toInstant('2026-07-01T00:00:00.000Z'),
    };

    // When
    const existingCreate = service.recordTodoCreated({
      config,
      user: existingUser,
      now: toInstant('2026-08-02T10:00:00.000Z'),
    });
    const uncomplete = service.recordTodoCompletion({
      config,
      user: { id: 'new-user', createdAt: toInstant('2026-08-01T00:00:00.000Z') },
      isCompleted: false,
      now: toInstant('2026-08-02T12:00:00.000Z'),
    });

    // Then
    expect(existingCreate).toBeNull();
    expect(uncomplete.event).toBeNull();
  });

  describe('푸시 요청 시점 열기', () => {
    const newUser = { id: 'new-user', createdAt: toInstant('2026-08-01T00:00:00.000Z') };

    it('설정에서 처음 켜면 요청 시점을 열고 새로 열렸다고 알린다', () => {
      // Given
      const service = createService();

      // When
      const result = service.unlockPushRegistration({
        config,
        user: newUser,
        now: toInstant('2026-08-02T00:00:00.000Z'),
      });

      // Then
      expect(result).toEqual({
        progress: {
          todoCreatedAt: null,
          activatedAt: null,
          pushRegistrationUnlockedAt: toInstant('2026-08-02T00:00:00.000Z'),
        },
        didOpenAskMoment: true,
      });
    });

    it('이미 요청 시점이 열려 있으면 다시 켤 때는 새로 열리지 않았다고 알린다', () => {
      // Given
      const service = createService();
      service.unlockPushRegistration({
        config,
        user: newUser,
        now: toInstant('2026-08-02T00:00:00.000Z'),
      });

      // When
      const result = service.unlockPushRegistration({
        config,
        user: newUser,
        now: toInstant('2026-08-03T00:00:00.000Z'),
      });

      // Then
      expect(result?.didOpenAskMoment).toBe(false);
    });

    it('이미 활성화된 신규 사용자가 처음 켜도 요청 키가 그대로라 새로 열리지 않았다고 알린다', () => {
      // Given
      const service = createService();
      service.recordTodoCreated({
        config,
        user: newUser,
        now: toInstant('2026-08-02T00:00:00.000Z'),
      });
      service.recordTodoCompletion({
        config,
        user: newUser,
        isCompleted: true,
        now: toInstant('2026-08-03T00:00:00.000Z'),
      });

      // When
      const result = service.unlockPushRegistration({
        config,
        user: newUser,
        now: toInstant('2026-08-04T00:00:00.000Z'),
      });

      // Then
      expect(result?.didOpenAskMoment).toBe(false);
    });

    it('기존 사용자는 신규 코호트 대상이 아니라 기록하지 않는다', () => {
      // Given
      const service = createService();

      // When
      const result = service.unlockPushRegistration({
        config,
        user: { id: 'existing-user', createdAt: toInstant('2026-07-01T00:00:00.000Z') },
        now: toInstant('2026-08-02T00:00:00.000Z'),
      });

      // Then
      expect(result).toBeNull();
    });
  });
});
