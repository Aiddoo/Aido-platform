import { ACTION_PLAN_LIMITS } from '@aido/api/vocabulary';
import type { FeatureQuota } from '@src/features/billing/subscription/domains/feature-quota.model';
import { z } from 'zod';

import {
  PlannedActionPolicy,
  plannedActionSchema,
  type PlannedAction,
} from './planned-action.model';

export const voicePlanIdSchema = z.string().min(1).brand<'VoicePlanId'>();

// 기기에 저장된 음성 노트 초안이 이 표기를 쓰므로 서버 값(ACTION_PLAN_SOURCES)으로 바꾸지 않고 mapper가 한 번 옮긴다
export const voicePlanSourceSchema = z.enum(['quick-voice', 'quick-text', 'voice-note', 'memo']);
export type VoicePlanSource = z.infer<typeof voicePlanSourceSchema>;

export const voicePlanSchema = z.object({
  planId: voicePlanIdSchema,
  source: voicePlanSourceSchema,
  // 저장에 성공하면 서버가 이 원본 메모를 지운다
  sourceMemoId: z.int().positive().nullable(),
  actions: z
    .array(plannedActionSchema)
    .max(ACTION_PLAN_LIMITS.MAX_TODOS + ACTION_PLAN_LIMITS.MAX_MEMOS),
  omittedTodoCount: z.int().nonnegative(),
});
export type VoicePlan = z.infer<typeof voicePlanSchema>;

export interface QuickPlanResult {
  plan: VoicePlan;
  // 서버가 한도를 싣지 못하면 null이다. 결과는 보여 주고 한도는 다시 묻는다
  featureQuota: FeatureQuota | null;
  isCharged: boolean;
}

export interface AppliedPlanResult {
  todoCount: number;
  hasMemo: boolean;
}

/** 행동별로 추가할지 고른 값. 키는 `actionId` */
export type PlanSelection = Record<string, boolean>;

export const VoicePlanPolicy = {
  getDefaultSelection(plan: VoicePlan): PlanSelection {
    return Object.fromEntries(
      plan.actions.map((action) => [
        action.actionId,
        !PlannedActionPolicy.isDuplicateAction(action),
      ]),
    );
  },

  getSelectedActions(plan: VoicePlan, selection: PlanSelection): PlannedAction[] {
    return plan.actions.filter((action) => selection[action.actionId] === true);
  },

  getSelectedTodoCount(plan: VoicePlan, selection: PlanSelection): number {
    return this.getSelectedActions(plan, selection).filter((action) =>
      PlannedActionPolicy.isTodoAction(action),
    ).length;
  },

  canApplyPlan(plan: VoicePlan, selection: PlanSelection): boolean {
    return this.getSelectedActions(plan, selection).length > 0;
  },
};
