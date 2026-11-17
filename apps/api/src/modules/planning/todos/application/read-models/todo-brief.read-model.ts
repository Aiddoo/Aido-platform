import type { TodoVisibility } from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoId } from "../../domain/todo-id.vo.js";

// 다른 Context가 할 일을 확인·표시할 때 쓰는 요약이다. endDate가 없으면 하루 할 일이다
export interface TodoBriefReadModel {
  readonly todoId: TodoId;
  readonly ownerId: UserId;
  readonly title: string;
  readonly completed: boolean;
  readonly visibility: TodoVisibility;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
}
