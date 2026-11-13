import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { toInstant } from '@src/shared/date/instant';

import {
  createNudgeInteraction,
  createNudgeThanksPreview,
} from '../__tests__/nudge-interaction.fixtures';
import {
  NudgeInteractionPolicy,
  NudgeThanksPreviewPolicy,
  TodoThanksPolicy,
} from './nudge-interaction.model';

describe('getNudgeInteractionStatus', () => {
  it.each([
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
      const nudge = createNudgeInteraction({
        isAvailable,
        isTodoCompleted,
        replyKind: hasReply ? 'STARTING' : null,
        thankedAt: isThanked ? toInstant('2026-01-01T00:00:00Z') : null,
      });

      // When
      const status = NudgeInteractionPolicy.getNudgeInteractionStatus(nudge);

      // Then
      expect(status).toBe(expected);
    },
  );

  it('완료된 할 일에 답장이 있어도 완료 상태가 우선한다', () => {
    // Given
    const nudge = createNudgeInteraction({
      isAvailable: true,
      isTodoCompleted: true,
      replyKind: 'STARTING',
      thankedAt: null,
    });

    // When
    const status = NudgeInteractionPolicy.getNudgeInteractionStatus(nudge);

    // Then
    expect(status).toBe('COMPLETED');
  });
});

describe('hasThankableRecipients', () => {
  it.each([
    [1, [{ id: 'friend', name: '친구', profileImage: null }], true],
    [null, [{ id: 'friend', name: '친구', profileImage: null }], false],
    [1, [], false],
  ])(
    '마지막 콕 %s와 받을 친구 목록으로 감사 가능 여부를 판단한다',
    (throughNudgeId, items, expected) => {
      // Given
      const preview = createNudgeThanksPreview({ throughNudgeId, items });

      // When
      const hasThankable = NudgeThanksPreviewPolicy.hasThankableRecipients(preview);

      // Then
      expect(hasThankable).toBe(expected);
    },
  );
});

describe('canThankTodo', () => {
  it.each([
    [true, true, 'PUBLIC' as const, true],
    [false, true, 'PUBLIC' as const, false],
    [true, false, 'PUBLIC' as const, false],
    [true, true, 'PRIVATE' as const, false],
  ])(
    '수정 권한 %s, 완료 %s, 공개 범위 %s에 맞게 감사를 허용한다',
    (canEditTodo, completed, visibility, expected) => {
      // Given
      const todo = createParentTodo({ completed, visibility });

      // When
      const isThankable = TodoThanksPolicy.canThankTodo(todo, { canEditTodo });

      // Then
      expect(isThankable).toBe(expected);
    },
  );
});

describe('getThanksSummary', () => {
  const recipient = { id: 'friend-1', name: '응원냥', profileImage: null };

  it.each([
    [10, 3, 0, 'PENDING', 3],
    [10, 3, 2, 'SENT_WITH_PENDING', 3],
    [null, 0, 2, 'SENT', 0],
    [null, 0, 0, 'NONE', 0],
  ] as const)(
    '기준 콕 %s·남은 친구 %s명·감사한 친구 %s명이면 %s 상태다',
    (throughNudgeId, totalRecipients, thankedRecipientCount, expectedState, expectedPending) => {
      // Given
      const preview = createNudgeThanksPreview({
        throughNudgeId,
        items: totalRecipients > 0 ? [recipient] : [],
        totalRecipients,
        thankedRecipientCount,
      });

      // When
      const summary = NudgeThanksPreviewPolicy.getThanksSummary(preview);

      // Then
      expect(summary).toEqual({ state: expectedState, pendingRecipientCount: expectedPending });
    },
  );

  it('감사 기준 콕이 없으면 남은 친구 수가 있어도 보낼 친구로 세지 않는다', () => {
    // Given
    const preview = createNudgeThanksPreview({
      throughNudgeId: null,
      items: [recipient],
      totalRecipients: 1,
      thankedRecipientCount: 0,
    });

    // When
    const summary = NudgeThanksPreviewPolicy.getThanksSummary(preview);

    // Then
    expect(summary).toEqual({ state: 'NONE', pendingRecipientCount: 0 });
  });
});

describe('getResponseStage', () => {
  const nudge = createNudgeInteraction({
    receiverId: 'me',
    isAvailable: true,
    isTodoCompleted: false,
    replyKind: null,
    thankedAt: null,
  });

  it.each([
    ['사라진 콕은 unavailable', { ...nudge, isAvailable: false }, 'me', 'unavailable'],
    ['받은 사람이 끝나지 않은 할 일에는 reply', nudge, 'me', 'reply'],
    ['보낸 사람은 답장 없이 status', nudge, 'sender', 'status'],
    [
      '완료된 할 일에 아직 고맙다고 안 했으면 thanksPrompt',
      { ...nudge, isTodoCompleted: true },
      'me',
      'thanksPrompt',
    ],
    [
      '고맙다고 했으면 thanked',
      { ...nudge, isTodoCompleted: true, thankedAt: toInstant('2026-03-01T00:00:00.000Z') },
      'me',
      'thanked',
    ],
  ] as const)('%s', (_title, input, userId, expected) => {
    // When
    const stage = NudgeInteractionPolicy.getResponseStage(input, userId);

    // Then
    expect(stage).toBe(expected);
  });
});

describe('isReceivedBy', () => {
  it('내가 받은 찌르기면 true다', () => {
    // Given
    const nudge = createNudgeInteraction({ receiverId: 'me' });

    // When
    const result = NudgeInteractionPolicy.isReceivedBy(nudge, 'me');

    // Then
    expect(result).toBe(true);
  });

  it('내가 보낸 찌르기면 false다', () => {
    // Given
    const nudge = createNudgeInteraction({ receiverId: 'friend' });

    // When
    const result = NudgeInteractionPolicy.isReceivedBy(nudge, 'me');

    // Then
    expect(result).toBe(false);
  });
});
