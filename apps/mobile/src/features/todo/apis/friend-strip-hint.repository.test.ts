import { createMemorySyncStorage } from '@src/shared/__tests__';

import { createFriendStripHintRepository } from './friend-strip-hint.repository';

describe('createFriendStripHintRepository', () => {
  it('닫은 계정만 닫힌 것으로 반환하고 기록은 계속 남는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    createFriendStripHintRepository(storage).dismiss('user-a');

    // When 앱을 다시 연 것처럼 같은 저장소로 새 저장소 객체를 만든다
    const repository = createFriendStripHintRepository(storage);

    // Then
    expect(repository.isDismissed('user-a')).toBe(true);
    expect(repository.isDismissed('user-b')).toBe(false);
  });

  it('이 계정의 닫기 기록이 바뀌면 구독한 쪽에 알리고, 해제하면 더 알리지 않는다', () => {
    // Given
    const repository = createFriendStripHintRepository(createMemorySyncStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe('user-a', listener);

    // When 다른 계정 기록은 알리지 않고, 이 계정을 닫으면 알린다
    repository.dismiss('user-b');
    repository.dismiss('user-a');
    unsubscribe();
    repository.dismiss('user-a');

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
