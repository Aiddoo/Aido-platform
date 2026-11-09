import { createTodoComment, createTodoCommentThread } from '../__tests__/todo-comment.fixtures';
import { expandThread, getReplyFooter } from './todo-comment-replies.view-model';

function threadWithReplies(count: number) {
  return createTodoCommentThread({ comment: createTodoComment({ replyCount: count }) });
}

describe('답글 아래 줄', () => {
  it('답글을 올려 펼친 묶음은 모두 불러와도 숨기기를 보이지 않는다', () => {
    // Given
    const thread = threadWithReplies(3);

    // When
    const footer = getReplyFooter(thread, {
      loadedCount: 3,
      hasNextPage: false,
      expansion: { isExpanded: true, source: 'auto' },
    });

    // Then
    expect(footer).toBe('none');
  });

  it('사용자가 펼친 묶음은 모두 불러오면 숨기기를 보인다', () => {
    // Given
    const thread = threadWithReplies(3);

    // When
    const footer = getReplyFooter(thread, {
      loadedCount: 3,
      hasNextPage: false,
      expansion: { isExpanded: true, source: 'user' },
    });

    // Then
    expect(footer).toBe('hide');
  });

  it('답글이 하나뿐이면 접어도 같은 모습이라 숨기기를 보이지 않는다', () => {
    // Given
    const thread = threadWithReplies(1);

    // When
    const footer = getReplyFooter(thread, {
      loadedCount: 1,
      hasNextPage: false,
      expansion: { isExpanded: true, source: 'user' },
    });

    // Then
    expect(footer).toBe('none');
  });

  it('다음 페이지에 남은 답글이 있으면 펼친 방식과 관계없이 더 보기를 보인다', () => {
    // Given
    const thread = threadWithReplies(12);

    // When
    const footers = (['user', 'auto'] as const).map((source) =>
      getReplyFooter(thread, {
        loadedCount: 10,
        hasNextPage: true,
        expansion: { isExpanded: true, source },
      }),
    );

    // Then
    expect(footers).toEqual(['viewMore', 'viewMore']);
  });

  it('사용자가 펼친 묶음은 답글을 올려도 사용자 펼침으로 남는다', () => {
    // Given
    const expandedByUser = { isExpanded: true, source: 'user' } as const;

    // When
    const expansion = expandThread(expandedByUser, 'auto');

    // Then
    expect(expansion).toBe(expandedByUser);
  });

  it('접혀 있거나 처음 보는 묶음은 답글을 올리면 자동 펼침이 된다', () => {
    // Given
    const collapsedByUser = { isExpanded: false, source: 'user' } as const;

    // When
    const expansions = [expandThread(collapsedByUser, 'auto'), expandThread(undefined, 'auto')];

    // Then
    expect(expansions).toEqual([
      { isExpanded: true, source: 'auto' },
      { isExpanded: true, source: 'auto' },
    ]);
  });
});
