import {
  createTodoComment,
  createTodoCommentReply,
  createTodoCommentThread,
} from '../__tests__/todo-comment.fixtures';
import { TodoCommentPolicy } from './todo-comment.model';

const PAGINATION = {
  previousCursor: null,
  nextCursor: null,
  hasPrevious: false,
  hasNext: false,
  size: 10,
};

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

describe('지운 글의 동작', () => {
  it.each([
    ['canLikeComment', TodoCommentPolicy.canLikeComment],
    ['canReplyToComment', TodoCommentPolicy.canReplyToComment],
    ['canEditComment', TodoCommentPolicy.canEditComment],
    ['canCopyComment', TodoCommentPolicy.canCopyComment],
    ['canReportComment', TodoCommentPolicy.canReportComment],
    ['hasCommentActions', TodoCommentPolicy.hasCommentActions],
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

describe('getHiddenReplyCount', () => {
  it.each([
    [10, 2],
    [12, 0],
    [15, 0],
  ])('전체 12개 중 %i개를 불러왔으면 남은 답글은 %i개다', (loadedCount, expected) => {
    // Given
    const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 12 }) });

    // When
    const hiddenCount = TodoCommentPolicy.getHiddenReplyCount(thread, loadedCount);

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
    const next = TodoCommentPolicy.withReplyAdded(thread, [reply]);

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
});

describe('findCommentInThread', () => {
  it('묶음의 머리 댓글을 id로 찾는다', () => {
    // Given
    const thread = createTodoCommentThread();

    // When
    const found = TodoCommentPolicy.findCommentInThread(thread, thread.comment.id);

    // Then
    expect(found).toBe(thread.comment);
  });

  it('묶음의 대표 답글을 id로 찾는다', () => {
    // Given
    const thread = createTodoCommentThread();

    // When
    const found = TodoCommentPolicy.findCommentInThread(thread, thread.previewReply?.id ?? '');

    // Then
    expect(found).toBe(thread.previewReply);
  });

  it('묶음에 없는 id는 null을 반환한다', () => {
    // Given
    const thread = createTodoCommentThread();

    // When
    const found = TodoCommentPolicy.findCommentInThread(thread, 'missing');

    // Then
    expect(found).toBeNull();
  });
});

describe('flattenThreads', () => {
  it('여러 페이지에 걸친 같은 묶음은 한 번만 보인다', () => {
    // Given
    const thread = createTodoCommentThread();

    // When
    const threads = TodoCommentPolicy.flattenThreads([
      { items: [thread], pagination: PAGINATION, anchor: null },
      { items: [thread], pagination: PAGINATION, anchor: null },
    ]);

    // Then
    expect(threads).toHaveLength(1);
  });
});

describe('flattenReplies', () => {
  it('먼저 붙인 새 답글은 남은 페이지를 받으면 작성 순 자리로 옮겨 간다', () => {
    // Given
    const head = createTodoComment();
    const older = createTodoCommentReply(head, { id: 'older' });
    const posted = createTodoCommentReply(head, { id: 'posted' });
    const first = createTodoCommentReply(head, { id: 'first' });

    // When
    const replies = TodoCommentPolicy.flattenReplies([
      { items: [first, posted], pagination: PAGINATION },
      { items: [older, posted], pagination: PAGINATION },
    ]);

    // Then
    expect(replies.map((reply) => reply.id)).toEqual(['first', 'older', 'posted']);
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
      const result = TodoCommentPolicy.hasRepliesToShow(thread);

      // Then
      expect(result).toBe(expected);
    },
  );
});

describe('withRepliesRemoved', () => {
  const head = createTodoComment();
  const first = createTodoCommentReply(head, { id: 'reply-1' });
  const second = createTodoCommentReply(head, { id: 'reply-2' });

  it('지운 답글만 목록에서 빼고 나머지 순서는 그대로 둔다', () => {
    // Given
    const replies = [first, second];

    // When
    const next = TodoCommentPolicy.withRepliesRemoved(replies, 'reply-1');

    // Then
    expect(next).toEqual([second]);
  });

  it('목록에 없는 답글이면 같은 내용의 새 목록을 돌려준다', () => {
    // Given
    const replies = [first, second];

    // When
    const next = TodoCommentPolicy.withRepliesRemoved(replies, 'reply-unknown');

    // Then
    expect(next).toEqual(replies);
    expect(next).not.toBe(replies);
  });
});

describe('getCollapsedHiddenReplyCount', () => {
  it('대표 답글이 있으면 서버가 센 숨은 답글 수를 반환한다', () => {
    // Given
    // 답글 4개 중 대표 1개를 보여 3개가 숨는다
    const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 4 }) });

    // When
    const result = TodoCommentPolicy.getCollapsedHiddenReplyCount(thread);

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
    const result = TodoCommentPolicy.getCollapsedHiddenReplyCount(thread);

    // Then
    expect(result).toBe(2);
  });

  it('대표 답글 하나뿐이면 숨은 답글이 없다', () => {
    // Given
    // 답글 1개 - 대표 1개 = 0
    const thread = createTodoCommentThread({ comment: createTodoComment({ replyCount: 1 }) });

    // When
    const result = TodoCommentPolicy.getCollapsedHiddenReplyCount(thread);

    // Then
    expect(result).toBe(0);
  });
});
