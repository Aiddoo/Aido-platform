import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createPushPermissionPromptRepository } from './push-permission-prompt.repository';

const AT = toInstant('2026-11-04T09:00:00.000Z');

describe('createPushPermissionPromptRepository', () => {
  it('나중에와 안내 닫기를 계정마다 따로 남기고 안내 닫기 키는 출시된 앱과 같다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createPushPermissionPromptRepository(storage);

    // When
    repository.defer('user-a', AT);
    repository.dismissNotice('user-a', AT);

    // Then
    expect(storage.get('aido_push_permission_prompt_dismissed_v1:user-a')).toBe(AT);
    expect(repository.find('user-a')).toEqual({ deferredAt: AT, noticeDismissedAt: AT });
    expect(repository.find('user-b')).toEqual({ deferredAt: null, noticeDismissedAt: null });
  });

  it('저장값이 시각이 아니면 답한 적 없는 것으로 본다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_push_permission_prompt_dismissed_v1:user-a', 'garbage');

    // When
    const prompt = createPushPermissionPromptRepository(storage).find('user-a');

    // Then
    expect(prompt.noticeDismissedAt).toBeNull();
  });

  it('저장값이 그대로면 같은 객체를 돌려주고 바뀌면 새 객체를 돌려준다', () => {
    // Given
    const repository = createPushPermissionPromptRepository(createMemoryObservableSyncStorage());
    const first = repository.find('user-a');

    // When
    const unchanged = repository.find('user-a');
    repository.defer('user-a', AT);
    const changed = repository.find('user-a');

    // Then
    expect(unchanged).toBe(first);
    expect(changed).not.toBe(first);
    expect(repository.find('user-a')).toBe(changed);
  });

  it('구독을 풀면 그 뒤 저장에는 알리지 않는다', () => {
    // Given
    const repository = createPushPermissionPromptRepository(createMemoryObservableSyncStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe('user-a', listener);
    repository.defer('user-a', AT);

    // When
    unsubscribe();
    repository.dismissNotice('user-a', AT);
    repository.clear('user-a');

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('계정을 지우면 그 계정의 답만 지운다', () => {
    // Given
    const repository = createPushPermissionPromptRepository(createMemoryObservableSyncStorage());
    repository.defer('user-a', AT);
    repository.defer('user-b', AT);

    // When
    repository.clear('user-a');

    // Then
    expect(repository.find('user-a').deferredAt).toBeNull();
    expect(repository.find('user-b').deferredAt).toBe(AT);
  });
});
