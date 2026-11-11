import { createTodoDetails } from '@src/features/planning/todo/__tests__/todo.fixtures';

import {
  createCheerMessageReportTarget,
  createCommentReportTarget,
  createNudgeMessageReportTarget,
  createProfileReportTarget,
  createTodoReportTarget,
  TodoReportPolicy,
} from './user-report.model';

const USER_ID = 'clz7x5p8k0001qz0z8z8z8z8z';

describe('createTodoReportTarget', () => {
  it('할 일 주인을 신고 대상으로, 할 일 ID를 문자열로 담는다', () => {
    // Given
    const todo = { todoId: 42, ownerId: USER_ID };

    // When
    const target = createTodoReportTarget(todo);

    // Then
    expect(target).toEqual({ targetUserId: USER_ID, targetType: 'TODO', targetId: '42' });
  });
});

describe('createCommentReportTarget', () => {
  it('댓글 작성자를 신고 대상으로, 댓글 ID를 그대로 담는다', () => {
    // Given
    const comment = { commentId: 'clz7x5p8k0099qz0z8z8z8z8z', authorId: USER_ID };

    // When
    const target = createCommentReportTarget(comment);

    // Then
    expect(target).toEqual({
      targetUserId: USER_ID,
      targetType: 'COMMENT',
      targetId: 'clz7x5p8k0099qz0z8z8z8z8z',
    });
  });
});

describe('createProfileReportTarget', () => {
  it('프로필 신고에는 대상 ID 없이 사용자만 담는다', () => {
    // Given
    const user = { userId: USER_ID };

    // When
    const target = createProfileReportTarget(user);

    // Then
    expect(target).toEqual({ targetUserId: USER_ID, targetType: 'PROFILE' });
  });
});

describe('메시지 신고 대상', () => {
  it('콕 메시지는 보낸 사람을 신고 대상으로, 콕 ID를 문자열로 담는다', () => {
    // Given
    const nudge = { nudgeId: 7, senderId: USER_ID };

    // When
    const target = createNudgeMessageReportTarget(nudge);

    // Then
    expect(target).toEqual({
      targetUserId: USER_ID,
      targetType: 'NUDGE_MESSAGE',
      targetId: '7',
    });
  });

  it('응원 메시지는 보낸 사람을 신고 대상으로, 응원 ID를 문자열로 담는다', () => {
    // Given
    const cheer = { cheerId: 9, senderId: USER_ID };

    // When
    const target = createCheerMessageReportTarget(cheer);

    // Then
    expect(target).toEqual({
      targetUserId: USER_ID,
      targetType: 'CHEER_MESSAGE',
      targetId: '9',
    });
  });
});

describe('canReportTodo', () => {
  it('수정할 수 없는 남의 할 일은 신고할 수 있다', () => {
    // Given
    const details = createTodoDetails({
      permissions: { canEdit: false, canComment: true, canNudge: true },
    });

    // When
    const result = TodoReportPolicy.canReportTodo(details);

    // Then
    expect(result).toBe(true);
  });

  it('수정할 수 있는 내 할 일은 신고할 수 없다', () => {
    // Given
    const details = createTodoDetails({
      permissions: { canEdit: true, canComment: true, canNudge: true },
    });

    // When
    const result = TodoReportPolicy.canReportTodo(details);

    // Then
    expect(result).toBe(false);
  });
});
