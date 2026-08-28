import { createTodoComment, createTodoCommentReply } from '../../__tests__/todo-comment.factories';
import {
  type ConversationPages,
  findTodoCommentInConversationPages,
  findTodoCommentInOverviewPages,
  type OverviewPages,
  patchTodoCommentConversationPages,
  patchTodoCommentOverviewPages,
} from './todo-comment-cache-pages';
import { withOptimisticTodoCommentLike } from './todo-comment-cache-transforms';
import { INITIAL_TODO_COMMENT_PAGE_PARAM } from './todo-comment-cursor-page';

function createConversationPages(comments = [createTodoComment()]): ConversationPages {
  return {
    pages: [
      {
        items: comments.map((comment) => ({
          comment,
          connection: {
            visualDepth: comment.depth,
            upperLaneDepths: comment.depth === 0 ? [] : [comment.depth - 1],
            lowerLaneDepths: [],
            incomingBranch:
              comment.depth === 0 ? null : { fromDepth: comment.depth - 1, toDepth: comment.depth },
          },
          isFocused: false,
        })),
        focus: null,
        pagination: {
          previousCursor: null,
          nextCursor: null,
          hasPrevious: false,
          hasNext: false,
          size: 20,
        },
      },
    ],
    pageParams: [INITIAL_TODO_COMMENT_PAGE_PARAM],
  };
}

function createOverviewPages(): OverviewPages {
  const root = createTodoComment();
  const previewReply = createTodoCommentReply(root);

  return {
    pages: [
      {
        items: [
          {
            comment: root,
            previewReply,
            replySummary: {
              totalCount: 1,
              hiddenCount: 0,
              hasMore: false,
              participantAuthors: previewReply.author === null ? [] : [previewReply.author],
            },
          },
        ],
        pagination: {
          previousCursor: null,
          nextCursor: null,
          hasPrevious: false,
          hasNext: false,
          size: 20,
        },
      },
    ],
    pageParams: [INITIAL_TODO_COMMENT_PAGE_PARAM],
  };
}

describe('todo comment cache pages', () => {
  test('같은 댓글을 conversation과 overview preview에서 함께 변환한다', () => {
    const overview = createOverviewPages();
    const previewReply = overview.pages[0]?.items[0]?.previewReply;
    if (previewReply === null || previewReply === undefined) {
      throw new Error('preview reply is required');
    }
    const conversationResult = patchTodoCommentConversationPages(
      createConversationPages([previewReply]),
      previewReply.id,
      (comment) => ({ ...comment, likeCount: 3 }),
    );
    const overviewResult = patchTodoCommentOverviewPages(overview, previewReply.id, (comment) => ({
      ...comment,
      likeCount: 3,
    }));

    expect(conversationResult?.pages[0]?.items[0]?.comment.likeCount).toBe(3);
    expect(overviewResult?.pages[0]?.items[0]?.previewReply?.likeCount).toBe(3);
  });

  test('focus 조상에서는 wrapper가 아니라 안쪽 comment만 바꾼다', () => {
    const root = createTodoComment();
    const focused = createTodoCommentReply(root);
    const pages = createConversationPages([focused]);
    const page = pages.pages[0];
    if (page === undefined) {
      throw new Error('conversation page is required');
    }
    const withFocus: ConversationPages = {
      ...pages,
      pages: [
        {
          ...page,
          focus: {
            commentId: focused.id,
            itemIndex: 0,
            precedingAncestors: [
              {
                comment: root,
                connection: {
                  visualDepth: 0,
                  upperLaneDepths: [],
                  lowerLaneDepths: [0],
                  incomingBranch: null,
                },
                isFocused: false,
              },
            ],
            omittedAncestorCount: 0,
          },
        },
      ],
    };

    const result = patchTodoCommentConversationPages(withFocus, root.id, (comment) => ({
      ...comment,
      content: '수정됨',
    }));

    expect(result?.pages[0]?.focus?.precedingAncestors[0]?.comment.content).toBe('수정됨');
    expect(result?.pages[0]?.items[0]).toBe(page.items[0]);
  });

  test('conversation에 없는 대표 답글도 overview snapshot에서 찾는다', () => {
    const overview = createOverviewPages();
    const previewReply = overview.pages[0]?.items[0]?.previewReply;
    if (previewReply === null || previewReply === undefined) {
      throw new Error('preview reply is required');
    }

    expect(findTodoCommentInOverviewPages(overview, previewReply.id)).toBe(previewReply);
  });

  test('stale 정도가 다른 query는 자기 값에서 갱신되고 원본 snapshot으로 각각 rollback할 수 있다', () => {
    const targetId = 'same-comment';
    const latestPages = createConversationPages([
      createTodoComment({ id: targetId, likeCount: 1, content: 'latest cache' }),
    ]);
    const stalePages = createConversationPages([
      createTodoComment({ id: targetId, likeCount: 8, content: 'stale cache' }),
    ]);
    const latestSnapshot = findTodoCommentInConversationPages(latestPages, targetId);
    const staleSnapshot = findTodoCommentInConversationPages(stalePages, targetId);
    if (latestSnapshot === undefined || staleSnapshot === undefined) {
      throw new Error('comment snapshots are required');
    }

    const optimisticLatest = patchTodoCommentConversationPages(latestPages, targetId, (comment) =>
      withOptimisticTodoCommentLike(comment, true),
    );
    const optimisticStale = patchTodoCommentConversationPages(stalePages, targetId, (comment) =>
      withOptimisticTodoCommentLike(comment, true),
    );
    const restoredLatest = patchTodoCommentConversationPages(
      optimisticLatest,
      targetId,
      () => latestSnapshot,
    );
    const restoredStale = patchTodoCommentConversationPages(
      optimisticStale,
      targetId,
      () => staleSnapshot,
    );

    expect(optimisticLatest?.pages[0]?.items[0]?.comment.likeCount).toBe(2);
    expect(optimisticStale?.pages[0]?.items[0]?.comment.likeCount).toBe(9);
    expect(restoredLatest?.pages[0]?.items[0]?.comment).toBe(latestSnapshot);
    expect(restoredStale?.pages[0]?.items[0]?.comment).toBe(staleSnapshot);
    expect(restoredLatest?.pages[0]?.items[0]?.comment.content).toBe('latest cache');
    expect(restoredStale?.pages[0]?.items[0]?.comment.content).toBe('stale cache');
  });

  test('대상이 없으면 page와 item identity를 유지한다', () => {
    const pages = createConversationPages();

    const result = patchTodoCommentConversationPages(pages, 'missing', (comment) => ({
      ...comment,
      content: 'never used',
    }));

    expect(result).toBe(pages);
  });
});
