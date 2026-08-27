import { createTodoComment } from '../../__tests__/todo-comment.factories';
import { likeToggled } from './todo-comment-optimistic';

describe('todo comment optimistic utilities', () => {
  test('좋아요는 입력을 바꾸지 않고 수와 viewer를 함께 바꾼다', () => {
    // Given
    const comment = createTodoComment({ likeCount: 1 });

    // When
    const result = likeToggled(comment, true);

    // Then
    expect(result.likeCount).toBe(2);
    expect(result.viewer.isLiked).toBe(true);
    expect(comment.likeCount).toBe(1);
  });
});
