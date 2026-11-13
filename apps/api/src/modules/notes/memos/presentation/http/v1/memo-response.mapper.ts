import type {
  ConvertMemoToTodoResponse,
  ConvertMemoToTodosResponse,
  Memo as MemoResponse,
  MemoDetailResponse,
  MemoListResponse,
  MemoMutationResponse,
  MemoResourceLimitResponse,
} from "@aido/api/contracts/memo";
import { pick } from "es-toolkit";

import {
  type TodoReadModel,
  toTodoResponse,
} from "#api/modules/planning/todos/planning-todos.public";
import type { CursorPage } from "#api/shared/application/cursor-page";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { MemoResourceLimit } from "../../../application/use-cases/get-memo-resource-limit.use-case.js";
import type { Memo } from "../../../domain/memo.aggregate.js";

// 출시 앱은 변경 응답의 message를 표시하지 않지만 계약 필드라 문구를 그대로 둔다
export const MEMO_RESPONSE_MESSAGES = {
  CREATED: "메모가 생성되었습니다.",
  UPDATED: "메모가 수정되었습니다.",
  PINNED: "메모가 고정되었습니다.",
  UNPINNED: "메모 고정이 해제되었습니다.",
  REORDERED: "메모 순서가 변경되었습니다.",
  DELETED: "메모가 삭제되었습니다.",
  CONVERTED_TO_TODO: "메모가 할 일로 변환되었습니다.",
} as const;

function toMemoResponse(memo: Memo): MemoResponse {
  const primitives = memo.toPrimitives();
  return {
    ...pick(primitives, ["id", "userId", "content", "isPinned", "sortOrder"]),
    createdAt: toIsoString(primitives.createdAt),
    updatedAt: toIsoString(primitives.updatedAt),
  };
}

export function toMemoDetailResponse(memo: Memo): MemoDetailResponse {
  return { memo: toMemoResponse(memo) };
}

export function toMemoMutationResponse(memo: Memo, message: string): MemoMutationResponse {
  return { message, memo: toMemoResponse(memo) };
}

export function toMemoListResponse(page: CursorPage<Memo, number>): MemoListResponse {
  return { items: page.items.map(toMemoResponse), pagination: page.pagination };
}

export function toMemoResourceLimitResponse(limit: MemoResourceLimit): MemoResourceLimitResponse {
  return { currentCount: limit.currentCount, maxPerUser: limit.maxPerUser };
}

export function toConvertMemoToTodoResponse(todo: TodoReadModel): ConvertMemoToTodoResponse {
  return { message: MEMO_RESPONSE_MESSAGES.CONVERTED_TO_TODO, todo: toTodoResponse(todo) };
}

export function toConvertMemoToTodosResponse(
  todos: readonly TodoReadModel[],
): ConvertMemoToTodosResponse {
  return {
    message: `메모가 ${todos.length}개의 할 일로 변환되었습니다.`,
    todos: todos.map(toTodoResponse),
  };
}
