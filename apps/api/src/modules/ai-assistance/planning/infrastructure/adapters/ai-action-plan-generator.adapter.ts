import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { now } from "#api/shared/domain/date/utils/core";

import { describeParsingFailure } from "../../../generation/application/ai-generation-failure.mapper.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
} from "../../../generation/application/ai-generation.log-events.js";
import {
  type BuiltPrompt,
  generateWithPrompt,
  type PromptDefinition,
  type PromptGeneration,
} from "../../../generation/application/messages/prompt-definition.messages.js";
import type { AiDataSharingConsentDecisionReaderPort } from "../../../generation/application/ports/ai-data-sharing-consent.reader.port.js";
import type { AiGeneratorPort } from "../../../generation/application/ports/ai-generator.port.js";
import {
  resolvePlanSchedule,
  type ScheduleClock,
} from "../../../shared/domain/todo-schedule.domain-service.js";
import { isEmptyVoiceNoteDigest } from "../../application/action-plan-draft.mapper.js";
import { buildWithinLimit } from "../../application/messages/planning-context.messages.js";
import { quickPlanPrompt } from "../../application/messages/quick-plan-prompt.messages.js";
import { voiceNoteDigestPrompt } from "../../application/messages/voice-note-digest-prompt.messages.js";
import type {
  ActionPlanGeneratorPort,
  GeneratedActionPlan,
  QuickPlanGeneration,
  QuickPlanGenerationInput,
  VoiceNoteDigestGeneration,
  VoiceNoteDigestGenerationInput,
} from "../../application/ports/action-plan-generator.port.js";
import type { NormalizedActionPlan } from "../../domain/action-plan-draft.constants.js";

interface ActionPlanGeneratorDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentDecisionReaderPort, "findAiDataSharingConsent">;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

function toGeneratedPlan(plan: NormalizedActionPlan, clock: ScheduleClock): GeneratedActionPlan {
  return {
    todos: plan.todos.map((todo) => {
      const { startDate, endDate, scheduledTime, repeat } = resolvePlanSchedule(
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
        buildGenerationCompletedLog(
          { ...logBase, outcome: quotaCharged ? "SUCCESS" : "NO_ACTION", quotaCharged },
          generation.meta,
        ),
      );
      return generation;
    } catch (error) {
      const failure = describeParsingFailure(error);
      logger.error(
        buildGenerationFailedLog({
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
