import { isOptimisticId } from './optimistic-id.model';

describe('isOptimisticId', () => {
  it.each([
    ['임시 id는 음수다', -1, true],
    ['서버 id는 양수다', 1, false],
  ])('%s', (_case, id, expected) => {
    // When
    const isOptimistic = isOptimisticId(id);

    // Then
    expect(isOptimistic).toBe(expected);
  });
});
