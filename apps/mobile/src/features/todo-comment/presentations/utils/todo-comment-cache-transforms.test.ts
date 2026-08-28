import { createTodoComment } from '../../__tests__/todo-comment.factories';
import {
  withEditedTodoCommentContent,
  withOptimisticTodoCommentLike,
  withTodoCommentLikeResult,
} from './todo-comment-cache-transforms';

describe('todo comment cache transforms', () => {
  test('낙관적 좋아요는 원본을 바꾸지 않고 수와 viewer를 함께 바꾼다', () => {
    const comment = createTodoComment({ likeCount: 1 });

    const result = withOptimisticTodoCommentLike(comment, true);

    expect(result.likeCount).toBe(2);
    expect(result.viewer.isLiked).toBe(true);
    expect(comment.likeCount).toBe(1);
  });

  test('서버 좋아요 결과가 낙관적 수치를 확정한다', () => {
    const comment = createTodoComment({ likeCount: 10 });

    const result = withTodoCommentLikeResult(comment, {
      commentId: comment.id,
      likeCount: 4,
      isLiked: false,
    });

    expect(result.likeCount).toBe(4);
    expect(result.viewer.isLiked).toBe(false);
  });

  test('수정 내용과 수정 표시를 함께 적용한다', () => {
    const comment = createTodoComment({ content: '이전 내용', isEdited: false });

    const result = withEditedTodoCommentContent(comment, '새 내용');

    expect(result.content).toBe('새 내용');
    expect(result.isEdited).toBe(true);
  });
});
