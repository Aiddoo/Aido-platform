import { ACTION_PLAN_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";

import type {
  NormalizedActionPlan,
  QuickPlanDraft,
} from "../../../../domain/types/planning/action-plan-draft.types.js";
import {
  type ActionPlanNormalizeContext,
  normalizeActionPlan,
} from "../../../services/planning/action-plan.normalizer.js";
import { composeUserTurn, type PromptDefinition } from "../../kit/prompt-definition.js";
import { sanitizeLineForPrompt, wrapUntrusted } from "../../kit/untrusted-input.js";
import { type PlanningContextInput, planningContext } from "../planning-context.js";
import { QUICK_PLAN_SYSTEM_EN } from "./prompt.en.js";
import { QUICK_PLAN_SYSTEM_KO } from "./prompt.ko.js";
import { quickPlanDraftSchema } from "./schema.js";

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
  version: "quick-plan@5",
  taskClass: "interactive",
  // 카테고리 30개·다가오는 할 일 30개·1,000자 입력의 최대 user 턴이 약 9,800자다.
  maxInputChars: 12_000,
  schema: quickPlanDraftSchema,
  build: (input, locale) => ({
    system: SYSTEM[locale],
    prompt: composeUserTurn({
      context: planningContext(input, locale),
      input: wrapUntrusted("user_input", {
        text: sanitizeLineForPrompt(input.text, ACTION_PLAN_LIMITS.QUICK_PLAN_TEXT_MAX_LENGTH),
      }),
    }),
  }),
  normalize: normalizeActionPlan,
};
