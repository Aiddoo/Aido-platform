import type { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { describeGenerationFailure } from "../../../generation/application/ai-generation-failure.mapper.js";
import { generationFailed } from "../../../generation/application/ai-generation.errors.js";
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
import type { AiGeneratorPort } from "../../../generation/application/ports/ai-generator.port.js";
import {
  resolvePlanSchedule,
  type ScheduleClock,
} from "../../../shared/domain/todo-schedule.domain-service.js";
import { isEmptyVoiceNoteDigest } from "../../application/action-plan-draft.mapper.js";
import { buildWithinLimit } from "../../application/messages/planning-context.messages.js";
import { quickPlanPrompt } from "../../application/messages/quick-plan-prompt.messages.js";
import { voiceNoteDigestPrompt } from "../../application/messages/voice-note-digest-prompt.messages.js";
import {
  ActionPlanGeneratorPort,
  type GeneratedActionPlan,
  type QuickPlanGeneration,
  type QuickPlanGenerationInput,
  type VoiceNoteDigestGeneration,
  type VoiceNoteDigestGenerationInput,
} from "../../application/ports/action-plan-generator.port.js";
import type { NormalizedActionPlan } from "../../domain/action-plan-draft.constants.js";

interface ActionPlanGeneratorDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentReaderPort, "findAiDataSharingConsent">;
  readonly clock: ClockPort;
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

export class AiActionPlanGeneratorAdapter extends ActionPlanGeneratorPort {
  readonly #dependencies: ActionPlanGeneratorDependencies;

  constructor(dependencies: ActionPlanGeneratorDependencies) {
    super();
    this.#dependencies = dependencies;
  }

  async generateQuickPlan(input: QuickPlanGenerationInput): Promise<QuickPlanGeneration> {
    const at = instantToDate(this.#dependencies.clock.now());
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
    const at = instantToDate(this.#dependencies.clock.now());
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
    { userId: owner, signal }: { readonly userId: UserId; readonly signal?: AbortSignal },
    keepsCharge: (result: R) => boolean,
  ): Promise<PromptGeneration<R>> {
    const { generator, consentReader, clock, logger } = this.#dependencies;
    const userId = owner.value;
    const startedAt = clock.now().epochMilliseconds;
    const logBase = { task: definition.id, promptVersion: definition.version, userId };
    const consent = await consentReader.findAiDataSharingConsent(owner);
    const { agreedVersion } = consent.status();
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
      const failure = describeGenerationFailure(error);
      logger.error(
        buildGenerationFailedLog({
          ...logBase,
          outcome: "FAILED",
          ...failure,
          latencyMs: clock.now().epochMilliseconds - startedAt,
          quotaCharged: false,
        }),
      );
      throw generationFailed(failure.errorCode, error);
    }
  }
}
