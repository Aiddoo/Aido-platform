import type { AiReport as AiReportDto } from "@aido/api";
import dayjs from "dayjs";

import type { EntitlementReaderPort } from "#api/modules/access/access-entitlement.public";
import {
  type AiProvider,
  AiProviderError,
  canRunScheduledAi,
  type ScheduledAiConsentReaders,
} from "#api/modules/ai-assistance/ai-assistance-parsing.public";
import type { UserMutationLockPort } from "#api/modules/identity/identity-user-access.public";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { parseLocalDateTime } from "#api/shared/domain/date/utils/timezone";
import type { SupportedLocale } from "#api/shared/domain/locale";

import { assembleAggregatedData } from "../../../domain/services/reports/report-aggregation.js";
import type {
  AggregatedReportData,
  AggregateParams,
  ReportContent,
  ReportType,
} from "../../../domain/types/reports/ai-report.types.js";
import {
  generationCompletedLog,
  generationFailedLog,
} from "../../observability/parsing/ai-generation-log.events.js";
import { AiReportLogEvent } from "../../observability/reports/ai-report-log.events.js";
import type { AiTaskSettings } from "../../ports/parsing/ai-task-settings.port.js";
import { type AiReportRepositoryPort } from "../../ports/reports/ai-report.repository.port.js";
import { type TodoStatsReaderPort } from "../../ports/reports/todo-stats.reader.port.js";
import { reportPrompts, type ReportPromptInput } from "../../prompts/reports/report/index.js";
import { toAiReportView } from "../../read-models/reports/ai-report.read-model.js";
import { computePeriodLabel } from "../../read-models/reports/report-period-label.js";
import { resolveGenerationPolicy } from "../../services/parsing/ai-generation-policy.js";
import {
  buildNoAiConsentContent,
  buildFallbackContent,
  buildNoActivityContent,
} from "../../services/reports/report-fallback.js";

/** 잡 재시도로 회복될 수 있는 공급자 오류 */
const TRANSIENT_PROVIDER_ERRORS: ReadonlySet<string> = new Set([
  "RATE_LIMITED",
  "UPSTREAM",
  "TIMEOUT",
]);

/** 기간 윈도우 계산 결과 */
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
  readonly aiReportRepository: Pick<AiReportRepositoryPort, "exists" | "findLatest" | "create">;
  readonly todoStatsReader: Pick<TodoStatsReaderPort, "fetchAggregationInputs">;
  readonly aiProvider: Pick<AiProvider, "isAvailable" | "generateStructured">;
  readonly aiDataSharingConsent: ScheduledAiConsentReaders["aiDataSharingConsent"];
  readonly clientAppVersion: ScheduledAiConsentReaders["clientAppVersion"];
  readonly logger: Pick<ApplicationLogger, "log" | "debug" | "warn" | "error">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "hasPremiumAccessInTx">;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly settings: AiTaskSettings;
}

