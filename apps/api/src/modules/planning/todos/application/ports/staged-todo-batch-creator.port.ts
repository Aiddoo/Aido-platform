import type { TodoVisibility } from "@aido/api/vocabulary";

import type { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import type { AfterCommitTask } from "#api/shared/application/ports/after-commit-task.registry.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoBatchRejectionReason } from "../../domain/todo-batch-admission.domain-service.js";
import type { TodoId } from "../../domain/todo-id.vo.js";

export interface TodoBatchDraft {
  readonly key: string;
  readonly categoryId: TodoCategoryId;
  readonly title: string;
  readonly startDate: Temporal.PlainDate;
  readonly endDate: Temporal.PlainDate | null;
  readonly scheduledLocalTime: string | null;
  readonly visibility: TodoVisibility;
}

export type TodoBatchOutcome =
  | { readonly kind: "created"; readonly key: string; readonly todoId: TodoId }
  | { readonly kind: "rejected"; readonly key: string; readonly reason: TodoBatchRejectionReason };

export interface StagedTodoBatch {
  // 초안과 같은 순서다
  readonly outcomes: readonly TodoBatchOutcome[];
  readonly afterCommit: AfterCommitTask;
  // 한 UoW에서 여러 묶음을 만들어도 커밋 뒤 캐시 정리는 한 번이다
  readonly afterCommitKey: string;
}

export interface StageTodoBatchInput {
  readonly userId: UserId;
  // 가져오기를 시작할 때 정한 IANA 시간대. 묶음 중간에 사용자 시간대가 바뀌어도 같은 값으로 순간을 만든다
  readonly timezone: string;
  readonly drafts: readonly TodoBatchDraft[];
}

// 생성 잠금(TodoCategoryLockKeys.userCategories·TodoLockKeys.sortOrder)을 쥔 UoW 안에서 부른다.
// 초안 하나가 잘못되거나 자리가 없어도 던지지 않고 결과로 알린다
export abstract class StagedTodoBatchCreatorPort {
  abstract stageMany(input: StageTodoBatchInput): Promise<StagedTodoBatch>;
}
