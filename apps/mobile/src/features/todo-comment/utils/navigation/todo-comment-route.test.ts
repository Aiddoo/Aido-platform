import {
  createTodoCommentHref,
  parseTodoCommentRoute,
  serializeTodoCommentRoute,
} from './todo-comment-route';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

describe('parseTodoCommentRoute', () => {
  it('정렬과 알림으로 연 댓글 위치를 읽는다', () => {
    // When
    const route = parseTodoCommentRoute({ sort: 'POPULAR', comment: COMMENT_ID });

    // Then
    expect(route).toEqual({ sort: 'POPULAR', comment: COMMENT_ID });
  });

  it('잘못된 값은 최신순·위치 없음으로 복구한다', () => {
    // When
    const route = parseTodoCommentRoute({ sort: 'OLDEST', comment: 'not-a-cuid' });

    // Then
    expect(route).toEqual({ sort: 'LATEST', comment: null });
  });

  it('1.14.0 이하 대화 URL의 intent·returnTo는 무시한다', () => {
    // When
    const route = parseTodoCommentRoute({ comment: COMMENT_ID });

    // Then
    expect(route).toEqual({ sort: 'LATEST', comment: COMMENT_ID });
  });
});

describe('serializeTodoCommentRoute', () => {
  it('위치가 없으면 search에서 comment를 지운다', () => {
    // When
    const params = serializeTodoCommentRoute({ sort: 'LATEST', comment: null });

    // Then
    expect(params).toEqual({ sort: 'LATEST', comment: undefined });
  });
});

describe('createTodoCommentHref', () => {
  it('옛 대화 링크는 할 일 상세의 그 댓글 위치로 옮긴다', () => {
    // When
    const href = createTodoCommentHref({ todoId: 42, commentId: COMMENT_ID });

    // Then
    expect(href).toEqual({
      pathname: '/todo/[todoId]',
      params: { todoId: 42, comment: COMMENT_ID },
    });
  });
});
