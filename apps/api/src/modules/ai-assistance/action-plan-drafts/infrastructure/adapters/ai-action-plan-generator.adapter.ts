import type { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantToDate } from "#api/shared/domain/time/instant";

import { describeGenerationFailure } from "../../../ai-generations/application/ai-generation-failure.mapper.js";
import { generationFailed } from "../../../ai-generations/application/ai-generations.errors.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
} from "../../../ai-generations/application/ai-generations.log-events.js";
import {
  type BuiltPrompt,
  generateWithPrompt,
  type PromptDefinition,
  type PromptGeneration,
} from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import type {
  AiGeneratorPort,
  AiTaskId,
} from "../../../ai-generations/application/ports/ai-generator.port.js";
import type { ScheduleClock } from "../../../shared/domain/schedule-time.domain-service.js";
import { resolvePlanSchedule } from "../../../shared/domain/todo-schedule.domain-service.js";
import { isEmptyVoiceNoteDigest } from "../../application/action-plan-draft.mapper.js";
import { buildWithinLimit } from "../../application/messages/planning-context.messages.js";
import { quickPlanPrompt } from "../../application/messages/quick-plan-prompt.messages.js";
import { voiceNoteDigestPrompt } from "../../application/messages/voice-note-digest-prompt.messages.js";
import {
  ActionPlanGeneratorPort,
  type QuickPlanGeneration,
  type QuickPlanGenerationInput,
  type VoiceNoteDigestGeneration,
  type VoiceNoteDigestGenerationInput,
} from "../../application/ports/action-plan-generator.port.js";
import {
  ActionPlanDraft,
  type ActionPlanDraftPrimitives,
} from "../../domain/action-plan-draft.aggregate.js";
import type { NormalizedActionPlan } from "../../domain/action-plan-drafts.constants.js";

interface PlanGenerationRequest<C> {
  readonly built: BuiltPrompt;
  readonly context: C;
  readonly userId: UserId;
  readonly signal?: AbortSignal;
}

interface ActionPlanGeneratorDependencies {
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly consentReader: Pick<AiDataSharingConsentReaderPort, "findAiDataSharingConsent">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "error">;
}

function toActionPlanDraft(
  plan: NormalizedActionPlan,
  clock: ScheduleClock,
): ActionPlanDraftPrimitives {
  return ActionPlanDraft.create({
    todos: plan.todos.map((todo) => {
      const { startDate, endDate, scheduledTime, repeat } = resolvePlanSchedule(
        todo.schedule,
        clock,
      );
      return {
        title: todo.title,
        categoryId: todo.categoryId,
        startDate,
        endDate,
        scheduledTime,
        repeat,
        visibility: todo.visibility,
        items: todo.items,
        duplicateOfTodoId: todo.duplicateOfTodoId,
      };
    }),
    memo: plan.memo,
    omittedTodoCount: plan.omittedTodoCount,
  }).toPrimitives();
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
      { built, context: normalizeContext(input), userId: input.userId, signal: input.signal },
      (plan) => plan.todos.length > 0,
    );
    return {
      plan: toActionPlanDraft(value, { now: at, timeZone: input.timezone }),
      meta: { ...meta, promptVersion: definition.version },
    };
  }

  async digestVoiceNote(input: VoiceNoteDigestGenerationInput): Promise<VoiceNoteDigestGeneration> {
    const at = instantToDate(this.#dependencies.clock.now());
    const definition = voiceNoteDigestPrompt;
    const built = buildWithinLimit(definition, { ...input, now: at }, input.locale);
    const { value, meta } = await this.#generate(
      definition,
      {
        built,
        context: { ...normalizeContext(input), sentenceCount: input.sentences.length },
        userId: input.userId,
        signal: input.signal,
      },
      (digest) => !isEmptyVoiceNoteDigest(digest),
    );
    return {
      title: value.title,
      summary: value.summary,
      keyPoints: value.keyPoints,
      plan: toActionPlanDraft(value.plan, { now: at, timeZone: input.timezone }),
      isEmpty: isEmptyVoiceNoteDigest(value),
      meta: { ...meta, promptVersion: definition.version },
    };
  }

  async #generate<TTask extends AiTaskId, I, R, C>(
    definition: PromptDefinition<TTask, I, R, C>,
    request: PlanGenerationRequest<C>,
    keepsCharge: (result: R) => boolean,
  ): Promise<PromptGeneration<R>> {
    const { generator, consentReader, clock, logger } = this.#dependencies;
    const { built, context, userId: owner, signal } = request;
    const userId = owner.value;
    const startedAt = clock.now().epochMilliseconds;
    const logBase = { task: definition.id, promptVersion: definition.version, userId };
    const consent = await consentReader.findAiDataSharingConsent(owner);
    const { agreedVersion } = consent.status();
    try {
      const generation = await generateWithPrompt(generator, definition, {
        built,
        context,
        agreedConsentVersion: agreedVersion,
        userId: owner,
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
