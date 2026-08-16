import { TODO_COMMENT_LIMITS } from '@aido/validators';

import type {
  PendingTodoComment,
  TodoComment,
  TodoCommentAuthor,
  TodoCommentLikeResult,
  TodoCommentPreview,
  TodoCommentReplyTarget,
} from '../../models/todo-comment.model';

/**
 * 서버 응답이 오기 전에 화면을 먼저 맞춰두는 예측 계산.
 * 도메인 규칙이 아니라 "서버가 이렇게 답할 것"이라는 클라이언트 사정이라 이 레이어에 둔다.
 * 전부 입력을 바꾸지 않고 새 값을 돌려주는 순수 함수다.
 */

export function likeToggled<C extends TodoCommentPreview>(comment: C, isLiked: boolean): C {
  return {
    ...comment,
    likeCount: Math.max(0, comment.likeCount + (isLiked ? 1 : -1)),
    viewer: { ...comment.viewer, isLiked },
  };
}

/** likeCount의 주인은 서버다 — 응답이 오면 그 값으로 확정한다. */
export function likeSettled<C extends TodoCommentPreview>(
  comment: C,
  result: TodoCommentLikeResult,
): C {
  return {
    ...comment,
    likeCount: result.likeCount,
    viewer: { ...comment.viewer, isLiked: result.isLiked },
  };
}

export function contentEdited<C extends TodoCommentPreview>(comment: C, content: string): C {
  return { ...comment, content, isEdited: true };
}

/** 서버의 소프트 삭제와 같은 모양. 답글 수는 보존된다. */
export function tombstoned<C extends TodoCommentPreview>(comment: C): C {
  return {
    ...comment,
    content: null,
    author: null,
    likeCount: 0,
    isDeleted: true,
    viewer: { isLiked: false, canEdit: false, canDelete: false, canReply: false },
  };
}

/** 답글 수만 올린다 — 미리보기로 그려진 자리에는 답글을 실을 곳이 없다. */
export function replyCounted<C extends TodoCommentPreview>(parent: C): C {
  return { ...parent, replyCount: parent.replyCount + 1, hasReplies: true, hasMoreReplies: true };
}

/** 목록에 그려진 부모의 답글 수와 미리보기를 함께 올린다. */
export function replyAdded(parent: TodoComment, reply: TodoCommentPreview): TodoComment {
  const counted = replyCounted(parent);
  const replyPreview = [reply, ...parent.replyPreview].slice(
    0,
    TODO_COMMENT_LIMITS.REPLY_PREVIEW_SIZE,
  );

  return { ...counted, replyPreview, hasMoreReplies: counted.replyCount > replyPreview.length };
}

/* 서버 확인 전 화면에 먼저 띄울 행. */

interface PendingCommentInput {
  /** 서버 댓글로 교체할 때 찾아낼 임시 id. */
  id: string;
  todoId: number;
  content: string;
  createdAt: Date;
  author: TodoCommentAuthor;
  /** 어느 댓글 아래에 붙는지. 없으면 할 일에 바로 달리는 최상위 댓글이다. */
  parent: TodoCommentPreview | null;
  replyTo: TodoCommentReplyTarget | null;
}

export function pendingComment(input: PendingCommentInput): PendingTodoComment<TodoComment> {
  return {
    id: input.id,
    todoId: input.todoId,
    parentId: input.parent?.id ?? null,
    rootId: input.parent === null ? null : (input.parent.rootId ?? input.parent.id),
    depth: input.parent === null ? 0 : input.parent.depth + 1,
    author: input.author,
    content: input.content,
    isDeleted: false,
    isEdited: false,
    likeCount: 0,
    replyCount: 0,
    hasReplies: false,
    hasMoreReplies: false,
    replyTo: input.replyTo,
    // 서버 확인 전에는 아무 권한도 열리지 않는다 (Policy의 isConfirmed와 짝을 이룬다).
    viewer: { isLiked: false, canEdit: false, canDelete: false, canReply: false },
    createdAt: input.createdAt,
    editedAt: null,
    replyPreview: [],
    isPending: true as const,
  };
}

/**
 * 이어 쓴 글들을 앞 글의 답글로 겹쳐 쌓아 하나로 만든다.
 * 목록에는 첫 글만 서고 나머지는 그 아래 맛보기로 붙는다 — 서버가 다시 내려줄 모양과 같다.
 */
export function nestChain<C extends TodoComment>(chain: C[]): C {
  return chain.reduceRight((child, current) => ({
    ...current,
    replyCount: 1,
    hasReplies: true,
    hasMoreReplies: false,
    replyPreview: [child],
  }));
}

interface PendingChainInput {
  todoId: number;
  createdAt: Date;
  author: TodoCommentAuthor;
  parent: TodoCommentPreview | null;
  items: { id: string; content: string }[];
}

/** 사슬 전체의 대기 행. 첫 글만 부모의 직계 자식이고 나머지는 앞 글의 답글이다. */
export function pendingCommentChain(input: PendingChainInput): PendingTodoComment<TodoComment> {
  let parent = input.parent;
  const written = input.items.map((item) => {
    const pending = pendingComment({
      id: item.id,
      todoId: input.todoId,
      content: item.content,
      createdAt: input.createdAt,
      author: input.author,
      parent,
      replyTo:
        parent === null ? null : { commentId: parent.id, authorName: parent.author?.name ?? null },
    });
    parent = pending;

    return pending;
  });

  return nestChain(written);
}
