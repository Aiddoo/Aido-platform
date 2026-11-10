import type { QuickPlanResponse } from "@aido/api";
import type { QuickPlanSource } from "@aido/api/vocabulary";

import {
  fingerprintRequest,
  resolveRequestLocale,
  type UserLocalePreferenceReaderPort,
} from "#api/modules/ai-assistance/parsing/ai-assistance-parsing.public";
import type { ActionPlanGeneratorPort } from "#api/modules/ai-assistance/planning/ai-assistance-planning.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import type { SupportedLocale } from "#api/shared/domain/locale";

import type { QuotaChargedPlanRunnerAdapter } from "../../infrastructure/adapters/quota-charged-plan-runner.adapter.js";
import type { PlanResultReplayPort } from "../ports/plan-result-replay.port.js";
import type { PlanningContextReaderPort } from "../ports/planning-context.reader.port.js";
import { countPlannedActions, toActionPlanView } from "../read-models/action-plan.read-model.js";
import { VoiceLogEvent } from "../voice.log-events.js";

/** `model`은 다시 보낸 응답의 로그에도 남기려고 함께 보관하고, 응답에는 싣지 않는다. */
export type QuickPlanResult = Pick<QuickPlanResponse, "plan"> & { readonly model: string };

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

interface CreateQuickPlanDependencies {
  readonly runner: Pick<QuotaChargedPlanRunnerAdapter, "run">;
  readonly generator: Pick<ActionPlanGeneratorPort, "generateQuickPlan">;
  readonly contextReader: Pick<PlanningContextReaderPort, "read">;
  readonly localePreferenceReader: Pick<UserLocalePreferenceReaderPort, "read">;
  readonly replay: PlanResultReplayPort<QuickPlanResult>;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "warn">;
}

/** 짧은 말·글 → 실행 계획. 할 일을 찾지 못하면 환불한다. 저장은 사용자가 확인한 뒤 적용 API가 한다. */
export class CreateQuickPlanUseCase {
  readonly #dependencies: CreateQuickPlanDependencies;

  constructor(dependencies: CreateQuickPlanDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateQuickPlanCommand): Promise<QuickPlanResponse> {
    const { runner, generator, contextReader, localePreferenceReader, replay, logger } =
      this.#dependencies;
    const { userId, text, source, idempotencyKey } = input;
    const startedAt = Date.now();
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
              plan: toActionPlanView(generation.plan, context.upcomingTodos),
              model: generation.meta.model,
            },
            outcome: generation.plan.todos.length > 0 ? "CHARGE" : "NO_ACTION",
          };
        },
      });
      logger.log({
        event: VoiceLogEvent.QUICK_PLAN_COMPLETED,
        userId,
        source,
        characterCount: text.length,
        ...countPlannedActions(result.plan),
        model: result.model,
        latencyMs: Date.now() - startedAt,
        quotaCharged: charged,
      });
      return { plan: result.plan, featureQuota, charged };
    } catch (error) {
      logger.warn({
        event: VoiceLogEvent.QUICK_PLAN_FAILED,
        userId,
        source,
        characterCount: text.length,
        latencyMs: Date.now() - startedAt,
        ...(error instanceof ErrorCodedException
          ? { errorCode: error.errorCode }
          : { errorType: toErrorType(error) }),
      });
      throw error;
    }
  }
}
