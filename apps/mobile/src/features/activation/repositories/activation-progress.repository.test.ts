import type { SyncStorage } from '@src/core/ports/sync-storage';
import { createActivationProgressRepository } from './activation-progress.repository';

function createMemoryStorage(initial?: Record<string, string>): SyncStorage {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
}

const identity = {
  accountId: 'account-1',
  campaignId: 'feature-discovery-2026-08',
};

describe('ActivationProgressRepository', () => {
  it('할 일 생성 시각을 최초 한 번만 보존한다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryStorage());

    // When
    repository.markTodoCreated(identity, new Date('2026-08-02T10:00:00.000Z'));
    const result = repository.markTodoCreated(identity, new Date('2026-08-03T10:00:00.000Z'));

    // Then
    expect(result.todoCreatedAt?.toISOString()).toBe('2026-08-02T10:00:00.000Z');
  });

  it('생성 기록이 있어야 완료를 한 번만 claim한다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryStorage());

    // When
    const beforeCreate = repository.claimActivated(identity, new Date('2026-08-02T12:00:00.000Z'));
    repository.markTodoCreated(identity, new Date('2026-08-02T10:00:00.000Z'));
    const first = repository.claimActivated(identity, new Date('2026-08-02T12:00:00.000Z'));
    const duplicate = repository.claimActivated(identity, new Date('2026-08-03T12:00:00.000Z'));

    // Then
    expect(beforeCreate.claimed).toBe(false);
    expect(first.claimed).toBe(true);
    expect(first.progress.activatedAt?.toISOString()).toBe('2026-08-02T12:00:00.000Z');
    expect(duplicate.claimed).toBe(false);
  });

  it('손상된 로컬 값은 빈 진행 상태로 안전하게 복구한다', () => {
    // Given
    const storage = createMemoryStorage({
      'aido_activation_v1:account-1:feature-discovery-2026-08': '{broken-json',
    });
    const repository = createActivationProgressRepository(storage);

    // When
    const result = repository.get(identity);

    // Then
    expect(result).toEqual({
      todoCreatedAt: null,
      activatedAt: null,
      pushRegistrationUnlockedAt: null,
    });
  });

  it('계정과 캠페인이 다르면 진행 상태를 공유하지 않는다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryStorage());
    repository.markTodoCreated(identity, new Date('2026-08-02T10:00:00.000Z'));

    // When
    const anotherAccount = repository.get({ ...identity, accountId: 'account-2' });
    const anotherCampaign = repository.get({ ...identity, campaignId: 'another-campaign' });

    // Then
    expect(anotherAccount.todoCreatedAt).toBeNull();
    expect(anotherCampaign.todoCreatedAt).toBeNull();
  });

  it('설정에서 푸시 등록을 해제한 시각을 최초 한 번만 보존한다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryStorage());

    // When
    repository.unlockPushRegistration(identity, new Date('2026-08-02T10:00:00.000Z'));
    const result = repository.unlockPushRegistration(
      identity,
      new Date('2026-08-03T10:00:00.000Z'),
    );

    // Then
    expect(result.pushRegistrationUnlockedAt?.toISOString()).toBe('2026-08-02T10:00:00.000Z');
  });

  it('저장소 쓰기 실패가 핵심 할 일 동작으로 전파되지 않는다', () => {
    // Given
    const storage = createMemoryStorage();
    storage.set = () => {
      throw new Error('storage unavailable');
    };
    const repository = createActivationProgressRepository(storage);

    // When
    const create = () => repository.markTodoCreated(identity, new Date('2026-08-02T10:00:00.000Z'));
    const unlock = () =>
      repository.unlockPushRegistration(identity, new Date('2026-08-02T10:00:00.000Z'));

    // Then
    expect(create).not.toThrow();
    expect(unlock).not.toThrow();
    expect(repository.get(identity)).toEqual({
      todoCreatedAt: null,
      activatedAt: null,
      pushRegistrationUnlockedAt: null,
    });
  });
});
