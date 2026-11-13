import {
  type ApplyAction as ApplyActionDto,
  type ApplyActionPlanRequest,
  type ApplyActionPlanResponse,
  PLANNED_ACTION_TYPES,
  type PlannedAction as PlannedActionDto,
  plannedActionSchema,
  type QuickPlanRequest,
  type VoiceNoteDigestRequest,
} from '@aido/api';
import { toFeatureQuota } from '@src/features/billing/subscription/apis/entitlement.mapper';
import { toRepeat, toRepeatDto } from '@src/features/planning/todo/apis/todo-repeat.mapper';
import { dateKeySchema } from '@src/shared/date/date-key';
import { match } from 'ts-pattern';

import type { VoiceNoteDigestInput } from '../domains/voice-note.model';
import {
  type AppliedPlanResult,
  type PlannedAction,
  type QuickPlanResult,
  type VoiceNoteDigestResult,
  type VoicePlan,
  type VoicePlanSource,
  voicePlanSchema,
} from '../domains/voice-plan.model';
import type { CreateQuickPlanInput } from '../schemas/quick-plan-request.schema';
import type {
  LenientActionPlan,
  LenientQuickPlanResponse,
  LenientVoiceNoteDigestResponse,
} from '../schemas/voice-plan-response.schema';

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

function toPlannedAction(dto: PlannedActionDto): PlannedAction {
  return match(dto)
    .returnType<PlannedAction>()
    .with({ type: 'CREATE_TODO' }, (todo) => ({
      type: 'create-todo',
      actionId: todo.key,
      title: todo.title,
      startDate: dateKeySchema.parse(todo.startDate),
      endDate: todo.endDate == null ? null : dateKeySchema.parse(todo.endDate),
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
}

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

const QUICK_PLAN_SOURCE = {
  'quick-voice': 'VOICE',
  'quick-text': 'TEXT',
} as const satisfies Record<CreateQuickPlanInput['source'], QuickPlanRequest['source']>;

export function toQuickPlanRequest({ text, source }: CreateQuickPlanInput): QuickPlanRequest {
  return {
    text,
    source: QUICK_PLAN_SOURCE[source],
  };
}

export function toQuickPlanResult(
  dto: LenientQuickPlanResponse,
  { planId, source }: { planId: string; source: CreateQuickPlanInput['source'] },
): QuickPlanResult {
  return {
    plan: toVoicePlan(planId, source, dto.plan),
    featureQuota: dto.featureQuota == null ? null : toFeatureQuota(dto.featureQuota),
    isCharged: dto.charged,
  };
}

function toApplyAction(action: PlannedAction, fallbackCategoryId: number): ApplyActionDto {
  return match(action)
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
}

const APPLY_SOURCE = {
  'quick-voice': 'QUICK_VOICE',
  'quick-text': 'QUICK_TEXT',
  'voice-note': 'VOICE_NOTE',
  memo: 'MEMO',
} as const satisfies Record<VoicePlanSource, ApplyActionPlanRequest['source']>;

interface ApplyActionPlanInput {
  source: VoicePlanSource;
  actions: readonly PlannedAction[];
  fallbackCategoryId: number;
  sourceMemoId: number | null;
}

export function toApplyActionPlanRequest({
  source,
  actions,
  fallbackCategoryId,
  sourceMemoId,
}: ApplyActionPlanInput): ApplyActionPlanRequest {
  return {
    source: APPLY_SOURCE[source],
    ...(sourceMemoId != null && { sourceMemoId }),
    actions: actions.map((action) => toApplyAction(action, fallbackCategoryId)),
  };
}

export function toAppliedPlanResult({ todos, memo }: ApplyActionPlanResponse): AppliedPlanResult {
  return { todoCount: todos.length, hasMemo: memo != null };
}

export function toVoiceNoteDigestRequest({
  text,
  durationSeconds,
  segments,
}: VoiceNoteDigestInput): VoiceNoteDigestRequest {
  return {
    text,
    durationSeconds,
    segments: segments.map(({ startMs, text: segmentText, isBookmarked }) => ({
      startMs,
      text: segmentText,
      isBookmarked,
    })),
  };
}

export function toVoiceNoteDigestResult(
  dto: LenientVoiceNoteDigestResponse,
  planId: string,
): VoiceNoteDigestResult {
  return {
    plan: toVoicePlan(planId, 'voice-note', dto.plan),
    title: dto.title,
    summary: dto.summary,
    keyPoints: dto.keyPoints.map(({ text, startMs }) => ({ text, startMs })),
    featureQuota: dto.featureQuota == null ? null : toFeatureQuota(dto.featureQuota),
    isCharged: dto.charged,
  };
}
