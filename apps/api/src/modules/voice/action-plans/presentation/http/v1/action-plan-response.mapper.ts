import type {
  ActionPlan,
  ApplyActionPlanResponse,
  PlannedAction,
  QuickPlanResponse,
} from "@aido/api/contracts/voice";
import { match } from "ts-pattern";

import { toTodoResponse } from "#api/modules/planning/todos/planning-todos.public";

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

export function toApplyActionPlanResponse(applied: AppliedActionPlan): ApplyActionPlanResponse {
  return { todos: applied.todos.map(toTodoResponse), memo: applied.memo };
}
