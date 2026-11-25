import { createTodoComment, createTodoCommentReply } from '../__tests__/todo-comment.fixtures';
import { type TodoComment, TodoCommentPolicy } from './todo-comment.model';

describe('TodoCommentPolicy', () => {
  describe('getDisplayState', () => {
    it('차단한 사용자의 글은 삭제보다 차단 상태로 그린다', () => {
      // Given
      const comment = createTodoComment({ isDeleted: true, isAuthorBlocked: true, content: null });

      // When
      const state = TodoCommentPolicy.getDisplayState(comment);

      // Then
      expect(state).toBe('blockedAuthor');
    });

    it('지운 글은 삭제 상태로 그린다', () => {
      // Given
      const comment = createTodoComment({ isDeleted: true, content: null, author: null });

      // When
      const state = TodoCommentPolicy.getDisplayState(comment);

      // Then
      expect(state).toBe('deleted');
    });

    it('지우지도 차단하지도 않은 글은 활성 상태로 그린다', () => {
      // Given
      const comment = createTodoComment();

      // When
      const state = TodoCommentPolicy.getDisplayState(comment);

      // Then
      expect(state).toBe('active');
    });
  });

  describe('isActive', () => {
    it.each([
      ['canLikeComment', (comment: TodoComment) => TodoCommentPolicy.canLikeComment(comment)],
      ['canReplyToComment', (comment: TodoComment) => TodoCommentPolicy.canReplyToComment(comment)],
      ['canEditComment', (comment: TodoComment) => TodoCommentPolicy.canEditComment(comment)],
      ['canCopyComment', (comment: TodoComment) => TodoCommentPolicy.canCopyComment(comment)],
      ['canReportComment', (comment: TodoComment) => TodoCommentPolicy.canReportComment(comment)],
      ['hasCommentActions', (comment: TodoComment) => TodoCommentPolicy.hasCommentActions(comment)],
    ])('지운 글에는 %s가 false를 반환한다', (_name, canDo) => {
      // Given
      const deleted = createTodoComment({
        isDeleted: true,
        content: null,
        viewer: { ...createTodoComment().viewer, canReport: true },
      });

      // When
      const result = canDo(deleted);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canReportComment', () => {
    it('서버가 신고를 허용한 활성 글만 신고할 수 있다', () => {
      // Given
      const reply = createTodoCommentReply(createTodoComment());

      // When
      const result = TodoCommentPolicy.canReportComment(reply);

      // Then
      expect(result).toBe(true);
    });

    it('내 글처럼 서버가 신고를 허용하지 않으면 활성 글이어도 신고할 수 없다', () => {
      // Given
      const mine = createTodoComment();

      // When
      const result = TodoCommentPolicy.canReportComment(mine);

      // Then
      expect(result).toBe(false);
    });

    it('차단한 사용자의 글은 서버가 허용해도 신고할 수 없다', () => {
      // Given
      const blocked = createTodoComment({
        isAuthorBlocked: true,
        viewer: { ...createTodoComment().viewer, canReport: true },
      });

      // When
      const result = TodoCommentPolicy.canReportComment(blocked);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canBlockCommentAuthor', () => {
    it('서버가 차단을 허용한 활성 글의 작성자는 차단할 수 있다', () => {
      // Given
      const reply = createTodoCommentReply(createTodoComment());

      // When
      const result = TodoCommentPolicy.canBlockCommentAuthor(reply);

      // Then
      expect(result).toBe(true);
    });

    it('작성자 정보가 없으면 서버가 허용해도 차단할 수 없다', () => {
      // Given
      const reply = createTodoCommentReply(createTodoComment(), { author: null });

      // When
      const result = TodoCommentPolicy.canBlockCommentAuthor(reply);

      // Then
      expect(result).toBe(false);
    });

    it('내 글처럼 서버가 차단을 허용하지 않으면 차단할 수 없다', () => {
      // Given
      const mine = createTodoComment();

      // When
      const result = TodoCommentPolicy.canBlockCommentAuthor(mine);

      // Then
      expect(result).toBe(false);
    });

    it('이미 차단한 사용자의 글에는 다시 차단을 열지 않는다', () => {
      // Given
      const blocked = createTodoCommentReply(createTodoComment(), { isAuthorBlocked: true });

      // When
      const result = TodoCommentPolicy.canBlockCommentAuthor(blocked);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canDeleteComment', () => {
    it('서버가 지울 수 있다고 준 활성 글이면 true를 반환한다', () => {
      // Given
      const comment = createTodoComment();

      // When
      const result = TodoCommentPolicy.canDeleteComment(comment);

      // Then
      expect(result).toBe(true);
    });

    it('서버가 지울 수 없다고 줬으면 false를 반환한다', () => {
      // Given
      const comment = createTodoComment({
        viewer: { ...createTodoComment().viewer, canEdit: false, canDelete: false },
      });

      // When
      const result = TodoCommentPolicy.canDeleteComment(comment);

      // Then
      expect(result).toBe(false);
    });

    it.each([
      ['이미 지운 글', { isDeleted: true, content: null }],
      ['차단한 사용자의 글', { isAuthorBlocked: true }],
    ] as const)('%s은 지울 권한이 있어도 false를 반환한다', (_label, overrides) => {
      // Given
      const comment = createTodoComment(overrides);

      // When
      const result = TodoCommentPolicy.canDeleteComment(comment);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('canDeleteOnlyAsTodoOwner', () => {
    it('내 할 일의 남의 글은 지울 수만 있어 남의 글 삭제로 확인받는다', () => {
      // Given
      const others = createTodoComment({
        viewer: {
          isLiked: false,
          canEdit: false,
          canDelete: true,
          canReply: true,
          canReport: true,
          canBlock: true,
        },
      });

      // When
      const result = TodoCommentPolicy.canDeleteOnlyAsTodoOwner(others);

      // Then
      expect(result).toBe(true);
    });

    it('내 글은 수정도 할 수 있어 남의 글 삭제가 아니다', () => {
      // Given
      const mine = createTodoComment();

      // When
      const result = TodoCommentPolicy.canDeleteOnlyAsTodoOwner(mine);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('isTombstonedOnDelete', () => {
    it('답글이 남은 댓글은 지워도 묘비로 남는다', () => {
      // Given
      const withReplies = createTodoComment({ replyCount: 2 });

      // When
      const result = TodoCommentPolicy.isTombstonedOnDelete(withReplies);

      // Then
      expect(result).toBe(true);
    });

    it('답글이 없는 댓글은 묘비 없이 사라진다', () => {
      // When
      const result = TodoCommentPolicy.isTombstonedOnDelete(createTodoComment());

      // Then
      expect(result).toBe(false);
    });

    it('답글 자체는 묘비로 남기지 않는다', () => {
      // Given
      const reply = createTodoCommentReply(createTodoComment({ replyCount: 2 }), { replyCount: 0 });

      // When
      const result = TodoCommentPolicy.isTombstonedOnDelete(reply);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('withLiked', () => {
    it('같은 상태면 그대로 둔다', () => {
      // Given
      const liked = createTodoComment({
        likeCount: 0,
        viewer: { ...createTodoComment().viewer, isLiked: true },
      });

      // When
      const same = TodoCommentPolicy.withLiked(liked, true);

      // Then
      expect(same).toBe(liked);
    });

    it('좋아요 수는 0 아래로 내려가지 않는다', () => {
      // Given
      const liked = createTodoComment({
        likeCount: 0,
        viewer: { ...createTodoComment().viewer, isLiked: true },
      });

      // When
      const unliked = TodoCommentPolicy.withLiked(liked, false);

      // Then
      expect(unliked.likeCount).toBe(0);
      expect(unliked.viewer.isLiked).toBe(false);
    });
  });

  describe('withLikeResult', () => {
    it('서버가 돌려준 좋아요 수와 상태로 바꾼다', () => {
      // Given
      const comment = createTodoComment({ likeCount: 1 });

      // When
      const next = TodoCommentPolicy.withLikeResult(comment, {
        commentId: comment.id,
        likeCount: 5,
        isLiked: true,
      });

      // Then
      expect(next.likeCount).toBe(5);
      expect(next.viewer.isLiked).toBe(true);
    });
  });

  describe('withContentEdited', () => {
    it('내용을 바꾸고 수정됨으로 표시한다', () => {
      // Given
      const comment = createTodoComment({ content: '원래 글' });

      // When
      const next = TodoCommentPolicy.withContentEdited(comment, '고친 글');

      // Then
      expect(next).toMatchObject({ content: '고친 글', isEdited: true });
    });
  });

  describe('isReply', () => {
    it('묶음 머리 댓글이 있으면 답글이다', () => {
      // Given
      const reply = createTodoCommentReply(createTodoComment());

      // When
      const result = TodoCommentPolicy.isReply(reply);

      // Then
      expect(result).toBe(true);
    });

    it('묶음 머리 댓글이 없으면 첫 댓글이다', () => {
      // Given
      const comment = createTodoComment({ threadCommentId: null });

      // When
      const result = TodoCommentPolicy.isReply(comment);

      // Then
      expect(result).toBe(false);
    });
  });

  describe('findCopyableContent', () => {
    it('활성 글은 그 글을 복사한다', () => {
      // Given
      const comment = createTodoComment({ content: '복사할 글' });

      // When
      const content = TodoCommentPolicy.findCopyableContent(comment);

      // Then
      expect(content).toBe('복사할 글');
    });

    it('차단한 사용자의 글은 내용이 남아 있어도 복사할 글이 없다', () => {
      // Given
      const comment = createTodoComment({ content: '가린 글', isAuthorBlocked: true });

      // When
      const content = TodoCommentPolicy.findCopyableContent(comment);

      // Then
      expect(content).toBeNull();
    });
  });
});
