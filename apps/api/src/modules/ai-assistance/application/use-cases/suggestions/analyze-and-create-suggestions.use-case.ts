import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";
import dayjs from "dayjs";
import { orderBy } from "es-toolkit";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { GridInput } from "#api/modules/weather/weather-forecast.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { resolveSuggestedCategoryId } from "../../../domain/services/suggestions/category-resolver.js";
import {
  generationCompletedLog,
  generationFailedLog,
  generationFailure,
} from "../../observability/generation/ai-generation-log.events.js";
import { AiSuggestionLogEvent } from "../../observability/suggestions/ai-suggestion-log.events.js";
import {
  AiGenerationError,
  isTransientAiFailure,
  isWithheldAiFailure,
} from "../../ports/generation/ai-generation.errors.js";
import type { AiGeneratorPort } from "../../ports/generation/ai-generator.port.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";
import { generateWithPrompt } from "../../prompts/kit/prompt-definition.js";
import { suggestionPrompt } from "../../prompts/suggestions/suggestion/index.js";
import {
  findScheduledAiConsent,
  type ScheduledAiConsentReaders,
} from "../../services/parsing/scheduled-ai-consent.js";
import type { SuggestionContextBuilder } from "../../services/suggestions/suggestion-context.builder.js";

/**
 * 사용자의 최근 할 일을 분석하여 반복 제안을 생성하는 use-case.
 *
 * 컨텍스트 수집 → 빈 기록 게이트 → AI 제안 1회 생성 →
 * 약패턴 필터·유형 캡·중복 제거 → 트랜잭션 내 기존 PENDING 교체·만료 정리·신규 저장.
 * 실행과 저장 직전에 최신 유료 자격을 확인한다.
 */
interface AnalyzeAndCreateSuggestionsDependencies {
  readonly repository: Pick<
    AiSuggestionRepositoryPort,
    "deletePending" | "deleteExpired" | "createMany"
  >;
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly aiDataSharingConsent: ScheduledAiConsentReaders["aiDataSharingConsent"];
  readonly clientAppVersion: ScheduledAiConsentReaders["clientAppVersion"];
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly contextBuilder: Pick<SuggestionContextBuilder, "build">;
  readonly logger: Pick<ApplicationLogger, "debug" | "log" | "warn">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "canInTx">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
}

export class AnalyzeAndCreateSuggestions {
  readonly #dependencies: AnalyzeAndCreateSuggestionsDependencies;

  constructor(dependencies: AnalyzeAndCreateSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    userId: string,
    timezone: string,
    weatherGrid?: GridInput | null,
    locale: SupportedLocale = "ko",
  ): Promise<number> {
    if (!(await this.#dependencies.entitlementReader.canInTx(userId, "AI_SUGGESTION"))) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: "not-premium",
      });
      return 0;
    }
    const consent = await findScheduledAiConsent(this.#dependencies, userId);
    if (!consent.allowed) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: "no-ai-consent",
      });
      return 0;
    }
    const context = await this.#dependencies.contextBuilder.build(
      userId,
      timezone,
      weatherGrid ?? null,
      locale,
    );

    if (context.todos.length === 0) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: "no-records",
      });
      return 0;
    }

    // 2. AI 제안 생성 — 비용과 채우기용 제안을 줄이기 위해 항상 1회만 호출
    const definition = suggestionPrompt;
    const logBase = {
      task: definition.id,
      promptVersion: definition.version,
      userId,
      quotaCharged: false,
    } as const;
    const startedAt = Date.now();
    const generation = await generateWithPrompt(
      this.#dependencies.generator,
      definition,
      definition.build(context, locale),
      { context, locale },
      { agreedConsentVersion: consent.agreedVersion, userId },
    ).catch((error: unknown) => {
      if (error instanceof AiGenerationError && isWithheldAiFailure(error.kind)) {
        return { skipped: error.kind } as const;
      }
      const failure = generationFailure(error);
      const settled = error instanceof AiGenerationError && !isTransientAiFailure(error.kind);
      this.#dependencies.logger.warn(
        generationFailedLog({
          ...logBase,
          outcome: settled ? "FAILED" : "RETRYING",
          ...failure,
          latencyMs: Date.now() - startedAt,
        }),
      );
      // 일시 장애만 잡 재시도로 넘긴다. 출력 오류·차단·잘림은 다시 불러도 같은 비용으로 같게 실패한다.
      if (!settled) {
        throw error;
      }
      return { skipped: failure.errorType } as const;
    });
    // 보낼 업체가 없거나 예산·킬 스위치로 멈췄거나 다시 시도해도 같은 실패면 이번 분석을 건너뛴다.
    if ("skipped" in generation) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: generation.skipped === "UNAVAILABLE" ? "provider-unavailable" : "generation-failed",
      });
      return 0;
    }
    this.#dependencies.logger.log(
      generationCompletedLog({ ...logBase, outcome: "SUCCESS" }, generation.meta),
    );
    const patterns = generation.value;

    if (patterns.length === 0) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: "no-patterns",
      });
      return 0;
    }

    const currentDate = dayjs.utc(now());
    const expiresAt = currentDate.add(AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS, "day").toDate();

    const limitedPatterns = orderBy(patterns, ["confidence"], ["desc"]).slice(
      0,
      AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER,
    );

    const createdCount = await this.#dependencies.unitOfWork.run(async () => {
      const { userMutationLock, entitlementReader } = this.#dependencies;
      if (
        !(await userMutationLock.lockById(userId)) ||
        !(await entitlementReader.canInTx(userId, "AI_SUGGESTION"))
      ) {
        return 0;
      }
      await this.#dependencies.repository.deletePending(userId);
      await this.#dependencies.repository.deleteExpired(userId);

      const { count } = await this.#dependencies.repository.createMany(
        limitedPatterns.map((pattern) => ({
          userId,
          title: pattern.title,
          daysOfWeek: pattern.daysOfWeek,
          scheduledTime: pattern.scheduledTime,
          confidence: pattern.confidence,
          reason: pattern.reason,
          matchedTodos: pattern.matchedTitles,
          expiresAt,
          suggestedCategoryId: resolveSuggestedCategoryId(
            pattern.title,
            pattern.matchedTitles,
            context.todos,
          ),
        })),
      );
      return count;
    });

    if (createdCount > 0) {
      this.#dependencies.logger.log({
        event: AiSuggestionLogEvent.SAVED,
        userId,
        patternCount: patterns.length,
        createdCount,
      });
    }

    return createdCount;
  }
}
