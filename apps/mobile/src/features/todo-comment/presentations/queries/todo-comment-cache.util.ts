import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type {
  TodoComment,
  TodoCommentPage,
  TodoCommentPreview,
  TodoCommentThread,
} from '../../models/todo-comment.model';
import { TODO_COMMENT_QUERY_KEYS } from '../constants/todo-comment-query-keys.constant';
import { replyAdded, replyCounted } from './todo-comment-optimistic';

/**
 * 캐시 모양을 아는 유일한 자리. TanStack 내부 타입은 이 레이어 밖으로 내보내지 않고,
 * 화면은 도메인 타입(TodoComment)만 안다.
 */
export type CommentPages = InfiniteData<TodoCommentPage, string | undefined>;
export type CommentPatch = <C extends TodoCommentPreview>(comment: C) => C;

/* 조회 — 이미 받아둔 캐시만 읽어 새 요청이나 구독을 만들지 않는다. */

/**
 * 이미 그려진 어느 화면에서든 이 댓글을 찾는다 — 다음 화면의 첫 프레임과 대기 행의 재료가 된다.
 * 미리보기·조상으로 그려진 자리에는 자기 미리보기가 없으므로 빈 채로 올린다.
 */
export function findCommentInCache(
  queryClient: QueryClient,
  todoId: number,
  commentId: string,
): TodoComment | undefined {
  const cachedPages = queryClient.getQueriesData<CommentPages>({
    queryKey: TODO_COMMENT_QUERY_KEYS.lists(todoId),
  });

  for (const [, pages] of cachedPages) {
    for (const comment of pages?.pages.flatMap((page) => page.comments) ?? []) {
      if (comment.id === commentId) {
        return comment;
      }

      const preview = comment.replyPreview.find((reply) => reply.id === commentId);

      if (preview !== undefined) {
        return { ...preview, replyPreview: [] };
      }
    }
  }

  const cachedThreads = queryClient.getQueriesData<TodoCommentThread>({
    queryKey: TODO_COMMENT_QUERY_KEYS.threads(todoId),
  });

  for (const [, thread] of cachedThreads) {
    if (thread?.comment.id === commentId) {
      return thread.comment;
    }

    const ancestor = thread?.ancestors.find((item) => item.id === commentId);

    if (ancestor !== undefined) {
      return { ...ancestor, replyPreview: [] };
    }
  }

  return undefined;
}

/* 변환 — 입력을 바꾸지 않고 새 캐시 값을 돌려준다. */

/**
 * 목록에서 대상 하나만 바꾼다. 재귀가 아니다 —
 * 한 페이지에 담기는 건 댓글과 그 미리보기 한 겹뿐이다.
 */
export function patchCommentPages(
  pages: CommentPages | undefined,
  commentId: string,
  patch: CommentPatch,
): CommentPages | undefined {
  if (pages === undefined) {
    return undefined;
  }

  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      comments: page.comments.map((comment) =>
        comment.id === commentId
          ? patch(comment)
          : {
              ...comment,
              replyPreview: comment.replyPreview.map((reply) =>
                reply.id === commentId ? patch(reply) : reply,
              ),
            },
      ),
    })),
  };
}

/** 스레드 머리말이 들고 있는 스냅샷에도 같은 변경을 반영한다. */
export function patchThread(
  thread: TodoCommentThread | undefined,
  commentId: string,
  patch: CommentPatch,
): TodoCommentThread | undefined {
  if (thread === undefined) {
    return thread;
  }

  return {
    ancestors: thread.ancestors.map((ancestor) =>
      ancestor.id === commentId ? patch(ancestor) : ancestor,
    ),
    comment: thread.comment.id === commentId ? patch(thread.comment) : thread.comment,
  };
}

/**
 * 같은 댓글이 어느 목록에 떠 있든 한 번에 맞춘다.
 * 목록 모양이 하나로 모여 순회할 접두사가 둘로 줄었다.
 */
export function patchCommentEverywhere(
  queryClient: QueryClient,
  todoId: number,
  commentId: string,
  patch: CommentPatch,
): void {
  queryClient.setQueriesData<CommentPages>(
    { queryKey: TODO_COMMENT_QUERY_KEYS.lists(todoId) },
    (pages) => patchCommentPages(pages, commentId, patch),
  );
  queryClient.setQueriesData<TodoCommentThread>(
    { queryKey: TODO_COMMENT_QUERY_KEYS.threads(todoId) },
    (thread) => patchThread(thread, commentId, patch),
  );
}

/** 방금 쓴 글은 정렬과 상관없이 맨 위에 보여준다. */
export function withPrependedComment(
  pages: CommentPages | undefined,
  comment: TodoComment,
): CommentPages | undefined {
  const [firstPage, ...restPages] = pages?.pages ?? [];

  if (pages === undefined || firstPage === undefined) {
    return pages;
  }

  return {
    ...pages,
    pages: [{ ...firstPage, comments: [comment, ...firstPage.comments] }, ...restPages],
  };
}

/** 답글이 달린 부모를 어느 목록에서든 찾아 답글 수를 올린다. */
export function withAddedReply(
  pages: CommentPages | undefined,
  reply: TodoComment,
): CommentPages | undefined {
  if (pages === undefined) {
    return undefined;
  }

  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      comments: page.comments.map((comment) =>
        comment.id === reply.parentId
          ? replyAdded(comment, reply)
          : {
              ...comment,
              replyPreview: comment.replyPreview.map((preview) =>
                preview.id === reply.parentId ? replyCounted(preview) : preview,
              ),
            },
      ),
    })),
  };
}

/** 대기 중이던 댓글을 서버가 돌려준 댓글로 갈아 끼운다. */
export function withReplacedComment(
  pages: CommentPages | undefined,
  pendingId: string,
  comment: TodoComment,
): CommentPages | undefined {
  if (pages === undefined) {
    return undefined;
  }

  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      comments: page.comments.map((item) =>
        item.id === pendingId
          ? comment
          : {
              ...item,
              replyPreview: item.replyPreview.map((preview) =>
                preview.id === pendingId ? comment : preview,
              ),
            },
      ),
    })),
  };
}
