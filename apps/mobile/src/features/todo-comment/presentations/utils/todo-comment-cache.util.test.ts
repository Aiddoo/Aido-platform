import { TODO_COMMENT_SORT } from '@aido/validators';
import { QueryClient } from '@tanstack/react-query';

import { createTodoComment, createTodoCommentReply } from '../../__tests__/todo-comment.factories';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';
import {
  type ConversationPages,
  findCommentInCache,
  type OverviewPages,
  patchCommentEverywhere,
  patchConversationPages,
} from './todo-comment-cache.util';
import { INITIAL_TODO_COMMENT_PAGE_PARAM } from './todo-comment-cursor-page';

const queryClients: QueryClient[] = [];

afterEach(() => {
  queryClients.forEach((queryClient) => queryClient.clear());
  queryClients.length = 0;
});

function createQueryClient(): QueryClient {
  const queryClient = new QueryClient();
  queryClients.push(queryClient);
  return queryClient;
}

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

describe('todo comment cache utilities', () => {
  test('같은 댓글을 모든 conversation과 overview preview에서 함께 patch한다', () => {
    // Given
    const queryClient = createQueryClient();
    const overview = createOverviewPages();
    const previewReply = overview.pages[0]?.items[0]?.previewReply;
    if (previewReply === null || previewReply === undefined) {
      throw new Error('preview reply is required');
    }
    queryClient.setQueryData(
      TODO_COMMENT_QUERY_KEYS.conversation({ todoId: 1, sort: TODO_COMMENT_SORT.LATEST }),
      createConversationPages([previewReply]),
    );
    queryClient.setQueryData(
      TODO_COMMENT_QUERY_KEYS.conversation({
        todoId: 1,
        sort: TODO_COMMENT_SORT.LATEST,
        focusCommentId: previewReply.id,
      }),
      createConversationPages([previewReply]),
    );
    queryClient.setQueryData(
      TODO_COMMENT_QUERY_KEYS.overview({ todoId: 1, sort: TODO_COMMENT_SORT.LATEST }),
      overview,
    );

    // When
    patchCommentEverywhere(queryClient, 1, previewReply.id, (cached) => ({
      ...cached,
      likeCount: 3,
    }));

    // Then
    const conversations = queryClient.getQueriesData<ConversationPages>({
      queryKey: TODO_COMMENT_QUERY_KEYS.conversations(1),
    });
    expect(conversations).toHaveLength(2);
    expect(
      conversations.every(([, data]) => data?.pages[0]?.items[0]?.comment.likeCount === 3),
    ).toBe(true);

    const patchedOverview = queryClient.getQueryData<OverviewPages>(
      TODO_COMMENT_QUERY_KEYS.overview({ todoId: 1, sort: TODO_COMMENT_SORT.LATEST }),
    );
    expect(patchedOverview?.pages[0]?.items[0]?.previewReply?.likeCount).toBe(3);
  });

  test('focus 조상 snapshot도 같은 wrapper 안의 comment만 patch한다', () => {
    // Given
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

    // When
    const result = patchConversationPages(withFocus, root.id, (comment) => ({
      ...comment,
      content: '수정됨',
    }));

    // Then
    expect(result?.pages[0]?.focus?.precedingAncestors[0]?.comment.content).toBe('수정됨');
    expect(result?.pages[0]?.items[0]).toBe(page.items[0]);
  });

  test('conversation에 없는 대표 답글도 overview cache에서 찾는다', () => {
    // Given
    const queryClient = createQueryClient();
    const overview = createOverviewPages();
    const previewReply = overview.pages[0]?.items[0]?.previewReply;
    queryClient.setQueryData(
      TODO_COMMENT_QUERY_KEYS.overview({ todoId: 1, sort: TODO_COMMENT_SORT.LATEST }),
      overview,
    );

    // When
    const result =
      previewReply === null || previewReply === undefined
        ? undefined
        : findCommentInCache(queryClient, 1, previewReply.id);

    // Then
    expect(result).toBe(previewReply);
  });
});
