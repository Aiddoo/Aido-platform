import {
  type ApplyAction as ApplyActionDto,
  type ApplyActionPlanRequest,
  actionPlanSchema,
  type QuickPlanRequest,
  type VoiceNoteDigestRequest,
  PLANNED_ACTION_TYPES,
  plannedActionSchema,
  quickPlanResponseSchema,
  voiceNoteDigestResponseSchema,
} from '@aido/api';
import { toFeatureQuota } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { toRepeat, toRepeatDto } from '@src/features/planning/todo/apis/todo-series.mapper';
import { match } from 'ts-pattern';
import { z } from 'zod';

import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import {
  type CreateQuickPlanInput,
  type PlannedAction,
  type QuickPlanResult,
  type VoicePlan,
  type VoiceNoteDigestResult,
  type VoicePlanSource,
  voicePlanSchema,
} from '../domains/voice-plan.model';

/**
 * 새 서버가 더한 모르는 행동 타입 하나 때문에 계획 전체를 버리지 않도록 행동은 느슨하게 받고,
 * 아는 타입만 {@link toVoicePlan}이 계약대로 검증한다.
 */
const lenientActionPlanSchema = actionPlanSchema.extend({ actions: z.array(z.unknown()) });

export const lenientQuickPlanResponseSchema = quickPlanResponseSchema.extend({
  plan: lenientActionPlanSchema,
});

export const lenientVoiceNoteDigestResponseSchema = voiceNoteDigestResponseSchema.extend({
  plan: lenientActionPlanSchema,
});

interface LenientActionPlan {
  actions: readonly unknown[];
  omittedTodoCount: number;
}

const KNOWN_ACTION_TYPES: readonly string[] = PLANNED_ACTION_TYPES;

function isKnownAction(action: unknown) {
  return (
    typeof action === 'object' &&
    action != null &&
    'type' in action &&
    typeof action.type === 'string' &&
    KNOWN_ACTION_TYPES.includes(action.type)
  );
}

const toPlannedAction = (dto: z.infer<typeof plannedActionSchema>): PlannedAction =>
  match(dto)
    .returnType<PlannedAction>()
    .with({ type: 'CREATE_TODO' }, (todo) => ({
      type: 'create-todo',
      actionId: todo.key,
      title: todo.title,
      startDate: todo.startDate,
      endDate: todo.endDate,
      scheduledTime: todo.scheduledTime,
      repeat: todo.repeat == null ? null : toRepeat(todo.repeat),
      visibility: todo.visibility,
      items: todo.items.map(({ title }) => ({ title })),
      categoryId: todo.categoryId,
      duplicateOfTodoId: todo.duplicateOfTodoId,
    }))
    .with({ type: 'CREATE_MEMO' }, (memo) => ({
      type: 'create-memo',
      actionId: memo.key,
      title: memo.title,
      content: memo.content,
    }))
    .exhaustive();

export function toVoicePlan(
  planId: string,
  source: VoicePlanSource,
  { actions, omittedTodoCount }: LenientActionPlan,
): VoicePlan {
  const known = actions
    .filter(isKnownAction)
    .map((action) => toPlannedAction(plannedActionSchema.parse(action)));
  return voicePlanSchema.parse({
    planId,
    source,
    sourceMemoId: null,
    actions: known,
    omittedTodoCount,
  });
}

export const toQuickPlanRequest = ({ text, source }: CreateQuickPlanInput): QuickPlanRequest => ({
  text,
  source: source === 'voice' ? 'VOICE' : 'TEXT',
});

export function toQuickPlanResult(
  dto: z.infer<typeof lenientQuickPlanResponseSchema>,
  { planId, source }: { planId: string; source: 'quick-voice' | 'quick-text' },
): QuickPlanResult {
  return {
    plan: toVoicePlan(planId, source, dto.plan),
    featureQuota: dto.featureQuota == null ? null : toFeatureQuota(dto.featureQuota),
    charged: dto.charged,
  };
}

const toApplyAction = (action: PlannedAction, fallbackCategoryId: number): ApplyActionDto =>
  match(action)
    .returnType<ApplyActionDto>()
    .with({ type: 'create-todo' }, (todo) => ({
      type: 'CREATE_TODO',
      key: todo.actionId,
      title: todo.title,
      startDate: todo.startDate,
      endDate: todo.endDate,
      scheduledTime: todo.scheduledTime,
      repeat: todo.repeat == null ? null : toRepeatDto(todo.repeat),
      visibility: todo.visibility,
      items: todo.items,
      categoryId: todo.categoryId ?? fallbackCategoryId,
    }))
    .with({ type: 'create-memo' }, (memo) => ({
      type: 'CREATE_MEMO',
      key: memo.actionId,
      title: memo.title,
      content: memo.content,
    }))
    .exhaustive();

const APPLY_SOURCE = {
  'quick-voice': 'QUICK_VOICE',
  'quick-text': 'QUICK_TEXT',
  'voice-note': 'VOICE_NOTE',
  memo: 'MEMO',
} as const satisfies Record<VoicePlanSource, ApplyActionPlanRequest['source']>;

export function toApplyActionPlanRequest(
  source: VoicePlanSource,
  actions: readonly PlannedAction[],
  fallbackCategoryId: number,
  sourceMemoId: number | null = null,
): ApplyActionPlanRequest {
  return {
    source: APPLY_SOURCE[source],
    ...(sourceMemoId != null && { sourceMemoId }),
    actions: actions.map((action) => toApplyAction(action, fallbackCategoryId)),
  };
}

export const toVoiceNoteDigestRequest = ({
  text,
  durationSeconds,
  segments,
}: VoiceNoteDigestInput): VoiceNoteDigestRequest => ({
  text,
  durationSeconds,
  segments: segments.map(({ startMs, text: segmentText, isBookmarked }) => ({
    startMs,
    text: segmentText,
    isBookmarked,
  })),
});

export function toVoiceNoteDigestResult(
  dto: z.infer<typeof lenientVoiceNoteDigestResponseSchema>,
  planId: string,
): VoiceNoteDigestResult {
  return {
    plan: toVoicePlan(planId, 'voice-note', dto.plan),
    title: dto.title,
    summary: dto.summary,
    keyPoints: dto.keyPoints.map(({ text, startMs }) => ({ text, startMs })),
    featureQuota: dto.featureQuota == null ? null : toFeatureQuota(dto.featureQuota),
    charged: dto.charged,
  };
}
