import type { Memo as MemoResponse } from "@aido/api/contracts/memo";
import type {
  ActionPlan,
  ApplyActionPlanResponse,
  PlannedAction,
  QuickPlanResponse,
} from "@aido/api/contracts/voice";
import { pick } from "es-toolkit";
import { match } from "ts-pattern";

import type { PlanMemoReadModel } from "#api/modules/notes/memos/notes-memos.public";
import { toTodoResponse } from "#api/modules/planning/todos/planning-todos.public";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { ActionPlanReadModel } from "../../../application/read-models/action-plan.read-model.js";
import type { AppliedActionPlan } from "../../../application/use-cases/apply-action-plan.use-case.js";
import type { CreatedQuickPlan } from "../../../application/use-cases/create-quick-plan.use-case.js";

export function toActionPlanResponse(plan: ActionPlanReadModel): ActionPlan {
  return {
    actions: plan.actions.map((action) =>
      match(action)
        .returnType<PlannedAction>()
        .with({ type: "CREATE_TODO" }, (todo) => ({
          ...todo,
          items: todo.items.map(({ title }) => ({ title })),
        }))
        .with({ type: "CREATE_MEMO" }, (memo) => ({ ...memo }))
        .exhaustive(),
    ),
    omittedTodoCount: plan.omittedTodoCount,
  };
}

export function toQuickPlanResponse(created: CreatedQuickPlan): QuickPlanResponse {
  return {
    plan: toActionPlanResponse(created.plan),
    featureQuota: created.featureQuota,
    charged: created.charged,
  };
}

function toPlanMemoResponse(memo: PlanMemoReadModel): MemoResponse {
  return {
    ...pick(memo, ["id", "userId", "content", "isPinned", "sortOrder"]),
    createdAt: toIsoString(memo.createdAt),
    updatedAt: toIsoString(memo.updatedAt),
  };
}

export function toApplyActionPlanResponse(applied: AppliedActionPlan): ApplyActionPlanResponse {
  return {
    todos: applied.todos.map(toTodoResponse),
    memo: applied.memo == null ? null : toPlanMemoResponse(applied.memo),
  };
}
