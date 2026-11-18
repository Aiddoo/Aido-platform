import { ACTION_PLAN_LIMITS, type Localized } from "@aido/api/vocabulary";

import {
  composeUserTurn,
  type PromptDefinition,
} from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import {
  sanitizeLineForPrompt,
  wrapUntrusted,
} from "../../../ai-generations/application/messages/untrusted-input.messages.js";
import type { NormalizedActionPlan } from "../../domain/action-plan-drafts.constants.js";
import {
  type ActionPlanNormalizeContext,
  normalizeActionPlan,
} from "../action-plan-draft.mapper.js";
import { QUICK_PLAN_SYSTEM_EN } from "./locales/en/quick-plan-system.messages.js";
import { QUICK_PLAN_SYSTEM_KO } from "./locales/ko/quick-plan-system.messages.js";
import { type PlanningContextInput, buildPlanningContext } from "./planning-context.messages.js";

export interface QuickPlanPromptInput extends PlanningContextInput {
  readonly text: string;
}

const SYSTEM: Localized<string> = {
  ko: QUICK_PLAN_SYSTEM_KO,
  en: QUICK_PLAN_SYSTEM_EN,
};

/** 빠른 계획: 짧은 말·글 하나 → 할 일 최대 10개 + 메모 1개 계획 초안 */
export const quickPlanPrompt: PromptDefinition<
  "quick-plan",
  QuickPlanPromptInput,
  NormalizedActionPlan,
  ActionPlanNormalizeContext
> = {
  id: "quick-plan",
  version: "quick-plan@11",
  taskClass: "interactive",
  // 카테고리 30개·다가오는 할 일 30개·1,000자 입력의 최대 user 턴이 약 9,800자다.
  maxInputChars: 12_000,
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
