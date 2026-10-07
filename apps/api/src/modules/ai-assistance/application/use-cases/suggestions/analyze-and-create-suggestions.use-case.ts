import { AI_SUGGESTION_LIMITS } from "@aido/api/vocabulary";
import dayjs from "dayjs";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import { type AiProvider } from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { GridInput } from "#api/modules/weather/weather-forecast.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { type UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { resolveSuggestedCategoryId } from "../../../domain/services/suggestions/category-resolver.js";
import {
  applyTypeCap,
  dedupeByTitlePrefixAndDays,
  filterWeakPatterns,
  groundPatternCandidates,
  normalizeStarterSuggestions,
} from "../../../domain/services/suggestions/pattern-filter.js";
import { AiSuggestionLogEvent } from "../../observability/suggestions/ai-suggestion-log.events.js";
import { type AiSuggestionRepositoryPort } from "../../ports/suggestions/ai-suggestion.repository.port.js";
import { aiPromptCatalog } from "../../prompts/ai-prompt.catalog.js";
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
  readonly aiProvider: Pick<AiProvider, "generateStructured">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly contextBuilder: Pick<SuggestionContextBuilder, "build">;
  readonly logger: Pick<ApplicationLogger, "debug" | "log">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccessInTx">;
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
    if (!(await this.#dependencies.entitlementReader.hasPremiumAccessInTx(userId))) {
      this.#dependencies.logger.debug({
        event: AiSuggestionLogEvent.SKIPPED,
        userId,
        reason: "not-premium",
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
    const { build, schema, starterReason, repeatReason } = aiPromptCatalog[locale].suggestion;
    const { system, prompt } = build(context, AI_SUGGESTION_LIMITS.MIN_REPEAT_OCCURRENCES);

    const result = await this.#dependencies.aiProvider.generateStructured({
      system,
      prompt,
      schema,
      maxOutputTokens: 1500,
    });

    const isStarter = context.todos.length < AI_SUGGESTION_LIMITS.MIN_OCCURRENCES;
    const excludedTitles = context.suggestionHistory.map((history) => history.title);
    let patterns = isStarter
      ? normalizeStarterSuggestions(result.output.patterns, context)
          .map(({ pattern, recordedActivity }) => ({
            ...pattern,
            reason: starterReason(context.todos.length, recordedActivity, pattern.daysOfWeek),
          }))
          .filter((pattern) => !excludedTitles.includes(pattern.title))
      : groundPatternCandidates(
          filterWeakPatterns(result.output.patterns, context),
          context,
          excludedTitles,
        ).map(({ pattern, recordedActivity }) => ({
          ...pattern,
          reason:
            recordedActivity === null
              ? pattern.reason
              : repeatReason(recordedActivity, pattern.daysOfWeek),
        }));

    if (!isStarter) {
      patterns = applyTypeCap(patterns);
    }
    patterns = dedupeByTitlePrefixAndDays(patterns);

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

    const limitedPatterns = [...patterns]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, AI_SUGGESTION_LIMITS.MAX_SUGGESTIONS_PER_USER);

    const createdCount = await this.#dependencies.unitOfWork.run(async () => {
      const { userMutationLock, entitlementReader } = this.#dependencies;
      if (
        !(await userMutationLock.lockById(userId)) ||
        !(await entitlementReader.hasPremiumAccessInTx(userId))
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
