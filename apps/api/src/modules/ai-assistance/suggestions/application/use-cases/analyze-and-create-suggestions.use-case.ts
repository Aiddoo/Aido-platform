import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";
import { orderBy } from "es-toolkit";

import type { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { GridInput } from "#api/modules/weather/forecasts/weather-forecasts.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";

import {
  AiGenerationError,
  isTransientAiFailure,
  isWithheldAiFailure,
} from "../../../generation/application/ai-generation.errors.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
  toGenerationFailure,
} from "../../../generation/application/ai-generation.log-events.js";
import { generateWithPrompt } from "../../../generation/application/messages/prompt-definition.messages.js";
import type { AiGeneratorPort } from "../../../generation/application/ports/ai-generator.port.js";
import type { ScheduledAiConsentReader } from "../../../generation/application/scheduled-ai-consent.reader.js";
import { resolveSuggestedCategoryId } from "../../domain/category-resolver.domain-service.js";
import { Suggestion } from "../../domain/suggestion.aggregate.js";
import { AiSuggestionLogEvent } from "../ai-suggestion.log-events.js";
import { suggestionPrompt } from "../messages/suggestion-prompt.messages.js";
import { type SuggestionRepositoryPort } from "../ports/suggestion.repository.port.js";
import type { SuggestionContextReader } from "../suggestion-context.reader.js";

/**
 * 사용자의 최근 할 일을 분석하여 반복 제안을 생성하는 use-case.
 *
 * 컨텍스트 수집 → 빈 기록 게이트 → AI 제안 1회 생성 →
 * 약패턴 필터·유형 캡·중복 제거 → 트랜잭션 내 기존 PENDING 교체·만료 정리·신규 저장.
 * 실행과 저장 직전에 최신 유료 자격을 확인한다.
 */
interface AnalyzeAndCreateSuggestionsDependencies {
  readonly repository: Pick<
    SuggestionRepositoryPort,
    "deletePendingByUserId" | "deleteExpiredByUserId" | "nextIds" | "saveMany"
  >;
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly scheduledAiConsent: Pick<ScheduledAiConsentReader, "find">;
  readonly clock: ClockPort;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly contextBuilder: Pick<SuggestionContextReader, "build">;
  readonly logger: Pick<ApplicationLoggerPort, "debug" | "log" | "warn">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "canInTx">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
}

export interface AnalyzeAndCreateSuggestionsCommand {
  readonly userId: string;
  readonly timezone: string;
  /** dispatcher가 미리 조회한 KMA 격자 좌표 (위치 미설정 시 null) */
  readonly weatherGrid?: GridInput | null;
  readonly locale?: SupportedLocale;
}

export class AnalyzeAndCreateSuggestionsUseCase {
  readonly #dependencies: AnalyzeAndCreateSuggestionsDependencies;

  constructor(dependencies: AnalyzeAndCreateSuggestionsDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: AnalyzeAndCreateSuggestionsCommand): Promise<number> {
    const { userId, timezone, weatherGrid = null, locale = "ko" } = command;
    if (
      !(await this.#dependencies.entitlementReader.canInTx(
        UserId.reconstitute(userId),
        "AI_SUGGESTION",
      ))
    ) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: "not-premium",
      });
      return 0;
    }
    const consent = await this.#dependencies.scheduledAiConsent.find(userId);
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
    const startedAt = this.#dependencies.clock.now().epochMilliseconds;
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
      const failure = toGenerationFailure(error);
      const settled = error instanceof AiGenerationError && !isTransientAiFailure(error.kind);
      this.#dependencies.logger.warn(
        buildGenerationFailedLog({
          ...logBase,
          outcome: settled ? "FAILED" : "RETRYING",
          ...failure,
          latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
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
      buildGenerationCompletedLog({ ...logBase, outcome: "SUCCESS" }, generation.meta),
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

    const now = this.#dependencies.clock.now();
    const expiresAt = now.add({ hours: AI_SUGGESTION_LIMITS.SUGGESTION_EXPIRY_DAYS * 24 });
    const owner = UserId.reconstitute(userId);

    const limitedPatterns = orderBy(patterns, ["confidence"], ["desc"]).slice(
      0,
      AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER,
    );

    const createdCount = await this.#dependencies.unitOfWork.run(async () => {
      const { userMutationLock, entitlementReader } = this.#dependencies;
      if (
        !(await userMutationLock.lockById(owner)) ||
        !(await entitlementReader.canInTx(owner, "AI_SUGGESTION"))
      ) {
        return 0;
      }
      const { repository } = this.#dependencies;
      await repository.deletePendingByUserId(owner);
      await repository.deleteExpiredByUserId(owner, now);

      const ids = await repository.nextIds(limitedPatterns.length);
      const suggestions = limitedPatterns.flatMap((pattern, index) => {
        const id = ids[index];
        return id == null
          ? []
          : [
              Suggestion.create({
                id,
                userId: owner,
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
                now,
              }),
            ];
      });
      await repository.saveMany(suggestions);
      return suggestions.length;
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
