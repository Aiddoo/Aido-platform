import type { SyncStorage } from '@src/core/ports/sync-storage';
import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { createActivationProgressRepository } from '../repositories/activation-progress.repository';
import { ActivationService } from './activation.service';

const config: FeatureDiscoveryConfig = {
  enabled: true,
  campaignId: 'feature-discovery-2026-08',
  minAppVersion: '1.8.0',
  launchedAt: new Date('2026-08-01T00:00:00.000Z'),
  autoOpen: true,
};

function createService(): ActivationService {
  const values = new Map<string, string>();
  const storage: SyncStorage = {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
  return new ActivationService(createActivationProgressRepository(storage));
}

describe('ActivationService', () => {
  it('신규 사용자의 생성 후 완료 성공에서 활성화 이벤트 payload를 한 번 반환한다', () => {
    // Given
    const service = createService();
    const user = { id: 'new-user', createdAt: new Date('2026-08-01T00:00:00.000Z') };
    service.recordTodoCreated({
      config,
      user,
      now: new Date('2026-08-02T10:00:00.000Z'),
    });

    // When
    const first = service.recordTodoCompletion({
      config,
      user,
      completed: true,
      now: new Date('2026-08-03T12:00:00.000Z'),
    });
    const duplicate = service.recordTodoCompletion({
      config,
      user,
      completed: true,
      now: new Date('2026-08-04T12:00:00.000Z'),
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
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    };

    // When
    const existingCreate = service.recordTodoCreated({
      config,
      user: existingUser,
      now: new Date('2026-08-02T10:00:00.000Z'),
    });
    const uncomplete = service.recordTodoCompletion({
      config,
      user: { id: 'new-user', createdAt: new Date('2026-08-01T00:00:00.000Z') },
      completed: false,
      now: new Date('2026-08-02T12:00:00.000Z'),
    });

    // Then
    expect(existingCreate).toBeNull();
    expect(uncomplete.event).toBeNull();
  });
});
