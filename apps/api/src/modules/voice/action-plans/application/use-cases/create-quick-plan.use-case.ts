import type { QuickPlanSource } from "@aido/api/vocabulary";

import type { MeteredFeatureQuota } from "#api/modules/access/quotas/access-quotas.public";
import {
  fingerprintRequest,
  resolveRequestLocale,
  type UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/generation/ai-assistance-generation.public";
import type { ActionPlanGeneratorPort } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { ActionPlanLogEvent } from "../action-plans.log-events.js";
import type { ChargedPlanRunnerPort } from "../ports/charged-plan-runner.port.js";
import type { PlanResultReplay, QuickPlanResult } from "../ports/plan-result-replay.port.js";
import type { PlanningContextReaderPort } from "../ports/planning-context.reader.port.js";
import {
  type ActionPlanReadModel,
  countPlannedActions,
  toActionPlanReadModel,
} from "../read-models/action-plan.read-model.js";

export interface CreateQuickPlanCommand {
  readonly userId: string;
  readonly text: string;
  readonly source: QuickPlanSource;
  readonly idempotencyKey: string;
  /** X-Timezone 헤더. 없으면 저장된 사용자 시간대를 쓴다. */
  readonly timezone: string | undefined;
  /** Accept-Language 헤더. 없으면 저장된 사용자 언어를 쓴다. */
  readonly locale: SupportedLocale | undefined;
  /** 앱이 연결을 끊으면 AI 호출을 멈추고 환불한다. */
  readonly signal?: AbortSignal;
}

export interface CreatedQuickPlan {
  readonly plan: ActionPlanReadModel;
  /** 이 요청을 반영한 AI_PARSE 한도. 결과는 주되 한도를 읽지 못했으면 null이다 */
  readonly featureQuota: MeteredFeatureQuota | null;
  readonly charged: boolean;
}

interface CreateQuickPlanDependencies {
  readonly runner: Pick<ChargedPlanRunnerPort, "run">;
  readonly generator: Pick<ActionPlanGeneratorPort, "generateQuickPlan">;
  readonly contextReader: Pick<PlanningContextReaderPort, "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly replay: PlanResultReplay<QuickPlanResult>;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 짧은 말·글 → 실행 계획. 할 일을 찾지 못하면 환불한다. 저장은 사용자가 확인한 뒤 적용 API가 한다. */
export class CreateQuickPlanUseCase {
  readonly #dependencies: CreateQuickPlanDependencies;

  constructor(dependencies: CreateQuickPlanDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateQuickPlanCommand): Promise<CreatedQuickPlan> {
    const { runner, generator, contextReader, localePreferenceReader, replay, logger } =
      this.#dependencies;
    const { userId, text, source, idempotencyKey } = input;
    const startedAt = this.#dependencies.clock.now().epochMilliseconds;
    const { timezone, locale } = await resolveRequestLocale(localePreferenceReader, userId, input);

    try {
      const { result, charged, featureQuota } = await runner.run<QuickPlanResult>({
        userId,
        feature: "AI_PARSE",
        reason: "quick-plan",
        idempotencyKey,
        requestHash: fingerprintRequest(userId, { text, source }),
        replay,
        generate: async () => {
          const context = await contextReader.read(userId, timezone);
          const generation = await generator.generateQuickPlan({
            userId,
            text,
            timezone,
            locale,
            categories: context.categories,
            upcomingTodos: context.upcomingTodos,
            signal: input.signal,
          });
          return {
            result: {
              plan: toActionPlanReadModel(generation.plan, context.upcomingTodos),
              model: generation.meta.model,
            },
            outcome: generation.plan.todos.length > 0 ? "CHARGE" : "NO_ACTION",
          };
        },
      });
      logger.log({
        event: ActionPlanLogEvent.QUICK_PLAN_COMPLETED,
        userId,
        source,
        characterCount: text.length,
        ...countPlannedActions(result.plan),
        model: result.model,
        latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
        quotaCharged: charged,
      });
      return { plan: result.plan, featureQuota, charged };
    } catch (error) {
      logger.warn({
        event: ActionPlanLogEvent.QUICK_PLAN_FAILED,
        userId,
        source,
        characterCount: text.length,
        latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
        ...(error instanceof ErrorCodedException
          ? { errorCode: error.errorCode }
          : { errorType: toErrorType(error) }),
      });
      throw error;
    }
  }
}
