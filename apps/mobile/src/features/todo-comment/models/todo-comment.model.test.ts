import {
  createPendingTodoComment,
  createTodoComment,
  createTodoCommentReply,
} from '../__tests__/todo-comment.factories';
import { TodoCommentPolicy, mentionedAuthorName } from './todo-comment.model';

describe('mentionedAuthorName', () => {
  test('답글은 부모 작성자를 멘션한다', () => {
    // Given
    const comment = createTodoComment();
    const reply = createTodoCommentReply(comment);

    // When
    const result = mentionedAuthorName(reply);

    // Then
    expect(result).toBe('김철수');
  });

  test('할 일에 바로 달린 댓글에는 멘션이 없다', () => {
    // Given
    const comment = createTodoComment();

    // When
    const result = mentionedAuthorName(comment);

    // Then
    expect(result).toBeNull();
  });

  test('탈퇴한 사람에게 단 답글에는 이름이 없다', () => {
    // Given
    const comment = createTodoComment({ author: null });
    const reply = createTodoCommentReply(comment);

    // When
    const result = mentionedAuthorName(reply);

    // Then
    expect(result).toBeNull();
  });
});

describe('답글의 자리', () => {
  test('깊이 제한 없이 부모의 뿌리를 이어받으며 내려간다', () => {
    // Given - 댓글 → 답글 → 답글의 답글
    const depth0 = createTodoComment();
    const depth1 = createTodoCommentReply(depth0);

    // When
    const depth2 = createTodoCommentReply(depth1);

    // Then - 뿌리는 그대로고 깊이만 쌓인다
    expect(depth1).toMatchObject({ parentId: depth0.id, rootId: depth0.id, depth: 1 });
    expect(depth2).toMatchObject({ parentId: depth1.id, rootId: depth0.id, depth: 2 });
  });
});

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

    test('서버가 아직 확인하지 않은 댓글은 좋아요할 수 없다', () => {
      // Given
      const comment = createPendingTodoComment();

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
        viewer: { isLiked: false, canEdit: false, canDelete: false, canReply: false },
      });

      // When
      const allowedResult = TodoCommentPolicy.canReply(allowed);
      const deniedResult = TodoCommentPolicy.canReply(denied);

      // Then
      expect(allowedResult).toBe(true);
      expect(deniedResult).toBe(false);
    });

    test('묘비가 된 댓글은 답글을 받지 못한다 — 스레드 화면의 입력바가 이 판단을 따른다', () => {
      // Given - 답글이 남아 목록에는 보이지만 삭제된 댓글
      const tombstone = createTodoComment({ isDeleted: true, replyCount: 2, hasReplies: true });

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
        viewer: { isLiked: false, canEdit: false, canDelete: true, canReply: true },
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

  describe('canManage', () => {
    test('수정·삭제 중 하나라도 열려 있으면 관리할 수 있다', () => {
      // Given
      const mine = createTodoComment();
      const deletableOnly = createTodoComment({
        viewer: { isLiked: false, canEdit: false, canDelete: true, canReply: true },
      });
      const others = createTodoComment({
        viewer: { isLiked: false, canEdit: false, canDelete: false, canReply: true },
      });

      // When & Then
      expect(TodoCommentPolicy.canManage(mine)).toBe(true);
      expect(TodoCommentPolicy.canManage(deletableOnly)).toBe(true);
      expect(TodoCommentPolicy.canManage(others)).toBe(false);
    });

    test('삭제된 댓글은 관리할 수 없다', () => {
      // Given
      const comment = createTodoComment({ isDeleted: true });

      // When
      const result = TodoCommentPolicy.canManage(comment);

      // Then
      expect(result).toBe(false);
    });

    test('서버가 아직 확인하지 않은 댓글은 관리할 수 없다', () => {
      // Given
      const comment = createPendingTodoComment({
        viewer: { isLiked: false, canEdit: true, canDelete: true, canReply: true },
      });

      // When
      const result = TodoCommentPolicy.canManage(comment);

      // Then
      expect(result).toBe(false);
    });
  });
});
