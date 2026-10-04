import { NudgeInteractionPolicy } from './nudge-interaction.model';

describe('NudgeInteractionPolicy', () => {
  test.each([
    ['receiver', true, true],
    ['sender', true, false],
    ['receiver', false, false],
  ] as const)(
    '사용자 %s와 사용 가능 여부 %s로 답장 권한을 판단한다',
    (currentUserId, isAvailable, expected) => {
      // Given
      const nudge = { receiverId: 'receiver', isAvailable };
      // When
      const isReplyable = NudgeInteractionPolicy.isReplyable(nudge, currentUserId);
      // Then
      expect(isReplyable).toBe(expected);
    },
  );

  test.each([
    [1, [{ id: 'friend', name: '친구', profileImage: null }], true],
    [null, [{ id: 'friend', name: '친구', profileImage: null }], false],
    [1, [], false],
  ])(
    '마지막 콕 %s와 받을 친구 목록으로 감사 가능 여부를 판단한다',
    (throughNudgeId, recipients, expected) => {
      // Given
      const preview = { throughNudgeId, recipients };
      // When
      const isThankable = NudgeInteractionPolicy.isThankable(preview);
      // Then
      expect(isThankable).toBe(expected);
    },
  );
});

test.each([
  [true, true, 'PUBLIC' as const, true],
  [false, true, 'PUBLIC' as const, false],
  [true, false, 'PUBLIC' as const, false],
  [true, true, 'PRIVATE' as const, false],
])(
  '소유자 %s, 완료 %s, 공개 범위 %s에 맞게 감사를 허용한다',
  (isOwner, completed, visibility, expected) => {
    // Given
    const todo = { completed, visibility };
    // When
    const isThankable = NudgeInteractionPolicy.isThankableTodo(todo, { isOwner });
    // Then
    expect(isThankable).toBe(expected);
  },
);
