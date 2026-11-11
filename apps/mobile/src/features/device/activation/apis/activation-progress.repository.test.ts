import { toInstant } from '@src/shared/date/instant';
import { createMemoryObservableSyncStorage } from '@src/testing/core';

import { createActivationProgressRepository } from './activation-progress.repository';

const ACCOUNT_ID = 'account-1';

describe('ActivationProgressRepository', () => {
  it('할 일 생성 시각을 최초 한 번만 보존한다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryObservableSyncStorage());

    // When
    repository.markTodoCreated(ACCOUNT_ID, toInstant('2026-08-02T10:00:00.000Z'));
    const result = repository.markTodoCreated(ACCOUNT_ID, toInstant('2026-08-03T10:00:00.000Z'));

    // Then
    expect(result.todoCreatedAt).toBe('2026-08-02T10:00:00.000Z');
  });

  it('생성 기록이 있어야 완료를 한 번만 claim한다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryObservableSyncStorage());

    // When
    const beforeCreate = repository.claimActivated(
      ACCOUNT_ID,
      toInstant('2026-08-02T12:00:00.000Z'),
    );
    repository.markTodoCreated(ACCOUNT_ID, toInstant('2026-08-02T10:00:00.000Z'));
    const first = repository.claimActivated(ACCOUNT_ID, toInstant('2026-08-02T12:00:00.000Z'));
    const duplicate = repository.claimActivated(ACCOUNT_ID, toInstant('2026-08-03T12:00:00.000Z'));

    // Then
    expect(beforeCreate.isClaimed).toBe(false);
    expect(first.isClaimed).toBe(true);
    expect(first.progress.activatedAt).toBe('2026-08-02T12:00:00.000Z');
    expect(duplicate.isClaimed).toBe(false);
  });

  it('손상된 로컬 값은 빈 진행 상태로 안전하게 복구한다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(`aido_activation_v2:${ACCOUNT_ID}`, '{broken-json');
    const repository = createActivationProgressRepository(storage);

    // When
    const result = repository.get(ACCOUNT_ID);

    // Then
    expect(result).toEqual({ todoCreatedAt: null, activatedAt: null });
  });

  it('계정이 다르면 진행 상태를 공유하지 않는다', () => {
    // Given
    const repository = createActivationProgressRepository(createMemoryObservableSyncStorage());
    repository.markTodoCreated(ACCOUNT_ID, toInstant('2026-08-02T10:00:00.000Z'));

    // When
    const anotherAccount = repository.get('account-2');

    // Then
    expect(anotherAccount.todoCreatedAt).toBeNull();
  });

  it('1.15.0 이하가 캠페인별로 남긴 키만 지우고 지금 키와 다른 설정은 남긴다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(`aido_activation_v1:${ACCOUNT_ID}:feature-discovery-2026-12`, '{}');
    storage.set(`aido_activation_v1:${ACCOUNT_ID}:feature-discovery-2026-08`, '{}');
    storage.set(`aido_activation_v2:${ACCOUNT_ID}`, '{}');
    storage.set('aido_feature_discovery_seen_v1:account-1:feature-discovery-2026-12', 'seen');
    const repository = createActivationProgressRepository(storage);

    // When
    repository.removeRetiredKeys();

    // Then
    expect(new Set(storage.keys())).toEqual(
      new Set([
        'aido_activation_v2:account-1',
        'aido_feature_discovery_seen_v1:account-1:feature-discovery-2026-12',
      ]),
    );
  });

  it('저장소 쓰기 실패가 핵심 할 일 동작으로 전파되지 않는다', () => {
    // Given
    const storage = {
      ...createMemoryObservableSyncStorage(),
      set: () => {
        throw new Error('storage unavailable');
      },
    };
    const repository = createActivationProgressRepository(storage);

    // When
    const create = () =>
      repository.markTodoCreated(ACCOUNT_ID, toInstant('2026-08-02T10:00:00.000Z'));

    // Then
    expect(create).not.toThrow();
    expect(repository.get(ACCOUNT_ID)).toEqual({ todoCreatedAt: null, activatedAt: null });
  });
});
