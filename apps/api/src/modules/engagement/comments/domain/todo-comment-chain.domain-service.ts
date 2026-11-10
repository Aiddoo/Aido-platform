import { createHash } from "node:crypto";

import type { TodoComment } from "./todo-comment.aggregate.js";

export interface TodoCommentChainItem {
  readonly clientRequestId: string;
  readonly content: string;
}

/** 한 번에 이어 쓴 글 묶음 요청. parentId는 첫 글이 답할 대상이고 없으면 할 일에 단 댓글이다 */
export interface TodoCommentChainRequest {
  readonly todoId: number;
  readonly authorId: string;
  readonly parentId: string | null;
  readonly items: readonly TodoCommentChainItem[];
}

/** 처음 보는 요청이면 commentIds가 null, 같은 요청을 다시 보냈으면 원래 글 id다. 멱등 키를 다른 요청에 쓰면 ok가 false다 */
export type TodoCommentChainReplay =
  | { readonly ok: true; readonly commentIds: readonly string[] | null }
  | { readonly ok: false };

// 지문은 저장된 값과 바이트가 같아야 배포 전 요청의 재시도도 같은 요청으로 본다(키 순서 포함)
export function fingerprintTodoCommentChain(request: TodoCommentChainRequest): string {
  const command = JSON.stringify({
    version: 1,
    todoId: request.todoId,
    authorId: request.authorId,
    parentId: request.parentId,
    items: request.items.map((item) => ({
      clientRequestId: item.clientRequestId,
      content: item.content,
    })),
  });
  return createHash("sha256").update(command).digest("hex");
}

function orderByRequest(
  stored: readonly TodoComment[],
  request: TodoCommentChainRequest,
): TodoComment[] | null {
  const storedByRequestId = new Map(stored.map((comment) => [comment.clientRequestId, comment]));
  const ordered = request.items.flatMap((item) => {
    const comment = storedByRequestId.get(item.clientRequestId);
    return comment == null ? [] : [comment];
  });
  const requestIds = new Set(request.items.map((item) => item.clientRequestId));
  const isExactSet =
    ordered.length === request.items.length &&
    stored.length === request.items.length &&
    requestIds.size === request.items.length;
  return isExactSet ? ordered : null;
}

// 지문 도입 전에 쓴 글은 구조와 내용이 같을 때만 같은 요청으로 본다
function isLegacyReplay(
  ordered: readonly TodoComment[],
  request: TodoCommentChainRequest,
): boolean {
  return ordered.every((comment, index) => {
    const stored = comment.toPrimitives();
    const expectedReplyToId = index === 0 ? request.parentId : ordered[index - 1]?.id.value;
    const item = request.items[index];
    return (
      item != null &&
      // nullish-strict: undefined는 목록 밖 항목, null은 할 일에 단 댓글이다
      expectedReplyToId !== undefined &&
      stored.todoId === request.todoId &&
      stored.authorId === request.authorId &&
      stored.replyToCommentId === expectedReplyToId &&
      stored.content === item.content
    );
  });
}

export function matchTodoCommentChainReplay(params: {
  readonly request: TodoCommentChainRequest;
  readonly stored: readonly TodoComment[];
}): TodoCommentChainReplay {
  const { request, stored } = params;
  if (stored.length === 0) {
    return { ok: true, commentIds: null };
  }
  const ordered = orderByRequest(stored, request);
  if (ordered == null) {
    return { ok: false };
  }
  const fingerprint = fingerprintTodoCommentChain(request);
  const commentIds = ordered.map((comment) => comment.id.value);
  if (ordered.every((comment) => comment.requestFingerprint === fingerprint)) {
    return { ok: true, commentIds };
  }
  const isLegacy = ordered.every((comment) => comment.requestFingerprint == null);
  return isLegacy && isLegacyReplay(ordered, request) ? { ok: true, commentIds } : { ok: false };
}
