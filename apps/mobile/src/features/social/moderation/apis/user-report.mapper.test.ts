import { createCommentReportTarget } from '../domains/user-report.model';
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
});
