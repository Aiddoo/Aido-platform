import { getNudgeInteractionStatus, NudgeInteractionPolicy } from './nudge-interaction.model';

describe('콕 상호작용 상태', () => {
  test.each([
    [false, false, false, false, 'UNAVAILABLE'],
    [false, false, false, true, 'UNAVAILABLE'],
    [false, false, true, false, 'UNAVAILABLE'],
    [false, false, true, true, 'UNAVAILABLE'],
    [false, true, false, false, 'UNAVAILABLE'],
    [false, true, false, true, 'UNAVAILABLE'],
    [false, true, true, false, 'UNAVAILABLE'],
    [false, true, true, true, 'UNAVAILABLE'],
    [true, false, false, false, 'WAITING'],
    [true, false, false, true, 'THANKED'],
    [true, false, true, false, 'REPLIED'],
    [true, false, true, true, 'THANKED'],
    [true, true, false, false, 'COMPLETED'],
    [true, true, false, true, 'THANKED'],
    [true, true, true, false, 'COMPLETED'],
    [true, true, true, true, 'THANKED'],
  ] as const)(
    '사용 가능 %s·완료 %s·답장 %s·감사 %s일 때 %s 상태로 표시한다',
    (isAvailable, isTodoCompleted, hasReply, isThanked, expected) => {
      // Given
      const context = { isAvailable, isTodoCompleted, hasReply, isThanked };

      // When
      const status = getNudgeInteractionStatus(
        context.isAvailable,
        context.isTodoCompleted,
        context.hasReply,
        context.isThanked,
      );

      // Then
      expect(status).toBe(expected);
    },
  );

  test('완료된 할 일에 답장이 있어도 완료 상태가 우선한다', () => {
    // Given
    const nudge = {
      isAvailable: true,
      isTodoCompleted: true,
      replyKind: 'STARTING' as const,
      thankedAt: null,
    };

    // When
    const status = NudgeInteractionPolicy.getStatus(nudge);

    // Then
    expect(status).toBe('COMPLETED');
  });
});

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
