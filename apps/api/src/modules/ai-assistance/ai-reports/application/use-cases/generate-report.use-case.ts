import type { SupportedLocale } from "@aido/api/vocabulary";

import type { EntitlementReaderPort } from "#api/modules/access/feature-grants/access-feature-grants.public";
import type { UserMutationLockPort } from "#api/modules/identity/users/identity-users.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/timezone-name";

import {
  AiGenerationError,
  isTransientAiFailure,
  isWithheldAiFailure,
} from "../../../ai-generations/application/ai-generations.errors.js";
import {
  buildGenerationCompletedLog,
  buildGenerationFailedLog,
  toGenerationFailure,
} from "../../../ai-generations/application/ai-generations.log-events.js";
import { generateWithPrompt } from "../../../ai-generations/application/messages/prompt-definition.messages.js";
import type { AiGeneratorPort } from "../../../ai-generations/application/ports/ai-generator.port.js";
import type { CheckScheduledAiConsentUseCase } from "../../../ai-generations/application/use-cases/check-scheduled-ai-consent.use-case.js";
import { AiReport } from "../../domain/ai-report.aggregate.js";
import type {
  AggregateParams,
  ReportAggregation,
  ReportContent,
  ReportType,
} from "../../domain/ai-reports.constants.js";
import { assembleAggregatedData } from "../../domain/report-aggregation.domain-service.js";
import {
  type ReportWindow,
  resolveLastReportWindow,
} from "../../domain/report-period.domain-service.js";
import { DuplicateAiReportError } from "../ai-reports.errors.js";
import { AiReportLogEvent } from "../ai-reports.log-events.js";
import { FALLBACK_CATEGORY_NAMES } from "../messages/report-category.messages.js";
import { buildReportContext, type ReportPromptInput } from "../messages/report-context.messages.js";
import {
  buildNoAiConsentContent,
  buildFallbackContent,
  buildNoActivityContent,
} from "../messages/report-fallback.messages.js";
import { computePeriodLabel } from "../messages/report-period-label.messages.js";
import { reportPrompt } from "../messages/report-prompt.messages.js";
import { type AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import { type TodoStatsReaderPort } from "../ports/todo-stats.reader.port.js";

/**
 * AI 리포트 생성 use-case.
 *
 * 주간/월간 데이터를 집계하고 AI 분석을 수행하여 리포트를 저장한다.
 * 같은 기간 리포트가 이미 존재하면 생성하지 않고 null을 반환한다.
 */
interface GenerateReportDependencies {
  readonly aiReportRepository: Pick<
    AiReportRepositoryPort,
    "existsForPeriod" | "findLatest" | "nextId" | "save"
  >;
  readonly todoStatsReader: Pick<TodoStatsReaderPort, "fetchAggregationInputs">;
  readonly generator: Pick<AiGeneratorPort, "generate">;
  readonly scheduledAiConsent: Pick<CheckScheduledAiConsentUseCase, "execute">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "debug" | "warn" | "error">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "canInTransaction">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
}

export class GenerateReportUseCase {
  readonly #dependencies: GenerateReportDependencies;

  constructor(dependencies: GenerateReportDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: {
    userId: string;
    timezone: string;
    type: ReportType;
    locale: SupportedLocale;
    /** 잡의 마지막 시도인지. 아니면 AI 일시 오류를 던져 잡이 다시 시도하게 한다. */
    isFinalAttempt?: boolean;
  }): Promise<AiReport | null> {
    const { userId, timezone, type, locale, isFinalAttempt = true } = input;
    if (
      !(await this.#dependencies.entitlementReader.canInTransaction(
        UserId.reconstitute(userId),
        "AI_REPORT",
      ))
    ) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "not-premium",
      });
      return null;
    }
    const localToday = localDateIn(this.#dependencies.clock.now(), timezone);

    const window = resolveLastReportWindow({ type, localToday, timezone });

    const exists = await this.#dependencies.aiReportRepository.existsForPeriod({
      userId: UserId.reconstitute(userId),
      type,
      year: window.year,
      period: window.period,
    });
    if (exists) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "already-exists",
      });
      return null;
    }

    return this.#generateReport({
      userId,
      timezone,
      type,
      window,
      periodLabel: computePeriodLabel({
        type,
        year: window.year,
        period: window.period,
        locale,
        localToday,
      }),
      locale,
      isFinalAttempt,
    });
  }

  async #generateReport(params: {
    userId: string;
    timezone: string;
    locale: SupportedLocale;
    type: ReportType;
    window: ReportWindow;
    periodLabel: string;
    isFinalAttempt: boolean;
  }): Promise<AiReport | null> {
    const { userId, timezone, type, window, periodLabel, locale, isFinalAttempt } = params;
    const { startDate, endDate, prevStartDate, prevEndDate } = window;

    const [aggregatedData, prevReport] = await Promise.all([
      this.#aggregate(
        { userId, startDate, endDate, prevStartDate, prevEndDate, timezone },
        FALLBACK_CATEGORY_NAMES[locale],
      ),
      this.#dependencies.aiReportRepository.findLatest(UserId.reconstitute(userId), type),
    ]);

    // 다른 언어로 쓰인 지난 팁은 반복 판단 근거가 되지 못하고 언어를 섞게 한다.
    const previousTips =
      prevReport == null || prevReport.locale !== locale ? null : prevReport.aiTips;

    const content = await this.#generateContent(
      {
        reportData: aggregatedData,
        type,
        periodLabel,
        previousTips,
        period: { start: window.periodStart, end: window.periodEnd },
      },
      { userId, locale, isFinalAttempt },
    );

    // 외부 공급자 호출 뒤에만 transaction을 시작한다.
    const report = await this.#saveReport({
      userId,
      type,
      window,
      aggregatedData,
      content,
      locale,
    });
    if (report == null) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "save-ineligible-or-duplicate",
      });
      return null;
    }
    this.#dependencies.logger.log({
      event: AiReportLogEvent.SAVED,
      reportId: report.id.value,
      userId,
      type,
      contentSource: content.contentSource,
    });

    return report;
  }

  /** 외부 공급자 호출 뒤에만 transaction을 시작한다. 그 사이 권한이 끝났거나 같은 주기를 저장했으면 null */
  async #saveReport(params: {
    readonly userId: string;
    readonly type: ReportType;
    readonly window: ReportWindow;
    readonly aggregatedData: ReportAggregation;
    readonly content: ReportContent;
    readonly locale: SupportedLocale;
  }): Promise<AiReport | null> {
    const { userId, type, window, aggregatedData, content, locale } = params;
    const { userMutationLock, entitlementReader, aiReportRepository, unitOfWork, clock } =
      this.#dependencies;
    const owner = UserId.reconstitute(userId);
    try {
      return await unitOfWork.run(async () => {
        if (
          !(await userMutationLock.lockById(owner)) ||
          !(await entitlementReader.canInTransaction(owner, "AI_REPORT"))
        ) {
          return null;
        }
        const period = { userId: owner, type, year: window.year, period: window.period };
        if (await aiReportRepository.existsForPeriod(period)) {
          return null;
        }
        const report = AiReport.create({
          id: await aiReportRepository.nextId(),
          ...period,
          stats: {
            totalTodos: aggregatedData.totalTodos,
            completedTodos: aggregatedData.completedTodos,
            completionRate: aggregatedData.completionRate,
            prevCompletionRate: aggregatedData.prevCompletionRate,
            streakDays: aggregatedData.streakDays,
          },
          categoryBreakdown: aggregatedData.categoryBreakdown,
          dayPatterns: aggregatedData.dayPatterns,
          timePatterns: aggregatedData.timePatterns,
          aiSummary: content.aiSummary,
          aiTips: content.aiTips,
          locale,
          hasActivity: aggregatedData.hasActivity,
          contentSource: content.contentSource,
          promptVersion: content.promptVersion,
          dailyCompletions: aggregatedData.dailyCompletions,
          now: clock.now(),
        });
        await aiReportRepository.save(report);
        return report;
      });
    } catch (error) {
      if (error instanceof DuplicateAiReportError) {
        return null;
      }
      throw error;
    }
  }

  async #aggregate(
    params: AggregateParams,
    fallbackCategoryName: string,
  ): Promise<ReportAggregation> {
    const inputs = await this.#dependencies.todoStatsReader.fetchAggregationInputs(params);
    return assembleAggregatedData(inputs, params, fallbackCategoryName);
  }

  /**
   * 요약·팁 생성. 활동이 없으면 LLM 없이 템플릿을 쓴다.
   * 시스템 호출이므로 사용량 제한에 포함되지 않는다(AiGeneratorPort 직접 사용).
   * AI 일시 오류는 마지막 시도 전까지 다시 던지고, 그 밖의 실패만 폴백으로 저장한다.
   */
  async #generateContent(
    input: ReportPromptInput,
    options: { userId: string; locale: SupportedLocale; isFinalAttempt: boolean },
  ): Promise<ReportContent> {
    const { userId, locale, isFinalAttempt } = options;
    if (!input.reportData.hasActivity) {
      return buildNoActivityContent(input, locale);
    }

    const owner = UserId.reconstitute(userId);
    const consent = await this.#dependencies.scheduledAiConsent.execute(owner);
    if (!consent.allowed) {
      this.#dependencies.logger.debug({ event: AiReportLogEvent.AI_SKIPPED_NO_CONSENT, userId });
      return buildNoAiConsentContent(input, locale);
    }

    const definition = reportPrompt;
    const context = buildReportContext(input, locale);
    const logBase = {
      task: definition.id,
      promptVersion: definition.version,
      userId,
      quotaCharged: false,
    } as const;
    const startedAt = this.#dependencies.clock.now().epochMilliseconds;
    try {
      const { value, meta } = await generateWithPrompt(this.#dependencies.generator, definition, {
        built: definition.build(context, locale),
        context: { context, locale },
        agreedConsentVersion: consent.agreedVersion,
        userId: owner,
      });
      this.#dependencies.logger.log(
        buildGenerationCompletedLog({ ...logBase, outcome: "SUCCESS" }, meta),
      );
      return { ...value, contentSource: "AI", promptVersion: definition.version };
    } catch (error) {
      if (error instanceof AiGenerationError && isWithheldAiFailure(error.kind)) {
        this.#dependencies.logger.warn({
          event: AiReportLogEvent.PROVIDER_UNAVAILABLE,
          userId,
          errorType: error.kind,
        });
        return buildFallbackContent(input, locale);
      }
      const failure = toGenerationFailure(error);
      const retrying = !isFinalAttempt && isTransientAiFailure(failure.errorType);
      const failedLog = buildGenerationFailedLog({
        ...logBase,
        ...failure,
        outcome: retrying ? "RETRYING" : "FALLBACK",
        latencyMs: this.#dependencies.clock.now().epochMilliseconds - startedAt,
      });
      if (retrying) {
        this.#dependencies.logger.warn(failedLog);
        throw error;
      }
      this.#dependencies.logger.error(failedLog);
      return buildFallbackContent(input, locale);
    }
  }
}
