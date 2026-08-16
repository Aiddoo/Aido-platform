import { createTodoComment } from '../../__tests__/todo-comment.factories';
import { resolveThreadContinuity } from './thread-continuity';

/** 판정 자체는 TodoCommentThreadPolicy가 검증한다. 여기서는 행마다 펴는 것만 본다. */
const byAuthor = (authors: readonly string[]) =>
  authors.map((authorId, index) =>
    createTodoComment({
      id: `comment-${index}`,
      author: { id: authorId, name: authorId, profileImage: null, isTodoOwner: false },
    }),
  );

describe('resolveThreadContinuity', () => {
  it('첫 행은 위로, 마지막 행은 아래로 잇지 않는다', () => {
    const result = resolveThreadContinuity(byAuthor(['a', 'a']));

    expect(result[0]?.continuesFromAbove).toBe(false);
    expect(result.at(-1)?.continuesBelow).toBe(false);
  });

  it('빈 목록도 다룬다', () => {
    expect(resolveThreadContinuity([])).toEqual([]);
  });

  /**
   * 반쪽 선이 남는 유일한 경로는 위 행의 아래 선과 아래 행의 위 선이 어긋나는 것이다.
   * 정렬(최신순↔인기순)로 순서가 통째로 바뀌어도 이 불변식은 깨지면 안 된다.
   */
  it.each([
    ['최신순', ['a', 'a', 'b', 'b', 'a']],
    ['인기순(뒤집힘)', ['a', 'b', 'b', 'a', 'a']],
    ['한 사람만', ['a', 'a', 'a', 'a']],
    ['전부 다른 사람', ['a', 'b', 'c', 'd']],
  ])('%s 순서에서도 위·아래 선 판정이 어긋나지 않는다', (_label, authors) => {
    const result = resolveThreadContinuity(byAuthor(authors));

    result.forEach((row, index) => {
      const below = result[index + 1];
      if (below) {
        expect(row.continuesBelow).toBe(below.continuesFromAbove);
      }
    });
  });

  it('답글이 섞여 흐름이 끊겨도 위·아래가 어긋나지 않는다', () => {
    const comments = [
      createTodoComment({ id: 'c0' }),
      createTodoComment({ id: 'c1', hasReplies: true }),
      createTodoComment({ id: 'c2' }),
    ];

    const result = resolveThreadContinuity(comments);

    result.forEach((row, index) => {
      const below = result[index + 1];
      if (below) {
        expect(row.continuesBelow).toBe(below.continuesFromAbove);
      }
    });
  });
});
