import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../generation/application/messages/prompt-definition.messages.js";
import {
  sanitizeLineForPrompt,
  wrapUntrusted,
} from "../../../generation/application/messages/untrusted-input.messages.js";
import type {
  NormalizedActionPlan,
  QuickPlanDraft,
} from "../../domain/action-plan-draft.constants.js";
import {
  type ActionPlanNormalizeContext,
  normalizeActionPlan,
} from "../action-plan-draft.mapper.js";
import { type PlanningContextInput, buildPlanningContext } from "./planning-context.messages.js";
import { quickPlanDraftSchema } from "./quick-plan-draft.wire.js";
import { QUICK_PLAN_SYSTEM_EN } from "./quick-plan-system-en.messages.js";
import { QUICK_PLAN_SYSTEM_KO } from "./quick-plan-system-ko.messages.js";

export interface QuickPlanPromptInput extends PlanningContextInput {
  readonly text: string;
}

const SYSTEM: Readonly<Record<SupportedLocale, string>> = {
  ko: QUICK_PLAN_SYSTEM_KO,
  en: QUICK_PLAN_SYSTEM_EN,
};

/** 빠른 계획: 짧은 말·글 하나 → 할 일 최대 10개 + 메모 1개 계획 초안 */
export const quickPlanPrompt: PromptDefinition<
  QuickPlanPromptInput,
  QuickPlanDraft,
  NormalizedActionPlan,
  ActionPlanNormalizeContext
> = {
  id: "quick-plan",
  version: "quick-plan@10",
  taskClass: "interactive",
  // 카테고리 30개·다가오는 할 일 30개·1,000자 입력의 최대 user 턴이 약 9,800자다.
  maxInputChars: 12_000,
  schema: quickPlanDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: buildPlanningContext(input, locale),
      input: wrapUntrusted("user_input", {
        text: sanitizeLineForPrompt(input.text, ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH),
      }),
    }),
  }),
  normalize: normalizeActionPlan,
};
