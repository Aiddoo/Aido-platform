import { CoachmarkPolicy } from './coachmark.model';

describe('CoachmarkPolicy', () => {
  describe('shouldShow', () => {
    it.each([
      { title: '끝낸 기록이 없으면 보인다', completedAt: null, expected: true },
      {
        title: '한 번 끝냈으면 기간과 상관없이 다시 띄우지 않는다',
        completedAt: '2026-01-01T00:00:00.000Z',
        expected: false,
      },
      { title: '원문이 시각이 아니어도 키가 있으면 끝낸 것이다', completedAt: '', expected: false },
    ])('$title', ({ completedAt, expected }) => {
      // When
      const result = CoachmarkPolicy.shouldShow({ kind: 'friend-strip', completedAt });

      // Then
      expect(result).toBe(expected);
    });
  });
});
