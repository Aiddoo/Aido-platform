import { uniqBy } from 'es-toolkit';

import { createTodoComment, createTodoCommentReply } from '../../__tests__/todo-comment.factories';
import type { TodoComment } from '../../models/todo-comment.model';
import {
  type CommentPages,
  patchCommentPages,
  patchThread,
  withAddedReply,
  withPrependedComment,
  withReplacedComment,
} from './todo-comment-cache.util';
import { likeToggled } from './todo-comment-optimistic';

const pagesOf = (...comments: TodoComment[]): CommentPages => ({
  pages: [{ comments, nextCursor: null, hasNext: false }],
  pageParams: [undefined],
});

describe('patchCommentPages', () => {
  test('목록에 있는 댓글을 찾아 바꾼다', () => {
    // Given
    const comment = createTodoComment({ likeCount: 1 });
    const pages = pagesOf(comment);

    // When
    const result = patchCommentPages(pages, comment.id, (item) => likeToggled(item, true));

    // Then
    expect(result?.pages[0]?.comments[0]).toMatchObject({ likeCount: 2 });
  });

  test('미리보기로 그려진 답글도 같은 방식으로 찾는다', () => {
    // Given - 답글 하나가 미리보기로 딸려 온 댓글
    const parent = createTodoComment({ replyCount: 1, hasReplies: true });
    const reply = createTodoCommentReply(parent);
    const pages = pagesOf({ ...parent, replyPreview: [reply] });

    // When
    const result = patchCommentPages(pages, reply.id, (item) => likeToggled(item, true));

    // Then
    expect(result?.pages[0]?.comments[0]?.replyPreview[0]).toMatchObject({ likeCount: 1 });
  });

  test('없는 댓글이면 아무것도 바꾸지 않는다', () => {
    // Given
    const comment = createTodoComment({ likeCount: 1 });
    const pages = pagesOf(comment);

    // When
    const result = patchCommentPages(pages, 'unknown-id', (item) => likeToggled(item, true));

    // Then
    expect(result?.pages[0]?.comments[0]).toMatchObject({ likeCount: 1 });
  });

  test('캐시가 비어 있으면 만들지 않는다', () => {
    // Given & When
    const result = patchCommentPages(undefined, 'comment-1', (item) => item);

    // Then
    expect(result).toBeUndefined();
  });
});

describe('patchThread', () => {
  test('조상이든 지금 보는 댓글이든 같은 변경을 받는다', () => {
    // Given - 깊이 1의 댓글을 보고 있고 그 부모가 조상으로 얹혀 있다
    const ancestor = createTodoComment({ likeCount: 3 });
    const focused = createTodoCommentReply(ancestor);
    const thread = { ancestors: [ancestor], comment: focused };

    // When
    const patchedAncestor = patchThread(thread, ancestor.id, (item) => likeToggled(item, true));
    const patchedFocused = patchThread(thread, focused.id, (item) => likeToggled(item, true));

    // Then
    expect(patchedAncestor?.ancestors[0]).toMatchObject({ likeCount: 4 });
    expect(patchedFocused?.comment).toMatchObject({ likeCount: 1 });
  });
});

describe('withPrependedComment', () => {
  test('첫 페이지 맨 앞에 꽂는다', () => {
    // Given
    const existing = createTodoComment({ id: 'comment-1' });
    const fresh = createTodoComment({ id: 'comment-2' });

    // When
    const result = withPrependedComment(pagesOf(existing), fresh);

    // Then
    expect(result?.pages[0]?.comments.map((item) => item.id)).toEqual(['comment-2', 'comment-1']);
  });

  test('아직 받아둔 페이지가 없으면 건드리지 않는다', () => {
    // Given & When
    const result = withPrependedComment(undefined, createTodoComment());

    // Then
    expect(result).toBeUndefined();
  });
});

describe('withAddedReply', () => {
  test('목록에 있는 부모는 답글 수와 미리보기가 함께 오른다', () => {
    // Given
    const parent = createTodoComment();
    const reply = createTodoCommentReply(parent);

    // When
    const result = withAddedReply(pagesOf(parent), reply);

    // Then
    const patched = result?.pages[0]?.comments[0];
    expect(patched).toMatchObject({ replyCount: 1, hasReplies: true });
    expect(patched?.replyPreview.map((item) => item.id)).toEqual([reply.id]);
  });

  test('미리보기로만 떠 있는 부모는 답글 수만 오르고 다음 화면으로 넘긴다', () => {
    // Given - 깊이 1 답글이 미리보기로 떠 있고, 거기에 답글을 단다
    const grandParent = createTodoComment({ replyCount: 1, hasReplies: true });
    const parent = createTodoCommentReply(grandParent);
    const reply = createTodoCommentReply(parent);

    // When
    const result = withAddedReply(pagesOf({ ...grandParent, replyPreview: [parent] }), reply);

    // Then
    expect(result?.pages[0]?.comments[0]?.replyPreview[0]).toMatchObject({
      replyCount: 1,
      hasReplies: true,
      hasMoreReplies: true,
    });
  });
});

describe('withReplacedComment', () => {
  test('대기 중이던 행을 서버 댓글로 갈아 끼운다', () => {
    // Given
    const pending = createTodoComment({ id: 'pending-1', content: '방금 쓴 댓글' });
    const confirmed = createTodoComment({ id: 'comment-9', content: '방금 쓴 댓글' });

    // When
    const result = withReplacedComment(pagesOf(pending), pending.id, confirmed);

    // Then
    expect(result?.pages[0]?.comments.map((item) => item.id)).toEqual(['comment-9']);
  });
});

describe('페이지를 가로지르는 중복', () => {
  test('맨 위에 꽂아둔 댓글이 뒷 페이지에서 다시 실려 와도 한 번만 그린다', () => {
    // Given - 인기순에서 방금 쓴 댓글(좋아요 0)이 1페이지 맨 위와 2페이지 제자리에 함께 온 상태
    const fresh = createTodoComment({ id: 'comment-fresh' });
    const popular = createTodoComment({ id: 'comment-popular', likeCount: 9 });
    const pages: CommentPages = {
      pages: [
        { comments: [fresh, popular], nextCursor: 'cursor-1', hasNext: true },
        { comments: [fresh], nextCursor: null, hasNext: false },
      ],
      pageParams: [undefined, 'cursor-1'],
    };

    // When - 목록이 그리는 것과 같은 방식으로 펼친다
    const comments = uniqBy(
      pages.pages.flatMap((page) => page.comments),
      (comment) => comment.id,
    );

    // Then - 먼저 그린 쪽(맨 위)만 남아 자리가 흔들리지 않는다
    expect(comments.map((comment) => comment.id)).toEqual(['comment-fresh', 'comment-popular']);
  });
});
