import {
  createTodoComment,
  createTodoCommentReply,
  createTodoCommentThread,
} from '../__tests__/todo-comment.fixtures';
import { TodoCommentPolicy } from './todo-comment.model';

describe('TodoCommentPolicy', () => {
  it('차단한 사용자의 글은 삭제보다 차단 상태로 그린다', () => {
    // Given
    const blocked = createTodoComment({ isDeleted: true, isAuthorBlocked: true, content: null });
    const deleted = createTodoComment({ isDeleted: true, content: null, author: null });

    // When
    const states = [blocked, deleted, createTodoComment()].map(TodoCommentPolicy.getDisplayState);

    // Then
    expect(states).toEqual(['blockedAuthor', 'deleted', 'active']);
  });

  it('지운 글에는 좋아요·답글·수정·복사·신고를 열지 않는다', () => {
    // Given
    const deleted = createTodoComment({ isDeleted: true, content: null });

    // When
    const actions = [
      TodoCommentPolicy.canLikeComment(deleted),
      TodoCommentPolicy.canReplyToComment(deleted),
      TodoCommentPolicy.canEditComment(deleted),
      TodoCommentPolicy.canCopyComment(deleted),
      TodoCommentPolicy.hasCommentActions(deleted),
    ];

    // Then
    expect(actions).toEqual([false, false, false, false, false]);
  });

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
    const result = [
      TodoCommentPolicy.canDeleteOnlyAsTodoOwner(others),
      TodoCommentPolicy.canDeleteOnlyAsTodoOwner(createTodoComment()),
    ];

    // Then
    expect(result).toEqual([true, false]);
  });

  it('답글이 남은 댓글만 지워도 묘비로 남는다', () => {
    // Given
    const withReplies = createTodoComment({ replyCount: 2 });
    const reply = createTodoCommentReply(withReplies, { replyCount: 0 });

    // When
    const result = [
      TodoCommentPolicy.leavesTombstoneOnDelete(withReplies),
      TodoCommentPolicy.leavesTombstoneOnDelete(createTodoComment()),
      TodoCommentPolicy.leavesTombstoneOnDelete(reply),
    ];

    // Then
    expect(result).toEqual([true, false, false]);
  });

  it('좋아요는 같은 상태면 그대로 두고 0 아래로 내려가지 않는다', () => {
    // Given
    const liked = createTodoComment({
      likeCount: 0,
      viewer: { ...createTodoComment().viewer, isLiked: true },
    });

    // When
    const same = TodoCommentPolicy.withLikeToggled(liked, true);
    const unliked = TodoCommentPolicy.withLikeToggled(liked, false);

    // Then
    expect(same).toBe(liked);
    expect(unliked.likeCount).toBe(0);
    expect(unliked.viewer.isLiked).toBe(false);
  });

  it('펼친 뒤 남은 답글 수는 전체에서 불러온 수를 뺀 값이고 음수가 되지 않는다', () => {
    // Given
    const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 12 }) });

    // When
    const counts = [10, 12, 15].map((loaded) =>
      TodoCommentPolicy.getHiddenReplyCount(thread, loaded),
    );

    // Then
    expect(counts).toEqual([2, 0, 0]);
  });

  it('대표 답글이 없던 묶음에 답글을 달면 그 답글이 대표가 되고 수가 늘어난다', () => {
    // Given
    const head = createTodoComment();
    const thread = createTodoCommentThread({ comment: head, previewReply: null });
    const reply = createTodoCommentReply(head);

    // When
    const next = TodoCommentPolicy.withReplyAdded(thread, [reply]);

    // Then
    expect(next.previewReply).toBe(reply);
    expect(next.comment.replyCount).toBe(1);
    expect(next.replySummary).toMatchObject({ totalCount: 1, hiddenCount: 0 });
  });

  it('답글이 남은 댓글을 지우면 묘비가 되고 답글은 그대로다', () => {
    // Given
    const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 2 }) });

    // When
    const next = TodoCommentPolicy.withCommentRemoved(thread, thread.comment);

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
    const next = TodoCommentPolicy.withCommentRemoved(thread, thread.comment);

    // Then
    expect(next).toBeNull();
  });

  it('묘비 댓글의 마지막 답글을 지우면 묶음째 사라진다', () => {
    // Given
    const head = createTodoComment({ replyCount: 1, isDeleted: true, content: null, author: null });
    const reply = createTodoCommentReply(head);
    const thread = createTodoCommentThread({ comment: head, previewReply: reply });

    // When
    const next = TodoCommentPolicy.withCommentRemoved(thread, reply);

    // Then
    expect(next).toBeNull();
  });

  it('다른 묶음의 답글을 지워도 이 묶음은 같은 참조로 남는다', () => {
    // Given
    const thread = createTodoCommentThread();
    const otherReply = createTodoCommentReply(createTodoComment({ id: 'other' }));

    // When
    const next = TodoCommentPolicy.withCommentRemoved(thread, otherReply);

    // Then
    expect(next).toBe(thread);
  });

  it('여러 페이지에 걸친 같은 묶음은 한 번만 보인다', () => {
    // Given
    const thread = createTodoCommentThread();
    const pagination = {
      previousCursor: null,
      nextCursor: null,
      hasPrevious: false,
      hasNext: false,
      size: 30,
    };

    // When
    const threads = TodoCommentPolicy.flattenThreads([
      { items: [thread], pagination, anchor: null },
      { items: [thread], pagination, anchor: null },
    ]);

    // Then
    expect(threads).toHaveLength(1);
  });

  it('먼저 붙인 새 답글은 남은 페이지를 받으면 작성 순 자리로 옮겨 간다', () => {
    // Given
    const head = createTodoComment();
    const [older, posted] = [
      createTodoCommentReply(head, { id: 'older' }),
      createTodoCommentReply(head, { id: 'posted' }),
    ];
    const first = createTodoCommentReply(head, { id: 'first' });
    const pagination = {
      previousCursor: null,
      nextCursor: null,
      hasPrevious: false,
      hasNext: false,
      size: 10,
    };

    // When
    const replies = TodoCommentPolicy.flattenReplies([
      { items: [first, posted], pagination },
      { items: [older, posted], pagination },
    ]);

    // Then
    expect(replies.map((reply) => reply.id)).toEqual(['first', 'older', 'posted']);
  });
});
