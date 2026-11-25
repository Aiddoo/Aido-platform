import { TodoResourceLimitPolicy } from './todo-resource-limit.model';

describe('TodoResourceLimitPolicy', () => {
  describe('calculateRoomLeft', () => {
    it.each([
      { scenario: '빈 카테고리는 한도만큼 넣을 수 있다', activeCount: 0, expected: 300 },
      { scenario: '290개면 10개 더 넣을 수 있다', activeCount: 290, expected: 10 },
      { scenario: '300개면 가득 찼다', activeCount: 300, expected: 0 },
      { scenario: '한도를 넘었어도 음수가 아니라 0이다', activeCount: 310, expected: 0 },
    ])('$scenario', ({ activeCount, expected }) => {
      // When
      const roomLeft = TodoResourceLimitPolicy.calculateRoomLeft({
        maxPerCategory: 300,
        activeCount,
      });

      // Then
      expect(roomLeft).toBe(expected);
    });
  });
});
