import { TODO_COMMENT_QUERY_KEYS } from './todo-comment-query-keys';

describe('TODO_COMMENT_QUERY_KEYS', () => {
  it('묶음·답글 키는 할 일 키 아래에 있어 할 일 단위로 한 번에 취소·무효화된다', () => {
    // When
    const todoKey = TODO_COMMENT_QUERY_KEYS.todo({ todoId: 42 });
    const threads = TODO_COMMENT_QUERY_KEYS.threads({
      todoId: 42,
      sort: 'LATEST',
      anchorCommentId: null,
    });
    const replies = TODO_COMMENT_QUERY_KEYS.replies({
      todoId: 42,
      commentId: 'c1',
      aroundReplyId: null,
    });

    // Then
    expect(threads.slice(0, todoKey.length)).toEqual(todoKey);
    expect(replies.slice(0, todoKey.length)).toEqual(todoKey);
  });

  it('알림으로 연 답글 페이지도 같은 묶음 키 아래라 새 답글이 함께 붙는다', () => {
    // When
    const thread = TODO_COMMENT_QUERY_KEYS.threadReplies({ todoId: 42, commentId: 'c1' });
    const around = TODO_COMMENT_QUERY_KEYS.replies({
      todoId: 42,
      commentId: 'c1',
      aroundReplyId: 'r9',
    });

    // Then
    expect(around.slice(0, thread.length)).toEqual(thread);
  });
});
