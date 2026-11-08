import { todoCommentParamsSchema } from './todo-comment-params.schema';

const COMMENT_ID = 'cmt92zn3n000b7voxx9quc2th';

describe('todoCommentParamsSchema', () => {
  it('정렬과 알림으로 연 댓글 위치를 읽는다', () => {
    // When
    const params = todoCommentParamsSchema.parse({ sort: 'POPULAR', comment: COMMENT_ID });

    // Then
    expect(params).toEqual({ sort: 'POPULAR', comment: COMMENT_ID });
  });

  it('잘못된 값은 최신순·위치 없음으로 복구한다', () => {
    // When
    const params = todoCommentParamsSchema.parse({ sort: 'OLDEST', comment: 'not-a-cuid' });

    // Then
    expect(params).toEqual({ sort: 'LATEST', comment: undefined });
  });

  it('1.14.0 이하 대화 URL의 intent·returnTo는 무시한다', () => {
    // When
    const params = todoCommentParamsSchema.parse({ comment: COMMENT_ID });

    // Then
    expect(params).toEqual({ sort: 'LATEST', comment: COMMENT_ID });
  });
});