export class GenerateReport {
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
  }): Promise<AiReportDto | null> {
    const { userId, timezone, type, locale = "ko", isFinalAttempt = true } = input;
    if (!(await this.#dependencies.entitlementReader.hasPremiumAccessInTx(userId))) {
      this.#dependencies.logger.debug({
        event: AiReportLogEvent.SKIPPED,
        userId,
        type,
        reason: "not-premium",
      });
      return null;
    }
    const localNow = dayjs(now()).tz(timezone);

    const window =
      type === "WEEKLY"
        ? this.#weeklyWindow(localNow, timezone)
        : this.#monthlyWindow(localNow, timezone);

    const exists = await this.#dependencies.aiReportRepository.exists(
      userId,
      type,
      window.year,
      window.period,
    );
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

  /** 지난 달 윈도우 */
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

  /**
   * 리포트 생성 오케스트레이션
   */
  async #generateReport(params: {
    userId: string;
    timezone: string;
    locale: SupportedLocale;
    type: ReportType;
    window: ReportWindow;
    periodLabel: string;
    isFinalAttempt: boolean;
  }): Promise<AiReportDto | null> {
    const { userId, timezone, type, window, periodLabel, locale, isFinalAttempt } = params;
    const { year, period, startDate, endDate, prevStartDate, prevEndDate } = window;

    const [aggregatedData, prevReport] = await Promise.all([
      this.#aggregate({
        userId,
        startDate,
        endDate,
        prevStartDate,
        prevEndDate,
        timezone,
      }),
      this.#dependencies.aiReportRepository.findLatest(userId, type),
    ]);

    // 다른 언어로 쓰인 지난 팁은 반복 판단 근거가 되지 못하고 언어를 섞게 한다.
    const prevTips =
      prevReport == null || prevReport.snapshot.locale !== locale ? null : prevReport.aiTips;

    const content = await this.#generateContent(
      {
        data: aggregatedData,
        type,
        periodLabel,
        prevTips,
        period: { start: window.periodStart, end: window.periodEnd },
      },
      { userId, locale, isFinalAttempt },
    );

    // 외부 공급자 호출 뒤에만 transaction을 시작한다.
    const report = await this.#dependencies.unitOfWork.run(async () => {
      const { userMutationLock, entitlementReader, aiReportRepository } = this.#dependencies;
      if (
        !(await userMutationLock.lockById(userId)) ||
        !(await entitlementReader.hasPremiumAccessInTx(userId))
      ) {
        return null;
      }
      if (await aiReportRepository.exists(userId, type, year, period)) return null;
      return aiReportRepository.create({
        userId,
        type,
        year,
        period,
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
        generatedAt: now(),
        contentSource: content.contentSource,
        promptVersion: content.promptVersion,
      });
    });
    if (report === null) {
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
      reportId: report.id,
      userId,
      type,
      contentSource: content.contentSource,
    });

    return toAiReportView(report);
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
   * 시스템 호출이므로 사용량 제한에 포함되지 않는다(AI_PROVIDER 직접 사용).
   * AI 일시 오류는 마지막 시도 전까지 다시 던지고, 그 밖의 실패만 폴백으로 저장한다.
   */
  async #generateContent(
    input: ReportPromptInput,
    options: { userId: string; locale: SupportedLocale; isFinalAttempt: boolean },
  ): Promise<ReportContent> {
    const { userId, locale, isFinalAttempt } = options;
    if (!input.data.hasActivity) return buildNoActivityContent(input, locale);

    if (!(await canRunScheduledAi(this.#dependencies, userId))) {
      this.#dependencies.logger.debug({ event: AiReportLogEvent.AI_SKIPPED_NO_CONSENT, userId });
      return buildNoAiConsentContent(input, locale);
    }

    if (!this.#dependencies.aiProvider.isAvailable()) {
      this.#dependencies.logger.warn({ event: AiReportLogEvent.PROVIDER_UNAVAILABLE });
      return buildFallbackContent(input, locale);
    }

    const definition = reportPrompts[this.#dependencies.settings.promptVersion][locale];
    const logBase = {
      task: "report",
      promptVersion: definition.promptVersion,
      userId,
      quotaCharged: false,
    } as const;
    const startedAt = Date.now();
    try {
      const { system, prompt } = definition.build(input);
      const { value, meta } = await definition.output.generate(
        this.#dependencies.aiProvider,
        {
          task: "report",
          promptVersion: definition.promptVersion,
          system,
          prompt,
          policy: resolveGenerationPolicy("report", this.#dependencies.settings),
        },
        input,
      );
      this.#dependencies.logger.log(
        generationCompletedLog({ ...logBase, outcome: "SUCCESS" }, meta),
      );
      return { ...value, contentSource: "AI", promptVersion: definition.promptVersion };
    } catch (error) {
      const errorKind = error instanceof AiProviderError ? error.kind : "INVALID_OUTPUT";
      const retrying = !isFinalAttempt && TRANSIENT_PROVIDER_ERRORS.has(errorKind);
      const failedLog = generationFailedLog({
        ...logBase,
        outcome: retrying ? "RETRYING" : "FALLBACK",
        errorKind,
        statusCode: error instanceof AiProviderError ? error.statusCode : undefined,
        latencyMs: Date.now() - startedAt,
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
