import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';

import { createUpsellDismissalRepository } from './upsell-dismissal.repository';

describe('createUpsellDismissalRepository', () => {
  it('계정·기능마다 마지막으로 닫은 날을 따로 남긴다', () => {
    // Given
    const repository = createUpsellDismissalRepository(createMemoryObservableSyncStorage());

    // When
    repository.dismiss('user-a', 'AI_PARSE', '2026-11-08');
    repository.dismiss('user-a', 'AI_PARSE', '2026-11-09');
    repository.dismiss('user-a', 'NUDGE', '2026-11-07');

    // Then
    expect(repository.findDismissedOn('user-a', 'AI_PARSE')).toBe('2026-11-09');
    expect(repository.findDismissedOn('user-a', 'NUDGE')).toBe('2026-11-07');
    expect(repository.findDismissedOn('user-a', 'FRIEND')).toBeNull();
    expect(repository.findDismissedOn('user-b', 'AI_PARSE')).toBeNull();
  });

  it.each([
    ['JSON이 아니면', 'not-json'],
    ['날짜 key가 아니면', JSON.stringify({ AI_PARSE: 'yesterday' })],
  ])('저장 값이 %s 닫은 적 없는 것으로 본다', (_case, raw) => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_upsell_dismissed_v1:user-a', raw);
    const repository = createUpsellDismissalRepository(storage);

    // When
    const dismissedOn = repository.findDismissedOn('user-a', 'AI_PARSE');

    // Then
    expect(dismissedOn).toBeNull();
  });

  it('앱이 모르는 기능 키가 섞여 있어도 아는 기능의 날짜를 읽는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(
      'aido_upsell_dismissed_v1:user-a',
      JSON.stringify({ AI_PARSE: '2026-11-09', FUTURE_FEATURE: '2026-11-09' }),
    );
    const repository = createUpsellDismissalRepository(storage);

    // When
    const dismissedOn = repository.findDismissedOn('user-a', 'AI_PARSE');

    // Then
    expect(dismissedOn).toBe('2026-11-09');
  });

  it('구독을 풀면 그 뒤로 닫아도 알리지 않는다', () => {
    // Given
    const repository = createUpsellDismissalRepository(createMemoryObservableSyncStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe('user-a', listener);
    repository.dismiss('user-a', 'AI_PARSE', '2026-11-08');

    // When
    unsubscribe();
    repository.dismiss('user-a', 'AI_PARSE', '2026-11-09');

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('값이 그대로면 몇 번 읽어도 같은 값을 돌려준다', () => {
    // Given
    const repository = createUpsellDismissalRepository(createMemoryObservableSyncStorage());
    repository.dismiss('user-a', 'AI_PARSE', '2026-11-09');

    // When
    const first = repository.findDismissedOn('user-a', 'AI_PARSE');
    const second = repository.findDismissedOn('user-a', 'AI_PARSE');

    // Then
    expect(Object.is(first, second)).toBe(true);
  });

  it('탈퇴한 계정의 기록만 지운다', () => {
    // Given
    const repository = createUpsellDismissalRepository(createMemoryObservableSyncStorage());
    repository.dismiss('user-a', 'AI_PARSE', '2026-11-09');
    repository.dismiss('user-b', 'AI_PARSE', '2026-11-09');

    // When
    repository.clear('user-a');

    // Then
    expect(repository.findDismissedOn('user-a', 'AI_PARSE')).toBeNull();
    expect(repository.findDismissedOn('user-b', 'AI_PARSE')).toBe('2026-11-09');
  });
});
