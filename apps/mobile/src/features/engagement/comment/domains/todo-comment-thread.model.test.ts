import {
  createTodoComment,
  createTodoCommentReply,
  createTodoCommentThread,
} from '../__tests__/todo-comment.fixtures';
import { TodoCommentThreadPolicy } from './todo-comment-thread.model';

describe('TodoCommentThreadPolicy', () => {
  describe('getHiddenReplyCount', () => {
    it.each([
      [10, 2],
      [12, 0],
      [15, 0],
    ])('전체 12개 중 %i개를 불러왔으면 남은 답글은 %i개다', (loadedCount, expected) => {
      // Given
      const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 12 }) });

      // When
      const hiddenCount = TodoCommentThreadPolicy.getHiddenReplyCount(thread, loadedCount);

      // Then
      // 전체에서 불러온 수를 뺀 값이고 음수가 되지 않는다
      expect(hiddenCount).toBe(expected);
    });
  });

  describe('withReplyAdded', () => {
    it('대표 답글이 없던 묶음에 답글을 달면 그 답글이 대표가 되고 수가 늘어난다', () => {
      // Given
      const head = createTodoComment();
      const thread = createTodoCommentThread({ comment: head, previewReply: null });
      const reply = createTodoCommentReply(head);

      // When
      const next = TodoCommentThreadPolicy.withReplyAdded(thread, [reply]);

      // Then
      expect(next.previewReply).toBe(reply);
      expect(next.comment.replyCount).toBe(1);
      expect(next.replySummary).toMatchObject({ totalCount: 1, hiddenCount: 0 });
    });
  });

  describe('withCommentRemoved', () => {
    it('답글이 남은 댓글을 지우면 묘비가 되고 답글은 그대로다', () => {
      // Given
      const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 2 }) });

      // When
      const next = TodoCommentThreadPolicy.withCommentRemoved(thread, thread.comment);

      // Then
      expect(next?.comment).toMatchObject({
        isDeleted: true,
        content: null,
        author: null,
        likeCount: 0,
      });
      expect(next?.previewReply).toBe(thread.previewReply);
    });

    it('답글 없는 댓글을 지우면 묶음째 사라진다', () => {
      // Given
      const thread = createTodoCommentThread({
        comment: createTodoComment({ replyCount: 0 }),
        previewReply: null,
      });

      // When
      const next = TodoCommentThreadPolicy.withCommentRemoved(thread, thread.comment);

      // Then
      expect(next).toBeNull();
    });

    it('묘비 댓글의 마지막 답글을 지우면 묶음째 사라진다', () => {
      // Given
      const head = createTodoComment({
        replyCount: 1,
        isDeleted: true,
        content: null,
        author: null,
      });
      const reply = createTodoCommentReply(head);
      const thread = createTodoCommentThread({ comment: head, previewReply: reply });

      // When
      const next = TodoCommentThreadPolicy.withCommentRemoved(thread, reply);

      // Then
      expect(next).toBeNull();
    });

    it('다른 묶음의 답글을 지워도 이 묶음은 같은 참조로 남는다', () => {
      // Given
      const thread = createTodoCommentThread();
      const otherReply = createTodoCommentReply(createTodoComment({ id: 'other' }));

      // When
      const next = TodoCommentThreadPolicy.withCommentRemoved(thread, otherReply);

      // Then
      expect(next).toBe(thread);
    });
  });

  describe('findCommentInThread', () => {
    it('묶음의 머리 댓글을 id로 찾는다', () => {
      // Given
      const thread = createTodoCommentThread();

      // When
      const found = TodoCommentThreadPolicy.findCommentInThread(thread, thread.comment.id);

      // Then
      expect(found).toBe(thread.comment);
    });

    it('묶음의 대표 답글을 id로 찾는다', () => {
      // Given
      const thread = createTodoCommentThread();

      // When
      const found = TodoCommentThreadPolicy.findCommentInThread(
        thread,
        thread.previewReply?.id ?? '',
      );

      // Then
      expect(found).toBe(thread.previewReply);
    });

    it('묶음에 없는 id는 null을 반환한다', () => {
      // Given
      const thread = createTodoCommentThread();

      // When
      const found = TodoCommentThreadPolicy.findCommentInThread(thread, 'missing');

      // Then
      expect(found).toBeNull();
    });
  });

  describe('hasRepliesToShow', () => {
    it.each([
      { totalCount: 0, expected: false },
      { totalCount: 1, expected: true },
      { totalCount: 12, expected: true },
    ])(
      '답글이 모두 $totalCount개면 답글 보기를 보여 주는지는 $expected다',
      ({ totalCount, expected }) => {
        // Given
        const thread = createTodoCommentThread({
          comment: createTodoComment({ replyCount: totalCount }),
        });

        // When
        const result = TodoCommentThreadPolicy.hasRepliesToShow(thread);

        // Then
        expect(result).toBe(expected);
      },
    );
  });

  describe('getCollapsedHiddenReplyCount', () => {
    it('대표 답글이 있으면 서버가 센 숨은 답글 수를 반환한다', () => {
      // Given
      // 답글 4개 중 대표 1개를 보여 3개가 숨는다
      const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 4 }) });

      // When
      const result = TodoCommentThreadPolicy.getCollapsedHiddenReplyCount(thread);

      // Then
      expect(result).toBe(3);
    });

    it('대표 답글이 없으면 답글 전체가 숨은 수다', () => {
      // Given
      const thread = createTodoCommentThread({
        comment: createTodoComment({ replyCount: 2 }),
        previewReply: null,
      });

      // When
      const result = TodoCommentThreadPolicy.getCollapsedHiddenReplyCount(thread);

      // Then
      expect(result).toBe(2);
    });

    it('대표 답글 하나뿐이면 숨은 답글이 없다', () => {
      // Given
      // 답글 1개 - 대표 1개 = 0
      const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 1 }) });

      // When
      const result = TodoCommentThreadPolicy.getCollapsedHiddenReplyCount(thread);

      // Then
      expect(result).toBe(0);
    });
  });

  describe('findAnchoredReplyId', () => {
    const thread = createTodoCommentThread({ comment: createTodoComment({ id: 'comment-1' }) });

    it('알림으로 연 위치가 이 묶음의 답글이면 그 답글을 반환한다', () => {
      // When
      const replyId = TodoCommentThreadPolicy.findAnchoredReplyId(thread, {
        threadCommentId: 'comment-1',
        replyId: 'reply-7',
      });

      // Then
      expect(replyId).toBe('reply-7');
    });

    it.each([
      ['이 묶음의 댓글 자신', { threadCommentId: 'comment-1', replyId: null }],
      ['다른 묶음의 답글', { threadCommentId: 'comment-2', replyId: 'reply-7' }],
      ['알림으로 열지 않음', null],
    ])('%s이면 null을 반환한다', (_label, anchor) => {
      // When
      const replyId = TodoCommentThreadPolicy.findAnchoredReplyId(thread, anchor);

      // Then
      expect(replyId).toBeNull();
    });
  });
});
