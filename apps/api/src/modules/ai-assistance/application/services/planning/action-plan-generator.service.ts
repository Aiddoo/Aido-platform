import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { now } from "#api/shared/domain/date/utils/core";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  resolveTodoSchedule,
  type ScheduleClock,
} from "../../../domain/services/parsing/resolve-todo-schedule.js";
import type { NormalizedActionPlan } from "../../../domain/types/planning/action-plan-draft.types.js";
import {
  generationCompletedLog,
  generationFailedLog,
} from "../../observability/generation/ai-generation-log.events.js";
import type { AiGeneratorPort } from "../../ports/generation/ai-generator.port.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../ports/parsing/ai-data-sharing-consent.reader.port.js";
import type {
  ActionPlanGeneratorPort,
  GeneratedActionPlan,
  QuickPlanGeneration,
  QuickPlanGenerationInput,
  VoiceNoteDigestGeneration,
  VoiceNoteDigestGenerationInput,
} from "../../ports/planning/action-plan-generator.port.js";
import {
  type BuiltPrompt,
  generateWithPrompt,
  type PromptDefinition,
  type PromptGeneration,
} from "../../prompts/kit/prompt-definition.js";
import { buildWithinLimit } from "../../prompts/planning/planning-context.js";
import { quickPlanPrompt } from "../../prompts/planning/quick-plan/index.js";
import { voiceNoteDigestPrompt } from "../../prompts/planning/voice-note-digest/index.js";
import { describeParsingFailure } from "../parsing/ai-parsing-error-code.js";
import { isEmptyVoiceNoteDigest } from "./action-plan.normalizer.js";

interface ActionPlanGeneratorDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentDecisionReaderPort, "findAiDataSharingConsent">;
  readonly logger: Pick<ApplicationLogger, "log" | "error">;
}

function toGeneratedPlan(plan: NormalizedActionPlan, clock: ScheduleClock): GeneratedActionPlan {
  return {
    todos: plan.todos.map((todo) => {
      const { startDate, endDate, scheduledTime, repeat } = resolveTodoSchedule(
        todo.schedule,
        clock,
      );
      return {
        title: todo.title,
        categoryId: todo.categoryId,
        startDate,
        // 반복은 기간을 쓰지 않는다. 생성 포트가 함께 받으면 거절한다.
        endDate: repeat == null ? endDate : null,
        scheduledTime,
        repeat,
        visibility: todo.visibility,
        items: todo.items,
        duplicateOfTodoId: todo.duplicateOfTodoId,
      };
    }),
    memo: plan.memo,
    omittedTodoCount: plan.omittedTodoCount,
  };
}

function normalizeContext(input: QuickPlanGenerationInput | VoiceNoteDigestGenerationInput) {
  return {
    ownedCategoryIds: new Set(input.categories.map((category) => category.id)),
    upcomingTodoIds: new Set(input.upcomingTodos.map((todo) => todo.id)),
  };
}

export class ActionPlanGenerator implements ActionPlanGeneratorPort {
  readonly #dependencies: ActionPlanGeneratorDependencies;

  constructor(dependencies: ActionPlanGeneratorDependencies) {
    this.#dependencies = dependencies;
  }

  async generateQuickPlan(input: QuickPlanGenerationInput): Promise<QuickPlanGeneration> {
    const at = now();
    const definition = quickPlanPrompt;
    const built = buildWithinLimit(definition, { ...input, now: at }, input.locale);
    const { value, meta } = await this.#generate(
      definition,
      built,
      normalizeContext(input),
      input,
      (plan) => plan.todos.length > 0,
    );
    return {
      plan: toGeneratedPlan(value, { now: at, timeZone: input.timezone }),
      meta: { ...meta, promptVersion: definition.version },
    };
  }

  async digestVoiceNote(input: VoiceNoteDigestGenerationInput): Promise<VoiceNoteDigestGeneration> {
    const at = now();
    const definition = voiceNoteDigestPrompt;
    const built = buildWithinLimit(definition, { ...input, now: at }, input.locale);
    const { value, meta } = await this.#generate(
      definition,
      built,
      { ...normalizeContext(input), sentenceCount: input.sentences.length },
      input,
      (digest) => !isEmptyVoiceNoteDigest(digest),
    );
    return {
      title: value.title,
      summary: value.summary,
      keyPoints: value.keyPoints,
      plan: toGeneratedPlan(value.plan, { now: at, timeZone: input.timezone }),
      isEmpty: isEmptyVoiceNoteDigest(value),
      meta: { ...meta, promptVersion: definition.version },
    };
  }

  async #generate<I, O, R, C>(
    definition: PromptDefinition<I, O, R, C>,
    built: BuiltPrompt,
    context: C,
    { userId, signal }: { readonly userId: string; readonly signal?: AbortSignal },
    keepsCharge: (result: R) => boolean,
  ): Promise<PromptGeneration<R>> {
    const { generator, consentReader, logger } = this.#dependencies;
    const startedAt = Date.now();
    const logBase = { task: definition.id, promptVersion: definition.version, userId };
    const { agreedVersion } = await consentReader.findAiDataSharingConsent(userId);
    try {
      const generation = await generateWithPrompt(generator, definition, built, context, {
        agreedConsentVersion: agreedVersion,
        userId,
        signal,
      });
      const quotaCharged = keepsCharge(generation.value);
      logger.log(
        generationCompletedLog(
          { ...logBase, outcome: quotaCharged ? "SUCCESS" : "NO_ACTION", quotaCharged },
          generation.meta,
        ),
      );
      return generation;
    } catch (error) {
      const failure = describeParsingFailure(error);
      logger.error(
        generationFailedLog({
          ...logBase,
          outcome: "FAILED",
          ...failure,
          latencyMs: Date.now() - startedAt,
          quotaCharged: false,
        }),
      );
      // 호출부가 예약을 환불하므로 차감 없음을 담는다. 환불에 실패하면 호출부가 뗀다.
      throw new ApplicationException(failure.errorCode, { charged: false });
    }
  }
}
