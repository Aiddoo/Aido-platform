import {
  createCommentReportTarget,
  createNudgeMessageReportTarget,
  createProfileReportTarget,
  createTodoReportTarget,
} from '../domains/user-report.model';
import { toUserReportRequest } from './user-report.mapper';

describe('toUserReportRequest', () => {
  const target = createCommentReportTarget({
    commentId: 'clz7x5p8k0099qz0z8z8z8z8z',
    authorId: 'clz7x5p8k0005qz0z8z8z8z8z',
  });

  it('공백만 적은 상세 내용은 빼고 신고한다', () => {
    // Given
    const form = { reason: 'SPAM', detail: '   ' } as const;

    // When
    const request = toUserReportRequest(target, form);

    // Then
    expect(request).toEqual({ ...target, reason: 'SPAM', detail: undefined });
  });

  it('상세 내용은 앞뒤 공백을 지우고 보낸다', () => {
    // Given
    const form = { reason: 'HARASSMENT', detail: '  계속 욕설을 해요 ' } as const;

    // When
    const request = toUserReportRequest(target, form);

    // Then
    expect(request.detail).toBe('계속 욕설을 해요');
  });

  // 계약은 targetId를 optional로만 받아 null을 실으면 신고가 400으로 거절된다
  it('프로필 신고는 targetId 칸 없이 보낸다', () => {
    // Given
    const profileTarget = createProfileReportTarget({ userId: 'clz7x5p8k0005qz0z8z8z8z8z' });

    // When
    const request = toUserReportRequest(profileTarget, { reason: 'SPAM' });

    // Then
    expect(request).not.toHaveProperty('targetId');
  });

  it.each([
    ['할 일', createTodoReportTarget({ todoId: 12, ownerId: 'clz7x5p8k0005qz0z8z8z8z8z' }), '12'],
    [
      '댓글',
      createCommentReportTarget({
        commentId: 'clz7x5p8k0099qz0z8z8z8z8z',
        authorId: 'clz7x5p8k0005qz0z8z8z8z8z',
      }),
      'clz7x5p8k0099qz0z8z8z8z8z',
    ],
    [
      '콕 메시지',
      createNudgeMessageReportTarget({ nudgeId: 7, senderId: 'clz7x5p8k0005qz0z8z8z8z8z' }),
      '7',
    ],
  ])('%s 신고는 대상 ID를 문자열 targetId로 싣는다', (_kind, contentTarget, expectedTargetId) => {
    // When
    const request = toUserReportRequest(contentTarget, { reason: 'SPAM' });

    // Then
    expect(request.targetId).toBe(expectedTargetId);
  });
});
