import { createHash } from "node:crypto";

import type { TodoId } from "#api/modules/planning/todos/planning-todo-queries.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoCommentId } from "../../shared/domain/todo-comment-id.vo.js";
import type { TodoComment } from "./todo-comment.aggregate.js";

interface TodoCommentChainItem {
  readonly clientRequestId: string;
  readonly content: string;
}

/** 한 번에 이어 쓴 글 묶음 요청. parentId는 첫 글이 답할 대상이고 없으면 할 일에 단 댓글이다 */
export interface TodoCommentChainRequest {
  readonly todoId: TodoId;
  readonly authorId: UserId;
  readonly parentId: TodoCommentId | null;
  readonly items: readonly TodoCommentChainItem[];
}

/** 처음 보는 요청이면 commentIds가 null, 같은 요청을 다시 보냈으면 원래 글 id다. 멱등 키를 다른 요청에 쓰면 ok가 false다 */
export type TodoCommentChainReplay =
  | { readonly ok: true; readonly commentIds: readonly TodoCommentId[] | null }
  | { readonly ok: false };

// 지문은 저장된 값과 바이트가 같아야 배포 전 요청의 재시도도 같은 요청으로 본다(키 순서 포함)
export function fingerprintTodoCommentChain(request: TodoCommentChainRequest): string {
  const command = JSON.stringify({
    version: 1,
    todoId: request.todoId.value,
    authorId: request.authorId.value,
    parentId: request.parentId?.value ?? null,
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
  return ordered.every((comment) => comment.requestFingerprint === fingerprint)
    ? { ok: true, commentIds: ordered.map((comment) => comment.id) }
    : { ok: false };
}
