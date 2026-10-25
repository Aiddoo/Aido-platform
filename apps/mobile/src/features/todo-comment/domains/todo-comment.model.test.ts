import { createTodoComment, createTodoCommentReply } from '../__tests__/todo-comment.factories';
import { TodoCommentDraftPolicy, TodoCommentPolicy } from './todo-comment.model';

describe('TodoCommentPolicy', () => {
  describe('canLike', () => {
    test('살아 있는 댓글은 어느 깊이에서든 좋아요할 수 있다', () => {
      // Given
      const comment = createTodoComment();
      const deepReply = createTodoCommentReply(createTodoCommentReply(comment));

      // When
      const result = TodoCommentPolicy.canLike(deepReply);

      // Then
      expect(result).toBe(true);
    });

    test('삭제된 댓글은 좋아요할 수 없다', () => {
      // Given
      const comment = createTodoComment({ isDeleted: true });

      // When
      const result = TodoCommentPolicy.canLike(comment);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canReply', () => {
    test('서버가 허용한 댓글에만 답글을 달 수 있다', () => {
      // Given
      const allowed = createTodoComment();
      const denied = createTodoComment({
        viewer: {
          isLiked: false,
          canEdit: false,
          canDelete: false,
          canReply: false,
          canReport: false,
          canBlock: false,
        },
      });

      // When
      const allowedResult = TodoCommentPolicy.canReply(allowed);
      const deniedResult = TodoCommentPolicy.canReply(denied);

      // Then
      expect(allowedResult).toBe(true);
      expect(deniedResult).toBe(false);
    });

    test('묘비가 된 댓글은 답글을 받지 못한다 — 대화 화면의 입력바가 이 판단을 따른다', () => {
      // Given - 답글이 남아 목록에는 보이지만 삭제된 댓글
      const tombstone = createTodoComment({ isDeleted: true, replyCount: 2 });

      // When
      const result = TodoCommentPolicy.canReply(tombstone);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canEdit · canDelete', () => {
    test('서버가 준 허가를 각각 따른다', () => {
      // Given - 삭제만 열린 댓글
      const deletableOnly = createTodoComment({
        viewer: {
          isLiked: false,
          canEdit: false,
          canDelete: true,
          canReply: true,
          canReport: false,
          canBlock: false,
        },
      });

      // When & Then
      expect(TodoCommentPolicy.canEdit(deletableOnly)).toBe(false);
      expect(TodoCommentPolicy.canDelete(deletableOnly)).toBe(true);
    });

    test('삭제된 댓글은 어느 쪽도 열리지 않는다', () => {
      // Given
      const comment = createTodoComment({ isDeleted: true });

      // When & Then
      expect(TodoCommentPolicy.canEdit(comment)).toBe(false);
      expect(TodoCommentPolicy.canDelete(comment)).toBe(false);
    });
  });

  describe('hasActions', () => {
    test('수정·삭제·신고·차단 중 하나라도 열려 있으면 메뉴를 보인다', () => {
      // Given
      const mine = createTodoComment();
      const others = createTodoCommentReply(createTodoComment());
      const readOnly = createTodoComment({
        viewer: {
          isLiked: false,
          canEdit: false,
          canDelete: false,
          canReply: true,
          canReport: false,
          canBlock: false,
        },
      });

      // When & Then
      expect(TodoCommentPolicy.hasActions(mine)).toBe(true);
      expect(TodoCommentPolicy.hasActions(others)).toBe(true);
      expect(TodoCommentPolicy.hasActions(readOnly)).toBe(false);
    });

    test('삭제되거나 차단으로 가린 댓글은 메뉴를 보이지 않는다', () => {
      // Given
      const hidden = createTodoComment({ isDeleted: true, isAuthorBlocked: true, author: null });

      // When
      const result = TodoCommentPolicy.hasActions(hidden);

      // Then
      expect(result).toBe(false);
    });
  });
});

describe('TodoCommentDraftPolicy', () => {
  describe('hasCapacity', () => {
    test.each([
      ['한 칸', 1, true],
      ['상한 직전', 4, true],
      ['상한', 5, false],
      ['상한 초과', 6, false],
    ])('%s(%i개)이면 %s', (_label, count, expected) => {
      expect(TodoCommentDraftPolicy.hasCapacity(count)).toBe(expected);
    });
  });
});
