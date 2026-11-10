import dayjs from "dayjs";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import type { SupportedLocale } from "#api/shared/domain/locale";
import { instantToDate } from "#api/shared/domain/time/instant";

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
import { AiReport } from "../../domain/ai-report.aggregate.js";
import type {
  AggregatedReportData,
  AggregateParams,
  ReportContent,
  ReportType,
} from "../../domain/ai-report.constants.js";
import { assembleAggregatedData } from "../../domain/report-aggregation.domain-service.js";
import { AiReportLogEvent } from "../ai-report.log-events.js";
import {
  buildNoAiConsentContent,
  buildFallbackContent,
  buildNoActivityContent,
} from "../messages/report-fallback.messages.js";
import { computePeriodLabel } from "../messages/report-period-label.messages.js";
import { reportPrompt, type ReportPromptInput } from "../messages/report-prompt.messages.js";
import { type AiReportRepositoryPort } from "../ports/ai-report.repository.port.js";
import { type TodoStatsReaderPort } from "../ports/todo-stats.reader.port.js";
import { DuplicateAiReportError } from "../reports.errors.js";

interface ReportWindow {
  year: number;
  period: number;
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
  /** 사용자 로컬 기간 첫날·마지막 날 (YYYY-MM-DD) */
  periodStart: string;
  periodEnd: string;
}

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
  readonly scheduledAiConsent: Pick<ScheduledAiConsentReader, "find">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log" | "debug" | "warn" | "error">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "canInTx">;
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
    locale?: SupportedLocale;
    /** 잡의 마지막 시도인지. 아니면 AI 일시 오류를 던져 잡이 다시 시도하게 한다. */
    isFinalAttempt?: boolean;
  }): Promise<AiReport | null> {
    const { userId, timezone, type, locale = "ko", isFinalAttempt = true } = input;
    if (!(await this.#dependencies.entitlementReader.canInTx(userId, "AI_REPORT"))) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "not-premium",
      });
      return null;
    }
    const localNow = dayjs(instantToDate(this.#dependencies.clock.now())).tz(timezone);

    const window =
      type === "WEEKLY"
        ? this.#weeklyWindow(localNow, timezone)
        : this.#monthlyWindow(localNow, timezone);

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
      periodLabel: computePeriodLabel(type, window.year, window.period, locale),
      locale,
      isFinalAttempt,
    });
  }

  /** 지난 주(월~일) 윈도우 */
  #weeklyWindow(localNow: dayjs.Dayjs, timezone: string): ReportWindow {
    // 달력 label을 먼저 계산하고 각 경계를 다시 타임존에 적용해 DST offset을 갱신한다.
    const lastWeekStart = dayjs
      .utc(localNow.format("YYYY-MM-DD"))
      .subtract(1, "week")
      .startOf("isoWeek");
    const lastWeekEnd = lastWeekStart.add(1, "week");
    const prevWeekStart = lastWeekStart.subtract(1, "week");
    const prevWeekEnd = lastWeekStart;
    return {
      year: lastWeekStart.isoWeekYear(),
      period: lastWeekStart.isoWeek(),
      startDate: parseLocalDateTime(lastWeekStart.format("YYYY-MM-DD"), "00:00", timezone),
      endDate: parseLocalDateTime(lastWeekEnd.format("YYYY-MM-DD"), "00:00", timezone),
      prevStartDate: parseLocalDateTime(prevWeekStart.format("YYYY-MM-DD"), "00:00", timezone),
      prevEndDate: parseLocalDateTime(prevWeekEnd.format("YYYY-MM-DD"), "00:00", timezone),
      periodStart: lastWeekStart.format("YYYY-MM-DD"),
      periodEnd: lastWeekEnd.subtract(1, "day").format("YYYY-MM-DD"),
    };
  }

  #monthlyWindow(localNow: dayjs.Dayjs, timezone: string): ReportWindow {
    const lastMonth = dayjs.utc(localNow.format("YYYY-MM-DD")).subtract(1, "month");
    const lastMonthStart = lastMonth.startOf("month");
    const lastMonthEnd = lastMonthStart.add(1, "month");
    const prevMonthStart = lastMonthStart.subtract(1, "month");
    const prevMonthEnd = lastMonthStart;
    return {
      year: lastMonthStart.year(),
      period: lastMonthStart.month() + 1,
      startDate: parseLocalDateTime(lastMonthStart.format("YYYY-MM-DD"), "00:00", timezone),
      endDate: parseLocalDateTime(lastMonthEnd.format("YYYY-MM-DD"), "00:00", timezone),
      prevStartDate: parseLocalDateTime(prevMonthStart.format("YYYY-MM-DD"), "00:00", timezone),
      prevEndDate: parseLocalDateTime(prevMonthEnd.format("YYYY-MM-DD"), "00:00", timezone),
      periodStart: lastMonthStart.format("YYYY-MM-DD"),
      periodEnd: lastMonthEnd.subtract(1, "day").format("YYYY-MM-DD"),
    };
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
      this.#aggregate({
        userId,
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        timezone,
      }),
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
    readonly aggregatedData: AggregatedReportData;
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
          !(await userMutationLock.lockById(userId)) ||
          !(await entitlementReader.canInTx(userId, "AI_REPORT"))
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

  /**
   * 데이터 집계: 할 일 통계 읽기 포트로 원시 집계를 조회하고 도메인 서비스로 계산.
   */
  async #aggregate(params: AggregateParams): Promise<AggregatedReportData> {
    const inputs = await this.#dependencies.todoStatsReader.fetchAggregationInputs(params);
    return assembleAggregatedData(inputs, params.startDate, params.endDate, params.timezone);
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

    const consent = await this.#dependencies.scheduledAiConsent.find(userId);
    if (!consent.allowed) {
      this.#dependencies.logger.debug({ event: AiReportLogEvent.AI_SKIPPED_NO_CONSENT, userId });
      return buildNoAiConsentContent(input, locale);
    }

    const definition = reportPrompt;
    const logBase = {
      task: definition.id,
      promptVersion: definition.version,
      userId,
      quotaCharged: false,
    } as const;
    const startedAt = this.#dependencies.clock.now().epochMilliseconds;
    try {
      const { value, meta } = await generateWithPrompt(
        this.#dependencies.generator,
        definition,
        definition.build(input, locale),
        { input, locale },
        { agreedConsentVersion: consent.agreedVersion, userId },
      );
      this.#dependencies.logger.log(
        buildGenerationCompletedLog({ ...logBase, outcome: "SUCCESS" }, meta),
      );
      return { ...value, contentSource: "AI", promptVersion: definition.version };
    } catch (error) {
      if (error instanceof AiGenerationError && isWithheldAiFailure(error.kind)) {
        this.#dependencies.logger.warn({
          event: AiReportLogEvent.PROVIDER_UNAVAILABLE,
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
