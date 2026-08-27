import { getCommentScreenBackAction } from './comment-screen-back-action';

describe('getCommentScreenBackAction', () => {
  it.each(['reply', 'edit', 'create'] as const)(
    '%s 작성 mode는 한 번의 뒤로가기로 작성기를 닫는다',
    (mode) => {
      expect(getCommentScreenBackAction({ mode, isSubmitting: false })).toBe('close-composer');
    },
  );

  it('대화 mode는 한 번의 뒤로가기로 댓글 개요를 연다', () => {
    expect(getCommentScreenBackAction({ mode: 'thread', isSubmitting: false })).toBe(
      'clear-thread',
    );
  });

  it('댓글 개요에서만 native stack을 pop한다', () => {
    expect(getCommentScreenBackAction({ mode: 'overview', isSubmitting: false })).toBe('native');
  });

  it.each(['overview', 'thread', 'reply', 'edit', 'create'] as const)(
    '%s에서 전송 중이면 현재 화면을 유지한다',
    (mode) => {
      expect(getCommentScreenBackAction({ mode, isSubmitting: true })).toBe('consume');
    },
  );
});
