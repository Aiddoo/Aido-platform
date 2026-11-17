import type { ParsedDraftReadModel } from "../../../application/read-models/parsed-draft.read-model.js";
import type { ParsedMemoTodo } from "../../../domain/parsed-drafts.constants.js";
import type { ParseMemoResponseDto, ParseTodoResponseDto } from "./ai.dto.js";

export function toParseTodoResponse(readModel: ParsedDraftReadModel): ParseTodoResponseDto {
  const { draft, meta, featureQuota } = readModel;
  return {
    success: true,
    data: draft.todos[0],
    meta,
    ...(featureQuota != null && { featureQuota }),
  };
}

/** 메모는 할 일 상한을 넘어 만들지 않은 할 일 수를 meta.omittedTodoCount로 알린다 */
export function toParseMemoResponse(
  readModel: ParsedDraftReadModel<ParsedMemoTodo>,
): ParseMemoResponseDto {
  const { draft, meta, featureQuota } = readModel;
  return {
    success: true,
    data: { todos: [...draft.todos] },
    meta: { ...meta, omittedTodoCount: draft.omittedTodoCount },
    ...(featureQuota != null && { featureQuota }),
  };
}
