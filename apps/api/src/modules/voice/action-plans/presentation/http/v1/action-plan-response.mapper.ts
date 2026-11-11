import type {
  ActionPlan,
  ApplyActionPlanResponse,
  PlannedAction,
  QuickPlanResponse,
} from "@aido/api";

import { toTodoResponse } from "#api/modules/planning/todos/planning-todos.public";

import type { ActionPlanReadModel } from "../../../application/read-models/action-plan.read-model.js";
import type { AppliedActionPlan } from "../../../application/use-cases/apply-action-plan.use-case.js";
import type { CreatedQuickPlan } from "../../../application/use-cases/create-quick-plan.use-case.js";

export function toActionPlanResponse(plan: ActionPlanReadModel): ActionPlan {
  return {
    actions: plan.actions.map((action): PlannedAction =>
      action.type === "CREATE_TODO"
        ? { ...action, items: action.items.map(({ title }) => ({ title })) }
        : { ...action },
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
