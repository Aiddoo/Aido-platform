import { createOptimisticId } from './create-optimistic-id';

describe('createOptimisticId', () => {
  it('서버 id와 겹치지 않는 음수를 호출마다 새로 준다', () => {
    // When
    const first = createOptimisticId();
    const second = createOptimisticId();

    // Then
    expect(first).toBeLessThan(0);
    expect(second).toBeLessThan(first);
  });
});
